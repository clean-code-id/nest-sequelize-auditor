// Sequelize hooks for automatic audit trail creation

import { Model, ModelStatic, Sequelize, WhereOptions } from 'sequelize';
import { RequestContext } from '../request-context.js';
import { writeAudit, writeBulkAudit } from '../utils/writeAudit.js';
import type { AuditConfig, AuditModuleOptions } from '../types.js';
import { AuditEvent } from '../types.js';

// Types for Sequelize index metadata
interface IndexInfo {
  name?: string;
  Key_name?: string;
}

// Types for bulk hook options
interface BulkHookOptions {
  where?: WhereOptions;
  attributes?: Record<string, unknown>;
  affectedRows?: number;
}

// Flag to track if audit model has been initialized
let auditModelInitialized = false;

// Helper function to check if an event should be audited
function shouldAuditEvent(event: AuditEvent, config: AuditConfig): boolean {
  // If no auditEvents specified, audit all events (default behavior)
  if (!config.auditEvents || config.auditEvents.length === 0) {
    return true;
  }

  // Check if the event is in the allowed events list
  return config.auditEvents.includes(event);
}

// Global audit options that get set by AuditModule.forRoot()
let globalAuditOptions: AuditModuleOptions = { autoSync: true, alterTable: false };

// Flag to ensure we only check indexes once per application startup
let indexCheckCompleted = false;

/**
 * Sets the global audit options (called by AuditModule)
 */
export function setGlobalAuditOptions(options: AuditModuleOptions): void {
  globalAuditOptions = options;
}

/**
 * Gets the global audit options (used by decorators)
 */
export function getGlobalAuditOptions(): AuditModuleOptions {
  return globalAuditOptions;
}

/**
 * Checks if required indexes exist on the audit table.
 * Logs a warning if indexes are missing to help users discover they need to migrate.
 */
async function checkAuditIndexes(sequelize: Sequelize, tableName: string): Promise<void> {
  if (indexCheckCompleted) {
    return;
  }
  indexCheckCompleted = true;

  try {
    const queryInterface = sequelize.getQueryInterface();
    const indexes = await queryInterface.showIndex(tableName);

    const requiredIndexPatterns = [
      `idx_${tableName}_creator_lookup`,
    ];

    const existingIndexNames = (indexes as IndexInfo[])
      .map((idx) => idx.name || idx.Key_name)
      .filter((name): name is string => typeof name === 'string');

    // Check both the default naming and custom table naming patterns
    const missingIndexes = requiredIndexPatterns.filter((pattern) => {
      // Check for exact match or the audits_ version if table name is different
      return !existingIndexNames.some(
        (name) => name === pattern || name === pattern.replace(`idx_${tableName}_`, 'idx_audits_')
      );
    });

    if (missingIndexes.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(`
⚠️  [AuditModule] PERFORMANCE WARNING: Missing index on '${tableName}' table

Your audit table is missing the essential index for query performance.
This commonly happens when upgrading from an older package version.

Run this SQL in your database client to add the missing index:

  CREATE INDEX idx_${tableName}_creator_lookup ON ${tableName}(auditable_type, auditable_id, event);

⚠️  For large tables (millions of rows), adding indexes may take several minutes
   and lock the table. Plan accordingly.
`);
    }
  } catch {
    // Silently ignore index check failures - this is non-critical
    // Table might not exist yet or other edge cases
  }
}

/**
 * Ensures the audit model is initialized exactly once across the entire application.
 * Uses the configuration from AuditModule.forRoot() to determine behavior.
 */
async function ensureAuditModelInitialized<T extends Model>(model: ModelStatic<T>): Promise<void> {
  if (auditModelInitialized) {
    return;
  }
  auditModelInitialized = true;

  try {
    const sequelize = model.sequelize;
    if (!sequelize) {
      throw new Error('No Sequelize instance found on model');
    }

    const { defineAuditModel } = await import('../model/defineAuditModel.js');
    const { setAuditModel } = await import('../utils/writeAudit.js');

    const AuditModel = defineAuditModel(sequelize, {
      tableName: globalAuditOptions.tableName || 'audits',
    });

    setAuditModel(AuditModel);

    if (globalAuditOptions.autoSync !== false) {
      await AuditModel.sync({ alter: globalAuditOptions.alterTable ?? false });
      // eslint-disable-next-line no-console
      console.log('🎉 AuditModule: Audit table created successfully via autoSync option!');

      const tableName = globalAuditOptions.tableName || 'audits';
      await checkAuditIndexes(sequelize, tableName);
    } else {
      // eslint-disable-next-line no-console
      console.log(
        '📋 AuditModule: Audit model registered (autoSync disabled in AuditModule.forRoot)'
      );
    }
  } catch (error) {
    auditModelInitialized = false; // Allow retry on failure
    // eslint-disable-next-line no-console
    console.error('❌ AuditModule: Failed to initialize audit model:', error);
    throw error;
  }
}

/**
 * Attaches audit hooks to a Sequelize model.
 * The first call to this function will also initialize the audit table.
 * Subsequent calls will only attach hooks without any database operations.
 */
