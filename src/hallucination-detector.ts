import { parse } from '@typescript-eslint/parser';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import { ParsedCodebase, AngularService, AngularComponent } from './codebase-parser.js';
import { FibreFlowValidators } from './fibreflow-validators.js';
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

export interface HallucinationResult {
  hasHallucinations: boolean;
  issues: HallucinationIssue[];
  suggestions: string[];
  confidence: number;
}

export interface HallucinationIssue {
  type: 'method' | 'property' | 'service' | 'component' | 'import' | 'parameter' | 'type' | 'pattern' | 'style' | 'localization' | 'monitoring' | 'security';
  description: string;
  location?: {
    line?: number;
    column?: number;
  };
  suggestion?: string;
  severity: 'error' | 'warning' | 'info';
}

export class HallucinationDetector {
  constructor(private knowledgeBase: ParsedCodebase) {}

  async detectHallucinations(code: string, context?: string): Promise<HallucinationResult> {
    logger.info('Starting hallucination detection');
    
    const issues: HallucinationIssue[] = [];
    const suggestions: string[] = [];

    try {
      const ast = parse(code, {
        loc: true,
        range: true,
        tokens: true,
        comment: true,
        jsx: false
      });

      // Check imports
      this.checkImports(ast, issues);

      // Check service usage
      this.checkServiceUsage(ast, issues);

      // Check method calls
      this.checkMethodCalls(ast, issues);

      // Check component usage
      this.checkComponentUsage(ast, issues);

      // FibreFlow-specific checks
      this.checkTypeScriptPatterns(ast, issues);
      this.checkFibreFlowPatterns(code, issues);

      // Generate suggestions based on issues
      issues.forEach(issue => {
        if (issue.suggestion) {
          suggestions.push(issue.suggestion);
        }
      });

      const confidence = issues.length === 0 ? 1.0 : Math.max(0.3, 1.0 - (issues.length * 0.15));

      return {
        hasHallucinations: issues.length > 0,
        issues,
        suggestions,
        confidence
      };

    } catch (error) {
      logger.error('Error parsing code for hallucination detection:', error);
      return {
        hasHallucinations: true,
        issues: [{
          type: 'import',
          description: 'Failed to parse code - possible syntax error',
          severity: 'error'
        }],
        suggestions: ['Please check code syntax'],
        confidence: 0
      };
    }
  }

