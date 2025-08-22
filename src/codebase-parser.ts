import { parse } from '@typescript-eslint/parser';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

export interface AngularComponent {
  name: string;
  selector?: string;
  templateUrl?: string;
  styleUrls?: string[];
  inputs: string[];
  outputs: string[];
  methods: MethodInfo[];
  filePath: string;
}

export interface AngularService {
  name: string;
  injectable: boolean;
  providedIn?: string;
  methods: MethodInfo[];
  properties: PropertyInfo[];
  dependencies: string[];
  filePath: string;
}

export interface MethodInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType?: string;
  isAsync: boolean;
  visibility: 'public' | 'private' | 'protected';
}

export interface ParameterInfo {
  name: string;
  type?: string;
  optional: boolean;
  defaultValue?: string;
}

export interface PropertyInfo {
  name: string;
  type?: string;
  visibility: 'public' | 'private' | 'protected';
  readonly: boolean;
}

export interface ParsedCodebase {
  components: AngularComponent[];
  services: AngularService[];
  interfaces: InterfaceInfo[];
  models: ModelInfo[];
}

export interface InterfaceInfo {
  name: string;
  properties: PropertyInfo[];
  filePath: string;
  extends?: string[];
}

export interface ModelInfo {
  name: string;
  properties: PropertyInfo[];
  filePath: string;
}

export class CodebaseParser {
  private components: AngularComponent[] = [];
  private services: AngularService[] = [];
  private interfaces: InterfaceInfo[] = [];
  private models: ModelInfo[] = [];

  async parseCodebase(rootPath: string): Promise<ParsedCodebase> {
    logger.info(`Parsing codebase at: ${rootPath}`);
    
    this.components = [];
    this.services = [];
    this.interfaces = [];
    this.models = [];

    await this.walkDirectory(rootPath);

    logger.info(`Parsed: ${this.components.length} components, ${this.services.length} services`);

    return {
      components: this.components,
      services: this.services,
      interfaces: this.interfaces,
      models: this.models
    };
  }

