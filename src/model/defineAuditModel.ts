// Helper function to create audit trail model with Sequelize

import { Model, DataTypes, Sequelize, ModelStatic } from 'sequelize';
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
    type: DataTypes.ENUM('created', 'updated', 'deleted', 'restored'),
    allowNull: false,
  })
  event!: 'created' | 'updated' | 'deleted' | 'restored';

  @Column({
    type: DataTypes.STRING,
    allowNull: false,
  })
  auditableType!: string;

  @Column({
    type: DataTypes.STRING,
    allowNull: false,
  })
  auditableId!: string | number;

  @Column({
    type: DataTypes.JSON,
    allowNull: true,
  })
  oldValues?: Record<string, unknown>;

  @Column({
    type: DataTypes.JSON,
    allowNull: true,
  })
  newValues?: Record<string, unknown>;

  @Column({
    type: DataTypes.STRING,
    allowNull: true,
  })
  actorableType?: string;

  @Column({
    type: DataTypes.STRING,
    allowNull: true,
  })
  actorableId?: string | number;

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
  tags?: Record<string, unknown>;

  @CreatedAt
  @Column({
    type: DataTypes.DATE,
    allowNull: false,
  })
  createdAt!: Date;
}

export function defineAuditModel(sequelize: Sequelize, options: AuditModelOptions = {}): ModelStatic<Model> {
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
        type: DataTypes.ENUM('created', 'updated', 'deleted', 'restored'),
        allowNull: false,
      },
      auditableType: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'auditable_type',
      },
      auditableId: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'auditable_id',
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
      actorableType: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'actorable_type',
      },
      actorableId: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'actorable_id',
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
      underscored: true,
    }
  );

  return AuditModel;
}
