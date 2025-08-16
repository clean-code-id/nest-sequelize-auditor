// Type definitions for the audit trail package

export enum AuditEvent {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  RESTORED = 'restored',
}

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
  auditEvents?: AuditEvent[];
}

export interface AuditRecord {
  id?: string | number;
  event: 'created' | 'updated' | 'deleted' | 'restored';
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

export interface AuditModuleOptions {
  connection?: string;
  tableName?: string;
  autoSync?: boolean;
  alterTable?: boolean;
  isGlobal?: boolean;
  auth?: AuthConfig;
}

export interface AuthConfig {
  type?: 'passport' | 'custom'; // Default: 'passport'
  userProperty?: string; // Default: 'user' (req.user)
  userIdField?: string; // Default: 'id' (user.id)
}

export interface AuditModuleAsyncOptions {
  imports?: any[];
  useFactory?: (...args: any[]) => Promise<AuditModuleOptions> | AuditModuleOptions;
  inject?: any[];
  connection?: string;
  isGlobal?: boolean;
}