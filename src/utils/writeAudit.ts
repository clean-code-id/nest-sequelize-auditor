// Utility function to write audit records to the database

import type { AuditContext, AuditConfig, AuditModuleOptions } from '../types.js';
import type { ModelStatic, Model } from 'sequelize';

interface WriteAuditOptions {
  event: 'created' | 'updated' | 'deleted' | 'restored';
  auditableType: string;
  auditableId: string | number;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  context?: AuditContext;
  config?: AuditConfig;
  globalConfig?: AuditModuleOptions;
}

interface WriteBulkAuditOptions {
  event: 'created' | 'updated' | 'deleted';
  auditableType: string;
  instances?: any[];
  affectedRecords?: any[];
  updatedRecords?: any[];
  affectedCount: number;
  where?: any;
  newValues?: Record<string, any>;
  context?: AuditContext;
  config?: AuditConfig;
  globalConfig?: AuditModuleOptions;
}

// Global audit model reference - will be set by the consumer
let globalAuditModel: ModelStatic<Model> | null = null;

export function setAuditModel(auditModel: ModelStatic<Model>): void {
  globalAuditModel = auditModel;
}

export function getAuditModel(): ModelStatic<Model> | null {
  return globalAuditModel;
}

export async function writeAudit(options: WriteAuditOptions): Promise<void> {
  if (!globalAuditModel) {
    console.warn('Audit model not configured. Call setAuditModel() first.');
    return;
  }

  const {
    event,
    auditableType,
    auditableId,
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
      auditableType,
      auditableId,
      oldValues: processedOldValues,
      newValues: processedNewValues,
      actorableType: context?.actorableType,
      actorableId: context?.actorableId,
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

export async function writeBulkAudit(options: WriteBulkAuditOptions): Promise<void> {
  if (!globalAuditModel) {
    console.warn('Audit model not configured. Call setAuditModel() first.');
    return;
  }

  const {
    event,
    auditableType,
    instances,
    affectedRecords,
    updatedRecords,
    affectedCount,
    where,
    newValues,
    context,
    config = {},
    globalConfig,
  } = options;

  try {
    // For bulk create, we can create individual audit records for each instance
    if (event === 'created' && instances && instances.length > 0) {
      const auditRecords = instances.map((instance) => {
        const processedNewValues = applyExcludeAndMask(instance.dataValues || instance, config);
        
        return {
          event,
          auditableType,
          auditableId: instance.get ? instance.get('id') : instance.id,
          newValues: processedNewValues,
          actorableType: context?.actorableType,
          actorableId: context?.actorableId,
          ip: context?.ip,
          userAgent: context?.userAgent,
          url: context?.url,
          tags: {
            ...context?.tags,
            bulkOperation: true,
            affectedCount,
          },
          createdAt: new Date(),
        };
      });

      await globalAuditModel.bulkCreate(auditRecords);
    } else if (affectedRecords && affectedRecords.length > 0) {
      // For bulk update/delete with affected records, create individual audit records
      const auditRecords = affectedRecords.map((record, index) => {
        let rawOldValues = record.dataValues || record;
        let rawNewValues: Record<string, any> | undefined;
        
        // For updates, choose between complete state or dirty fields based on onlyDirty setting
        if (event === 'updated') {
          const onlyDirty = config.onlyDirty ?? globalConfig?.onlyDirty ?? false;
          
          if (onlyDirty) {
            // For onlyDirty: true, use partial newValues (only changed fields)
            rawNewValues = newValues;
          } else if (updatedRecords && updatedRecords[index]) {
            // For onlyDirty: false, use complete state from updated record
            rawNewValues = updatedRecords[index].dataValues || updatedRecords[index];
          } else if (newValues) {
            // Fallback to partial newValues
            rawNewValues = newValues;
          }
        }
        
        // Apply dirty field filtering and exclusions/masking
        const { processedOldValues, processedNewValues } = processValues(
          rawOldValues,
          rawNewValues,
          config,
          globalConfig
        );
        
        return {
          event,
          auditableType,
          auditableId: record.get ? record.get('id') : record.id,
          oldValues: (event === 'updated' || event === 'deleted') ? processedOldValues : undefined,
          newValues: event === 'deleted' ? undefined : processedNewValues,
          actorableType: context?.actorableType,
          actorableId: context?.actorableId,
          ip: context?.ip,
          userAgent: context?.userAgent,
          url: context?.url,
          tags: {
            ...context?.tags,
            bulkOperation: true,
            affectedCount,
            where,
          },
          createdAt: new Date(),
        };
      });

      await globalAuditModel.bulkCreate(auditRecords);
    } else {
      // Fallback: create a single audit record with bulk operation metadata
      const processedNewValues = newValues ? applyExcludeAndMask(newValues, config) : undefined;
      
      await globalAuditModel.create({
        event,
        auditableType,
        auditableId: 'bulk', // Special ID for bulk operations
        newValues: processedNewValues,
        actorableType: context?.actorableType,
        actorableId: context?.actorableId,
        ip: context?.ip,
        userAgent: context?.userAgent,
        url: context?.url,
        tags: {
          ...context?.tags,
          bulkOperation: true,
          affectedCount,
          where,
        },
        createdAt: new Date(),
      });
    }
  } catch (error) {
    // Log error but don't throw to avoid disrupting the main operation
    console.error('Failed to write bulk audit record:', error);
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
  
  // Only check fields that exist in newValues (this handles bulk updates where newValues only contains changed fields)
  for (const field in newValues) {
    if (oldValues[field] !== newValues[field]) {
      changedFields.push(field);
    }
  }
  
  // Note: We don't check for "removed" fields in bulk operations because newValues only contains the fields being updated
  // If we need to handle actual field removal, that would be a different use case
  
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