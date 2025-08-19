// Type definitions for the audit trail package

export enum AuditEvent {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  RESTORED = 'restored',
}

export interface AuditContext {
  actorableType?: string;
  actorableId?: string | number;
  ip?: string;
  userAgent?: string;
  url?: string;
  tags?: Record<string, any>;
}

export interface AuditConfig {
  exclude?: string[];
  mask?: string[];
  auditEvents?: AuditEvent[];
  onlyDirty?: boolean;
}

export interface AuditRecord {
  id?: string | number;
  event: 'created' | 'updated' | 'deleted' | 'restored';
  auditableType: string;
  auditableId: string | number;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  actorableType?: string;
  actorableId?: string | number;
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
  onlyDirty?: boolean;
}

export interface AuthConfig {
  type?: 'passport' | 'custom'; // Default: 'passport'
  userProperty?: string; // Default: 'user' (req.user)
  userIdField?: string; // Default: 'id' (user.id)
  actorModel?: string; // Default: 'User' - the model name of the actor
}

export interface AuditModuleAsyncOptions {
  imports?: any[];
  useFactory?: (...args: any[]) => Promise<AuditModuleOptions> | AuditModuleOptions;
  inject?: any[];
  connection?: string;
  isGlobal?: boolean;
}