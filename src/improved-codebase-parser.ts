import { parse } from '@typescript-eslint/parser';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname, relative } from 'path';
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

export interface KnowledgeGraphIndex {
  version: string;
  created: string;
  totalSize: number;
  chunks: ChunkInfo[];
  summary: {
    totalComponents: number;
    totalServices: number;
    totalInterfaces: number;
    totalFunctions: number;
    totalGuards: number;
    totalInterceptors: number;
    totalDirectives: number;
    totalEnums: number;
    totalTypes: number;
  };
  quickLookup: {
    components: { [key: string]: string }; // name -> chunk file
    services: { [key: string]: string };
    guards: { [key: string]: string };
    interceptors: { [key: string]: string };
    functions: { [key: string]: string };
  };
}

export interface ChunkInfo {
  id: string;
  file: string;
  size: number;
  contains: {
    components?: string[];
    services?: string[];
    interfaces?: string[];
    functions?: string[];
    guards?: string[];
    interceptors?: string[];
    directives?: string[];
    enums?: string[];
    types?: string[];
  };
}

export interface ParsedCodebase {
  components: AngularComponent[];
  services: AngularService[];
  interfaces: InterfaceInfo[];
  models: ModelInfo[];
  functions: FunctionInfo[];
  guards: GuardInfo[];
  interceptors: InterceptorInfo[];
  directives: DirectiveInfo[];
  enums: EnumInfo[];
  types: TypeAliasInfo[];
  abstractClasses: AbstractClassInfo[];
}

// New interfaces for additional patterns
export interface FunctionInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType?: string;
  isAsync: boolean;
  isExported: boolean;
  filePath: string;
}

export interface GuardInfo {
  name: string;
  type: 'CanActivate' | 'CanActivateChild' | 'CanDeactivate' | 'CanLoad' | 'CanMatch';
  filePath: string;
}

export interface InterceptorInfo {
  name: string;
  filePath: string;
}

export interface DirectiveInfo {
  name: string;
  selector?: string;
  inputs: string[];
  outputs: string[];
  methods: MethodInfo[];
  filePath: string;
}

export interface EnumInfo {
  name: string;
  members: string[];
  filePath: string;
}

export interface TypeAliasInfo {
  name: string;
  type: string;
  filePath: string;
}

export interface AbstractClassInfo {
  name: string;
  abstract: boolean;
  methods: MethodInfo[];
  properties: PropertyInfo[];
  filePath: string;
}

// Existing interfaces...
export interface AngularComponent {
  name: string;
  selector?: string;
  templateUrl?: string;
  styleUrls?: string[];
  inputs: string[];
  outputs: string[];
  methods: MethodInfo[];
  staticMethods?: MethodInfo[];
  filePath: string;
}

export interface AngularService {
  name: string;
  injectable: boolean;
  providedIn?: string;
  methods: MethodInfo[];
  staticMethods?: MethodInfo[];
  properties: PropertyInfo[];
  dependencies: string[];
  filePath: string;
}

export interface MethodInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType?: string;
  isAsync: boolean;
  isStatic?: boolean;
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
  isStatic?: boolean;
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

export class ImprovedCodebaseParser {
  private components: AngularComponent[] = [];
  private services: AngularService[] = [];
  private interfaces: InterfaceInfo[] = [];
  private models: ModelInfo[] = [];
  private functions: FunctionInfo[] = [];
  private guards: GuardInfo[] = [];
  private interceptors: InterceptorInfo[] = [];
  private directives: DirectiveInfo[] = [];
  private enums: EnumInfo[] = [];
  private types: TypeAliasInfo[] = [];
  private abstractClasses: AbstractClassInfo[] = [];

  private readonly MAX_CHUNK_SIZE = 200 * 1024 * 1024; // 200MB per chunk
  private readonly KNOWLEDGE_GRAPH_DIR = 'knowledge-graphs';

