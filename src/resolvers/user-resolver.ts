// User resolver for extracting authenticated user from request context

import { ExecutionContext } from '@nestjs/common';
import type { AuthConfig } from '../types.js';

export interface UserResolver {
  resolve(context: ExecutionContext): any;
}

export class PassportUserResolver implements UserResolver {
  private userProperty: string;
  private userIdField: string;

  constructor(config: AuthConfig = {}) {
    this.userProperty = config.userProperty || 'user';
    this.userIdField = config.userIdField || 'id';
  }

  resolve(context: ExecutionContext): any {
    const request = context.switchToHttp().getRequest();
    const user = request[this.userProperty];
    
    if (!user) {
      return null;
    }

    // Support nested field paths like 'user_id' or 'sub'
    return user[this.userIdField] || null;
  }
}

export class UserResolverFactory {
  static create(config: AuthConfig = {}): UserResolver {
    const resolverType = config.type || 'passport';
    
    switch (resolverType) {
      case 'passport':
        return new PassportUserResolver(config);
      case 'custom':
        // For future custom implementations
        return new PassportUserResolver(config);
      default:
        // Default to passport resolver
        return new PassportUserResolver(config);
    }
  }
}