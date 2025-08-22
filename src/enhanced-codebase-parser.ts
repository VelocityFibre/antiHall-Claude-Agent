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

// Enhanced interfaces to capture more patterns
export interface AngularComponent {
  name: string;
  selector?: string;
  templateUrl?: string;
  styleUrls?: string[];
  inputs: string[];
  outputs: string[];
  methods: MethodInfo[];
  filePath: string;
  standalone?: boolean;
  imports?: string[];
  providers?: string[];
}

export interface AngularService {
  name: string;
  injectable: boolean;
  providedIn?: string;
  methods: MethodInfo[];
  properties: PropertyInfo[];
  dependencies: string[];
  filePath: string;
  staticMethods?: MethodInfo[];
}

export interface AngularDirective {
  name: string;
  selector?: string;
  inputs: string[];
  outputs: string[];
  methods: MethodInfo[];
  filePath: string;
  standalone?: boolean;
}

export interface AngularPipe {
  name: string;
  pipeName?: string;
  methods: MethodInfo[];
  filePath: string;
  standalone?: boolean;
  pure?: boolean;
}

export interface AngularGuard {
  name: string;
  type: 'class' | 'function';
  guardType?: string; // CanActivate, CanActivateFn, etc.
  methods?: MethodInfo[];
  filePath: string;
}

export interface AngularInterceptor {
  name: string;
  type: 'class' | 'function';
  methods?: MethodInfo[];
  filePath: string;
}

export interface MethodInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType?: string;
  isAsync: boolean;
  visibility: 'public' | 'private' | 'protected';
  isStatic?: boolean;
  isAbstract?: boolean;
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
  methods?: MethodInfo[];
  filePath: string;
  extends?: string[];
}

export interface TypeDefinition {
  name: string;
  type: string;
  filePath: string;
}

export interface EnumDefinition {
  name: string;
  members: string[];
  filePath: string;
}

export interface UtilityFunction {
  name: string;
  parameters: ParameterInfo[];
  returnType?: string;
  isAsync: boolean;
  filePath: string;
  isExported: boolean;
}

export interface AbstractClass {
  name: string;
  methods: MethodInfo[];
  properties: PropertyInfo[];
  filePath: string;
  extends?: string;
}

export interface CustomProvider {
  token: string;
  type: 'useClass' | 'useFactory' | 'useValue' | 'useExisting';
  filePath: string;
  deps?: string[];
}

export interface RouteConfig {
  path: string;
  component?: string;
  loadChildren?: string;
  canActivate?: string[];
  children?: RouteConfig[];
  filePath: string;
}

export interface EnhancedParsedCodebase {
  components: AngularComponent[];
  services: AngularService[];
  directives: AngularDirective[];
  pipes: AngularPipe[];
  guards: AngularGuard[];
  interceptors: AngularInterceptor[];
  interfaces: InterfaceInfo[];
  types: TypeDefinition[];
  enums: EnumDefinition[];
  utilityFunctions: UtilityFunction[];
  abstractClasses: AbstractClass[];
  providers: CustomProvider[];
  routes: RouteConfig[];
}

export class EnhancedCodebaseParser {
  private components: AngularComponent[] = [];
  private services: AngularService[] = [];
  private directives: AngularDirective[] = [];
  private pipes: AngularPipe[] = [];
  private guards: AngularGuard[] = [];
  private interceptors: AngularInterceptor[] = [];
  private interfaces: InterfaceInfo[] = [];
  private types: TypeDefinition[] = [];
  private enums: EnumDefinition[] = [];
  private utilityFunctions: UtilityFunction[] = [];
  private abstractClasses: AbstractClass[] = [];
  private providers: CustomProvider[] = [];
  private routes: RouteConfig[] = [];

