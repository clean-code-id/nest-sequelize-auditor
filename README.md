# @clean-code-id/nest-sequelize-auditor

A seamless audit trail package for NestJS + Sequelize with automatic setup and request context tracking.

## Features

- 🎯 **Zero Configuration** - Works out of the box with automatic table creation
- 🔄 **Automatic Tracking** - Create, update, delete, and restore operations
- 🧵 **Request Context** - AsyncLocalStorage for userId, IP, user agent, URL, tags
- 🎛️ **Selective Events** - Choose which operations to audit
- 🎭 **Field Control** - Exclude or mask sensitive fields
- 🗄️ **Multi-Database** - PostgreSQL and MySQL support
- 📦 **TypeScript First** - Full type safety
- ⚡ **Zero Dependencies** - Only peer dependencies

## Installation

```bash
npm install @clean-code-id/nest-sequelize-auditor
```

**Peer Dependencies:**

```bash
npm install @nestjs/common @nestjs/core sequelize sequelize-typescript
```

## Quick Setup

### 1. Register the Module

```typescript
import { Module } from '@nestjs/common';
import { AuditModule } from '@clean-code-id/nest-sequelize-auditor';

@Module({
  imports: [
    SequelizeModule.forRoot(/* your db config */),
    AuditModule.forRoot(), // That's it! 🎉
  ],
})
export class AppModule {}
```

### 2. Add Request Context (Optional)

```typescript
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RequestContextInterceptor } from '@clean-code-id/nest-sequelize-auditor';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
  ],
})
export class AppModule {}
```

### 3. Attach Audit Hooks

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { attachAuditHooks } from '@clean-code-id/nest-sequelize-auditor';

@Injectable()
export class UserService implements OnModuleInit {
  constructor(@InjectModel(User) private userModel: typeof User) {}

  onModuleInit() {
    attachAuditHooks(this.userModel); // Automatic audit table creation!
  }

  // Your CRUD methods work normally - auditing happens automatically
  async createUser(data: any) {
    return this.userModel.create(data); // ✅ Audited
  }
}
```

**That's it!** The audit table is created automatically with proper snake_case columns.

## Advanced Configuration

### Selective Audit Events

```typescript
import { attachAuditHooks, AuditEvent } from '@clean-code-id/nest-sequelize-auditor';

attachAuditHooks(User, {
  // Only audit deletions (great for compliance)
  auditEvents: [AuditEvent.DELETED],

  // Or multiple events
  auditEvents: [AuditEvent.CREATED, AuditEvent.UPDATED, AuditEvent.DELETED],

  // Exclude fields
  exclude: ['created_at', 'updated_at'],

  // Mask fields (shows '***MASKED***')
  mask: ['password'],
});
```

### Manual Context Setting (If needed)

```typescript
import { RequestContext } from '@clean-code-id/nest-sequelize-auditor';

await RequestContext.runWithContext(
  {
    userId: '123',
    ip: '192.168.1.1',
    tags: { source: 'admin-panel' },
  },
  async () => {
    await User.create({ name: 'Admin User' }); // Uses context
  }
);
```

### Async Module Configuration

```typescript
AuditModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    autoSync: config.get('AUDIT_ENABLED', true),
    connection: config.get('AUDIT_DB_CONNECTION', 'default'),
  }),
  inject: [ConfigService],
});
```

## Available Events

Past tense events representing completed actions:

- `AuditEvent.CREATED` - Record was created
- `AuditEvent.UPDATED` - Record was updated
- `AuditEvent.DELETED` - Record was deleted
- `AuditEvent.RESTORED` - Record was restored

## Database Schema

The audit table is automatically created with snake_case columns:

```sql
CREATE TABLE audits (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event ENUM('created', 'updated', 'deleted', 'restored') NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  record_id VARCHAR(255) NOT NULL,
  old_values JSON,
  new_values JSON,
  user_id VARCHAR(255),
  ip VARCHAR(45),
  user_agent TEXT,
  url VARCHAR(2048),
  tags JSON,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Configuration Reference

```typescript
interface AuditConfig {
  exclude?: string[]; // Fields to exclude from audit
  mask?: string[]; // Fields to mask with '***MASKED***'
  auditEvents?: AuditEvent[]; // Specific events to audit
}

interface AuditModuleOptions {
  autoSync?: boolean; // Auto-create audit table (default: true)
  connection?: string; // Sequelize connection name
  isGlobal?: boolean; // Global module registration
}
```

## Requirements

- Node.js 16+
- NestJS 10+
- Sequelize 6+
- PostgreSQL or MySQL

## License

MIT
