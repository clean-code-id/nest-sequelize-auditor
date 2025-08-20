// Sequelize hooks for automatic audit trail creation

import { Model, ModelCtor } from 'sequelize';
import { RequestContext } from '../request-context.js';
import { writeAudit, writeBulkAudit } from '../utils/writeAudit.js';
import type { AuditConfig } from '../types.js';
import { AuditEvent } from '../types.js';

// Global flag to track if audit model has been initialized across the entire application
// This ensures the audit table is created only once, regardless of how many services use attachAuditHooks
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
let globalAuditOptions: any = { autoSync: true, alterTable: false };

/**
 * Sets the global audit options (called by AuditModule)
 */
export function setGlobalAuditOptions(options: any): void {
  globalAuditOptions = options;
}

/**
 * Ensures the audit model is initialized exactly once across the entire application.
 * Uses the configuration from AuditModule.forRoot() to determine behavior.
 */
async function ensureAuditModelInitialized<T extends Model>(model: ModelCtor<T>): Promise<void> {
  if (auditModelInitialized) {
    return; // Already initialized - no database operations needed
  }

  try {
    // Get the Sequelize instance from the model
    const sequelize = model.sequelize;
    if (!sequelize) {
      throw new Error('No Sequelize instance found on model');
    }

    // Initialize audit model using the global options from AuditModule.forRoot()
    try {
      const { defineAuditModel } = await import('../model/defineAuditModel.js');
      const { setAuditModel } = await import('../utils/writeAudit.js');

      // Create and register audit model with the Sequelize instance
      const AuditModel = defineAuditModel(sequelize, {
        tableName: globalAuditOptions.tableName || 'audits',
      });

      // Set the global audit model for the package
      setAuditModel(AuditModel);

      // Auto-sync the audit table if enabled (from AuditModule.forRoot options)
      if (globalAuditOptions.autoSync !== false) {
        await AuditModel.sync({ alter: globalAuditOptions.alterTable ?? false });
        // eslint-disable-next-line no-console
        console.log('🎉 AuditModule: Audit table created successfully via autoSync option!');
      } else {
        // eslint-disable-next-line no-console
        console.log('📋 AuditModule: Audit model registered (autoSync disabled in AuditModule.forRoot)');
      }

      auditModelInitialized = true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ AuditModule: Failed to initialize audit model:', error);
      throw error;
    }
  } catch (error) {
    // eslint-disable-next-line no-console  
    console.error('❌ AuditModule: Failed to ensure audit model initialization:', error);
    throw error;
  }
}

/**
 * Attaches audit hooks to a Sequelize model.
 * The first call to this function will also initialize the audit table.
 * Subsequent calls will only attach hooks without any database operations.
 */
export function attachAuditHooks<T extends Model>(
  model: ModelCtor<T>,
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
  model.addHook('beforeBulkUpdate', async (options: any) => {
    if (!shouldAuditEvent(AuditEvent.UPDATED, config)) {
      return;
    }
    
    try {
      // Find all records that match the where clause before they're updated
      recordsToUpdate = await model.findAll({ where: options.where });
    } catch (error) {
      console.error('Failed to capture records before bulk update:', error);
      recordsToUpdate = [];
    }
  });

  // After bulk update hook
  model.addHook('afterBulkUpdate', async (options: any) => {
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
        const recordIds = recordsToUpdate.map(record => record.get ? record.get('id') : (record as any).id);
        updatedRecords = await model.findAll({ where: { id: recordIds } as any });
      } catch (error) {
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
  model.addHook('beforeBulkDestroy', async (options: any) => {
    if (!shouldAuditEvent(AuditEvent.DELETED, config)) {
      return;
    }
    
    try {
      // Find all records that match the where clause before they're deleted
      recordsToDelete = await model.findAll({ where: options.where });
    } catch (error) {
      console.error('Failed to capture records before bulk delete:', error);
      recordsToDelete = [];
    }
  });

  // After bulk destroy hook
  model.addHook('afterBulkDestroy', async (options: any) => {
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