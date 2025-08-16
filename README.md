# @cleancode-id/nestjs-sequelize-auditor

A seamless audit trail package for NestJS + Sequelize with automatic setup and request context tracking.

## Features

- 🎯 **Zero Configuration** - Works out of the box with automatic table creation
- 🔄 **Automatic Tracking** - Create, update, delete, and restore operations
- 🧵 **Request Context** - AsyncLocalStorage for userId, IP, user agent, URL, tags, and actor tracking
- 🎛️ **Selective Events** - Choose which operations to audit
- 🎭 **Field Control** - Exclude or mask sensitive fields
- 🗜️ **Dirty Field Tracking** - Log only changed fields or complete state
- 🗄️ **Multi-Database** - PostgreSQL and MySQL support
- 📦 **TypeScript First** - Full type safety
- ⚡ **Zero Dependencies** - Only peer dependencies

## Installation

```bash
npm install @cleancode-id/nestjs-sequelize-auditor
```

**Peer Dependencies:**

```bash
npm install @nestjs/common @nestjs/core sequelize sequelize-typescript
```

## Quick Setup

### 1. Register the Module

```typescript
import { Module } from '@nestjs/common';
import { AuditModule } from '@cleancode-id/nestjs-sequelize-auditor';

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
import { RequestContextInterceptor } from '@cleancode-id/nestjs-sequelize-auditor';

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
import { attachAuditHooks } from '@cleancode-id/nestjs-sequelize-auditor';

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
import { attachAuditHooks, AuditEvent } from '@cleancode-id/nestjs-sequelize-auditor';

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

### Dirty Field Tracking (onlyDirty)

By default, audit logs capture the complete state of records. Enable `onlyDirty` to log only fields that actually changed:

```typescript
// Global configuration - affects all models
AuditModule.forRoot({
  onlyDirty: true, // Only log changed fields globally
});

// Per-model configuration
attachAuditHooks(User, {
  onlyDirty: false, // Override: log full state for User model (compliance)
  exclude: ['created_at', 'updated_at'],
  mask: ['password'],
});

attachAuditHooks(Product, {
  // Uses global onlyDirty: true setting
  auditEvents: [AuditEvent.UPDATED], // Only track updates
});
```

**Benefits of onlyDirty:**
- 🗜️ **Reduced Storage** - Only changed fields are stored
- 🔍 **Clearer Logs** - Focus on what actually changed
- ⚡ **Better Performance** - Less data serialization
- 📊 **Compliance Ready** - Track specific changes for audit requirements

**Examples:**

```typescript
// Before (onlyDirty: false) - Full state logged
{
  "old_values": {
    "id": 1,
    "name": "John Doe", 
    "email": "john@example.com",
    "phone": "123-456-7890",
    "status": "active"
  },
  "new_values": {
    "id": 1,
    "name": "John Smith",        // ← changed
    "email": "john@example.com", // ← unchanged but logged
    "phone": "987-654-3210",     // ← changed  
    "status": "active"           // ← unchanged but logged
  }
}

// After (onlyDirty: true) - Only changed fields
{
  "old_values": {
    "name": "John Doe",
    "phone": "123-456-7890"
  },
  "new_values": {
    "name": "John Smith",
    "phone": "987-654-3210" 
  }
}
```

### Manual Context Setting (If needed)

```typescript
import { RequestContext } from '@cleancode-id/nestjs-sequelize-auditor';

await RequestContext.runWithContext(
  {
    actorId: '123', // ID of the user who performed the action
    ip: '192.168.1.1',
    tags: { source: 'admin-panel' },
  },
  async () => {
    await User.create({ name: 'Admin User' }); // Uses context
  }
);
```

### Authentication Configuration

Configure how the package extracts authenticated user information:

```typescript
AuditModule.forRoot({
  auth: {
    type: 'passport', // 'passport' or 'custom' (default: 'passport')
    userProperty: 'user', // Property on request object (default: 'user')
    userIdField: 'id', // Field within user object (default: 'id')
  },
});

// Examples for different auth setups:
// Standard Passport.js with req.user.id
AuditModule.forRoot({
  auth: {
    type: 'passport',
    userProperty: 'user',
    userIdField: 'id',
  },
});
```

### Async Module Configuration

```typescript
AuditModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    autoSync: config.get('AUDIT_ENABLED', true),
    connection: config.get('AUDIT_DB_CONNECTION', 'default'),
    auth: {
      type: 'passport',
      userProperty: 'user',
      userIdField: config.get('AUTH_USER_ID_FIELD', 'id'),
    },
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
  actor_id VARCHAR(255), -- ID of the actor who performed the action
  ip VARCHAR(45),
  user_agent TEXT,
  url VARCHAR(2048),
  tags JSON,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Actor Tracking

The package automatically tracks the actor (user) who performed each action using the `actor_id` field:

```typescript
// Example: Set actor ID in controller  
@Controller('users')
export class UserController {
  @Post()
  async createUser(@Body() userData: any, @Req() req: any) {
    // Actor ID is automatically extracted from authenticated user (req.user.id)
    return this.userService.create(userData);
  }
}

// Example: Manual actor ID setting for system operations
await RequestContext.runWithContext(
  {
    actorId: 'system-migration-job', // ID of who/what performed the action
  },
  async () => {
    await User.bulkCreate(migrationData);
  }
);
```

## Configuration Reference

```typescript
interface AuditConfig {
  exclude?: string[]; // Fields to exclude from audit
  mask?: string[]; // Fields to mask with '***MASKED***'
  auditEvents?: AuditEvent[]; // Specific events to audit
  onlyDirty?: boolean; // Log only changed fields (default: false)
}

interface AuthConfig {
  type?: 'passport' | 'custom'; // Authentication strategy (default: 'passport')
  userProperty?: string; // Request property containing user (default: 'user')
  userIdField?: string; // Field within user object for ID (default: 'id')
}

interface AuditModuleOptions {
  autoSync?: boolean; // Auto-create audit table (default: true)
  connection?: string; // Sequelize connection name
  isGlobal?: boolean; // Global module registration
  auth?: AuthConfig; // Authentication configuration
  onlyDirty?: boolean; // Global setting for dirty field tracking (default: false)
}
```

## Requirements

- Node.js 16+
- NestJS 10+
- Sequelize 6+
- PostgreSQL or MySQL

## License

MIT
