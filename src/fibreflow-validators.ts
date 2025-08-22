import { HallucinationIssue } from './hallucination-detector.js';
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

export class FibreFlowValidators {
  // Valid Angular CDK imports based on your v20.0.3
  private static readonly CDK_MODULES: Record<string, string[]> = {
    '@angular/cdk/a11y': ['A11yModule', 'LiveAnnouncer', 'FocusTrap', 'FocusMonitor', 'CdkTrapFocus'],
    '@angular/cdk/clipboard': ['Clipboard', 'ClipboardModule', 'CdkCopyToClipboard'],
    '@angular/cdk/coercion': ['coerceBooleanProperty', 'coerceNumberProperty', 'coerceArray', 'coerceElement'],
    '@angular/cdk/collections': ['SelectionModel', 'DataSource', 'CollectionViewer', 'ArrayDataSource'],
    '@angular/cdk/dialog': ['Dialog', 'DialogModule', 'DialogRef', 'DIALOG_DATA'],
    '@angular/cdk/drag-drop': ['DragDropModule', 'CdkDrag', 'CdkDropList', 'moveItemInArray', 'transferArrayItem'],
    '@angular/cdk/layout': ['BreakpointObserver', 'Breakpoints', 'MediaMatcher', 'LayoutModule'],
    '@angular/cdk/overlay': ['Overlay', 'OverlayModule', 'OverlayRef', 'OverlayConfig', 'ConnectedPosition'],
    '@angular/cdk/platform': ['Platform', 'PlatformModule', 'getSupportedInputTypes'],
    '@angular/cdk/portal': ['Portal', 'PortalModule', 'ComponentPortal', 'TemplatePortal', 'DomPortal'],
    '@angular/cdk/scrolling': ['ScrollingModule', 'CdkVirtualScrollViewport', 'CdkScrollable', 'ScrollDispatcher'],
    '@angular/cdk/stepper': ['CdkStepper', 'CdkStep', 'StepperSelectionEvent', 'STEPPER_GLOBAL_OPTIONS'],
    '@angular/cdk/table': ['CdkTable', 'CdkTableModule', 'CdkColumnDef', 'CdkHeaderCell', 'CdkCell'],
    '@angular/cdk/text-field': ['TextFieldModule', 'CdkTextareaAutosize', 'AutofillMonitor'],
    '@angular/cdk/tree': ['CdkTree', 'CdkTreeModule', 'CdkTreeNode', 'NestedTreeControl', 'FlatTreeControl'],
  };

  // Valid Angular Material imports based on your v20.0.3
  private static readonly MATERIAL_MODULES: Record<string, string[]> = {
    '@angular/material/button': ['MatButton', 'MatButtonModule', 'MatIconButton', 'MatFabButton'],
    '@angular/material/icon': ['MatIcon', 'MatIconModule'],
    '@angular/material/card': ['MatCard', 'MatCardModule', 'MatCardHeader', 'MatCardContent', 'MatCardActions', 'MatCardTitle'],
    '@angular/material/form-field': ['MatFormField', 'MatFormFieldModule', 'MatLabel', 'MatError', 'MatHint'],
    '@angular/material/input': ['MatInput', 'MatInputModule'],
    '@angular/material/select': ['MatSelect', 'MatSelectModule', 'MatOption'],
    '@angular/material/checkbox': ['MatCheckbox', 'MatCheckboxModule'],
    '@angular/material/table': ['MatTable', 'MatTableModule', 'MatTableDataSource', 'MatHeaderCell', 'MatCell'],
    '@angular/material/paginator': ['MatPaginator', 'MatPaginatorModule'],
    '@angular/material/sort': ['MatSort', 'MatSortModule', 'MatSortHeader'],
    '@angular/material/dialog': ['MatDialog', 'MatDialogModule', 'MatDialogRef', 'MAT_DIALOG_DATA'],
    '@angular/material/snack-bar': ['MatSnackBar', 'MatSnackBarModule'],
    '@angular/material/toolbar': ['MatToolbar', 'MatToolbarModule'],
    '@angular/material/sidenav': ['MatSidenav', 'MatSidenavModule', 'MatDrawer'],
    '@angular/material/list': ['MatList', 'MatListModule', 'MatListItem', 'MatNavList'],
    '@angular/material/menu': ['MatMenu', 'MatMenuModule', 'MatMenuItem', 'MatMenuTrigger'],
    '@angular/material/progress-spinner': ['MatProgressSpinner', 'MatProgressSpinnerModule'],
    '@angular/material/progress-bar': ['MatProgressBar', 'MatProgressBarModule'],
    '@angular/material/tabs': ['MatTab', 'MatTabsModule', 'MatTabGroup'],
    '@angular/material/chips': ['MatChip', 'MatChipsModule', 'MatChipList'],
    '@angular/material/datepicker': ['MatDatepicker', 'MatDatepickerModule', 'MatCalendar'],
    '@angular/material/tooltip': ['MatTooltip', 'MatTooltipModule'],
  };

