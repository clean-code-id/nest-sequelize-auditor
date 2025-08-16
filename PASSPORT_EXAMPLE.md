# Passport Authentication Support

The NestJS Sequelize Auditor now supports automatic user resolution for Passport.js authentication!

## Configuration

### For Standard Passport JWT (req.user.id)

```typescript
// app.module.ts
AuditModule.forRoot({
  auth: {
    type: 'passport',
    userProperty: 'user', // Default: req.user
    userIdField: 'id',    // Default: user.id
  },
});
```

### For Custom User ID Field (req.user.user_id)

```typescript
// app.module.ts - Perfect for your friend's setup!
AuditModule.forRoot({
  auth: {
    type: 'passport',
    userProperty: 'user',    // req.user
    userIdField: 'user_id',  // user.user_id (matches JWT strategy)
  },
});
```

### For JWT Standard Sub Claim (req.user.sub)

```typescript
// app.module.ts
AuditModule.forRoot({
  auth: {
    type: 'passport',
    userProperty: 'user',
    userIdField: 'sub',      // user.sub
  },
});
```

## How It Works

1. **JWT Strategy**: Your `jwt.strategy.ts` validates JWT and returns user object:
   ```typescript
   async validate(payload: { id: string; email: string }) {
     return {
       ...payload,
       user_id: payload.id // Custom mapping
     };
   }
   ```

2. **Request Flow**: 
   - Guard validates JWT → User attached to `req.user`
   - RequestContextInterceptor automatically extracts user ID
   - Sequelize hooks capture user ID seamlessly during CRUD operations

3. **Automatic Audit Trail**: 
   ```typescript
   // No manual user_id passing needed!
   @UseGuards(AuthGuard('jwt'))
   async createSalesOrder(@Body() payload: CreateDto) {
     return this.service.create(payload); // User ID captured automatically!
   }
   ```

## Migration Guide

### Before (Manual)
```typescript
async createSalesOrder(@Req() req: IRequest, @Body() payload: CreateDto) {
  const { user: { user_id } } = req;
  return this.service.create(user_id, payload); // Manual user_id
}
```

### After (Automatic)
```typescript
@UseGuards(AuthGuard('jwt'))
async createSalesOrder(@Body() payload: CreateDto) {
  return this.service.create(payload); // User ID captured automatically!
}
```

## Benefits

✅ **Zero Manual User ID Passing**  
✅ **Works with Any Passport Strategy**  
✅ **Configurable for Different User Object Structures**  
✅ **Seamless Integration with Existing Code**  
✅ **Type-Safe Configuration**

The package now automatically captures the authenticated user for your audit trail! 🎉