  async parseCodebase(rootPath: string): Promise<EnhancedParsedCodebase> {
    logger.info(`Parsing codebase at: ${rootPath}`);
    
    // Reset all collections
    this.components = [];
    this.services = [];
    this.directives = [];
    this.pipes = [];
    this.guards = [];
    this.interceptors = [];
    this.interfaces = [];
    this.types = [];
    this.enums = [];
    this.utilityFunctions = [];
    this.abstractClasses = [];
    this.providers = [];
    this.routes = [];

    await this.walkDirectory(rootPath);

    logger.info(`Enhanced parser results: ${this.components.length} components, ${this.services.length} services, ${this.directives.length} directives, ${this.guards.length} guards, ${this.interceptors.length} interceptors`);

    return {
      components: this.components,
      services: this.services,
      directives: this.directives,
      pipes: this.pipes,
      guards: this.guards,
      interceptors: this.interceptors,
      interfaces: this.interfaces,
      types: this.types,
      enums: this.enums,
      utilityFunctions: this.utilityFunctions,
      abstractClasses: this.abstractClasses,
      providers: this.providers,
      routes: this.routes
    };
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
      
      // Parse the entire file to get all constructs
      const ast = parse(content, {
        loc: true,
        range: true,
        tokens: true,
        comment: true,
        jsx: false
      });

      // Parse all constructs in the file
      await this.parseComponents(filePath, content, ast);
      await this.parseServices(filePath, content, ast);
      await this.parseDirectives(filePath, content, ast);
      await this.parsePipes(filePath, content, ast);
      await this.parseGuards(filePath, content, ast);
      await this.parseInterceptors(filePath, content, ast);
      await this.parseInterfaces(filePath, content, ast);
      await this.parseTypes(filePath, content, ast);
      await this.parseEnums(filePath, content, ast);
      await this.parseUtilityFunctions(filePath, content, ast);
      await this.parseAbstractClasses(filePath, content, ast);
      await this.parseProviders(filePath, content, ast);
      await this.parseRoutes(filePath, content, ast);
      
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
            filePath
          };

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

