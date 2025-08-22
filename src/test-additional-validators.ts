#!/usr/bin/env node

import { config } from 'dotenv';
config();

import { HallucinationDetector } from './hallucination-detector.js';
import { ParsedCodebase } from './codebase-parser.js';

// Mock codebase
const mockCodebase: ParsedCodebase = {
  components: [],
  services: [],
  interfaces: [],
  models: []
};

const additionalTestCases = [
  {
    name: "✅ Correct RxJS v7.8 operators",
    code: `
import { switchMap, debounceTime, distinctUntilChanged, catchError } from 'rxjs/operators';
import { of, throwError } from 'rxjs';

this.search$.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  switchMap(term => this.searchService.search(term)),
  catchError(error => of([]))
).subscribe();
`
  },
  {
    name: "❌ Invalid RxJS operator",
    code: `
import { retryWithBackoff, delayRetry } from 'rxjs/operators';

this.api$.pipe(
  retryWithBackoff(3, 1000),
  delayRetry(5000)
).subscribe();
`
  },
  {
    name: "❌ Wrong Angular CDK import",
    code: `
import { DragDrop, DropZone } from '@angular/cdk/drag-drop';
import { VirtualScroll } from '@angular/cdk/scrolling';
// DropZone and VirtualScroll don't exist
`
  },
  {
    name: "❌ Zone.js pattern issues",
    code: `
export class DataComponent {
  updateView() {
    // Manual change detection without ChangeDetectorRef
    this.detectChanges();
    
    // Async operation without Zone awareness
    setTimeout(() => {
      this.data = newData;
    }, 1000);
  }
}
`
  },
  {
    name: "❌ SCSS theme mixin issues",
    code: `
@Component({
  selector: 'app-themed',
  template: '<div>Themed</div>',
  styles: [\`
    @include custom-button-theme($theme);
    @include invalid-theme-mixin($theme);
    
    .card {
      background: mat-color($primary); // Missing $theme parameter
    }
  \`]
})
export class ThemedComponent {}
`
  },
  {
    name: "❌ Firebase security issues",
    code: `
export class DataService {
  async saveData(data: any) {
    // Direct Firestore write without auth check
    await addDoc(collection(this.firestore, 'projects'), data);
  }
  
  debugAuth(user: User) {
    // Logging sensitive data
    console.log('User token:', user.token);
    console.log('API key:', this.apiKey);
  }
}
`
  },
  {
    name: "❌ Wrong lazy loading pattern",
    code: `
const routes: Routes = [
  {
    path: 'user_profile',  // Should be kebab-case
    loadChildren: './modules/profile/profile.module#ProfileModule'  // Old syntax
  },
  {
    path: 'dashboard',
    loadChildren: () => import('./dashboard.component').then(m => m.DashboardComponent),
    // Using loadChildren for standalone component
    data: { standalone: true }
  }
];
`
  },
  {
    name: "❌ Mixed CDK issues",
    code: `
import { Platform } from '@angular/cdk/platform';
import { BreakpointObserver, Breakpoint } from '@angular/cdk/layout';
import { ScrollStrategy } from '@angular/cdk/overlay';
// 'Breakpoint' should be 'Breakpoints', 'ScrollStrategy' needs more specific import
`
  },
  {
    name: "✅ Correct lazy loading with standalone",
    code: `
const routes: Routes = [
  {
    path: 'projects',
    loadComponent: () => import('./projects/projects.component').then(m => m.ProjectsComponent)
  },
  {
    path: 'staff-management',
    loadChildren: () => import('./staff/staff.routes').then(m => m.STAFF_ROUTES)
  }
];
`
  }
];

async function runAdditionalTests() {
  console.log('🧪 Additional FibreFlow Validations Test\n');
  console.log('Testing additional tech stack validations:\n');
  console.log('- RxJS v7.8.0 operators');
  console.log('- Angular CDK imports');
  console.log('- Zone.js patterns');
  console.log('- SCSS theme mixins');
  console.log('- Firebase security patterns');
  console.log('- Lazy loading patterns\n');
  console.log('=' .repeat(60));
  
  const detector = new HallucinationDetector(mockCodebase);
  
  for (const testCase of additionalTestCases) {
    console.log(`\n${testCase.name}`);
    console.log('-'.repeat(60));
    
    const result = await detector.detectHallucinations(testCase.code);
    
    console.log(`Hallucinations detected: ${result.hasHallucinations ? 'YES ⚠️' : 'NO ✅'}`);
    console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    
    if (result.issues.length > 0) {
      console.log('\nIssues found:');
      result.issues.forEach((issue, index) => {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`  ${index + 1}. ${icon} [${issue.type}] ${issue.description}`);
        if (issue.suggestion) {
          console.log(`     💡 ${issue.suggestion}`);
        }
      });
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Additional validation test completed!');
  console.log('\nAll FibreFlow tech stack validations are now active:');
  console.log('- TypeScript strict mode & branded types');
  console.log('- Angular v20 patterns & imports');
  console.log('- Angular Material & CDK v20');
  console.log('- Firebase/AngularFire security');
  console.log('- RxJS v7.8 operators');
  console.log('- Theme system & SCSS mixins');
  console.log('- Zone.js change detection');
  console.log('- Lazy loading patterns');
  console.log('- South African localization');
  console.log('- Sentry error tracking');
}

runAdditionalTests().catch(console.error);