  async parseCodebase(rootPath: string): Promise<void> {
    logger.info(`Parsing codebase at: ${rootPath}`);
    
    // Reset all collections
    this.resetCollections();

    // Parse all files
    await this.walkDirectory(rootPath);

    // Create knowledge graph directory
    mkdirSync(this.KNOWLEDGE_GRAPH_DIR, { recursive: true });

    // Split and save the knowledge graph
    await this.splitAndSaveKnowledgeGraph();

    logger.info(`Parsed complete. Check ${this.KNOWLEDGE_GRAPH_DIR}/ for results.`);
  }

  private resetCollections(): void {
    this.components = [];
    this.services = [];
    this.interfaces = [];
    this.models = [];
    this.functions = [];
    this.guards = [];
    this.interceptors = [];
    this.directives = [];
    this.enums = [];
    this.types = [];
    this.abstractClasses = [];
  }

  private async splitAndSaveKnowledgeGraph(): Promise<void> {
    const fullData: ParsedCodebase = {
      components: this.components,
      services: this.services,
      interfaces: this.interfaces,
      models: this.models,
      functions: this.functions,
      guards: this.guards,
      interceptors: this.interceptors,
      directives: this.directives,
      enums: this.enums,
      types: this.types,
      abstractClasses: this.abstractClasses
    };

    const chunks: ChunkInfo[] = [];
    const quickLookup: KnowledgeGraphIndex['quickLookup'] = {
      components: {},
      services: {},
      guards: {},
      interceptors: {},
      functions: {}
    };

    // Strategy: Split by type and module
    const typeGroups = [
      { name: 'components', data: this.components },
      { name: 'services', data: this.services },
      { name: 'interfaces', data: this.interfaces },
      { name: 'functions', data: this.functions },
      { name: 'guards-interceptors', data: [...this.guards, ...this.interceptors] },
      { name: 'directives-enums-types', data: [...this.directives, ...this.enums, ...this.types] },
      { name: 'models-abstract', data: [...this.models, ...this.abstractClasses] }
    ];

    let chunkId = 0;
    for (const group of typeGroups) {
      let currentChunk: any[] = [];
      let currentSize = 0;

      for (const item of group.data) {
        const itemSize = JSON.stringify(item).length;
        
        if (currentSize + itemSize > this.MAX_CHUNK_SIZE && currentChunk.length > 0) {
          // Save current chunk
          const chunk = await this.saveChunk(chunkId++, group.name, currentChunk);
          chunks.push(chunk);
          
          // Reset for next chunk
          currentChunk = [];
          currentSize = 0;
        }

        currentChunk.push(item);
        currentSize += itemSize;

        // Update quick lookup
        if ('name' in item) {
          const lookupKey = group.name === 'components' ? 'components' :
                           group.name === 'services' ? 'services' :
                           group.name === 'guards-interceptors' && 'type' in item ? 'guards' :
                           group.name === 'guards-interceptors' ? 'interceptors' :
                           group.name === 'functions' ? 'functions' : null;
          
          if (lookupKey && lookupKey in quickLookup) {
            quickLookup[lookupKey][item.name] = `chunk-${chunkId}-${group.name}.json`;
          }
        }
      }

      // Save final chunk for this group
      if (currentChunk.length > 0) {
        const chunk = await this.saveChunk(chunkId++, group.name, currentChunk);
        chunks.push(chunk);
      }
    }

    // Create and save index
    const index: KnowledgeGraphIndex = {
      version: '2.0',
      created: new Date().toISOString(),
      totalSize: chunks.reduce((sum, chunk) => sum + chunk.size, 0),
      chunks,
      summary: {
        totalComponents: this.components.length,
        totalServices: this.services.length,
        totalInterfaces: this.interfaces.length,
        totalFunctions: this.functions.length,
        totalGuards: this.guards.length,
        totalInterceptors: this.interceptors.length,
        totalDirectives: this.directives.length,
        totalEnums: this.enums.length,
        totalTypes: this.types.length
      },
      quickLookup
    };

    writeFileSync(
      join(this.KNOWLEDGE_GRAPH_DIR, 'index.json'),
      JSON.stringify(index, null, 2)
    );

    // Save a lightweight summary for quick access
    this.saveSummary();
  }

