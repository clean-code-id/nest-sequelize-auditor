// Sequelize hooks for automatic audit trail creation

import { Model, ModelCtor } from 'sequelize';
import { RequestContext } from '../request-context.js';
import { writeAudit } from '../utils/writeAudit.js';
import type { AuditConfig } from '../types.js';

// Global flag to track if audit model has been initialized
let auditModelInitialized = false;

async function ensureAuditModelInitialized<T extends Model>(model: ModelCtor<T>): Promise<void> {
  if (auditModelInitialized) {
    return;
  }

  try {
    // Get the Sequelize instance from the model
    const sequelize = model.sequelize;
    if (!sequelize) {
      throw new Error('No Sequelize instance found on model');
    }

    // Try to get AuditService from NestJS container if available
    // Otherwise, initialize audit model directly
    try {
      const { defineAuditModel } = await import('../model/defineAuditModel.js');
      const { setAuditModel } = await import('../utils/writeAudit.js');

      // Create and register audit model with the Sequelize instance
      const AuditModel = defineAuditModel(sequelize, {
        tableName: 'audits',
      });

      // Set the global audit model for the package
      setAuditModel(AuditModel);

      // Auto-sync the audit table with alter to handle schema changes
      await AuditModel.sync({ alter: true });

      auditModelInitialized = true;
      console.log('🎉 attachAuditHooks: Audit model auto-initialized successfully!');
    } catch (error) {
      console.error('❌ Failed to auto-initialize audit model:', error);
      throw error;
    }
  } catch (error) {
    console.error('❌ Failed to ensure audit model initialization:', error);
    throw error;
  }
}

export function attachAuditHooks<T extends Model>(
  model: ModelCtor<T>,
  config: AuditConfig = {}
): void {
  const tableName = model.tableName;

  // After create hook
  model.addHook('afterCreate', async (instance: T) => {
    await ensureAuditModelInitialized(model);
    const context = RequestContext.getContext();
    await writeAudit({
      event: 'create',
      table: tableName,
      recordId: instance.get('id') as string | number,
      newValues: instance.dataValues,
      context,
      config,
    });
  });

  // After update hook  
  model.addHook('afterUpdate', async (instance: T) => {
    await ensureAuditModelInitialized(model);
    const context = RequestContext.getContext();
    await writeAudit({
      event: 'update',
      table: tableName,
      recordId: instance.get('id') as string | number,
      oldValues: (instance as any)._previousDataValues,
      newValues: instance.dataValues,
      context,
      config,
    });
  });

  // After delete hook
  model.addHook('afterDestroy', async (instance: T) => {
    await ensureAuditModelInitialized(model);
    const context = RequestContext.getContext();
    await writeAudit({
      event: 'delete',
      table: tableName,
      recordId: instance.get('id') as string | number,
      oldValues: instance.dataValues,
      context,
      config,
    });
  });

  // After restore hook (for soft deletes)
  model.addHook('afterRestore', async (instance: T) => {
    await ensureAuditModelInitialized(model);
    const context = RequestContext.getContext();
    await writeAudit({
      event: 'restore',
      table: tableName,
      recordId: instance.get('id') as string | number,
      newValues: instance.dataValues,
      context,
      config,
    });
  });
}