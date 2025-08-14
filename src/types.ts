// Type definitions for the audit trail package

export interface AuditContext {
  userId?: string | number;
  ip?: string;
  userAgent?: string;
  url?: string;
  tags?: Record<string, any>;
}

export interface AuditConfig {
  exclude?: string[];
  mask?: string[];
}

export interface AuditRecord {
  id?: string | number;
  event: 'create' | 'update' | 'delete' | 'restore';
  table: string;
  recordId: string | number;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  userId?: string | number;
  ip?: string;
  userAgent?: string;
  url?: string;
  tags?: Record<string, any>;
  createdAt: Date;
}

export interface AuditModelOptions {
  tableName?: string;
  exclude?: string[];
  mask?: string[];
}