  private checkImports(ast: any, issues: HallucinationIssue[]): void {
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.ImportDeclaration) {
        const importPath = node.source.value;
        
        // Check if importing from Angular core modules
        if (importPath.startsWith('@angular/')) {
          this.validateAngularImport(node, importPath, issues);
        }
        
        // Check if importing from app services
        if (importPath.includes('/services/') || importPath.includes('/components/')) {
          this.validateLocalImport(node, importPath, issues);
        }
      }
    });
  }

  private validateAngularImport(node: any, importPath: string, issues: HallucinationIssue[]): void {
    const validAngularImports: Record<string, string[]> = {
      '@angular/core': ['Component', 'Injectable', 'OnInit', 'OnDestroy', 'Input', 'Output', 'EventEmitter', 'ViewChild', 'AfterViewInit', 'inject', 'signal', 'computed', 'effect'],
      '@angular/common': ['CommonModule', 'DatePipe', 'AsyncPipe', 'NgIf', 'NgFor', 'CurrencyPipe', 'DecimalPipe'],
      '@angular/router': ['Router', 'ActivatedRoute', 'RouterModule', 'Routes', 'RouterOutlet', 'RouterLink'],
      '@angular/forms': ['FormBuilder', 'FormGroup', 'FormControl', 'Validators', 'ReactiveFormsModule', 'FormsModule'],
      '@angular/platform-browser': ['BrowserModule', 'DomSanitizer', 'Title', 'Meta'],
      '@angular/animations': ['trigger', 'state', 'style', 'transition', 'animate']
    };

    // Check Material imports
    if (importPath.startsWith('@angular/material/')) {
      const imports = node.specifiers?.map((s: any) => s.imported?.name).filter(Boolean) || [];
      FibreFlowValidators.validateAngularMaterialImport(importPath, imports, issues);
      return;
    }

    // Check CDK imports
    if (importPath.startsWith('@angular/cdk/')) {
      const imports = node.specifiers?.map((s: any) => s.imported?.name).filter(Boolean) || [];
      FibreFlowValidators.validateAngularCDKImport(importPath, imports, issues);
      return;
    }

    // Check Firebase imports
    if (importPath.startsWith('@angular/fire/')) {
      const imports = node.specifiers?.map((s: any) => s.imported?.name).filter(Boolean) || [];
      FibreFlowValidators.validateFirebaseImport(importPath, imports, issues);
      return;
    }

    const moduleImports = validAngularImports[importPath];
    if (!moduleImports) {
      issues.push({
        type: 'import',
        description: `Unknown Angular module: ${importPath}`,
        severity: 'warning',
        suggestion: `Check if ${importPath} is a valid Angular module`
      });
      return;
    }

    // Check specific imports
    if (node.specifiers && moduleImports) {
      node.specifiers.forEach((specifier: any) => {
        if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
          const importedName = specifier.imported.name;
          if (!moduleImports.includes(importedName)) {
            issues.push({
              type: 'import',
              description: `'${importedName}' is not exported from ${importPath}`,
              severity: 'error',
              suggestion: `Available exports: ${moduleImports.join(', ')}`
            });
          }
        }
      });
    }
  }

  private validateLocalImport(node: any, importPath: string, issues: HallucinationIssue[]): void {
    // Extract service/component name from import path
    const pathParts = importPath.split('/');
    const fileName = pathParts[pathParts.length - 1].replace('.service', '').replace('.component', '');
    
    if (importPath.includes('/services/')) {
      // Check if service exists
      const serviceName = this.kebabToPascalCase(fileName) + 'Service';
      const service = this.knowledgeBase.services.find(s => s.name === serviceName);
      
      if (!service) {
        const availableServices = this.knowledgeBase.services.map(s => s.name).join(', ');
        issues.push({
          type: 'service',
          description: `Service '${serviceName}' not found in codebase`,
          severity: 'error',
          suggestion: `Available services: ${availableServices}`
        });
      }
    }
  }

  private checkServiceUsage(ast: any, issues: HallucinationIssue[]): void {
    const usedServices = new Map<string, Set<string>>();

    // First pass: collect all service usages
    this.walkAST(ast, (node: any) => {
      // Check for method calls on services
      if (node.type === AST_NODE_TYPES.CallExpression && 
          node.callee.type === AST_NODE_TYPES.MemberExpression) {
        
        const callee = node.callee;
        
        // Pattern: this.serviceInstance.method()
        if (callee.object?.type === AST_NODE_TYPES.MemberExpression &&
            callee.object.object?.type === AST_NODE_TYPES.ThisExpression) {
          
          const serviceProp = callee.object.property.name;
          const methodName = callee.property.name;
          
          logger.debug(`Found service method call: this.${serviceProp}.${methodName}()`);
          
          if (!usedServices.has(serviceProp)) {
            usedServices.set(serviceProp, new Set());
          }
          usedServices.get(serviceProp)!.add(methodName);
        }
      }
    });

    // Second pass: validate against knowledge base
    usedServices.forEach((methods, serviceProp) => {
      // Try to find the service in our knowledge base
      const service = this.findServiceByPropertyName(serviceProp);
      
      if (!service) {
        issues.push({
          type: 'service',
          description: `Unknown service property '${serviceProp}'`,
          severity: 'warning',
          suggestion: `Make sure '${serviceProp}' is injected in the constructor`
        });
        return;
      }

      // Check each method call
      methods.forEach(methodName => {
        const method = service.methods.find(m => m.name === methodName);
        if (!method) {
          const availableMethods = service.methods
            .filter(m => m.visibility === 'public')
            .map(m => m.name)
            .join(', ');
          
          issues.push({
            type: 'method',
            description: `Method '${methodName}' does not exist on ${service.name}`,
            severity: 'error',
            suggestion: `Available methods: ${availableMethods}`
          });
        }
      });
    });
  }

  private checkMethodCalls(ast: any, issues: HallucinationIssue[]): void {
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.CallExpression) {
        // Check Observable operators
        if (node.callee.type === AST_NODE_TYPES.MemberExpression) {
          const methodName = node.callee.property?.name;

          // Check RxJS operators in pipe() calls
          if (methodName === 'pipe' && node.arguments) {
            // Check each operator in the pipe
            node.arguments.forEach((arg: any) => {
              if (arg.type === AST_NODE_TYPES.CallExpression && 
                  arg.callee.type === AST_NODE_TYPES.Identifier) {
                const operatorName = arg.callee.name;
                this.validateRxJSOperator(operatorName, issues, node.loc);
              }
            });
          }

          // Check direct Observable method calls
          const objectName = this.getObjectName(node.callee.object);
          if (objectName && this.isObservableChain(node.callee.object) && methodName) {
            const observableMethods = ['subscribe', 'pipe', 'toPromise', 'forEach'];
            if (!observableMethods.includes(methodName)) {
              this.validateRxJSOperator(methodName, issues, node.loc);
            }
          }
        }
        
        // Check for function calls that might be RxJS operators
        if (node.callee.type === AST_NODE_TYPES.Identifier) {
          const functionName = node.callee.name;
          // Check if it looks like an RxJS operator (used in pipe)
          const rxjsOperatorPattern = /^(map|filter|tap|switchMap|mergeMap|catchError|retry|take|skip|debounce|throttle)/;
          if (rxjsOperatorPattern.test(functionName)) {
            this.validateRxJSOperator(functionName, issues, node.loc);
          }
        }
      }
      
      // Check lifecycle hooks in method definitions
      if (node.type === AST_NODE_TYPES.MethodDefinition && 
          node.key.type === AST_NODE_TYPES.Identifier) {
        const methodName = node.key.name;
        this.validateComponentMethod(methodName, issues, node.loc);
      }
    });
  }

  private checkComponentUsage(ast: any, issues: HallucinationIssue[]): void {
    // Check for component-specific patterns
    this.walkAST(ast, (node: any) => {
      if (node.type === AST_NODE_TYPES.Decorator && 
          node.expression?.callee?.name === 'Component') {
        
        const metadata = node.expression.arguments?.[0];
        if (metadata?.properties) {
          metadata.properties.forEach((prop: any) => {
            if (prop.key?.name === 'selector' && prop.value?.value) {
              const selector = prop.value.value;
              // Validate selector format
              if (!selector.includes('-') || selector.startsWith('app-') === false) {
                issues.push({
                  type: 'component',
                  description: `Component selector '${selector}' should follow 'app-*' convention`,
                  severity: 'warning',
                  suggestion: `Use selector like 'app-${selector.replace('app-', '')}'`
                });
              }
            }
          });
        }
      }
    });
  }

  private validateRxJSOperator(operator: string, issues: HallucinationIssue[], location?: any): void {
    // Use the comprehensive FibreFlow validator for RxJS v7.8
    FibreFlowValidators.validateRxJSOperator(operator, issues);
  }

  private validateComponentMethod(methodName: string, issues: HallucinationIssue[], location?: any): void {
    // Check for common lifecycle hooks
    const lifecycleHooks = [
      'ngOnInit', 'ngOnDestroy', 'ngAfterViewInit', 'ngOnChanges',
      'ngDoCheck', 'ngAfterContentInit', 'ngAfterContentChecked',
      'ngAfterViewChecked'
    ];

    // Check if method looks like a lifecycle hook
    if (methodName.toLowerCase().startsWith('ng')) {
      // Check if it's a lifecycle hook with wrong casing
      const lowercaseMethod = methodName.toLowerCase();
      const correctHook = lifecycleHooks.find(hook => hook.toLowerCase() === lowercaseMethod);
      
      if (correctHook && correctHook !== methodName) {
        issues.push({
          type: 'method',
          description: `Incorrect lifecycle hook name '${methodName}'`,
          severity: 'error',
          suggestion: `Use '${correctHook}' instead`,
          location
        });
      } else if (!correctHook) {
        // It starts with 'ng' but isn't a valid lifecycle hook
        const similarHooks = lifecycleHooks.filter(hook => 
          hook.toLowerCase().includes(methodName.toLowerCase().substring(2)) ||
          methodName.toLowerCase().includes(hook.toLowerCase().substring(2))
        );
        
        issues.push({
          type: 'method',
          description: `'${methodName}' is not a valid Angular lifecycle hook`,
          severity: 'error',
          suggestion: similarHooks.length > 0 
            ? `Did you mean: ${similarHooks.join(', ')}?`
            : `Valid hooks: ${lifecycleHooks.slice(0, 4).join(', ')}...`,
          location
        });
      }
    }
  }

  private findServiceByPropertyName(propName: string): AngularService | undefined {
    // Common naming patterns: authService -> AuthService
    const possibleServiceNames = [
      propName.charAt(0).toUpperCase() + propName.slice(1), // capitalize
      this.kebabToPascalCase(propName), // kebab-case to PascalCase
      propName.replace(/Service$/, '') + 'Service' // ensure Service suffix
    ];

    for (const serviceName of possibleServiceNames) {
      const service = this.knowledgeBase.services.find(s => s.name === serviceName);
      if (service) return service;
    }

    return undefined;
  }

  private isObservableChain(node: any): boolean {
    // Check if this is part of an Observable chain (has .pipe() or similar)
    if (node.type === AST_NODE_TYPES.CallExpression) {
      if (node.callee.property?.name === 'pipe') return true;
      if (node.callee.object) return this.isObservableChain(node.callee.object);
    }
    return false;
  }

  private getObjectName(node: any): string | null {
    if (node.type === AST_NODE_TYPES.Identifier) {
      return node.name;
    }
    if (node.type === AST_NODE_TYPES.MemberExpression) {
      return this.getObjectName(node.object);
    }
    if (node.type === AST_NODE_TYPES.ThisExpression) {
      return 'this';
    }
    return null;
  }

  private kebabToPascalCase(str: string): string {
    return str.split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
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

  private checkTypeScriptPatterns(ast: any, issues: HallucinationIssue[]): void {
    this.walkAST(ast, (node: any) => {
      // Check for 'any' type usage
      if (node.type === AST_NODE_TYPES.TSAnyKeyword) {
        issues.push({
          type: 'type',
          description: 'Avoid using "any" type (FibreFlow enforces zero any types)',
          severity: 'error',
          suggestion: 'Use specific types, unknown, or generic types instead',
          location: node.loc
        });
      }

      // Check for branded type usage
      if (node.type === AST_NODE_TYPES.TSTypeReference && 
          node.typeName?.type === AST_NODE_TYPES.Identifier) {
        const typeName = node.typeName.name;
        FibreFlowValidators.validateBrandedType(typeName, issues);
      }

      // Check standalone components
      if (node.type === AST_NODE_TYPES.Decorator && 
          node.expression?.callee?.name === 'Component') {
        const metadata = node.expression.arguments?.[0];
        if (metadata?.properties) {
          const metadataObj: any = {};
          metadata.properties.forEach((prop: any) => {
            if (prop.key?.name) {
              metadataObj[prop.key.name] = prop.value;
            }
          });
          FibreFlowValidators.validateStandaloneComponent(metadataObj, issues);
        }
      }

      // Check for constructor DI pattern
      if (node.type === AST_NODE_TYPES.MethodDefinition && 
          node.key?.name === 'constructor' && 
          node.value?.params?.length > 0) {
        FibreFlowValidators.validateInjectPattern(node.value.params, issues);
      }
    });
  }

  private checkFibreFlowPatterns(code: string, issues: HallucinationIssue[]): void {
    // Check TypeScript strict mode patterns
    FibreFlowValidators.validateTypeScriptStrict(code, issues);

    // Check for Sentry usage
    FibreFlowValidators.validateSentryUsage(code, issues);

    // Check for hardcoded colors in styles
    const styleMatches = code.match(/styles:\s*\[[\s\S]*?\]/g);
    if (styleMatches) {
      styleMatches.forEach(style => {
        FibreFlowValidators.validateThemeUsage(style, issues);
      });
    }

    // Check SCSS theme mixins
    const scssMatches = code.match(/styles:\s*\[`[\s\S]*?`\]/g);
    if (scssMatches) {
      scssMatches.forEach(scss => {
        FibreFlowValidators.validateSCSSThemeMixins(scss, issues);
      });
    }

    // Check for US date formats
    const dateMatches = code.match(/\d{1,2}\/\d{1,2}\/\d{4}/g);
    if (dateMatches) {
      dateMatches.forEach(date => {
        FibreFlowValidators.validateDateFormat(date, issues);
      });
    }

    // Check for currency usage
    if (code.includes('$')) {
      FibreFlowValidators.validateCurrencyFormat(code, issues);
    }

    // Check Zone.js patterns
    FibreFlowValidators.validateZonePatterns(code, issues);

    // Check Firebase security patterns
    FibreFlowValidators.validateFirebaseSecurityPatterns(code, issues);

    // Check lazy loading patterns
    FibreFlowValidators.validateLazyLoadingPattern(code, issues);
  }
}