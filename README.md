# @clean-code-id/nest-sequelize-auditor

An audit trail package for NestJS + Sequelize ORM with AsyncLocalStorage context management.

## Features

- 🚀 **Comprehensive** audit trail functionality
- 🔄 **Automatic tracking** of create, update, delete, and restore operations  
- 🧵 **AsyncLocalStorage** for request context (userId, IP, user agent, URL, tags)
- 🎛️ **Configurable** field exclusion and masking
- 🏗️ **NestJS integration** with built-in interceptor
- 🗄️ **Database support** for PostgreSQL and MySQL
- 📦 **TypeScript** first with full type safety
- ⚡ **Zero dependencies** (only peer dependencies)

## Installation

```bash
npm install @clean-code-id/nest-sequelize-auditor
```

### Peer Dependencies

Make sure you have the following peer dependencies installed:

```bash
npm install @nestjs/common @nestjs/core sequelize sequelize-typescript
```

## Quick Setup

### 1. Import the AuditModule

```typescript
import { Module } from '@nestjs/common';
import { AuditModule } from '@clean-code-id/nest-sequelize-auditor';

@Module({
  imports: [
    // Your Sequelize module setup
    SequelizeModule.forRoot({
      // your database config
    }),
    
    // Simple setup - automatic audit model registration and table creation
    AuditModule.forRoot(),
    
    // Or with custom options
    AuditModule.forRoot({
      autoSync: true,        // Auto-create audit table (default: true)
      alterTable: false,     // Allow table alterations (default: false)
      connection: 'default', // Sequelize connection name (default: 'default')
      isGlobal: true,        // Register as global module (default: true)
    }),
  ],
})
export class AppModule {}
```

### 2. Async Configuration (Advanced)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuditModule } from '@clean-code-id/nest-sequelize-auditor';

@Module({
  imports: [
    ConfigModule.forRoot(),
    
    // Async configuration with dependency injection
    AuditModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        autoSync: configService.get('AUDIT_AUTO_SYNC', true),
        alterTable: configService.get('AUDIT_ALTER_TABLE', false),
        connection: configService.get('AUDIT_DB_CONNECTION', 'default'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### 3. Setup Request Context Interceptor

```typescript
import { Module } from '@nestjs/common';
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

### 4. Attach Audit Hooks to Your Models

Add `attachAuditHooks()` in your service's `onModuleInit()` method:

```typescript
// user.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { attachAuditHooks } from '@clean-code-id/nest-sequelize-auditor';
import { User } from './user.model';

@Injectable()
export class UserService implements OnModuleInit {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
  ) {}

  onModuleInit() {
    // 🎉 Attach audit hooks - everything else is automatic!
    attachAuditHooks(this.userModel, {
      exclude: ['createdAt', 'updatedAt'], // Fields to exclude from audit
      mask: ['password'], // Fields to mask in audit trail
    });
  }

  // Your service methods...
  async createUser(userData: any) {
    return this.userModel.create(userData); // Audit happens automatically!
  }
}
```

**That's it!** The audit table will be created automatically, and all CRUD operations will be audited.

## Usage Examples

### Basic Usage

Once configured, audit trails are created automatically:

```typescript
// This will automatically create an audit record
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'secret123'
});

// This will create an update audit record
await user.update({ name: 'Jane Doe' });

// This will create a delete audit record
await user.destroy();
```

### Manual Context Setting

You can manually set audit context outside of HTTP requests:

```typescript
import { RequestContext } from '@clean-code-id/nest-sequelize-auditor';

await RequestContext.runWithContext(
  {
    userId: '123',
    ip: '192.168.1.1',
    userAgent: 'CLI Script',
    url: '/background-job',
    tags: { source: 'cron' }
  },
  async () => {
    // Any operations here will use this context for auditing
    await User.create({ name: 'Background User' });
  }
);
```

## Database Migration Options

### Option 1: Automatic (Recommended)
The `AuditModule.forRoot()` automatically creates the audit table when `autoSync: true` (default).

### Option 2: Manual Migration with Sequelize CLI

```javascript
// Generate migration file using our utility
import { generateMigrationFileContent } from '@clean-code-id/nest-sequelize-auditor';
import fs from 'fs';

const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
const filename = `${timestamp}-create-audits-table.js`;
const content = generateMigrationFileContent('audits');

fs.writeFileSync(`./migrations/${filename}`, content);
```

### Option 3: Manual SQL Script

```javascript
import { generateSQLScript } from '@clean-code-id/nest-sequelize-auditor';

// For PostgreSQL
const postgresScript = generateSQLScript('audits', 'postgres');

// For MySQL  
const mysqlScript = generateSQLScript('audits', 'mysql');
```

### Custom Audit Configuration

```typescript
import { attachAuditHooks } from '@clean-code-id/nest-sequelize-auditor';

attachAuditHooks(User, {
  exclude: [
    'password',
    'createdAt', 
    'updatedAt',
    'deletedAt'
  ],
  mask: [
    'email', // Will show as '***MASKED***' in audit trail
    'phone'
  ]
});
```

## Configuration Options

### AuditConfig

```typescript
interface AuditConfig {
  exclude?: string[]; // Fields to completely exclude from audit trail
  mask?: string[];    // Fields to mask with '***MASKED***'
}
```

### AuditModelOptions

```typescript
interface AuditModelOptions {
  tableName?: string; // Custom table name for audits
  exclude?: string[]; // Global field exclusions
  mask?: string[];    // Global field masking
}
```

## Database Schema

The audit table will have the following structure:

```sql
CREATE TABLE audits (
  id BIGSERIAL PRIMARY KEY,
  event VARCHAR(10) NOT NULL CHECK (event IN ('create', 'update', 'delete', 'restore')),
  table_name VARCHAR(255) NOT NULL,
  record_id VARCHAR(255) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id VARCHAR(255),
  ip VARCHAR(45),
  user_agent TEXT,
  url VARCHAR(2048),
  tags JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## API Reference

### Functions

- `defineAuditModel(sequelize, options?)` - Creates the audit model
- `attachAuditHooks(model, config?)` - Attaches audit hooks to a model
- `RequestContext.getContext()` - Gets current audit context
- `RequestContext.runWithContext(context, callback)` - Runs callback with context

### Classes

- `RequestContextInterceptor` - NestJS interceptor for automatic context setting
- `AuditModel` - The audit trail model

## Requirements

- Node.js 16+
- NestJS 10+
- Sequelize 6+
- PostgreSQL or MySQL

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit PRs to our GitHub repository.