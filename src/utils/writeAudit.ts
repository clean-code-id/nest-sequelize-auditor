// Utility function to write audit records to the database

import { AuditModel } from '../model/defineAuditModel.js';
import type { AuditContext, AuditConfig } from '../types.js';

interface WriteAuditOptions {
  event: 'create' | 'update' | 'delete' | 'restore';
  table: string;
  recordId: string | number;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  context?: AuditContext;
  config?: AuditConfig;
}

export async function writeAudit(options: WriteAuditOptions): Promise<void> {
  const {
    event,
    table,
    recordId,
    oldValues,
    newValues,
    context,
    config = {},
  } = options;

  // Apply field exclusions and masking
  const processedOldValues = processValues(oldValues, config);
  const processedNewValues = processValues(newValues, config);

  try {
    await AuditModel.create({
      event,
      table,
      recordId,
      oldValues: processedOldValues,
      newValues: processedNewValues,
      userId: context?.userId,
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