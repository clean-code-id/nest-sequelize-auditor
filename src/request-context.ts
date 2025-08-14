// AsyncLocalStorage-based request context management

import { AsyncLocalStorage } from 'async_hooks';
import type { AuditContext } from './types.js';

const contextStorage = new AsyncLocalStorage<AuditContext>();

export class RequestContext {
  static getContext(): AuditContext | undefined {
    return contextStorage.getStore();
  }

  static setContext(context: AuditContext): void {
    // Implementation pending
  }

  static runWithContext<T>(context: AuditContext, callback: () => T): T {
    return contextStorage.run(context, callback);
  }

  static updateContext(updates: Partial<AuditContext>): void {
    // Implementation pending
  }
}

export { contextStorage };