export function attachAuditHooks<T extends Model>(
  model: ModelStatic<T>,
  config: AuditConfig = {}
): void {
  // Initialize audit table on first hook attachment (happens once per application)
  // This is triggered by the first service that calls attachAuditHooks during onModuleInit
  ensureAuditModelInitialized(model).catch((error) => {
    // eslint-disable-next-line no-console
    console.error('❌ AuditSystem: Failed to initialize audit model:', error);
  });
  const modelName = model.name;

  // After create hook
  model.addHook('afterCreate', async (instance: T) => {
    if (!shouldAuditEvent(AuditEvent.CREATED, config)) {
      return;
    }

    const context = RequestContext.getContext();
    await writeAudit({
      event: 'created',
      auditableType: modelName,
      auditableId: instance.get('id') as string | number,
      newValues: instance.dataValues,
      context,
      config,
      globalConfig: globalAuditOptions,
    });
  });

  // After update hook
  model.addHook('afterUpdate', async (instance: T) => {
    if (!shouldAuditEvent(AuditEvent.UPDATED, config)) {
      return;
    }

    const context = RequestContext.getContext();
    await writeAudit({
      event: 'updated',
      auditableType: modelName,
      auditableId: instance.get('id') as string | number,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      oldValues: (instance as any)._previousDataValues,
      newValues: instance.dataValues,
      context,
      config,
      globalConfig: globalAuditOptions,
    });
  });

  // After delete hook
  model.addHook('afterDestroy', async (instance: T) => {
    if (!shouldAuditEvent(AuditEvent.DELETED, config)) {
      return;
    }

    const context = RequestContext.getContext();
    await writeAudit({
      event: 'deleted',
      auditableType: modelName,
      auditableId: instance.get('id') as string | number,
      oldValues: instance.dataValues,
      context,
      config,
      globalConfig: globalAuditOptions,
    });
  });

  // After restore hook (for soft deletes)
  model.addHook('afterRestore', async (instance: T) => {
    if (!shouldAuditEvent(AuditEvent.RESTORED, config)) {
      return;
    }

    const context = RequestContext.getContext();
    await writeAudit({
      event: 'restored',
      auditableType: modelName,
      auditableId: instance.get('id') as string | number,
      newValues: instance.dataValues,
      context,
      config,
      globalConfig: globalAuditOptions,
    });
  });

  // After bulk create hook
  model.addHook('afterBulkCreate', async (instances: T[]) => {
    if (!shouldAuditEvent(AuditEvent.CREATED, config)) {
      return;
    }

    const context = RequestContext.getContext();
    await writeBulkAudit({
      event: 'created',
      auditableType: modelName,
      instances,
      context,
      config,
      globalConfig: globalAuditOptions,
      affectedCount: instances.length,
    });
  });

  // Store records before bulk operations
  let recordsToUpdate: T[] = [];
  let recordsToDelete: T[] = [];

  // Before bulk update hook - capture records that will be updated
  model.addHook('beforeBulkUpdate', async (options: BulkHookOptions) => {
    if (!shouldAuditEvent(AuditEvent.UPDATED, config)) {
      return;
    }

    try {
      // Find all records that match the where clause before they're updated
      recordsToUpdate = await model.findAll({ where: options.where });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to capture records before bulk update:', error);
      recordsToUpdate = [];
    }
  });

  // After bulk update hook
  model.addHook('afterBulkUpdate', async (options: BulkHookOptions) => {
    if (!shouldAuditEvent(AuditEvent.UPDATED, config)) {
      return;
    }

    const context = RequestContext.getContext();

    // For onlyDirty: false, we need to fetch the complete updated records
    let updatedRecords: T[] = [];
    const onlyDirty = config.onlyDirty ?? globalAuditOptions?.onlyDirty ?? false;

    if (!onlyDirty && recordsToUpdate.length > 0) {
      try {
        // Fetch the updated records to get their complete state
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recordIds = recordsToUpdate.map((record) => (record as any).id);
        updatedRecords = await model.findAll({ where: { id: recordIds } as WhereOptions });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch updated records for complete state:', error);
        updatedRecords = [];
      }
    }

    await writeBulkAudit({
      event: 'updated',
      auditableType: modelName,
      context,
      config,
      globalConfig: globalAuditOptions,
      affectedCount: options.affectedRows || recordsToUpdate.length,
      where: options.where,
      newValues: options.attributes,
      affectedRecords: recordsToUpdate,
      updatedRecords: updatedRecords.length > 0 ? updatedRecords : undefined,
    });

    // Clear the captured records
    recordsToUpdate = [];
  });

  // Before bulk destroy hook - capture records that will be deleted
  model.addHook('beforeBulkDestroy', async (options: BulkHookOptions) => {
    if (!shouldAuditEvent(AuditEvent.DELETED, config)) {
      return;
    }

    try {
      // Find all records that match the where clause before they're deleted
      recordsToDelete = await model.findAll({ where: options.where });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to capture records before bulk delete:', error);
      recordsToDelete = [];
    }
  });

  // After bulk destroy hook
  model.addHook('afterBulkDestroy', async (options: BulkHookOptions) => {
    if (!shouldAuditEvent(AuditEvent.DELETED, config)) {
      return;
    }

    const context = RequestContext.getContext();
    await writeBulkAudit({
      event: 'deleted',
      auditableType: modelName,
      context,
      config,
      globalConfig: globalAuditOptions,
      affectedCount: options.affectedRows || recordsToDelete.length,
      where: options.where,
      affectedRecords: recordsToDelete,
    });

    // Clear the captured records
    recordsToDelete = [];
  });
}
