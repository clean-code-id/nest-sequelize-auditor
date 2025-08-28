# @cleancode-id/nestjs-sequelize-auditor

🔍 **Simple audit trails for NestJS + Sequelize** with zero configuration and automatic relationship tracking.

![npm version](https://img.shields.io/npm/v/@cleancode-id/nestjs-sequelize-auditor) 
![npm_downloads](https://img.shields.io/npm/dm/@cleancode-id/nestjs-sequelize-auditor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🎯 **Zero Setup** - Auto-creates audit table and relationships
- 🔄 **Complete Tracking** - CREATE, UPDATE, DELETE, RESTORE + bulk operations
- 🧵 **Smart Context** - Captures user, IP, URL from HTTP requests automatically
- 👤 **Built-in Creator** - `include: ["creator"]` works out of the box
- 🎭 **Multi-Actor Support** - Track different user types (User, Admin, System)
- 🛡️ **Data Security** - Exclude/mask sensitive fields, filter creator data globally
- 🗄️ **Multi-DB Support** - PostgreSQL, MySQL with proper indexing
- 📦 **TypeScript Native** - Full type safety, zero runtime dependencies
- 🚀 **Production Ready** - Battle-tested with comprehensive test suite

## 🚀 Quick Start

### Installation

```bash
npm install @cleancode-id/nestjs-sequelize-auditor
```

### Module Setup

```typescript
// app.module.ts
import { AuditModule } from '@cleancode-id/nestjs-sequelize-auditor';

@Module({
  imports: [
    SequelizeModule.forRoot(/* your db config */),
    AuditModule.forRoot({
      autoSync: true,                  // Auto-create audit table
      actorTypes: ['User', 'Admin'],   // Which models can be actors
      creatorFields: ['id', 'name'],   // Global: only return safe fields
      auth: {
        type: 'passport',              // Use Passport.js
        userProperty: 'user',          // req.user
        userIdField: 'id',             // req.user.id
      },
    }),
  ],
})
export class AppModule {}
```

### Model Setup

```typescript
// user.model.ts
import { Auditable, AuditEvent } from '@cleancode-id/nestjs-sequelize-auditor';

@Auditable({
  exclude: ['password', 'createdAt', 'updatedAt'],
  auditEvents: [AuditEvent.CREATED, AuditEvent.UPDATED, AuditEvent.DELETED],
})
@Table({ tableName: 'users' })
export class User extends Model {
  @Column({ primaryKey: true, autoIncrement: true })
  id: number;

  @Column
  name: string;

  @Column
  email: string;
  
  // ✨ Automatically available:
  // - audits: Audit[] relationship  
  // - creator: User virtual field (filtered by creatorFields)
  // - creationAudit: Audit relationship
}
```

### Usage Examples

```typescript
@Injectable()
export class UserService {
  constructor(@InjectModel(User) private userModel: typeof User) {}

  // Get user with creator info (only id + name, no password)
  async findWithCreator(id: number) {
    return this.userModel.findByPk(id, {
      include: ['creator']  // ✨ Automatic, secure creator data
    });
  }

  // Pagination with creator
  async getPaginated(page: number, limit: number) {
    return this.userModel.findAndCountAll({
      include: ['creator'],
      limit,
      offset: page * limit,
    });
  }

  // Get all audit history
  async getAuditHistory(id: number) {
    return this.userModel.findByPk(id, {
      include: ['audits']  // All changes to this user
    });
  }
}
```

**Example Response:**
```json
{
  "id": 123,
  "name": "John Doe",
  "email": "john@example.com", 
  "creator": {
    "id": 456,
    "name": "Admin User"
  }
}
```

## 🔧 Configuration

### AuditModule.forRoot() Options

```typescript
interface AuditModuleOptions {
  autoSync?: boolean;           // Auto-create audit table (default: true)
  actorTypes?: string[];        // Models that can be actors (default: ['User'])
  creatorFields?: string[];     // Global creator fields (default: ['id', 'name', 'email'])
  onlyDirty?: boolean;          // Global: only log changed fields (default: false)
  auth?: {
    type?: 'passport' | 'custom';  // Auth strategy (default: 'passport')
    userProperty?: string;         // req[property] (default: 'user') 
    userIdField?: string;          // user[field] (default: 'id')
  }
}
```

### @Auditable() Options

```typescript
interface AuditableConfig {
  exclude?: string[];           // Fields to skip
  mask?: string[];              // Fields to show as '***MASKED***'
  auditEvents?: AuditEvent[];   // Which operations to track
  onlyDirty?: boolean;          // Override global dirty setting
  verbose?: boolean;            // Enable debug logging
}
```

## 🎭 Multi-Actor Support

Track different types of users automatically:

```typescript
// Configure multiple actor types
AuditModule.forRoot({
  actorTypes: ['User', 'Admin', 'System'],
  // ...
})

// Different actors create different audit records
@Auditable()
export class Post extends Model {
  // Audit records will show:
  // - actorable_type: "User" | "Admin" | "System"  
  // - actorable_id: actual ID
  // - creator field resolves automatically
}
```

## 📦 Bulk Operations

Audit system automatically handles bulk operations:

```typescript
// Bulk create - creates individual audit records
await User.bulkCreate([
  { name: 'John', email: 'john@example.com' },
  { name: 'Jane', email: 'jane@example.com' },
]);

// Bulk update - captures old values automatically  
await User.update(
  { status: 'active' },
  { where: { role: 'member' } }
);

// Each affected record gets its own audit entry
```

**⚠️ Performance Note:** Bulk updates/deletes perform additional SELECT queries to capture old values. Use batching for large datasets.

## 🛠️ Advanced Usage

### Manual Context for Background Jobs

```typescript
import { RequestContext } from '@cleancode-id/nestjs-sequelize-auditor';

// Background jobs
await RequestContext.runWithContext(
  {
    actorableType: 'System',
    actorableId: 'cleanup-job',
    tags: { jobType: 'data-cleanup' }
  },
  async () => {
    await User.destroy({ where: { inactive: true } });
  }
);
```

### Querying Audit Data

```typescript
// Get all changes to a user
const userAudits = await AuditModel.findAll({
  where: {
    auditable_type: 'User',
    auditable_id: '123'
  },
  order: [['created_at', 'DESC']]
});

// Get all actions by an admin
const adminActions = await AuditModel.findAll({
  where: {
    actorable_type: 'Admin',
    actorable_id: '456'
  }
});
```

### Conditional Auditing

```typescript
// Different auditing per environment
@Auditable({
  auditEvents: process.env.NODE_ENV === 'production' 
    ? [AuditEvent.CREATED, AuditEvent.DELETED]      // Skip updates in prod
    : [AuditEvent.CREATED, AuditEvent.UPDATED, AuditEvent.DELETED]
})
export class User extends Model {}

// Security-sensitive model
@Auditable({
  mask: ['password', 'ssn'],
  auditEvents: [AuditEvent.CREATED, AuditEvent.DELETED], // No update tracking
})
export class PaymentMethod extends Model {}
```

## 📊 Database Schema

The audit table is created automatically:

```sql
CREATE TABLE audits (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event ENUM('created', 'updated', 'deleted', 'restored') NOT NULL,
  
  -- What was changed
  auditable_type VARCHAR(255) NOT NULL,  -- "User", "Post", etc.
  auditable_id VARCHAR(255) NOT NULL,
  
  -- Who made the change  
  actorable_type VARCHAR(255),           -- "User", "Admin", "System"
  actorable_id VARCHAR(255),
  
  -- Change data
  old_values JSON,                       -- Previous state
  new_values JSON,                       -- New state
  
  -- Request context
  ip VARCHAR(45),
  user_agent TEXT,
  url VARCHAR(2048),
  tags JSON,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  INDEX idx_auditable (auditable_type, auditable_id),
  INDEX idx_actorable (actorable_type, actorable_id)
);
```

## 🚀 Why Choose This Package?

### Simple Setup
- **One decorator** - just add `@Auditable()` to your models
- **Auto-initialization** - relationships created automatically  
- **Zero boilerplate** - no manual service setup required

### Secure by Default
- **Global creator filtering** - consistent data exposure control
- **Field masking** - sensitive data protection
- **Request context** - automatic IP/URL/agent capture

### Production Ready
- **Battle-tested** - comprehensive test suite
- **Performance optimized** - efficient queries and indexing  
- **TypeScript native** - full type safety

## 📋 Requirements

- **Node.js** 16+
- **NestJS** 10+ or 11+
- **Sequelize** 6+ 
- **sequelize-typescript** 2+
- **Database**: PostgreSQL or MySQL

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Built with ❤️ by [Clean Code Indonesia](https://github.com/clean-code-id)