  private async walkDirectory(dir: string): Promise<void> {
    const files = readdirSync(dir);

    for (const file of files) {
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip node_modules and other non-source directories
        if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist') {
          await this.walkDirectory(fullPath);
        }
      } else if (file.endsWith('.ts') && !file.endsWith('.spec.ts')) {
        await this.parseFile(fullPath);
      }
    }
  }

  private async parseFile(filePath: string): Promise<void> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Quick checks to determine file type
      if (content.includes('@Component')) {
        await this.parseComponent(filePath, content);
      } else if (content.includes('@Injectable')) {
        await this.parseService(filePath, content);
      } else if (content.includes('interface ') || content.includes('export interface')) {
        await this.parseInterfaces(filePath, content);
      } else if (content.includes('class ') && (content.includes('model') || content.includes('Model'))) {
        await this.parseModels(filePath, content);
      }
    } catch (error) {
      logger.warn(`Failed to parse ${filePath}: ${error}`);
    }
  }

  private async parseComponent(filePath: string, content: string): Promise<void> {
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        tokens: true,
        comment: true,
        jsx: false
      });

      const component: AngularComponent = {
        name: '',
        inputs: [],
        outputs: [],
        methods: [],
        filePath
      };

      // Find the component class
      this.walkAST(ast, (node: any) => {
        if (node.type === AST_NODE_TYPES.ClassDeclaration && node.decorators) {
          const componentDecorator = node.decorators.find((d: any) => 
            d.expression?.callee?.name === 'Component'
          );

          if (componentDecorator) {
            component.name = node.id.name;

            // Parse decorator metadata
            if (componentDecorator.expression.arguments?.[0]) {
              const metadata = componentDecorator.expression.arguments[0];
              this.extractComponentMetadata(metadata, component);
            }

            // Parse class members
            node.body.body.forEach((member: any) => {
              if (member.type === AST_NODE_TYPES.PropertyDefinition) {
                // Check for @Input and @Output decorators
                if (member.decorators) {
                  member.decorators.forEach((decorator: any) => {
                    if (decorator.expression?.callee?.name === 'Input') {
                      component.inputs.push(member.key.name);
                    } else if (decorator.expression?.callee?.name === 'Output') {
                      component.outputs.push(member.key.name);
                    }
                  });
                }
              } else if (member.type === AST_NODE_TYPES.MethodDefinition) {
                component.methods.push(this.extractMethodInfo(member));
              }
            });
          }
        }
      });

      if (component.name) {
        this.components.push(component);
        logger.debug(`Parsed component: ${component.name}`);
      }
    } catch (error) {
      logger.warn(`Failed to parse component in ${filePath}: ${error}`);
    }
  }

  private async parseService(filePath: string, content: string): Promise<void> {
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        tokens: true,
        comment: true,
        jsx: false
      });

      const service: AngularService = {
        name: '',
        injectable: false,
        methods: [],
        properties: [],
        dependencies: [],
        filePath
      };

      this.walkAST(ast, (node: any) => {
        if (node.type === AST_NODE_TYPES.ClassDeclaration && node.decorators) {
          const injectableDecorator = node.decorators.find((d: any) => 
            d.expression?.callee?.name === 'Injectable'
          );

          if (injectableDecorator) {
            service.name = node.id.name;
            service.injectable = true;

            // Extract providedIn
            if (injectableDecorator.expression.arguments?.[0]) {
              const metadata = injectableDecorator.expression.arguments[0];
              if (metadata.properties) {
                const providedInProp = metadata.properties.find((p: any) => 
                  p.key?.name === 'providedIn'
                );
                if (providedInProp) {
                  service.providedIn = providedInProp.value?.value || 'root';
                }
              }
            }

            // Parse constructor for dependencies
            const constructor = node.body.body.find((member: any) => 
              member.type === AST_NODE_TYPES.MethodDefinition && member.key.name === 'constructor'
            );
            
            if (constructor?.value?.params) {
              constructor.value.params.forEach((param: any) => {
                if (param.typeAnnotation?.typeAnnotation?.typeName?.name) {
                  service.dependencies.push(param.typeAnnotation.typeAnnotation.typeName.name);
                }
              });
            }

            // Parse class members
            node.body.body.forEach((member: any) => {
              if (member.type === AST_NODE_TYPES.PropertyDefinition) {
                service.properties.push(this.extractPropertyInfo(member));
              } else if (member.type === AST_NODE_TYPES.MethodDefinition && member.key.name !== 'constructor') {
                service.methods.push(this.extractMethodInfo(member));
              }
            });
          }
        }
      });

      if (service.name) {
        this.services.push(service);
        logger.debug(`Parsed service: ${service.name}`);
      }
    } catch (error) {
      logger.warn(`Failed to parse service in ${filePath}: ${error}`);
    }
  }

  private async parseInterfaces(filePath: string, content: string): Promise<void> {
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        tokens: true,
        comment: true,
        jsx: false
      });

      this.walkAST(ast, (node: any) => {
        if (node.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
          const interfaceInfo: InterfaceInfo = {
            name: node.id.name,
            properties: [],
            filePath
          };

          if (node.extends) {
            interfaceInfo.extends = node.extends.map((e: any) => e.expression.name);
          }

          node.body.body.forEach((member: any) => {
            if (member.type === AST_NODE_TYPES.TSPropertySignature) {
              interfaceInfo.properties.push({
                name: member.key.name,
                type: this.getTypeString(member.typeAnnotation?.typeAnnotation),
                visibility: 'public',
                readonly: member.readonly || false
              });
            }
          });

          this.interfaces.push(interfaceInfo);
          logger.debug(`Parsed interface: ${interfaceInfo.name}`);
        }
      });
    } catch (error) {
      logger.warn(`Failed to parse interfaces in ${filePath}: ${error}`);
    }
  }

  private async parseModels(filePath: string, content: string): Promise<void> {
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        tokens: true,
        comment: true,
        jsx: false
      });

      this.walkAST(ast, (node: any) => {
        if (node.type === AST_NODE_TYPES.ClassDeclaration && 
            (node.id.name.includes('Model') || filePath.includes('model'))) {
          const model: ModelInfo = {
            name: node.id.name,
            properties: [],
            filePath
          };

          node.body.body.forEach((member: any) => {
            if (member.type === AST_NODE_TYPES.PropertyDefinition) {
              model.properties.push(this.extractPropertyInfo(member));
            }
          });

          this.models.push(model);
          logger.debug(`Parsed model: ${model.name}`);
        }
      });
    } catch (error) {
      logger.warn(`Failed to parse models in ${filePath}: ${error}`);
    }
  }

  private extractComponentMetadata(metadata: any, component: AngularComponent): void {
    if (metadata.properties) {
      metadata.properties.forEach((prop: any) => {
        switch (prop.key?.name) {
          case 'selector':
            component.selector = prop.value?.value;
            break;
          case 'templateUrl':
            component.templateUrl = prop.value?.value;
            break;
          case 'styleUrls':
            if (prop.value?.elements) {
              component.styleUrls = prop.value.elements.map((e: any) => e.value);
            }
            break;
        }
      });
    }
  }

  private extractMethodInfo(node: any): MethodInfo {
    return {
      name: node.key.name,
      parameters: node.value.params.map((param: any) => ({
        name: param.name,
        type: this.getTypeString(param.typeAnnotation?.typeAnnotation),
        optional: param.optional || false,
        defaultValue: param.right?.value
      })),
      returnType: this.getTypeString(node.value.returnType?.typeAnnotation),
      isAsync: node.value.async || false,
      visibility: node.accessibility || 'public'
    };
  }

  private extractPropertyInfo(node: any): PropertyInfo {
    return {
      name: node.key.name,
      type: this.getTypeString(node.typeAnnotation?.typeAnnotation),
      visibility: node.accessibility || 'public',
      readonly: node.readonly || false
    };
  }

  private getTypeString(typeNode: any): string | undefined {
    if (!typeNode) return undefined;

    switch (typeNode.type) {
      case AST_NODE_TYPES.TSStringKeyword:
        return 'string';
      case AST_NODE_TYPES.TSNumberKeyword:
        return 'number';
      case AST_NODE_TYPES.TSBooleanKeyword:
        return 'boolean';
      case AST_NODE_TYPES.TSAnyKeyword:
        return 'any';
      case AST_NODE_TYPES.TSVoidKeyword:
        return 'void';
      case AST_NODE_TYPES.TSTypeReference:
        return typeNode.typeName.name;
      case AST_NODE_TYPES.TSArrayType:
        return `${this.getTypeString(typeNode.elementType)}[]`;
      default:
        return 'unknown';
    }
  }

  private walkAST(node: any, callback: (node: any) => void): void {
    callback(node);
    
    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          node[key].forEach((child: any) => {
            if (child && typeof child === 'object') {
              this.walkAST(child, callback);
            }
          });
        } else {
          this.walkAST(node[key], callback);
        }
      }
    }
  }
}