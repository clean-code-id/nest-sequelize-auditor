# @cleancode-id/nestjs-sequelize-auditor

🔍 **Polymorphic audit trails for NestJS + Sequelize** with zero configuration and full request context tracking.

[![npm version](https://badge.fury.io/js/@cleancode-id%2Fnestjs-sequelize-auditor.svg)](https://badge.fury.io/js/@cleancode-id%2Fnestjs-sequelize-auditor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🎯 **Zero Setup** - Auto-creates audit table, hooks into your models automatically
- 🔄 **Complete Tracking** - CREATE, UPDATE, DELETE, RESTORE operations
- 🧵 **Smart Context** - Captures user, IP, URL, tags from HTTP requests via AsyncLocalStorage
- 🎭 **Polymorphic Support** - Track any entity type and actor type with Sequelize conventions
- 🎛️ **Selective Auditing** - Choose which events and fields to track
- 🗜️ **Dirty Field Mode** - Log only changed fields vs complete state (configurable)
- 🛡️ **Data Security** - Exclude or mask sensitive fields (passwords, PII)
- 🗄️ **Multi-DB Support** - PostgreSQL, MySQL with proper indexing
- 📦 **TypeScript Native** - Full type safety, zero runtime dependencies
- 🚀 **Production Ready** - Battle-tested with comprehensive test suite

## 🆕 What's New in v1.2.0

- **Polymorphic Entities**: Track any model type (`User`, `Product`, `Order`) using Sequelize conventions
- **Polymorphic Actors**: Support different actor types (`User`, `Admin`, `System`) with configurable models  
- **Enhanced Schema**: Database uses proper `auditable_type`/`auditable_id` and `actorable_type`/`actorable_id` fields
- **Better Performance**: Optimized indexing for polymorphic queries

## 🚀 Quick Start

### Installation

```bash
npm install @cleancode-id/nestjs-sequelize-auditor
```

### Basic Setup

```typescript
// app.module.ts
import { AuditModule } from '@cleancode-id/nestjs-sequelize-auditor';

@Module({
  imports: [
    SequelizeModule.forRoot(/* your db config */),
    AuditModule.forRoot({
      autoSync: true,        // Auto-create audit table
      onlyDirty: false,      // Log full state by default
      auth: {
        type: 'passport',         // Use Passport.js authentication
        userProperty: 'user',     // req.user
        userIdField: 'id',        // req.user.id
        actorModel: 'User',       // Actor model name (NEW!)
      },
    }),
  ],
})
export class AppModule {}
```

### Enable Auditing for Models

```typescript
// user.service.ts  
import { Injectable, OnModuleInit } from '@nestjs/common';
import { attachAuditHooks, AuditEvent } from '@cleancode-id/nestjs-sequelize-auditor';

@Injectable()
export class UserService implements OnModuleInit {
  constructor(@InjectModel(User) private userModel: typeof User) {}

  onModuleInit() {
    // Enable auditing for User model
    attachAuditHooks(this.userModel, {
      exclude: ['password', 'createdAt', 'updatedAt'],
      mask: ['ssn', 'creditCard'],
      auditEvents: [AuditEvent.CREATED, AuditEvent.UPDATED, AuditEvent.DELETED],
    });
  }

  async createUser(userData: any) {
    return this.userModel.create(userData); // ✅ Automatically audited!
  }
}
```

## 🔧 Configuration

### Module Configuration

```typescript
interface AuditModuleOptions {
  connection?: string;      // Sequelize connection name (default: 'default')
  tableName?: string;       // Audit table name (default: 'audits')  
  autoSync?: boolean;       // Auto-create audit table (default: true)
  alterTable?: boolean;     // Allow table alterations (default: false)
  isGlobal?: boolean;       // Make module global (default: false)
  onlyDirty?: boolean;      // Global dirty field setting (default: false)
  auth?: AuthConfig;        // Authentication configuration
}

interface AuthConfig {
  type?: 'passport' | 'custom';    // Auth strategy (default: 'passport')
  userProperty?: string;           // req[userProperty] (default: 'user')
  userIdField?: string;            // user[userIdField] (default: 'id')
  actorModel?: string;             // Actor model name (default: 'User')
}
```

### Per-Model Configuration

```typescript
interface AuditConfig {
  exclude?: string[];         // Fields to completely skip
  mask?: string[];            // Fields to show as '***MASKED***'
  auditEvents?: AuditEvent[]; // Which operations to track
  onlyDirty?: boolean;        // Override global dirty field setting
}
```

## 🎭 Polymorphic Support

### Different Entity Types

The audit system now supports tracking any model type using Sequelize polymorphic conventions:

```typescript
// Track different entity types
attachAuditHooks(User);        // auditable_type: "User"
attachAuditHooks(Product);     // auditable_type: "Product"  
attachAuditHooks(Order);       // auditable_type: "Order"
```

### Different Actor Types

Configure different actor models for different parts of your application:

```typescript
// User-facing API
AuditModule.forRoot({
  auth: { actorModel: 'User' }     // actorable_type: "User"
});

// Admin panel  
AuditModule.forRoot({
  auth: { actorModel: 'Admin' }    // actorable_type: "Admin" 
});

// System operations
await RequestContext.runWithContext(
  { 
    actorableType: 'System',
    actorableId: 'background-job-1',
    tags: { jobType: 'data-cleanup' }
  },
  async () => {
    await User.bulkUpdate(cleanupData, { where: { inactive: true } });
  }
);
```

## 📊 Database Schema

### Audit Table Structure

```sql
CREATE TABLE audits (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event ENUM('created', 'updated', 'deleted', 'restored') NOT NULL,
  
  -- Polymorphic auditable (what was changed)
  auditable_type VARCHAR(255) NOT NULL,  -- e.g., "User", "Product", "Order" 
  auditable_id VARCHAR(255) NOT NULL,    -- ID of the changed record
  
  -- Polymorphic actor (who made the change)  
  actorable_type VARCHAR(255),           -- e.g., "User", "Admin", "System"
  actorable_id VARCHAR(255),             -- ID of the actor
  
  -- Change data
  old_values JSON,                       -- Previous state
  new_values JSON,                       -- New state
  
  -- Request context
  ip VARCHAR(45),                        -- Request IP (IPv6 compatible)
  user_agent TEXT,                       -- Browser/client info
  url VARCHAR(2048),                     -- Request URL
  tags JSON,                             -- Custom metadata
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Performance indexes
  INDEX idx_auditable (auditable_type, auditable_id),
  INDEX idx_actorable (actorable_type, actorable_id), 
  INDEX idx_created_at (created_at),
  INDEX idx_event (event)
);
```

### Example Audit Records

```json
{
  "id": 1,
  "event": "created",
  "auditable_type": "User",
  "auditable_id": "123",
  "actorable_type": "Admin", 
  "actorable_id": "456",
  "old_values": null,
  "new_values": {
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  },
  "ip": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "url": "/admin/users",
  "tags": { "source": "admin-panel" },
  "created_at": "2024-01-15T10:30:00Z"
}
```

## 🛠️ Advanced Usage

### Async Configuration

```typescript
AuditModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    autoSync: config.get('AUDIT_ENABLED', true),
    onlyDirty: config.get('AUDIT_ONLY_DIRTY', false),
    auth: {
      actorModel: config.get('AUDIT_ACTOR_MODEL', 'User'),
      userIdField: config.get('AUTH_USER_ID_FIELD', 'id'),
    },
  }),
  inject: [ConfigService],
});
```

### Manual Context Management

```typescript
import { RequestContext } from '@cleancode-id/nestjs-sequelize-auditor';

// Background jobs
await RequestContext.runWithContext(
  {
    actorableType: 'System',
    actorableId: 'cleanup-job',
    tags: { 
      jobType: 'data-cleanup',
      scheduledAt: new Date().toISOString()
    }
  },
  async () => {
    await User.destroy({ where: { lastLogin: { [Op.lt]: oneYearAgo } } });
  }
);

// API integrations
await RequestContext.runWithContext(
  {
    actorableType: 'Integration', 
    actorableId: 'webhook-handler',
    tags: { webhook: 'stripe', event: 'payment.success' }
  },
  async () => {
    await Order.update({ status: 'paid' }, { where: { id: orderId } });
  }
);
```

### Field Filtering Examples

```typescript
// Only log important changes  
attachAuditHooks(User, {
  exclude: ['id', 'createdAt', 'updatedAt', 'lastLogin'],
  mask: ['password', 'ssn', 'creditCardNumber'],
  onlyDirty: true,  // Only changed fields
});

// Security-sensitive model
attachAuditHooks(PaymentMethod, {
  exclude: ['createdAt', 'updatedAt'],
  mask: ['cardNumber', 'cvv', 'accountNumber'],
  auditEvents: [AuditEvent.CREATED, AuditEvent.DELETED], // No updates logged
});
```

### Querying Audit Data

```typescript
// Find all changes to a user
const userAudits = await AuditModel.findAll({
  where: {
    auditable_type: 'User',
    auditable_id: '123'
  },
  order: [['created_at', 'DESC']]
});

// Find all changes by an admin
const adminActions = await AuditModel.findAll({
  where: {
    actorable_type: 'Admin',
    actorable_id: '456'
  }
});

// Find recent system operations
const systemAudits = await AuditModel.findAll({
  where: {
    actorable_type: 'System',
    created_at: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  }
});
```

## 🔄 Migration from v1.1.x

The v1.2.0 update introduces polymorphic fields. If upgrading from v1.1.x:

### Option 1: Fresh Start (Recommended)
1. Drop existing audit table: `DROP TABLE audits;`
2. Update to v1.2.0
3. Restart application (auto-creates new table)

### Option 2: Manual Migration
```sql
-- Add new polymorphic columns
ALTER TABLE audits 
  ADD COLUMN auditable_type VARCHAR(255),
  ADD COLUMN auditable_id VARCHAR(255), 
  ADD COLUMN actorable_type VARCHAR(255),
  ADD COLUMN actorable_id VARCHAR(255);

-- Migrate data (example for User model)
UPDATE audits SET 
  auditable_type = 'User',
  auditable_id = record_id,
  actorable_type = 'User', 
  actorable_id = actor_id;

-- Add constraints and indexes
ALTER TABLE audits 
  MODIFY auditable_type VARCHAR(255) NOT NULL,
  MODIFY auditable_id VARCHAR(255) NOT NULL;

CREATE INDEX idx_auditable ON audits (auditable_type, auditable_id);
CREATE INDEX idx_actorable ON audits (actorable_type, actorable_id);

-- Drop old columns
ALTER TABLE audits 
  DROP COLUMN table_name,
  DROP COLUMN record_id,
  DROP COLUMN actor_id;
```

## 🧪 Testing

The package includes comprehensive test coverage:

```bash
# Run example application tests
cd example
npm test

# Tests cover:
# - Request context management
# - Polymorphic audit creation
# - Field masking and exclusion
# - Different event types
# - Background job scenarios
```

## 📋 Requirements

- **Node.js** 16+
- **NestJS** 10+ or 11+
- **Sequelize** 6+ 
- **sequelize-typescript** 2+
- **Database**: PostgreSQL or MySQL

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and add tests
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature` 
6. Open a Pull Request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ by [Clean Code](https://github.com/clean-code-id)
- Inspired by Laravel's audit trail packages
- Uses Sequelize polymorphic association conventions