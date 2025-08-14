// Sequelize hooks for automatic audit trail creation

import { Model, ModelCtor } from 'sequelize';
import { RequestContext } from '../request-context.js';
import { writeAudit } from '../utils/writeAudit.js';
import type { AuditConfig } from '../types.js';

export function attachAuditHooks<T extends Model>(
  model: ModelCtor<T>,
  config: AuditConfig = {}
): void {
  const tableName = model.tableName;

  // After create hook
  model.addHook('afterCreate', async (instance: T) => {
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