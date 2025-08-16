// Utility function to write audit records to the database

import type { AuditContext, AuditConfig, AuditModuleOptions } from '../types.js';
import type { ModelCtor, Model } from 'sequelize';

interface WriteAuditOptions {
  event: 'created' | 'updated' | 'deleted' | 'restored';
  table: string;
  recordId: string | number;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  context?: AuditContext;
  config?: AuditConfig;
  globalConfig?: AuditModuleOptions;
}

// Global audit model reference - will be set by the consumer
let globalAuditModel: ModelCtor<Model> | null = null;

export function setAuditModel(auditModel: ModelCtor<Model>): void {
  globalAuditModel = auditModel;
}

export async function writeAudit(options: WriteAuditOptions): Promise<void> {
  if (!globalAuditModel) {
    console.warn('Audit model not configured. Call setAuditModel() first.');
    return;
  }

  const {
    event,
    table,
    recordId,
    oldValues,
    newValues,
    context,
    config = {},
    globalConfig,
  } = options;

  // Apply dirty field filtering, exclusions and masking
  const { processedOldValues, processedNewValues } = processValues(
    oldValues,
    newValues,
    config,
    globalConfig
  );

  try {
    await globalAuditModel.create({
      event,
      table,
      recordId,
      oldValues: processedOldValues,
      newValues: processedNewValues,
      actorId: context?.actorId,
      ip: context?.ip,
      userAgent: context?.userAgent,
      url: context?.url,
      tags: context?.tags,
      createdAt: new Date(),
    });
  } catch (error) {
    // Log error but don't throw to avoid disrupting the main operation
    console.error('Failed to write audit record:', error);
  }
}

function processValues(
  oldValues: Record<string, any> | undefined,
  newValues: Record<string, any> | undefined,
  config: AuditConfig,
  globalConfig?: AuditModuleOptions
): { processedOldValues?: Record<string, any>; processedNewValues?: Record<string, any> } {
  const onlyDirty = config.onlyDirty ?? globalConfig?.onlyDirty ?? false;
  
  let finalOldValues = oldValues;
  let finalNewValues = newValues;
  
  // Apply dirty field filtering if enabled and we have both old and new values
  if (onlyDirty && oldValues && newValues) {
    const changedFields = getChangedFields(oldValues, newValues);
    if (changedFields.length > 0) {
      finalOldValues = pickFields(oldValues, changedFields);
      finalNewValues = pickFields(newValues, changedFields);
    } else {
      // No changes detected, return empty objects
      finalOldValues = {};
      finalNewValues = {};
    }
  }
  
  return {
    processedOldValues: applyExcludeAndMask(finalOldValues, config),
    processedNewValues: applyExcludeAndMask(finalNewValues, config),
  };
}

function getChangedFields(
  oldValues: Record<string, any>,
  newValues: Record<string, any>
): string[] {
  const changedFields: string[] = [];
  
  // Check all fields in newValues
  for (const field in newValues) {
    if (oldValues[field] !== newValues[field]) {
      changedFields.push(field);
    }
  }
  
  // Check for fields that were removed (exist in old but not in new)
  for (const field in oldValues) {
    if (!(field in newValues) && !changedFields.includes(field)) {
      changedFields.push(field);
    }
  }
  
  return changedFields;
}

function pickFields(
  values: Record<string, any>,
  fields: string[]
): Record<string, any> {
  const result: Record<string, any> = {};
  fields.forEach((field) => {
    if (field in values) {
      result[field] = values[field];
    }
  });
  return result;
}

function applyExcludeAndMask(
  values: Record<string, any> | undefined,
  config: AuditConfig
): Record<string, any> | undefined {
  if (!values) return values;

  const result = { ...values };
  
  // Remove excluded fields
  if (config.exclude) {
    config.exclude.forEach((field) => {
      delete result[field];
    });
  }

  // Mask sensitive fields
  if (config.mask) {
    config.mask.forEach((field) => {
      if (field in result) {
        result[field] = '***MASKED***';
      }
    });
  }

  return result;
}