  // Firebase/AngularFire imports based on your versions
  private static readonly FIREBASE_IMPORTS: Record<string, string[]> = {
    '@angular/fire/firestore': [
      'Firestore', 'collection', 'doc', 'collectionData', 'docData', 
      'addDoc', 'updateDoc', 'deleteDoc', 'setDoc', 'query', 'where', 
      'orderBy', 'limit', 'startAfter', 'endBefore', 'CollectionReference',
      'DocumentReference', 'QueryConstraint', 'provideFirestore', 'getFirestore'
    ],
    '@angular/fire/auth': [
      'Auth', 'signInWithEmailAndPassword', 'createUserWithEmailAndPassword',
      'signOut', 'onAuthStateChanged', 'User', 'provideAuth', 'getAuth',
      'sendPasswordResetEmail', 'updateProfile', 'updatePassword'
    ],
    '@angular/fire/storage': [
      'Storage', 'ref', 'uploadBytes', 'uploadString', 'getDownloadURL',
      'deleteObject', 'listAll', 'provideStorage', 'getStorage'
    ],
    '@angular/fire/app': ['initializeApp', 'provideFirebaseApp', 'getApp'],
  };

  // Branded types from your project
  private static readonly BRANDED_TYPES = [
    'ProjectId', 'UserId', 'TaskId', 'StaffId', 'ClientId', 'SupplierId',
    'ContractorId', 'MaterialId', 'StockItemId', 'StockMovementId', 'RoleId'
  ];

  // RxJS v7.8.0 operators - comprehensive list
  private static readonly RXJS_OPERATORS = {
    creation: ['of', 'from', 'fromEvent', 'interval', 'timer', 'range', 'defer', 'generate', 'empty', 'never', 'throwError', 'ajax', 'webSocket'],
    transformation: ['map', 'mapTo', 'pluck', 'switchMap', 'mergeMap', 'concatMap', 'exhaustMap', 'scan', 'reduce', 'toArray', 'buffer', 'bufferTime', 'bufferCount', 'bufferWhen', 'bufferToggle', 'window', 'windowTime', 'windowCount', 'windowWhen', 'windowToggle', 'groupBy', 'pairwise', 'partition', 'expand'],
    filtering: ['filter', 'take', 'takeUntil', 'takeWhile', 'takeLast', 'skip', 'skipUntil', 'skipWhile', 'skipLast', 'first', 'last', 'single', 'elementAt', 'ignoreElements', 'distinct', 'distinctUntilChanged', 'distinctUntilKeyChanged', 'debounce', 'debounceTime', 'throttle', 'throttleTime', 'audit', 'auditTime', 'sample', 'sampleTime'],
    combination: ['combineLatest', 'concat', 'merge', 'zip', 'race', 'forkJoin', 'withLatestFrom', 'startWith', 'endWith', 'pairwise', 'combineLatestAll', 'concatAll', 'mergeAll', 'switchAll', 'exhaust'],
    error: ['catchError', 'retry', 'retryWhen', 'onErrorResumeNext'],
    utility: ['tap', 'delay', 'delayWhen', 'dematerialize', 'materialize', 'observeOn', 'subscribeOn', 'timeInterval', 'timestamp', 'timeout', 'timeoutWith', 'toArray', 'finalize', 'repeat', 'repeatWhen'],
    conditional: ['defaultIfEmpty', 'every', 'find', 'findIndex', 'isEmpty'],
    mathematical: ['count', 'max', 'min', 'reduce'],
    multicasting: ['share', 'shareReplay', 'publish', 'publishBehavior', 'publishLast', 'publishReplay', 'multicast', 'refCount', 'connect']
  };

  // Theme mixin patterns used in FibreFlow
  private static readonly THEME_MIXINS = [
    'mat-card-theme', 'mat-button-theme', 'mat-toolbar-theme', 'mat-form-field-theme',
    'mat-input-theme', 'mat-select-theme', 'mat-table-theme', 'mat-paginator-theme',
    'mat-dialog-theme', 'mat-snack-bar-theme', 'mat-sidenav-theme', 'mat-list-theme',
    'custom-component-theme', 'apply-theme-to-component'
  ];

