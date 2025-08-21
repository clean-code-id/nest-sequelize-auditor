import { Model, ModelStatic } from 'sequelize';
import { attachAuditHooks } from '../hooks/attachAuditHooks.js';
import { getAuditModel } from '../utils/writeAudit.js';
import type { AuditConfig } from '../types.js';

/**
 * Configuration for the @Auditable decorator
 * Extends the base AuditConfig with additional relationship options
 */
export interface AuditableConfig extends AuditConfig {
  /**
   * Enable automatic 'creator' virtual field that returns the user who created this record
   * @default true
   */
  enableCreatorRelationship?: boolean;
  
  /**
   * Enable automatic 'audits' relationship that returns all audit records for this model
   * @default true  
   */
  enableAuditsRelationship?: boolean;
  
  /**
   * Enable automatic 'creationAudit' relationship that returns the creation audit record
   * @default true
   */
  enableCreationAuditRelationship?: boolean;
  
  /**
   * Enable verbose logging for debugging audit setup
   * @default false
   */
  verbose?: boolean;
}

/**
 * @Auditable
 * 
 * This decorator automatically stores configuration and sets up audit functionality.
 * The actual audit hooks and relationships are created automatically when the model is ready.
 * 
 * @example
 * ```typescript
 * @Auditable({
 *   exclude: ['password', 'createdAt'],
 *   onlyDirty: true,
 *   auditEvents: [AuditEvent.CREATED, AuditEvent.UPDATED]
 * })
 * @Table({ tableName: 'users' })
 * export class User extends Model {
 *   // After initializeAuditableModel(User) is called, automatically has:
 *   // - audits: Audit[] relationship
 *   // - creator: User virtual field  
 *   // - creationAudit: Audit relationship
 * }
 * 
 * // Usage in service - call the setup once:
 * @Injectable()
 * export class UserService implements OnModuleInit {
 *   constructor(@InjectModel(User) private userModel: typeof User) {}
 *   
 *   onModuleInit() {
 *     initializeAuditableModel(this.userModel);
 *   }
 * }
 * ```
 */
// Track models that need initialization
const pendingModels = new Set<ModelStatic<any>>();

// Helper function for conditional logging
function auditLog(message: string, config?: AuditableConfig): void {
  if (config?.verbose || process.env.NODE_ENV === 'development') {
    console.log(message);
  }
}

function auditWarn(message: string, error?: any): void {
  console.warn(message, error ? (error instanceof Error ? error.message : String(error)) : '');
}

export function Auditable(config: AuditableConfig = {}) {
  return function <T extends ModelStatic<Model>>(target: T) {
    // Store the complete configuration
    (target as any)._auditableConfig = config;
    
    // Add to pending models for auto-initialization (keep for backward compatibility)
    pendingModels.add(target);
    
    // Auto-initialize when sequelize instance is attached to the model
    setupAutoInitialization(target);
    
    return target;
  };
}

/**
 * Sets up automatic initialization by hooking into when the model gets its sequelize instance
 * This approach eliminates the need for manual service initialization
 */
function setupAutoInitialization(model: ModelStatic<any>) {
  // Check if model already has sequelize instance (late decoration scenario)
  if ((model as any).sequelize) {
    const config = (model as any)._auditableConfig;
    auditLog(`🚀 Auto-initializing @Auditable model (already has sequelize): ${model.name}`, config);
    initializeAuditableModel(model).then(() => {
      pendingModels.delete(model);
      auditLog(`✅ Successfully auto-initialized @Auditable model: ${model.name}`, config);
    }).catch((error) => {
      auditWarn(`⚠️  Failed to auto-initialize ${model.name}:`, error);
    });
    return;
  }

  // Hook into the sequelize property setter to auto-initialize when attached
  let sequelizeInstance: any = null;

  Object.defineProperty(model, 'sequelize', {
    get() {
      return sequelizeInstance;
    },
    set(newSequelize) {
      sequelizeInstance = newSequelize;
      
      // Auto-initialize when sequelize is attached and we haven't initialized yet
      if (newSequelize && !(model as any)._auditInitialized) {
        (model as any)._auditInitialized = true;
        console.log(`🚀 Auto-initializing @Auditable model: ${model.name}`);
        
        // Small delay to ensure sequelize is fully attached
        process.nextTick(async () => {
          try {
            await initializeAuditableModel(model);
            pendingModels.delete(model);
            console.log(`✅ Successfully auto-initialized @Auditable model: ${model.name}`);
          } catch (error) {
            console.warn(`⚠️  Failed to auto-initialize ${model.name}:`, error instanceof Error ? error.message : String(error));
          }
        });
      }
    },
    configurable: true,
    enumerable: true
  });
}