  private async saveChunk(id: number, type: string, data: any[]): Promise<ChunkInfo> {
    const filename = `chunk-${id}-${type}.json`;
    const filepath = join(this.KNOWLEDGE_GRAPH_DIR, filename);
    const content = JSON.stringify(data, null, 2);
    
    writeFileSync(filepath, content);

    const contains: ChunkInfo['contains'] = {};
    const addToContains = (key: string, items: any[]) => {
      const names = items.filter(item => 'name' in item).map(item => item.name);
      if (names.length > 0) contains[key] = names;
    };

    // Categorize contents
    data.forEach(item => {
      if ('selector' in item && !('type' in item)) addToContains('components', [item]);
      else if ('injectable' in item) addToContains('services', [item]);
      else if ('type' in item && item.type.includes('Can')) addToContains('guards', [item]);
      else if ('type' in item && item.type === 'interceptor') addToContains('interceptors', [item]);
      else if ('members' in item) addToContains('enums', [item]);
      else if ('isExported' in item) addToContains('functions', [item]);
      else if ('extends' in item) addToContains('interfaces', [item]);
      else if ('abstract' in item) addToContains('types', [item]);
    });

    return {
      id: `chunk-${id}`,
      file: filename,
      size: content.length,
      contains
    };
  }

  private saveSummary(): void {
    const summary = {
      generated: new Date().toISOString(),
      stats: {
        components: this.components.length,
        services: this.services.length,
        interfaces: this.interfaces.length,
        functions: this.functions.length,
        guards: this.guards.length,
        interceptors: this.interceptors.length,
        directives: this.directives.length,
        enums: this.enums.length,
        types: this.types.length,
        abstractClasses: this.abstractClasses.length
      },
      topLevel: {
        components: this.components.slice(0, 10).map(c => ({ name: c.name, selector: c.selector })),
        services: this.services.slice(0, 10).map(s => ({ name: s.name, providedIn: s.providedIn })),
        guards: this.guards.map(g => ({ name: g.name, type: g.type })),
        interceptors: this.interceptors.map(i => ({ name: i.name }))
      }
    };

    writeFileSync(
      join(this.KNOWLEDGE_GRAPH_DIR, 'summary.json'),
      JSON.stringify(summary, null, 2)
    );
  }

  private async walkDirectory(dir: string): Promise<void> {
    const files = readdirSync(dir);

    for (const file of files) {
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip node_modules and other non-source directories
        if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist' && file !== 'venv') {
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
      
      // Parse with TypeScript parser
      const ast = parse(content, {
        loc: true,
        range: true,
        tokens: true,
        comment: true,
        jsx: false
      });

      // Parse all patterns
      await this.parseComponents(filePath, content, ast);
      await this.parseServices(filePath, content, ast);
      await this.parseInterfacesAndModels(filePath, content, ast);
      await this.parseFunctions(filePath, content, ast);
      await this.parseGuardsAndInterceptors(filePath, content, ast);
      await this.parseDirectives(filePath, content, ast);
      await this.parseEnums(filePath, content, ast);
      await this.parseTypeAliases(filePath, content, ast);
      await this.parseAbstractClasses(filePath, content, ast);
      
    } catch (error) {
      logger.warn(`Failed to parse ${filePath}: ${error}`);
    }
  }

