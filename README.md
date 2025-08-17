# @cleancode-id/nestjs-sequelize-auditor

🔍 **Automatic audit trails for NestJS + Sequelize** with zero configuration and full request context tracking.

## ✨ Features

- 🎯 **Zero Setup** - Auto-creates audit table, hooks into your models automatically
- 🔄 **Complete Tracking** - CREATE, UPDATE, DELETE, RESTORE operations
- 🧵 **Smart Context** - Captures user, IP, URL, tags from HTTP requests via AsyncLocalStorage
- 🎛️ **Selective Auditing** - Choose which events and fields to track
- 🗜️ **Dirty Field Mode** - Log only changed fields vs complete state (configurable)
- 🎭 **Data Security** - Exclude or mask sensitive fields (passwords, PII)
- 🗄️ **Multi-DB Support** - PostgreSQL, MySQL
- 📦 **TypeScript Native** - Full type safety, zero runtime dependencies

## 🚀 Setup Guide

**Install:**
```bash
npm install @cleancode-id/nestjs-sequelize-auditor
```

### Step 1: Configure AppModule

```typescript
// app.module.ts
import { AuditModule } from '@cleancode-id/nestjs-sequelize-auditor';

@Module({
  imports: [
    SequelizeModule.forRoot(/* your db config */),
    AuditModule.forRoot({
      autoSync: true,        // Auto-create audit table (default: true)
      onlyDirty: true,       // Log only changed fields by default (default: false)
      auth: {
        type: 'passport',         // 'passport' or 'custom' (default: 'passport')
        userProperty: 'user',     // req[userProperty] (default: 'user')
        userIdField: 'id',        // req.user[userIdField] (default: 'id')
      },
    }),
  ],
  // RequestContextInterceptor auto-registered for HTTP context capture
})
export class AppModule {}
```

**Module Options:**
- `autoSync` - Automatically creates the audit table on startup
- `onlyDirty` - Default for all models: log only changed fields vs full state
- `connection` - Which Sequelize connection to use (default: 'default')
- `auth.type` - How to extract user: `'passport'` (Passport.js) or `'custom'`
- `auth.userProperty` - Request property containing user data (default: `req.user`)
- `auth.userIdField` - Field within user object for ID (default: `req.user.id`)

**Environment-based config:**
```typescript
AuditModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    autoSync: config.get('AUDIT_ENABLED', true),
    onlyDirty: config.get('AUDIT_ONLY_DIRTY', false),
    auth: { userIdField: config.get('AUTH_USER_ID_FIELD', 'id') },
  }),
  inject: [ConfigService],
})
```

### Step 2: Enable Audit for Your Models

```typescript
// user.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { attachAuditHooks, AuditEvent } from '@cleancode-id/nestjs-sequelize-auditor';

@Injectable()
export class UserService implements OnModuleInit {
  constructor(@InjectModel(User) private userModel: typeof User) {}

  onModuleInit() {
    // Basic audit - uses global settings
    attachAuditHooks(this.userModel);
    
    // Or with custom configuration
    attachAuditHooks(this.userModel, {
      auditEvents: [AuditEvent.CREATED, AuditEvent.UPDATED, AuditEvent.DELETED],
      exclude: ['id', 'createdAt', 'updatedAt'], // Skip these fields
      mask: ['password', 'ssn'],                 // Show as '***MASKED***'
      onlyDirty: false,                          // Override global: log full state
    });
  }

  async createUser(data: any) {
    return this.userModel.create(data); // ✅ Automatically audited!
  }
}
```

**Per-Model Options:**
- `auditEvents` - Which operations to track: `CREATED`, `UPDATED`, `DELETED`, `RESTORED`
- `exclude` - Fields to completely skip from audit logs
- `mask` - Fields to show as `'***MASKED***'` (passwords, PII)
- `onlyDirty` - Override global setting for this model

### `onlyDirty` Comparison
```typescript
// onlyDirty: false (default) - Full record state
{
  "old_values": { "name": "John", "email": "john@test.com", "status": "active" },
  "new_values": { "name": "Jane", "email": "john@test.com", "status": "active" }
}

// onlyDirty: true - Only changed fields  
{
  "old_values": { "name": "John" },
  "new_values": { "name": "Jane" }
}
```

### Manual Context (Background Jobs, Migrations)
```typescript
import { RequestContext } from '@cleancode-id/nestjs-sequelize-auditor';

// For system operations
await RequestContext.runWithContext(
  { actorId: 'migration-script', tags: { source: 'data-migration' } },
  async () => {
    await User.bulkCreate(migrationData); // Audited with custom context
  }
);
```

## 📊 Audit Data Structure

**Available Events:**
- `CREATED`, `UPDATED`, `DELETED`, `RESTORED`

**Auto-generated Audit Table:**
```sql
CREATE TABLE audits (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event ENUM('created', 'updated', 'deleted', 'restored'),
  table_name VARCHAR(255), -- Source table
  record_id VARCHAR(255),  -- ID of the changed record
  old_values JSON,         -- Previous state
  new_values JSON,         -- New state  
  actor_id VARCHAR(255),   -- Who made the change (from req.user.id)
  ip VARCHAR(45),          -- Request IP
  user_agent TEXT,         -- Browser/client info
  url VARCHAR(2048),       -- Request URL
  tags JSON,               -- Custom metadata
  created_at TIMESTAMP     -- When it happened
);
```

**Example Audit Record:**
```json
{
  "id": 1,
  "event": "updated",
  "table_name": "users",
  "record_id": "123",
  "old_values": { "email": "old@example.com" },
  "new_values": { "email": "new@example.com" },
  "actor_id": "456",
  "ip": "192.168.1.100",
  "url": "/api/users/123",
  "created_at": "2024-01-15T10:30:00Z"
}
```

## 🔧 API Reference

```typescript
// Core types
enum AuditEvent { CREATED, UPDATED, DELETED, RESTORED }

interface AuditConfig {
  exclude?: string[];        // Fields to skip
  mask?: string[];          // Fields to show as '***MASKED***'
  auditEvents?: AuditEvent[]; // Which operations to track
  onlyDirty?: boolean;      // Log only changed fields
}

interface AuditModuleOptions {
  autoSync?: boolean;       // Auto-create audit table (default: true)
  onlyDirty?: boolean;     // Global dirty field setting (default: false)
  auth?: {
    type?: 'passport' | 'custom';    // Auth strategy (default: 'passport')  
    userProperty?: string;           // req[userProperty] (default: 'user')
    userIdField?: string;           // req.user[userIdField] (default: 'id')
  };
}

// Main functions
AuditModule.forRoot(options?: AuditModuleOptions)
AuditModule.forRootAsync({ useFactory, imports, inject })
attachAuditHooks(model: typeof Model, config?: AuditConfig)
RequestContext.runWithContext(context, fn)
```

## 📋 Requirements

- **Node.js** 16+
- **NestJS** 10+  
- **Sequelize** 6+
- **Database**: PostgreSQL or MySQL