/**
 * Initialize audit functionality for a model decorated with @Auditable
 * This creates the audit hooks and relationships at runtime when the audit model is available
 * 
 * @param model The model class decorated with @Auditable
 * 
 * @example
 * ```typescript
 * @Injectable()
 * export class UserService implements OnModuleInit {
 *   constructor(@InjectModel(User) private userModel: typeof User) {}
 *   
 *   onModuleInit() {
 *     initializeAuditableModel(this.userModel);
 *   }
 * }
 * ```
 */
export async function initializeAuditableModel<T extends Model>(model: ModelStatic<T>): Promise<void> {
  const auditableConfig = (model as any)._auditableConfig as AuditableConfig | undefined;
  
  if (!auditableConfig) {
    console.warn(`Model ${model.name} is not decorated with @Auditable but initializeAuditableModel was called`);
    return;
  }

  const {
    enableCreatorRelationship = true,
    enableAuditsRelationship = true,
    enableCreationAuditRelationship = true,
    ...auditHooksConfig
  } = auditableConfig;

  // First, attach the audit hooks (this creates the audit model asynchronously)
  attachAuditHooks(model, auditHooksConfig);

  // Wait for audit model to be ready, then create relationships
  await waitForAuditModelAndSetupRelationships(model, {
    enableCreatorRelationship,
    enableAuditsRelationship,
    enableCreationAuditRelationship,
  });
}

/**
 * Waits for the audit model to be ready and then sets up relationships
 * This ensures proper timing when audit model initialization is async
 */
async function waitForAuditModelAndSetupRelationships<T extends Model>(
  model: ModelStatic<T>,
  options: {
    enableCreatorRelationship: boolean;
    enableAuditsRelationship: boolean;
    enableCreationAuditRelationship: boolean;
  }
): Promise<void> {
  // Wait for audit model to be available (max 5 seconds)
  let attempts = 0;
  const maxAttempts = 50;
  
  while (attempts < maxAttempts) {
    const AuditModel = getAuditModel();
    if (AuditModel) {
      setupAuditRelationships(model, options);
      console.log(`✅ Set up audit relationships for ${model.name}`);
      return;
    }
    
    // Wait 100ms before next attempt
    await new Promise(resolve => globalThis.setTimeout(resolve, 100));
    attempts++;
  }
  
  console.warn(`⚠️  Timeout waiting for audit model for ${model.name}, relationships not set up`);
}

/**
 * Sets up audit relationships for a model after the audit hooks are attached
 * This must be called after attachAuditHooks creates the audit model
 */
function setupAuditRelationships<T extends Model>(
  model: ModelStatic<T>,
  options: {
    enableCreatorRelationship: boolean;
    enableAuditsRelationship: boolean;
    enableCreationAuditRelationship: boolean;
  }
): void {
  // Get the audit model that was created by attachAuditHooks
  const AuditModel = getAuditModel();
  
  if (!AuditModel) {
    console.warn(`Audit model not yet initialized for ${model.name}, relationships will be set up when available`);
    return;
  }

  if (options.enableAuditsRelationship) {
    // Add audits relationship - hasMany to all audit records for this model
    model.hasMany(AuditModel, {
      foreignKey: 'auditableId',
      scope: {
        auditableType: model.name,
      },
      constraints: false,
      as: 'audits',
    });
  }

  if (options.enableCreationAuditRelationship) {
    // Add creationAudit relationship - hasOne to the creation audit record
    model.hasOne(AuditModel, {
      foreignKey: 'auditableId',
      scope: {
        auditableType: model.name,
        event: 'created',
      },
      constraints: false,
      as: 'creationAudit',
    });
  }

  // Set up creator relationship - virtual field that gets the user who created this record
  if (options.enableCreatorRelationship) {
    setupCreatorRelationship(model, AuditModel);
  }

  // Set up audit -> actor relationship for nested includes
  // This allows accessing post.creationAudit.actor or post.audits[0].actor
  setupActorRelationship(AuditModel, model).catch(error => {
    console.warn('Failed to set up actor relationships:', error instanceof Error ? error.message : String(error));
  });
}

// Track which specific relationships we've already set up to prevent duplicates
const setupActorRelationships = new Set<string>();

