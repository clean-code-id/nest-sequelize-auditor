# @cleancode-id/nestjs-sequelize-auditor

🔍 **Polymorphic audit trails for NestJS + Sequelize** with zero configuration and full request context tracking.

[![npm version](https://badge.fury.io/js/@cleancode-id%2Fnestjs-sequelize-auditor.svg)](https://badge.fury.io/js/@cleancode-id%2Fnestjs-sequelize-auditor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🎯 **Zero Setup** - Auto-creates audit table, hooks into your models automatically
- 🔄 **Complete Tracking** - CREATE, UPDATE, DELETE, RESTORE operations + **Bulk Operations** (with performance considerations)
- 🧵 **Smart Context** - Captures user, IP, URL, tags from HTTP requests via AsyncLocalStorage
- 🎭 **Polymorphic Support** - Track any entity type and actor type with Sequelize conventions
- 🎛️ **Selective Auditing** - Choose which events and fields to track
- 🗜️ **Dirty Field Mode** - Log only changed fields vs complete state (configurable)
- 🛡️ **Data Security** - Exclude or mask sensitive fields (passwords, PII)
- 🗄️ **Multi-DB Support** - PostgreSQL, MySQL with proper indexing
- 📦 **TypeScript Native** - Full type safety, zero runtime dependencies
- 🚀 **Production Ready** - Battle-tested with comprehensive test suite

## 🆕 What's New in v2.0.0

- **🔄 Bulk Operations Support**: Individual record tracking for `bulkCreate`, `bulkUpdate`, and `bulkDestroy`
- **🎯 Enhanced onlyDirty Mode**: Improved dirty field detection for both individual and bulk operations
- **⚡ Performance Optimizations**: Intelligent query handling with comprehensive performance guidelines
- **🎭 Polymorphic Architecture**: Full support for multiple entity types and actor types
- **📚 Comprehensive Documentation**: Complete performance guidelines and best practices

## 📚 Table of Contents

> 💡 **New to bulk operations?** Be sure to read [⚠️ Performance & Limitations](#️-performance--limitations) for important performance considerations.

- [🚀 Quick Start](#-quick-start)
  - [Installation](#installation)
  - [Basic Setup](#basic-setup)
  - [Enable Auditing for Models](#enable-auditing-for-models)
- [🔧 Configuration](#-configuration)
  - [Module Configuration](#module-configuration)
  - [Per-Model Configuration](#per-model-configuration)
- [🎭 Polymorphic Support](#-polymorphic-support)
  - [Different Entity Types](#different-entity-types)
  - [Different Actor Types](#different-actor-types)
- [📦 Bulk Operations Support](#-bulk-operations-support)
  - [Bulk Create](#bulk-create)
  - [Bulk Update - Individual Record Tracking](#bulk-update---individual-record-tracking)
  - [Bulk Delete - Individual Record Tracking](#bulk-delete---individual-record-tracking)
  - [Performance Considerations](#performance-considerations)
  - [onlyDirty Mode with Bulk Operations](#onlydirty-mode-with-bulk-operations)
  - [Bulk Operation Context](#bulk-operation-context)
- [📊 Database Schema](#-database-schema)
  - [Audit Table Structure](#audit-table-structure)
  - [Example Audit Records](#example-audit-records)
- [⚠️ Performance & Limitations](#️-performance--limitations)
  - [Bulk Operations Performance Impact](#bulk-operations-performance-impact)
  - [Recommended Patterns](#recommended-patterns)
  - [Memory Considerations](#memory-considerations)
- [🛠️ Advanced Usage](#️-advanced-usage)
  - [Async Configuration](#async-configuration)
  - [Manual Context Management](#manual-context-management)
  - [Field Filtering Examples](#field-filtering-examples)
  - [Querying Audit Data](#querying-audit-data)
- [🧪 Testing](#-testing)
- [📋 Requirements](#-requirements)
- [🤝 Contributing](#-contributing)
- [📝 License](#-license)
- [🙏 Acknowledgments](#-acknowledgments)

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

## 📦 Bulk Operations Support

The audit system automatically tracks Sequelize bulk operations with **individual record tracking** for complete audit trails.

> ⚠️ **PERFORMANCE WARNING**: Bulk update and delete operations trigger additional SELECT queries to capture old values before the operation. This can significantly impact performance for large datasets. Use with caution in high-volume environments.

### Bulk Create
For `bulkCreate`, individual audit records are created for each instance:

```typescript
// This will create 3 separate audit records
const users = await User.bulkCreate([
  { name: 'John', email: 'john@example.com' },
  { name: 'Jane', email: 'jane@example.com' },  
  { name: 'Bob', email: 'bob@example.com' },
]);

// Each audit record will have:
// - event: "created"
// - auditableType: "User"
// - auditableId: [individual user ID]  
// - newValues: { name: "John", email: "john@example.com" }
// - tags: { bulkOperation: true, affectedCount: 3 }
```

### Bulk Update - Individual Record Tracking
⚠️ **Performance Impact**: Each bulk update triggers `SELECT * FROM table WHERE condition` before the update to capture old values.

```typescript
// Updates 2 users: performs SELECT + UPDATE queries
await User.update(
  { status: 'inactive', phone: '555-9999' },
  { where: { id: [4, 7] } }
);

// Creates 2 separate audit records:
// Record 1:
// - event: "updated"
// - auditableType: "User" 
// - auditableId: 4
// - oldValues: { status: "active", phone: "555-1234" }  // ← Fetched via SELECT
// - newValues: { status: "inactive", phone: "555-9999" }
// - tags: { bulkOperation: true, affectedCount: 2 }

// Record 2: 
// - auditableId: 7, oldValues: { status: "active", phone: "555-5678" }, etc.
```

### Bulk Delete - Individual Record Tracking  
⚠️ **Performance Impact**: Each bulk delete triggers `SELECT * FROM table WHERE condition` before deletion to capture old values.

```typescript
// Deletes 2 users: performs SELECT + DELETE queries
await User.destroy({
  where: { status: 'archived' }
});

// Creates 2 separate audit records:
// Record 1:
// - event: "deleted"
// - auditableType: "User"
// - auditableId: 4  
// - oldValues: { name: "John", status: "archived", ... }  // ← Fetched via SELECT
// - newValues: null
// - tags: { bulkOperation: true, affectedCount: 2 }

// Record 2: auditableId: 7, etc.
```

### Performance Considerations

```typescript
// ❌ AVOID: Large bulk operations with auditing enabled
await User.update(
  { lastActive: new Date() },
  { where: {} } // Updates ALL users - very expensive with auditing!
);

// ✅ PREFERRED: Batch processing for large datasets  
const BATCH_SIZE = 100;
const users = await User.findAll({ attributes: ['id'] });

for (let i = 0; i < users.length; i += BATCH_SIZE) {
  const batch = users.slice(i, i + BATCH_SIZE);
  const ids = batch.map(u => u.id);
  
  await User.update(
    { lastActive: new Date() },
    { where: { id: { [Op.in]: ids } } }
  );
  
  // Small batch = manageable SELECT overhead
}

// ✅ ALTERNATIVE: Disable auditing for performance-critical operations
attachAuditHooks(User, {
  auditEvents: [AuditEvent.CREATED, AuditEvent.DELETED] // Skip UPDATE events
});
```

### onlyDirty Mode with Bulk Operations

When `onlyDirty: true`, both old and new values contain only changed fields:

```typescript
// Configuration
attachAuditHooks(User, { onlyDirty: true });

// Update operation
await User.update(
  { phone: '555-NEW' },
  { where: { id: [4, 7] } }
);

// Audit records will have:
// oldValues: { phone: "555-OLD" }      // ← Only changed field
// newValues: { phone: "555-NEW" }      // ← Only changed field
// (name, email, etc. are excluded since they didn't change)
```

### Bulk Operation Context
Use `RequestContext` to add metadata for bulk operations:

```typescript
await RequestContext.runWithContext(
  {
    actorableType: 'System',
    actorableId: 'cleanup-job-001',
    tags: { 
      jobType: 'user-cleanup',
      batchId: 'batch-2024-001' 
    }
  },
  async () => {
    await User.destroy({ 
      where: { deletedAt: { [Op.lt]: new Date('2023-01-01') } }
    });
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

## ⚠️ Performance & Limitations

### Bulk Operations Performance Impact

**Critical**: Bulk update and delete operations have significant performance implications:

```typescript
// This innocent-looking bulk update:
await User.update({ lastActive: new Date() }, { where: { active: true } });

// Actually performs TWO queries:
// 1. SELECT * FROM users WHERE active = true;     // ← Additional overhead!
// 2. UPDATE users SET lastActive = ? WHERE active = true;
```

**Why this happens:**
- To create accurate audit trails, we need the old values before modification
- Sequelize bulk operations don't provide access to the affected records
- We must perform a `SELECT` query before each bulk `UPDATE`/`DELETE`

**Performance guidelines:**

| Dataset Size | Recommendation | Query Overhead |
|--------------|----------------|----------------|
| < 100 records | ✅ Safe to use | Minimal impact |
| 100-1000 records | ⚠️ Monitor carefully | Moderate impact |
| > 1000 records | ❌ Use batching or disable | Significant impact |

### Recommended Patterns

```typescript
// ❌ Dangerous for large datasets
await User.update({ status: 'verified' }, { where: {} }); // ALL users!

// ✅ Batch processing for safety
async function bulkUpdateWithBatching(updates: any, batchSize = 100) {
  const userIds = await User.findAll({ 
    attributes: ['id'],
    where: { needsUpdate: true }
  });
  
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const ids = batch.map(u => u.id);
    
    await User.update(updates, { 
      where: { id: { [Op.in]: ids } } 
    });
  }
}

// ✅ Selective auditing for performance-critical models
attachAuditHooks(MetricsLog, {
  auditEvents: [AuditEvent.CREATED], // Only audit creation, skip updates/deletes
});

// ✅ Conditional auditing based on environment
attachAuditHooks(User, {
  auditEvents: process.env.NODE_ENV === 'production' 
    ? [AuditEvent.CREATED, AuditEvent.DELETED]  // Skip updates in production
    : [AuditEvent.CREATED, AuditEvent.UPDATED, AuditEvent.DELETED] // Full auditing in dev
});
```

### Memory Considerations

Large bulk operations can consume significant memory:

```typescript
// This could load thousands of records into memory:
await User.update({ status: 'inactive' }, { 
  where: { lastLogin: { [Op.lt]: oneYearAgo } } 
});
```

**Mitigation strategies:**
- Use specific WHERE clauses to limit affected records
- Implement batch processing with reasonable batch sizes
- Monitor memory usage during bulk operations
- Consider using streaming for very large datasets

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