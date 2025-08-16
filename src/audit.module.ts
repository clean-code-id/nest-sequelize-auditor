import { DynamicModule, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import type { AuditModuleOptions, AuditModuleAsyncOptions } from './types.js';
import { AuditService } from './services/audit.service.js';
import { RequestContextInterceptor } from './interceptors/RequestContextInterceptor.js';
import { setGlobalAuditOptions } from './hooks/attachAuditHooks.js';

@Module({})
export class AuditModule {
  /**
   * Register the audit module with synchronous configuration
   */
  static forRoot(options: AuditModuleOptions = {}): DynamicModule {
    // Set global options so attachAuditHooks can access them
    setGlobalAuditOptions(options);
    
    return {
      module: AuditModule,
      providers: [
        {
          provide: 'AUDIT_OPTIONS',
          useValue: options,
        },
        AuditService,
        RequestContextInterceptor,
        {
          provide: APP_INTERCEPTOR,
          useClass: RequestContextInterceptor,
        },
      ],
      exports: [AuditService, RequestContextInterceptor],
      global: options.isGlobal ?? true,
    };
  }

  /**
   * Register the audit module with asynchronous configuration
   */
  static forRootAsync(options: AuditModuleAsyncOptions): DynamicModule {
    return {
      module: AuditModule,
      imports: options.imports || [],
      providers: [
        {
          provide: 'AUDIT_OPTIONS',
          useFactory: async (...args: any[]) => {
            const resolvedOptions = options.useFactory ? await options.useFactory(...args) : {};
            // Set global options so attachAuditHooks can access them
            setGlobalAuditOptions(resolvedOptions);
            return resolvedOptions;
          },
          inject: options.inject || [],
        },
        AuditService,
        RequestContextInterceptor,
        {
          provide: APP_INTERCEPTOR,
          useClass: RequestContextInterceptor,
        },
      ],
      exports: [AuditService, RequestContextInterceptor],
      global: options.isGlobal ?? true,
    };
  }
}