  // Common FibreFlow service patterns
  private static readonly SERVICE_PATTERNS = {
    'ProjectService': ['getProjects', 'getProjectById', 'createProject', 'updateProject', 'deleteProject', 'getProjectsByStatus'],
    'AuthService': ['login', 'logout', 'register', 'getCurrentUser', 'isAuthenticated', 'hasRole'],
    'StaffService': ['getStaff', 'getStaffById', 'createStaff', 'updateStaff', 'deleteStaff', 'getStaffByRole'],
    'TaskService': ['getTasks', 'getTaskById', 'createTask', 'updateTask', 'deleteTask', 'getTasksByProject'],
    'StockService': ['getStockItems', 'getStockItemById', 'createStockItem', 'updateStockItem', 'adjustStock'],
    'SupplierService': ['getSuppliers', 'getSupplierById', 'createSupplier', 'updateSupplier', 'deleteSupplier'],
  };

  static validateAngularMaterialImport(importPath: string, imports: string[], issues: HallucinationIssue[]): void {
    const validImports = this.MATERIAL_MODULES[importPath];
    
    if (!validImports && !importPath.startsWith('@angular/material/')) {
      return; // Not a Material import
    }

    if (!validImports) {
      issues.push({
        type: 'import',
        description: `Unknown Angular Material module: ${importPath}`,
        severity: 'error',
        suggestion: `Valid Material modules: ${Object.keys(this.MATERIAL_MODULES).slice(0, 5).join(', ')}...`
      });
      return;
    }

    imports.forEach(imp => {
      if (!validImports.includes(imp)) {
        issues.push({
          type: 'import',
          description: `'${imp}' is not exported from ${importPath}`,
          severity: 'error',
          suggestion: `Available exports: ${validImports.join(', ')}`
        });
      }
    });
  }

  static validateFirebaseImport(importPath: string, imports: string[], issues: HallucinationIssue[]): void {
    const validImports = this.FIREBASE_IMPORTS[importPath];
    
    if (!validImports) {
      return; // Not a Firebase import we track
    }

    imports.forEach(imp => {
      if (!validImports.includes(imp)) {
        const similar = validImports.filter(v => 
          v.toLowerCase().includes(imp.toLowerCase()) || 
          imp.toLowerCase().includes(v.toLowerCase())
        );
        
        issues.push({
          type: 'import',
          description: `'${imp}' is not exported from ${importPath}`,
          severity: 'error',
          suggestion: similar.length > 0 
            ? `Did you mean: ${similar.slice(0, 3).join(', ')}?`
            : `Available: ${validImports.slice(0, 5).join(', ')}...`
        });
      }
    });
  }

  static validateBrandedType(typeName: string, issues: HallucinationIssue[]): void {
    if (typeName.endsWith('Id') && !this.BRANDED_TYPES.includes(typeName)) {
      const similar = this.BRANDED_TYPES.filter(t => 
        t.toLowerCase().includes(typeName.toLowerCase().replace('id', ''))
      );
      
      issues.push({
        type: 'type',
        description: `'${typeName}' is not a defined branded type`,
        severity: 'warning',
        suggestion: similar.length > 0 
          ? `Did you mean: ${similar.join(', ')}?`
          : `Valid branded types: ${this.BRANDED_TYPES.slice(0, 5).join(', ')}...`
      });
    }
  }

  static validateServiceMethod(serviceName: string, methodName: string, issues: HallucinationIssue[]): void {
    const commonMethods = this.SERVICE_PATTERNS[serviceName];
    
    if (!commonMethods) {
      return; // Not a service we track patterns for
    }

    // Check if it's a CRUD method pattern
    const crudPatterns = /^(get|create|update|delete|find|save|remove)/;
    if (crudPatterns.test(methodName)) {
      // It's likely a valid CRUD method even if not in our list
      return;
    }

    if (!commonMethods.includes(methodName)) {
      issues.push({
        type: 'method',
        description: `'${methodName}' is not a common method on ${serviceName}`,
        severity: 'warning',
        suggestion: `Common methods: ${commonMethods.join(', ')}`
      });
    }
  }

  static validateStandaloneComponent(decoratorMetadata: any, issues: HallucinationIssue[]): void {
    // Check if component uses standalone pattern (no NgModule)
    if (!decoratorMetadata.standalone) {
      issues.push({
        type: 'component',
        description: 'Component should use standalone: true (project uses standalone components)',
        severity: 'warning',
        suggestion: 'Add standalone: true to @Component decorator'
      });
    }

    // Check for imports array (required for standalone)
    if (decoratorMetadata.standalone && !decoratorMetadata.imports) {
      issues.push({
        type: 'component',
        description: 'Standalone component missing imports array',
        severity: 'error',
        suggestion: 'Add imports: [...] with required modules'
      });
    }
  }

