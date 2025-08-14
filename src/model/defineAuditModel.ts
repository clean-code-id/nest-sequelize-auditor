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
    type: DataTypes.JSONB,
    allowNull: true,
  })
  oldValues?: Record<string, any>;

  @Column({
    type: DataTypes.JSONB,
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
    type: DataTypes.JSONB,
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

export function defineAuditModel(
  sequelize: Sequelize,
  options: AuditModelOptions = {}
): typeof AuditModel {
  // Implementation pending - customize model based on options
  return AuditModel;
}