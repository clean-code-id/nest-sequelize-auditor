import { Injectable, Inject } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import type { AuditModuleOptions } from '../types.js';
import { defineAuditModel } from '../model/defineAuditModel.js';
import { setAuditModel } from '../utils/writeAudit.js';

@Injectable()
export class AuditService {
  private isInitialized = false;

  constructor(
    @Inject('AUDIT_OPTIONS') private readonly options: AuditModuleOptions,
  ) {}

  async initializeAuditModel(sequelize: Sequelize): Promise<void> {
    if (this.isInitialized) {
      return; // Already initialized
    }

    try {
      // Create and register audit model with the Sequelize instance
      const AuditModel = defineAuditModel(sequelize, {
        tableName: this.options.tableName || 'audits',
      });

      // Set the global audit model for the package
      setAuditModel(AuditModel);

      // Auto-sync the audit table if enabled (controlled by AuditModule.forRoot options)
      if (this.options.autoSync !== false) {
        await AuditModel.sync({ alter: this.options.alterTable ?? false });
        // eslint-disable-next-line no-console
        console.log('🎉 AuditModule: Audit table created successfully via autoSync!');
      } else {
        // eslint-disable-next-line no-console
        console.log('📋 AuditModule: Audit model registered (autoSync disabled - table not created)');
      }

      this.isInitialized = true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ AuditModule: Failed to initialize audit model:', error);
      throw error;
    }
  }
}