// Import global audit options to access configured actorTypes

/**
 * Sets up the creator relationship that resolves through creationAudit polymorphic actor
 * This handles the actorableType logic automatically at package level
 */
function setupCreatorRelationship(model: any, AuditModel: any): void {
  try {
    const sequelize = model.sequelize;
    if (!sequelize) return;

    // Override the model's find methods to transform creator includes
    const originalFindAll = model.findAll;
    const originalFindOne = model.findOne;
    const originalFindByPk = model.findByPk;

    // Transform include: ['creator'] to include creationAudit with polymorphic actor
    const transformCreatorInclude = (options: any) => {
      if (!options || !options.include) return options;
      
      const includes = Array.isArray(options.include) ? options.include : [options.include];
      const hasCreatorInclude = includes.some((inc: any) => inc === 'creator' || (inc.as && inc.as === 'creator'));
      
      if (hasCreatorInclude) {
        // Remove 'creator' from includes
        const newIncludes = includes.filter((inc: any) => inc !== 'creator' && !(inc.as && inc.as === 'creator'));
        
        // Add creationAudit with actor include
        // Check if creationAudit is already included
        const hasCreationAudit = newIncludes.some((inc: any) => 
          inc === 'creationAudit' || (inc.as && inc.as === 'creationAudit') ||
          (inc.model === AuditModel && inc.as === 'creationAudit')
        );
        
        if (!hasCreationAudit) {
          // Build dynamic includes for all possible actor types
          const actorIncludes = [];
          
          // Get all actor associations from the AuditModel
          const associations = AuditModel.associations || {};
          const actorAssociations = Object.keys(associations).filter(key => key.startsWith('actor_'));
          
          if (actorAssociations.length > 0) {
            // Include all possible actor types - Sequelize will only populate the matching one
            actorAssociations.forEach(associationName => {
              const actorType = associationName.replace('actor_', '');
              const modelName = actorType.charAt(0).toUpperCase() + actorType.slice(1); // Capitalize
              
              actorIncludes.push({
                association: associationName,
                required: false,
                where: {
                  '$creationAudit.actorable_type$': modelName,
                },
              });
            });
          } else {
            // Fallback to User if no dynamic relationships were set up
            actorIncludes.push({
              association: 'actor_user',
              required: false,
              where: {
                '$creationAudit.actorable_type$': 'User',
              },
            });
          }
          
          newIncludes.push({
            model: AuditModel,
            as: 'creationAudit',
            include: actorIncludes,
            required: false,
          });
        }
        
        options.include = newIncludes;
        
        // Mark that we need to populate creator field
        options._populateCreator = true;
      }
      
      return options;
    };

    // Add afterFind hook to populate creator from creationAudit.actor
    model.addHook('afterFind', async (result: any, options: any) => {
      if (!options._populateCreator || !result) return;
      
      const instances = Array.isArray(result) ? result : [result];
      
      instances.forEach((instance: any) => {
        if (instance && instance.creationAudit) {
          // Look for any populated actor relationship (actor_user, actor_admin, etc.)
          let foundActor: any = null;
          
          // Check all possible actor fields
          Object.keys(instance.creationAudit.dataValues || {}).forEach(key => {
            if (key.startsWith('actor_') && instance.creationAudit[key]) {
              foundActor = instance.creationAudit[key];
            }
          });
          
          // Also check direct properties (not just dataValues)
          Object.keys(instance.creationAudit).forEach(key => {
            if (key.startsWith('actor_') && instance.creationAudit[key] && !foundActor) {
              foundActor = instance.creationAudit[key];
            }
          });
          
          if (foundActor) {
            // Map the found actor to creator field
            instance.dataValues.creator = foundActor;
            instance.creator = foundActor;
          } else {
            // If creationAudit exists but no actor, set creator to null
            instance.dataValues.creator = null;
            instance.creator = null;
          }
          
          // Remove creationAudit from response since we only want the creator field
          delete instance.dataValues.creationAudit;
          delete instance.creationAudit;
        }
      });
    });

    // Override findAll
    model.findAll = function(options: any = {}) {
      const transformedOptions = transformCreatorInclude(options);
      return originalFindAll.call(this, transformedOptions);
    };

    // Override findOne
    model.findOne = function(options: any = {}) {
      const transformedOptions = transformCreatorInclude(options);
      return originalFindOne.call(this, transformedOptions);
    };

    // Override findByPk
    model.findByPk = function(id: any, options: any = {}) {
      const transformedOptions = transformCreatorInclude(options);
      return originalFindByPk.call(this, id, transformedOptions);
    };

    console.log(`✅ Set up creator relationship for ${model.name}`);
  } catch (error) {
    console.warn(`Could not set up creator relationship for ${model.name}:`, error instanceof Error ? error.message : String(error));
  }
}

