# @clean-code-id/nest-sequelize-auditor

A Laravel-style audit trail package for NestJS + Sequelize ORM with AsyncLocalStorage context management.

## Features

- 🚀 **Laravel-inspired** audit trail functionality
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

### 1. Create the Audit Model

```typescript
import { defineAuditModel } from '@clean-code-id/nest-sequelize-auditor';
import { Sequelize } from 'sequelize-typescript';

const sequelize = new Sequelize(/* your config */);

// Create the audit model
const AuditModel = defineAuditModel(sequelize, {
  tableName: 'audits', // optional, defaults to 'audits'
});

// Add to your sequelize models
sequelize.addModels([AuditModel]);
```

### 2. Setup Request Context Interceptor

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

### 3. Attach Audit Hooks to Your Models

```typescript
import { Table, Column, Model, PrimaryKey } from 'sequelize-typescript';
import { attachAuditHooks } from '@clean-code-id/nest-sequelize-auditor';

@Table
export class User extends Model {
  @PrimaryKey
  @Column
  id: number;

  @Column
  name: string;

  @Column
  email: string;

  @Column
  password: string;
}

// Attach audit hooks with configuration
attachAuditHooks(User, {
  exclude: ['createdAt', 'updatedAt'], // Fields to exclude from audit
  mask: ['password'], // Fields to mask in audit trail
});
```

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