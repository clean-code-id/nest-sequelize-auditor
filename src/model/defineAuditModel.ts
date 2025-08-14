// Helper function to create audit trail model with Sequelize

import { Model, DataTypes, Sequelize } from 'sequelize';
import { Table, Column, PrimaryKey, AutoIncrement, CreatedAt } from 'sequelize-typescript';
import type { AuditRecord, AuditModelOptions } from '../types.js';

@Table({
  tableName: 'audits',
  timestamps: false,
})
export class AuditModel extends Model<AuditRecord> implements AuditRecord {
  @PrimaryKey
  @AutoIncrement
  @Column(DataTypes.BIGINT)
  id!: number;

  @Column({
    type: DataTypes.ENUM('create', 'update', 'delete', 'restore'),
    allowNull: false,
  })
  event!: 'create' | 'update' | 'delete' | 'restore';

  @Column({
    type: DataTypes.STRING,
    allowNull: false,
  })
  table!: string;

  @Column({
    type: DataTypes.STRING,
    allowNull: false,
  })
  recordId!: string | number;

  @Column({
    type: DataTypes.JSON,
    allowNull: true,
  })
  oldValues?: Record<string, any>;

  @Column({
    type: DataTypes.JSON,
    allowNull: true,
  })
  newValues?: Record<string, any>;

  @Column({
    type: DataTypes.STRING,
    allowNull: true,
  })
  userId?: string | number;

  @Column({
    type: DataTypes.STRING,
    allowNull: true,
  })
  ip?: string;

  @Column({
    type: DataTypes.TEXT,
    allowNull: true,
  })
  userAgent?: string;

  @Column({
    type: DataTypes.STRING,
    allowNull: true,
  })
  url?: string;

  @Column({
    type: DataTypes.JSON,
    allowNull: true,
  })
  tags?: Record<string, any>;

  @CreatedAt
  @Column({
    type: DataTypes.DATE,
    allowNull: false,
  })
  createdAt!: Date;
}

export function defineAuditModel(sequelize: Sequelize, options: AuditModelOptions = {}): any {
  // Define audit model using raw Sequelize with proper snake_case column names
  const AuditModel = sequelize.define(
    options.tableName || 'audits',
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      event: {
        type: DataTypes.ENUM('create', 'update', 'delete', 'restore'),
        allowNull: false,
      },
      table: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'table_name',
      },
      recordId: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'record_id',
      },
      oldValues: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'old_values',
      },
      newValues: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'new_values',
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'user_id',
      },
      ip: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'user_agent',
      },
      url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      tags: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },
    },
    {
      tableName: options.tableName || 'audits',
      timestamps: false,
    }
  );

  return AuditModel;
}