/**
 * Sets up audit -> actor relationships for configured actor models
 * Uses the actorTypes from AuditModule.forRoot() configuration
 */
async function setupActorRelationship(AuditModel: any, triggeringModel: any): Promise<void> {
  if (!AuditModel) {
    return;
  }
  
  // Check if we've already set up relationships for this AuditModel
  const auditModelKey = `${AuditModel.name || 'AuditModel'}_relationships`;
  if (setupActorRelationships.has(auditModelKey)) {
    return;
  }
  
  // Mark this AuditModel as being processed
  setupActorRelationships.add(auditModelKey);

  try {
    const sequelize = triggeringModel.sequelize;
    if (!sequelize) {
      return;
    }

    // Get configured actor types from AuditModule.forRoot()
    const { getGlobalAuditOptions } = await import('../hooks/attachAuditHooks.js');
    const globalOptions = getGlobalAuditOptions();
    const configuredActorTypes = globalOptions?.actorTypes || ['User']; // Default to ['User'] if not configured

    let relationshipsCreated = 0;
    
    configuredActorTypes.forEach((actorType: string) => {
      const ActorModel = sequelize.models[actorType];
      if (ActorModel) {
        try {
          const aliasName = `actor_${actorType.toLowerCase()}`;
          
          AuditModel.belongsTo(ActorModel, {
            foreignKey: 'actorableId',
            constraints: false,
            as: aliasName,
          });
          
          relationshipsCreated++;
          console.log(`✅ Set up audit -> ${actorType} relationship (as: ${aliasName}) [configured]`);
        } catch (error) {
          console.warn(`Could not set up audit -> ${actorType} relationship:`, error instanceof Error ? error.message : String(error));
        }
      } else {
        console.warn(`Configured actor model '${actorType}' not found in sequelize.models`);
      }
    });
    
    if (relationshipsCreated > 0) {
      console.log(`✅ Set up ${relationshipsCreated} audit -> actor relationships (from AuditModule configuration)`);
    }
  } catch (error) {
    console.warn('Could not set up audit -> actor relationships:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Initialize audit functionality for multiple models decorated with @Auditable
 * Convenience method for services that handle multiple auditable models
 * 
 * @param models Array of model classes decorated with @Auditable
 * 
 * @example
 * ```typescript
 * @Injectable()
 * export class CombinedService implements OnModuleInit {
 *   constructor(
 *     @InjectModel(User) private userModel: typeof User,
 *     @InjectModel(Post) private postModel: typeof Post,
 *   ) {}
 *   
 *   onModuleInit() {
 *     initializeAuditableModels(this.userModel, this.postModel);
 *   }
 * }
 * ```
 */
export async function initializeAuditableModels(...models: ModelStatic<any>[]): Promise<void> {
  await Promise.all(models.map(model => initializeAuditableModel(model)));
}

/**
 * Force initialization of all pending @Auditable models
 * This can be called from the application startup to ensure all models are initialized
 * 
 * @example
 * ```typescript
 * // In your main.ts or app initialization
 * import { initializeAllAuditableModels } from '@cleancode-id/nestjs-sequelize-auditor';
 * 
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule);
 *   
 *   // Force initialize all @Auditable models after app is created
 *   initializeAllAuditableModels();
 *   
 *   await app.listen(3000);
 * }
 * ```
 */
export async function initializeAllAuditableModels(): Promise<void> {
  console.log(`🔄 Force-initializing ${pendingModels.size} @Auditable models...`);
  
  // Create a copy to avoid modification during iteration
  const modelsToInit = Array.from(pendingModels);
  
  for (const model of modelsToInit) {
    try {
      await initializeAuditableModel(model);
      pendingModels.delete(model);
      console.log(`✅ Auto-initialized @Auditable model: ${model.name}`);
    } catch (error) {
      console.warn(`⚠️  Could not auto-initialize ${model.name}:`, error instanceof Error ? error.message : String(error));
    }
  }
  
  if (pendingModels.size > 0) {
    console.warn(`⚠️  ${pendingModels.size} @Auditable models could not be auto-initialized. You may need to call initializeAuditableModel manually.`);
  }
}