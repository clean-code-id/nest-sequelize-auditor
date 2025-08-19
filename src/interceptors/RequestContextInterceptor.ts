// NestJS interceptor to automatically set audit context from request

import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestContext } from '../request-context.js';
import { UserResolverFactory } from '../resolvers/user-resolver.js';
import type { AuditContext, AuditModuleOptions } from '../types.js';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  private userResolver: any;

  constructor(@Inject('AUDIT_OPTIONS') private options: AuditModuleOptions) {
    // Create user resolver based on configuration
    this.userResolver = UserResolverFactory.create(this.options.auth || { type: 'passport' });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // Extract actor info using configurable resolver
    const actorInfo = this.userResolver.resolve(context);
    
    const auditContext: AuditContext = {
      actorableType: actorInfo?.actorableType,
      actorableId: actorInfo?.actorableId,
      ip: request.ip || request.connection?.remoteAddress,
      userAgent: request.get('User-Agent'),
      url: request.originalUrl || request.url,
      tags: {
        // Add any additional context you need
        method: request.method,
      },
    };

    // Run the request handler within the audit context
    return new Observable((observer) => {
      RequestContext.runWithContext(auditContext, () => {
        const subscription = next.handle().subscribe({
          next: (value) => observer.next(value),
          error: (error) => observer.error(error),
          complete: () => observer.complete(),
        });

        return () => subscription.unsubscribe();
      });
    });
  }
}