  private async parseComponents(filePath: string, content: string, ast: any): Promise<void> {
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.ClassDeclaration && node.decorators) {
        const componentDecorator = node.decorators.find((d: any) => 
          d.expression?.callee?.name === 'Component'
        );

        if (componentDecorator) {
          const component: AngularComponent = {
            name: node.id.name,
            inputs: [],
            outputs: [],
            methods: [],
            staticMethods: [],
            filePath
          };

          // Parse decorator metadata
          if (componentDecorator.expression.arguments?.[0]) {
            const metadata = componentDecorator.expression.arguments[0];
            this.extractComponentMetadata(metadata, component);
          }

          // Parse class members including static methods
          this.parseClassMembers(node, component);

          this.components.push(component);
          logger.debug(`Parsed component: ${component.name}`);
        }
      }
    });
  }

  private async parseServices(filePath: string, content: string, ast: any): Promise<void> {
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.ClassDeclaration) {
        const injectableDecorator = node.decorators?.find((d: any) => 
          d.expression?.callee?.name === 'Injectable'
        );

        // Also check for services without @Injectable but with 'Service' in name
        if (injectableDecorator || (node.id.name.includes('Service') && !node.abstract)) {
          const service: AngularService = {
            name: node.id.name,
            injectable: !!injectableDecorator,
            methods: [],
            staticMethods: [],
            properties: [],
            dependencies: [],
            filePath
          };

          // Extract providedIn
          if (injectableDecorator?.expression.arguments?.[0]) {
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

          // Parse constructor dependencies
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

          // Parse all members including static
          this.parseClassMembers(node, service);

          this.services.push(service);
          logger.debug(`Parsed service: ${service.name}`);
        }
      }
    });
  }

  private async parseFunctions(filePath: string, content: string, ast: any): Promise<void> {
    this.walkAST(ast, (node: any) => {
      // Export function declarations
      if (node.type === AST_NODE_TYPES.FunctionDeclaration && node.id) {
        // Check if exported
        const isExported = this.isNodeExported(ast, node);
        if (isExported) {
          this.functions.push({
            name: node.id.name,
            parameters: this.extractParameters(node.params),
            returnType: this.getTypeString(node.returnType?.typeAnnotation),
            isAsync: node.async || false,
            isExported: true,
            filePath
          });
        }
      }

      // Export const arrow functions
      if (node.type === AST_NODE_TYPES.VariableDeclaration) {
        node.declarations.forEach((decl: any) => {
          if (decl.init?.type === AST_NODE_TYPES.ArrowFunctionExpression && decl.id?.name) {
            const isExported = this.isNodeExported(ast, node);
            if (isExported) {
              this.functions.push({
                name: decl.id.name,
                parameters: this.extractParameters(decl.init.params),
                returnType: this.getTypeString(decl.init.returnType?.typeAnnotation),
                isAsync: decl.init.async || false,
                isExported: true,
                filePath
              });
            }
          }
        });
      }
    });
  }

  private async parseGuardsAndInterceptors(filePath: string, content: string, ast: any): Promise<void> {
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.VariableDeclaration) {
        node.declarations.forEach((decl: any) => {
          if (decl.id?.name && decl.id.typeAnnotation?.typeAnnotation) {
            const typeName = this.getTypeString(decl.id.typeAnnotation.typeAnnotation);
            
            // Check for guards
            if (typeName && typeName.includes('CanActivate')) {
              this.guards.push({
                name: decl.id.name,
                type: typeName.replace('Fn', '') as any,
                filePath
              });
            }
            
            // Check for interceptors
            if (typeName === 'HttpInterceptorFn' || decl.id.name.includes('Interceptor')) {
              this.interceptors.push({
                name: decl.id.name,
                filePath
              });
            }
          }
        });
      }
    });
  }

  private async parseDirectives(filePath: string, content: string, ast: any): Promise<void> {
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.ClassDeclaration && node.decorators) {
        const directiveDecorator = node.decorators.find((d: any) => 
          d.expression?.callee?.name === 'Directive'
        );

        if (directiveDecorator) {
          const directive: DirectiveInfo = {
            name: node.id.name,
            inputs: [],
            outputs: [],
            methods: [],
            filePath
          };

          // Parse decorator metadata
          if (directiveDecorator.expression.arguments?.[0]) {
            const metadata = directiveDecorator.expression.arguments[0];
            metadata.properties?.forEach((prop: any) => {
              if (prop.key?.name === 'selector') {
                directive.selector = prop.value?.value;
              }
            });
          }

          // Parse inputs/outputs
          this.parseClassMembers(node, directive);

          this.directives.push(directive);
        }
      }
    });
  }

  private async parseEnums(filePath: string, content: string, ast: any): Promise<void> {
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.TSEnumDeclaration) {
        this.enums.push({
          name: node.id.name,
          members: node.members.map((m: any) => m.id.name),
          filePath
        });
      }
    });
  }

  private async parseTypeAliases(filePath: string, content: string, ast: any): Promise<void> {
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.TSTypeAliasDeclaration) {
        this.types.push({
          name: node.id.name,
          type: this.getTypeString(node.typeAnnotation) || 'unknown',
          filePath
        });
      }
    });
  }

  private async parseAbstractClasses(filePath: string, content: string, ast: any): Promise<void> {
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.ClassDeclaration && node.abstract) {
        const abstractClass: AbstractClassInfo = {
          name: node.id.name,
          abstract: true,
          methods: [],
          properties: [],
          filePath
        };

        this.parseClassMembers(node, abstractClass);
        this.abstractClasses.push(abstractClass);
      }
    });
  }

  private async parseInterfacesAndModels(filePath: string, content: string, ast: any): Promise<void> {
    this.walkAST(ast, (node: any) => {
      // Parse interfaces
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

      // Parse model classes
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
  }

  private parseClassMembers(node: any, target: any): void {
    node.body.body.forEach((member: any) => {
      if (member.type === AST_NODE_TYPES.PropertyDefinition) {
        // Check for @Input and @Output decorators
        if (member.decorators && 'inputs' in target) {
          member.decorators.forEach((decorator: any) => {
            if (decorator.expression?.callee?.name === 'Input') {
              target.inputs.push(member.key.name);
            } else if (decorator.expression?.callee?.name === 'Output') {
              target.outputs.push(member.key.name);
            }
          });
        }
        
        // Add properties
        if ('properties' in target) {
          target.properties.push(this.extractPropertyInfo(member));
        }
      } else if (member.type === AST_NODE_TYPES.MethodDefinition && member.key.name !== 'constructor') {
        const methodInfo = this.extractMethodInfo(member);
        
        if (member.static && 'staticMethods' in target) {
          target.staticMethods.push(methodInfo);
        } else if ('methods' in target) {
          target.methods.push(methodInfo);
        }
      }
    });
  }

  private isNodeExported(ast: any, targetNode: any): boolean {
    let isExported = false;
    
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.ExportNamedDeclaration) {
        if (node.declaration === targetNode) {
          isExported = true;
        }
      }
    });
    
    return isExported;
  }

  private extractParameters(params: any[]): ParameterInfo[] {
    return params.map((param: any) => ({
      name: param.name || 'unknown',
      type: this.getTypeString(param.typeAnnotation?.typeAnnotation),
      optional: param.optional || false,
      defaultValue: param.right?.value
    }));
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
      parameters: this.extractParameters(node.value.params || []),
      returnType: this.getTypeString(node.value.returnType?.typeAnnotation),
      isAsync: node.value.async || false,
      isStatic: node.static || false,
      visibility: node.accessibility || 'public'
    };
  }

  private extractPropertyInfo(node: any): PropertyInfo {
    return {
      name: node.key.name,
      type: this.getTypeString(node.typeAnnotation?.typeAnnotation),
      visibility: node.accessibility || 'public',
      readonly: node.readonly || false,
      isStatic: node.static || false
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
        if (typeNode.typeParameters) {
          const baseType = typeNode.typeName.name;
          const typeParams = typeNode.typeParameters.params
            .map((p: any) => this.getTypeString(p))
            .join(', ');
          return `${baseType}<${typeParams}>`;
        }
        return typeNode.typeName.name;
      case AST_NODE_TYPES.TSArrayType:
        return `${this.getTypeString(typeNode.elementType)}[]`;
      case AST_NODE_TYPES.TSUnionType:
        return typeNode.types.map((t: any) => this.getTypeString(t)).join(' | ');
      case AST_NODE_TYPES.TSIntersectionType:
        return typeNode.types.map((t: any) => this.getTypeString(t)).join(' & ');
      case AST_NODE_TYPES.TSLiteralType:
        return typeNode.literal.value?.toString() || 'literal';
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