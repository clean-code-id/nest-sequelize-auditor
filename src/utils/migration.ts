import { QueryInterface, DataTypes } from 'sequelize';

/**
 * Generates SQL migration for creating the audits table
 */
export function generateAuditMigration(tableName = 'audits') {
  return {
    up: async (queryInterface: QueryInterface) => {
      await queryInterface.createTable(tableName, {
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
        auditable_type: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        auditable_id: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        old_values: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        new_values: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        actorable_type: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        actorable_id: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        ip: {
          type: DataTypes.STRING(45), // IPv6 compatible
          allowNull: true,
        },
        user_agent: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        url: {
          type: DataTypes.STRING(2048),
          allowNull: true,
        },
        tags: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      });

      // Add indexes for better query performance
      await queryInterface.addIndex(tableName, ['auditable_type', 'auditable_id']);
      await queryInterface.addIndex(tableName, ['actorable_type', 'actorable_id']);
      await queryInterface.addIndex(tableName, ['created_at']);
      await queryInterface.addIndex(tableName, ['event']);
    },

    down: async (queryInterface: QueryInterface) => {
      await queryInterface.dropTable(tableName);
    },
  };
}

/**
 * Generates a JavaScript migration file content
 */
export function generateMigrationFileContent(tableName = 'audits'): string {
  
  return `'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('${tableName}', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      event: {
        type: Sequelize.ENUM('created', 'updated', 'deleted', 'restored'),
        allowNull: false,
      },
      auditable_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      auditable_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      old_values: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      new_values: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      actorable_type: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      actorable_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      ip: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      url: {
        type: Sequelize.STRING(2048),
        allowNull: true,
      },
      tags: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('${tableName}', ['auditable_type', 'auditable_id']);
    await queryInterface.addIndex('${tableName}', ['actorable_type', 'actorable_id']);
    await queryInterface.addIndex('${tableName}', ['created_at']);
    await queryInterface.addIndex('${tableName}', ['event']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('${tableName}');
  }
};`;
}

/**
 * SQL script for creating the audits table (for manual execution)
 */
export function generateSQLScript(tableName = 'audits', dialect: 'postgres' | 'mysql' = 'postgres'): string {
  if (dialect === 'postgres') {
    return `-- PostgreSQL script for creating audits table
CREATE TYPE audit_event AS ENUM ('created', 'updated', 'deleted', 'restored');

CREATE TABLE ${tableName} (
    id BIGSERIAL PRIMARY KEY,
    event audit_event NOT NULL,
    auditable_type VARCHAR(255) NOT NULL,
    auditable_id VARCHAR(255) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    actorable_type VARCHAR(255),
    actorable_id VARCHAR(255),
    ip VARCHAR(45),
    user_agent TEXT,
    url VARCHAR(2048),
    tags JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_${tableName}_auditable ON ${tableName}(auditable_type, auditable_id);
CREATE INDEX idx_${tableName}_actorable ON ${tableName}(actorable_type, actorable_id);
CREATE INDEX idx_${tableName}_created_at ON ${tableName}(created_at);
CREATE INDEX idx_${tableName}_event ON ${tableName}(event);`;
  } else {
    return `-- MySQL script for creating audits table
CREATE TABLE ${tableName} (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event ENUM('created', 'updated', 'deleted', 'restored') NOT NULL,
    auditable_type VARCHAR(255) NOT NULL,
    auditable_id VARCHAR(255) NOT NULL,
    old_values JSON,
    new_values JSON,
    actorable_type VARCHAR(255),
    actorable_id VARCHAR(255),
    ip VARCHAR(45),
    user_agent TEXT,
    url VARCHAR(2048),
    tags JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_${tableName}_auditable ON ${tableName}(auditable_type, auditable_id);
CREATE INDEX idx_${tableName}_actorable ON ${tableName}(actorable_type, actorable_id);
CREATE INDEX idx_${tableName}_created_at ON ${tableName}(created_at);
CREATE INDEX idx_${tableName}_event ON ${tableName}(event);`;
  }
}