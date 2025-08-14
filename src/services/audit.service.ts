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

      // Auto-sync the audit table if enabled
      if (this.options.autoSync !== false) {
        await AuditModel.sync({ alter: this.options.alterTable ?? false });
      }

      this.isInitialized = true;
      console.log('🎉 AuditService: Audit model registered and table created successfully!');
    } catch (error) {
      console.error('❌ AuditService: Failed to initialize audit model:', error);
      throw error;
    }
  }
}