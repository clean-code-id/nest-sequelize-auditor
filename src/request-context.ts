// AsyncLocalStorage-based request context management

import { AsyncLocalStorage } from 'async_hooks';
import type { AuditContext } from './types.js';

const contextStorage = new AsyncLocalStorage<AuditContext>();

export class RequestContext {
  static getContext(): AuditContext | undefined {
    return contextStorage.getStore();
  }

  static setContext(context: AuditContext): void {
    const currentContext = contextStorage.getStore() || {};
    contextStorage.enterWith({ ...currentContext, ...context });
  }

  static runWithContext<T>(context: AuditContext, callback: () => T): T {
    return contextStorage.run(context, callback);
  }

  static updateContext(updates: Partial<AuditContext>): void {
    const currentContext = contextStorage.getStore() || {};
    contextStorage.enterWith({ ...currentContext, ...updates });
  }
}

export { contextStorage };

// Convenience function for setting request context
export function setRequestContext(context: AuditContext): void {
  RequestContext.setContext(context);
}