          this.components.push(component);
          logger.debug(`Parsed component: ${component.name}`);
        }
      }
    });
  }

  private async parseServices(filePath: string, content: string, ast: any): Promise<void> {
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.ClassDeclaration) {
        const service: AngularService = {
          name: node.id.name,
          injectable: false,
          methods: [],
          properties: [],
          dependencies: [],
          filePath,
          staticMethods: []
        };

        // Check for @Injectable decorator
        if (node.decorators) {
          const injectableDecorator = node.decorators.find((d: any) => 
            d.expression?.callee?.name === 'Injectable'
          );

          if (injectableDecorator) {
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
          }
        }

        // Parse services without @Injectable if they match naming pattern
        if (service.injectable || node.id.name.endsWith('Service')) {
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
              const methodInfo = this.extractMethodInfo(member);
              if (methodInfo.isStatic) {
                service.staticMethods?.push(methodInfo);
              } else {
                service.methods.push(methodInfo);
              }
            }
          });

          this.services.push(service);
          logger.debug(`Parsed service: ${service.name}`);
        }
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
          const directive: AngularDirective = {
            name: node.id.name,
            inputs: [],
            outputs: [],
            methods: [],
            filePath
          };

          // Parse decorator metadata
          if (directiveDecorator.expression.arguments?.[0]) {
            const metadata = directiveDecorator.expression.arguments[0];
            this.extractDirectiveMetadata(metadata, directive);
          }

          // Parse class members for inputs/outputs
          node.body.body.forEach((member: any) => {
            if (member.type === AST_NODE_TYPES.PropertyDefinition && member.decorators) {
              member.decorators.forEach((decorator: any) => {
                if (decorator.expression?.callee?.name === 'Input') {
                  directive.inputs.push(member.key.name);
                } else if (decorator.expression?.callee?.name === 'Output') {
                  directive.outputs.push(member.key.name);
                }
              });
            } else if (member.type === AST_NODE_TYPES.MethodDefinition) {
              directive.methods.push(this.extractMethodInfo(member));
            }
          });

          this.directives.push(directive);
          logger.debug(`Parsed directive: ${directive.name}`);
        }
      }
    });
  }

  private async parsePipes(filePath: string, content: string, ast: any): Promise<void> {
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.ClassDeclaration && node.decorators) {
        const pipeDecorator = node.decorators.find((d: any) => 
          d.expression?.callee?.name === 'Pipe'
        );

        if (pipeDecorator) {
          const pipe: AngularPipe = {
            name: node.id.name,
            methods: [],
            filePath
          };

          // Parse decorator metadata
          if (pipeDecorator.expression.arguments?.[0]) {
            const metadata = pipeDecorator.expression.arguments[0];
            if (metadata.properties) {
              const nameProp = metadata.properties.find((p: any) => p.key?.name === 'name');
              if (nameProp) {
                pipe.pipeName = nameProp.value?.value;
              }
              const pureProp = metadata.properties.find((p: any) => p.key?.name === 'pure');
              if (pureProp) {
                pipe.pure = pureProp.value?.value;
              }
              const standaloneProp = metadata.properties.find((p: any) => p.key?.name === 'standalone');
              if (standaloneProp) {
                pipe.standalone = standaloneProp.value?.value;
              }
            }
          }

          // Parse methods
          node.body.body.forEach((member: any) => {
            if (member.type === AST_NODE_TYPES.MethodDefinition) {
              pipe.methods.push(this.extractMethodInfo(member));
            }
          });

          this.pipes.push(pipe);
          logger.debug(`Parsed pipe: ${pipe.name}`);
        }
      }
    });
  }

  private async parseGuards(filePath: string, content: string, ast: any): Promise<void> {
    // Parse function-based guards
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.VariableDeclaration) {
        node.declarations.forEach((decl: any) => {
          if (decl.id?.name && decl.init && 
              (content.includes('CanActivateFn') || content.includes('CanMatchFn'))) {
            const guard: AngularGuard = {
              name: decl.id.name,
              type: 'function',
              guardType: content.includes('CanActivateFn') ? 'CanActivateFn' : 'CanMatchFn',
              filePath
            };
            this.guards.push(guard);
            logger.debug(`Parsed function guard: ${guard.name}`);
          }
        });
      }

      // Parse class-based guards
      if (node.type === AST_NODE_TYPES.ClassDeclaration) {
        const implementsGuard = node.implements?.some((impl: any) => 
          ['CanActivate', 'CanDeactivate', 'CanLoad', 'CanMatch'].includes(impl.expression?.name)
        );

        if (implementsGuard || (node.id.name.endsWith('Guard') && content.includes('canActivate'))) {
          const guard: AngularGuard = {
            name: node.id.name,
            type: 'class',
            guardType: node.implements?.[0]?.expression?.name,
            methods: [],
            filePath
          };

          // Parse methods
          node.body.body.forEach((member: any) => {
            if (member.type === AST_NODE_TYPES.MethodDefinition) {
              guard.methods?.push(this.extractMethodInfo(member));
            }
          });

          this.guards.push(guard);
          logger.debug(`Parsed class guard: ${guard.name}`);
        }
      }
    });
  }

  private async parseInterceptors(filePath: string, content: string, ast: any): Promise<void> {
    // Parse function-based interceptors
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.VariableDeclaration) {
        node.declarations.forEach((decl: any) => {
          if (decl.id?.name && decl.init && content.includes('HttpInterceptorFn')) {
            const interceptor: AngularInterceptor = {
              name: decl.id.name,
              type: 'function',
              filePath
            };
            this.interceptors.push(interceptor);
            logger.debug(`Parsed function interceptor: ${interceptor.name}`);
          }
        });
      }

      // Parse class-based interceptors
      if (node.type === AST_NODE_TYPES.ClassDeclaration) {
        const implementsInterceptor = node.implements?.some((impl: any) => 
          impl.expression?.name === 'HttpInterceptor'
        );

        if (implementsInterceptor || (node.id.name.endsWith('Interceptor') && content.includes('intercept'))) {
          const interceptor: AngularInterceptor = {
            name: node.id.name,
            type: 'class',
            methods: [],
            filePath
          };

          // Parse methods
          node.body.body.forEach((member: any) => {
            if (member.type === AST_NODE_TYPES.MethodDefinition) {
              interceptor.methods?.push(this.extractMethodInfo(member));
            }
          });

          this.interceptors.push(interceptor);
          logger.debug(`Parsed class interceptor: ${interceptor.name}`);
        }
      }
    });
  }

  private async parseInterfaces(filePath: string, content: string, ast: any): Promise<void> {
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
        const interfaceInfo: InterfaceInfo = {
          name: node.id.name,
          properties: [],
          methods: [],
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
          } else if (member.type === AST_NODE_TYPES.TSMethodSignature) {
            interfaceInfo.methods?.push({
              name: member.key.name,
              parameters: member.params.map((param: any) => ({
                name: param.name,
                type: this.getTypeString(param.typeAnnotation?.typeAnnotation),
                optional: param.optional || false
              })),
              returnType: this.getTypeString(member.returnType?.typeAnnotation),
              isAsync: false,
              visibility: 'public'
            });
          }
        });

        this.interfaces.push(interfaceInfo);
        logger.debug(`Parsed interface: ${interfaceInfo.name}`);
      }
    });
  }

  private async parseTypes(filePath: string, content: string, ast: any): Promise<void> {
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.TSTypeAliasDeclaration) {
        const typeDefinition: TypeDefinition = {
          name: node.id.name,
          type: this.getTypeString(node.typeAnnotation),
          filePath
        };
        this.types.push(typeDefinition);
        logger.debug(`Parsed type: ${typeDefinition.name}`);
      }
    });
  }

  private async parseEnums(filePath: string, content: string, ast: any): Promise<void> {
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.TSEnumDeclaration) {
        const enumDef: EnumDefinition = {
          name: node.id.name,
          members: node.members.map((member: any) => member.id.name),
          filePath
        };
        this.enums.push(enumDef);
        logger.debug(`Parsed enum: ${enumDef.name}`);
      }
    });
  }

  private async parseUtilityFunctions(filePath: string, content: string, ast: any): Promise<void> {
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.FunctionDeclaration || 
          (node.type === AST_NODE_TYPES.VariableDeclaration && 
           node.declarations.some((d: any) => d.init?.type === AST_NODE_TYPES.ArrowFunctionExpression))) {
        
        let funcInfo: UtilityFunction | null = null;

        if (node.type === AST_NODE_TYPES.FunctionDeclaration) {
          funcInfo = {
            name: node.id.name,
            parameters: node.params.map((param: any) => ({
              name: param.name,
              type: this.getTypeString(param.typeAnnotation?.typeAnnotation),
              optional: param.optional || false,
              defaultValue: param.right?.value
            })),
            returnType: this.getTypeString(node.returnType?.typeAnnotation),
            isAsync: node.async || false,
            isExported: this.isExported(node, ast),
            filePath
          };
        } else {
          // Arrow function
          const decl = node.declarations[0];
          if (decl.init?.type === AST_NODE_TYPES.ArrowFunctionExpression) {
            funcInfo = {
              name: decl.id.name,
              parameters: decl.init.params.map((param: any) => ({
                name: param.name,
                type: this.getTypeString(param.typeAnnotation?.typeAnnotation),
                optional: param.optional || false,
                defaultValue: param.right?.value
              })),
              returnType: this.getTypeString(decl.init.returnType?.typeAnnotation),
              isAsync: decl.init.async || false,
              isExported: this.isExported(node, ast),
              filePath
            };
          }
        }

        if (funcInfo) {
          this.utilityFunctions.push(funcInfo);
          logger.debug(`Parsed utility function: ${funcInfo.name}`);
        }
      }
    });
  }

  private async parseAbstractClasses(filePath: string, content: string, ast: any): Promise<void> {
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.ClassDeclaration && node.abstract) {
        const abstractClass: AbstractClass = {
          name: node.id.name,
          methods: [],
          properties: [],
          filePath,
          extends: node.superClass?.name
        };

        // Parse class members
        node.body.body.forEach((member: any) => {
          if (member.type === AST_NODE_TYPES.PropertyDefinition) {
            abstractClass.properties.push(this.extractPropertyInfo(member));
          } else if (member.type === AST_NODE_TYPES.MethodDefinition) {
            abstractClass.methods.push(this.extractMethodInfo(member));
          }
        });

        this.abstractClasses.push(abstractClass);
        logger.debug(`Parsed abstract class: ${abstractClass.name}`);
      }
    });
  }

  private async parseProviders(filePath: string, content: string, ast: any): Promise<void> {
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.ObjectExpression) {
        // Look for provider patterns
        const provideProperty = node.properties.find((p: any) => p.key?.name === 'provide');
        if (provideProperty) {
          const provider: CustomProvider = {
            token: this.getProviderToken(provideProperty.value),
            type: 'useClass',
            filePath
          };

          // Determine provider type
          node.properties.forEach((prop: any) => {
            switch (prop.key?.name) {
              case 'useClass':
                provider.type = 'useClass';
                break;
              case 'useFactory':
                provider.type = 'useFactory';
                break;
              case 'useValue':
                provider.type = 'useValue';
                break;
              case 'useExisting':
                provider.type = 'useExisting';
                break;
              case 'deps':
                if (prop.value?.elements) {
                  provider.deps = prop.value.elements.map((e: any) => e.name);
                }
                break;
            }
          });

          this.providers.push(provider);
          logger.debug(`Parsed provider: ${provider.token}`);
        }
      }
    });
  }

  private async parseRoutes(filePath: string, content: string, ast: any): Promise<void> {
    if (!filePath.includes('.routes.ts') && !filePath.includes('routing')) {
      return;
    }

    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.VariableDeclaration) {
        node.declarations.forEach((decl: any) => {
          if (decl.id?.name === 'routes' && decl.init?.type === AST_NODE_TYPES.ArrayExpression) {
            decl.init.elements.forEach((element: any) => {
              if (element?.type === AST_NODE_TYPES.ObjectExpression) {
                const route = this.extractRouteConfig(element, filePath);
                if (route) {
                  this.routes.push(route);
                }
              }
            });
          }
        });
      }
    });
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
          case 'standalone':
            component.standalone = prop.value?.value;
            break;
          case 'imports':
            if (prop.value?.elements) {
              component.imports = prop.value.elements.map((e: any) => e.name);
            }
            break;
          case 'providers':
            if (prop.value?.elements) {
              component.providers = prop.value.elements.map((e: any) => e.name);
            }
            break;
        }
      });
    }
  }

  private extractDirectiveMetadata(metadata: any, directive: AngularDirective): void {
    if (metadata.properties) {
      metadata.properties.forEach((prop: any) => {
        switch (prop.key?.name) {
          case 'selector':
            directive.selector = prop.value?.value;
            break;
          case 'standalone':
            directive.standalone = prop.value?.value;
            break;
        }
      });
    }
  }

  private extractMethodInfo(node: any): MethodInfo {
    return {
      name: node.key.name,
      parameters: node.value.params.map((param: any) => ({
        name: param.name || param.left?.name || 'unknown',
        type: this.getTypeString(param.typeAnnotation?.typeAnnotation),
        optional: param.optional || false,
        defaultValue: param.right?.value
      })),
      returnType: this.getTypeString(node.value.returnType?.typeAnnotation),
      isAsync: node.value.async || false,
      visibility: node.accessibility || 'public',
      isStatic: node.static || false,
      isAbstract: node.abstract || false
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

  private extractRouteConfig(node: any, filePath: string): RouteConfig | null {
    const route: RouteConfig = { path: '', filePath };

    node.properties.forEach((prop: any) => {
      switch (prop.key?.name) {
        case 'path':
          route.path = prop.value?.value || '';
          break;
        case 'component':
          route.component = prop.value?.name;
          break;
        case 'loadChildren':
          route.loadChildren = 'lazy-loaded';
          break;
        case 'canActivate':
          if (prop.value?.elements) {
            route.canActivate = prop.value.elements.map((e: any) => e.name);
          }
          break;
        case 'children':
          if (prop.value?.elements) {
            route.children = prop.value.elements
              .map((e: any) => this.extractRouteConfig(e, filePath))
              .filter((r: any) => r !== null);
          }
          break;
      }
    });

    return route.path !== undefined ? route : null;
  }

  private getProviderToken(node: any): string {
    if (node.type === AST_NODE_TYPES.Identifier) {
      return node.name;
    } else if (node.type === AST_NODE_TYPES.MemberExpression) {
      return `${node.object.name}.${node.property.name}`;
    }
    return 'unknown';
  }

  private isExported(node: any, ast: any): boolean {
    // Check if the function is exported
    let isExported = false;
    
    this.walkAST(ast, (n: any) => {
      if (n.type === AST_NODE_TYPES.ExportNamedDeclaration) {
        if (n.declaration === node) {
          isExported = true;
        }
      }
    });

    return isExported;
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
      case AST_NODE_TYPES.TSUnknownKeyword:
        return 'unknown';
      case AST_NODE_TYPES.TSVoidKeyword:
        return 'void';
      case AST_NODE_TYPES.TSNullKeyword:
        return 'null';
      case AST_NODE_TYPES.TSUndefinedKeyword:
        return 'undefined';
      case AST_NODE_TYPES.TSTypeReference:
        if (typeNode.typeParameters) {
          const typeParams = typeNode.typeParameters.params
            .map((p: any) => this.getTypeString(p))
            .join(', ');
          return `${typeNode.typeName.name}<${typeParams}>`;
        }
        return typeNode.typeName.name;
      case AST_NODE_TYPES.TSArrayType:
        return `${this.getTypeString(typeNode.elementType)}[]`;
      case AST_NODE_TYPES.TSUnionType:
        return typeNode.types.map((t: any) => this.getTypeString(t)).join(' | ');
      case AST_NODE_TYPES.TSLiteralType:
        return typeNode.literal.value?.toString() || typeNode.literal.raw;
      case AST_NODE_TYPES.TSFunctionType:
        return 'Function';
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