  static validateInjectPattern(constructorParams: any[], issues: HallucinationIssue[]): void {
    // FibreFlow uses inject() pattern, not constructor DI
    if (constructorParams && constructorParams.length > 0) {
      issues.push({
        type: 'pattern',
        description: 'Use inject() pattern instead of constructor dependency injection',
        severity: 'warning',
        suggestion: 'Replace constructor parameters with: private service = inject(ServiceName)'
      });
    }
  }

  static validateThemeUsage(cssContent: string, issues: HallucinationIssue[]): void {
    // Check for hardcoded colors instead of theme variables
    const hardcodedColors = cssContent.match(/#[0-9a-fA-F]{3,6}|rgb\(|rgba\(/g);
    
    if (hardcodedColors) {
      issues.push({
        type: 'style',
        description: 'Use theme variables instead of hardcoded colors',
        severity: 'warning',
        suggestion: 'Use var(--primary-color), var(--accent-color), etc.'
      });
    }
  }

  static validateDateFormat(dateString: string, issues: HallucinationIssue[]): void {
    // South African format: DD/MM/YYYY
    const usFormat = /\d{1,2}\/\d{1,2}\/\d{4}/;
    if (usFormat.test(dateString) && !dateString.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      issues.push({
        type: 'localization',
        description: 'Use DD/MM/YYYY format for South African locale',
        severity: 'info',
        suggestion: 'Format dates as DD/MM/YYYY (en-ZA)'
      });
    }
  }

  static validateCurrencyFormat(value: string, issues: HallucinationIssue[]): void {
    // Check for $ instead of R
    if (value.includes('$')) {
      issues.push({
        type: 'localization',
        description: 'Use ZAR (R) currency symbol for South Africa',
        severity: 'warning',
        suggestion: 'Replace $ with R for currency values'
      });
    }
  }

  static validateSentryUsage(code: string, issues: HallucinationIssue[]): void {
    // Check if error handling uses Sentry
    if (code.includes('console.error') && !code.includes('Sentry')) {
      issues.push({
        type: 'monitoring',
        description: 'Use Sentry for error tracking instead of console.error',
        severity: 'info',
        suggestion: 'Use Sentry.captureException(error) for production error tracking'
      });
    }
  }

  static validateTypeScriptStrict(code: string, issues: HallucinationIssue[]): void {
    // Check for 'any' type usage (project has zero any policy)
    const anyMatches = code.match(/:\s*any\b/g);
    if (anyMatches) {
      issues.push({
        type: 'type',
        description: 'Avoid using "any" type (project enforces zero any types)',
        severity: 'error',
        suggestion: 'Use specific types, unknown, or generic types instead'
      });
    }

    // Check for missing types on public methods
    const publicMethods = code.match(/public\s+\w+\s*\([^)]*\)\s*{/g);
    if (publicMethods) {
      publicMethods.forEach(method => {
        if (!method.includes(':')) {
          issues.push({
            type: 'type',
            description: 'Public method missing return type annotation',
            severity: 'warning',
            suggestion: 'Add explicit return type to all public methods'
          });
        }
      });
    }
  }

  static validateAngularCDKImport(importPath: string, imports: string[], issues: HallucinationIssue[]): void {
    const validImports = this.CDK_MODULES[importPath];
    
    if (!validImports) {
      return; // Not a CDK import we track
    }

    imports.forEach(imp => {
      if (!validImports.includes(imp)) {
        issues.push({
          type: 'import',
          description: `'${imp}' is not exported from ${importPath}`,
          severity: 'error',
          suggestion: `Available exports: ${validImports.slice(0, 5).join(', ')}...`
        });
      }
    });
  }

  static validateRxJSOperator(operatorName: string, issues: HallucinationIssue[]): void {
    // Check if it's a valid RxJS operator
    const allOperators = Object.values(this.RXJS_OPERATORS).flat();
    
    if (!allOperators.includes(operatorName)) {
      // Find similar operators
      const similar = allOperators.filter(op => 
        op.toLowerCase().includes(operatorName.toLowerCase()) || 
        operatorName.toLowerCase().includes(op.toLowerCase())
      );
      
      // Find category if partial match
      let category = '';
      for (const [cat, ops] of Object.entries(this.RXJS_OPERATORS)) {
        if (ops.some(op => op.toLowerCase().includes(operatorName.toLowerCase()))) {
          category = cat;
          break;
        }
      }
      
      issues.push({
        type: 'method',
        description: `'${operatorName}' is not a valid RxJS v7.8 operator`,
        severity: 'error',
        suggestion: similar.length > 0 
          ? `Did you mean: ${similar.slice(0, 3).join(', ')}?`
          : category 
            ? `${category} operators: ${this.RXJS_OPERATORS[category as keyof typeof this.RXJS_OPERATORS].slice(0, 5).join(', ')}`
            : `Common operators: map, filter, tap, switchMap, catchError`
      });
    }
  }

  static validateZonePatterns(code: string, issues: HallucinationIssue[]): void {
    // Check for manual change detection instead of Zone.js
    if (code.includes('detectChanges()') && !code.includes('ChangeDetectorRef')) {
      issues.push({
        type: 'pattern',
        description: 'Avoid manual change detection - Zone.js handles this automatically',
        severity: 'warning',
        suggestion: 'Remove manual detectChanges() calls unless using OnPush strategy'
      });
    }

    // Check for setTimeout/setInterval without Zone awareness
    if ((code.includes('setTimeout') || code.includes('setInterval')) && 
        !code.includes('ngZone.run') && !code.includes('ngZone.runOutsideAngular')) {
      issues.push({
        type: 'pattern',
        description: 'Async operations should be Zone-aware for proper change detection',
        severity: 'info',
        suggestion: 'Use ngZone.run() for UI updates or ngZone.runOutsideAngular() for performance'
      });
    }
  }

  static validateSCSSThemeMixins(scssContent: string, issues: HallucinationIssue[]): void {
    // Check for @include statements
    const includeMatches = scssContent.match(/@include\s+(\w+-theme)\(/g);
    
    if (includeMatches) {
      includeMatches.forEach(match => {
        const mixinName = match.match(/@include\s+(\w+-theme)/)?.[1];
        if (mixinName && !this.THEME_MIXINS.includes(mixinName)) {
          issues.push({
            type: 'style',
            description: `Unknown theme mixin: ${mixinName}`,
            severity: 'warning',
            suggestion: `Valid mixins: ${this.THEME_MIXINS.slice(0, 5).join(', ')}...`
          });
        }
      });
    }

    // Check for direct Material color usage
    if (scssContent.includes('mat-color(') && !scssContent.includes('$theme')) {
      issues.push({
        type: 'style',
        description: 'Use theme parameter in mat-color() function',
        severity: 'warning',
        suggestion: 'Pass $theme to mat-color() for proper theming'
      });
    }
  }

  static validateFirebaseSecurityPatterns(code: string, issues: HallucinationIssue[]): void {
    // Check for direct Firestore access without auth checks
    if ((code.includes('addDoc') || code.includes('updateDoc') || code.includes('deleteDoc')) &&
        !code.includes('currentUser') && !code.includes('auth')) {
      issues.push({
        type: 'security',
        description: 'Firestore operations should verify authentication',
        severity: 'warning',
        suggestion: 'Check user authentication before database operations'
      });
    }

    // Check for sensitive data exposure
    if (code.includes('console.log') && 
        (code.includes('password') || code.includes('token') || code.includes('apiKey'))) {
      issues.push({
        type: 'security',
        description: 'Avoid logging sensitive information',
        severity: 'error',
        suggestion: 'Remove console.log statements containing sensitive data'
      });
    }
  }

  static validateLazyLoadingPattern(code: string, issues: HallucinationIssue[]): void {
    // Check route definitions
    const routePattern = /path:\s*['"`]([^'"`]+)['"`],\s*loadChildren:/g;
    const matches = code.matchAll(routePattern);
    
    for (const match of matches) {
      const path = match[1];
      
      // Check if loadChildren uses modern import() syntax
      const routeBlock = code.substring(match.index!, match.index! + 200);
      if (!routeBlock.includes('import(') || !routeBlock.includes('.then(')) {
        issues.push({
          type: 'pattern',
          description: 'Use modern import() syntax for lazy loading',
          severity: 'warning',
          suggestion: `loadChildren: () => import('./path/to/module').then(m => m.FeatureModule)`
        });
      }

      // Check for proper route path naming
      if (path.includes('_') || path.includes(' ')) {
        issues.push({
          type: 'pattern',
          description: 'Use kebab-case for route paths',
          severity: 'info',
          suggestion: `Change '${path}' to kebab-case format`
        });
      }
    }

    // Check for loadComponent (standalone components)
    if (code.includes('loadChildren') && code.includes('standalone: true')) {
      issues.push({
        type: 'pattern',
        description: 'Use loadComponent for standalone components instead of loadChildren',
        severity: 'warning',
        suggestion: 'loadComponent: () => import("./component").then(m => m.Component)'
      });
    }
  }
}