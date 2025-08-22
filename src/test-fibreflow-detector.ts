#!/usr/bin/env node

import { config } from 'dotenv';
config();

import { HallucinationDetector } from './hallucination-detector.js';
import { ParsedCodebase } from './codebase-parser.js';

// Mock FibreFlow codebase
const mockCodebase: ParsedCodebase = {
  components: [],
  services: [
    {
      name: 'ProjectService',
      injectable: true,
      providedIn: 'root',
      methods: [
        {
          name: 'getProjects',
          parameters: [],
          returnType: 'Observable<Project[]>',
          isAsync: false,
          visibility: 'public'
        }
      ],
      properties: [],
      dependencies: ['Firestore'],
      filePath: 'src/app/core/services/project.service.ts'
    }
  ],
  interfaces: [],
  models: []
};

const fibreflowTestCases = [
  {
    name: "❌ Using 'any' type (Zero any policy)",
    code: `
export class ProjectService {
  private data: any;
  
  processData(input: any): any {
    return input;
  }
}
`
  },
  {
    name: "❌ Wrong Angular Material import",
    code: `
import { MatButton, MatButtonToggle } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
`
  },
  {
    name: "❌ Wrong Firebase/AngularFire import",
    code: `
import { getFirestore, query, filter } from '@angular/fire/firestore';
// 'filter' doesn't exist - should be 'where'
`
  },
  {
    name: "❌ Constructor DI instead of inject()",
    code: `
@Component({
  selector: 'app-project-list',
  template: ''
})
export class ProjectListComponent {
  constructor(
    private projectService: ProjectService,
    private auth: AuthService
  ) {}
}
`
  },
  {
    name: "❌ Non-standalone component",
    code: `
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {}
`
  },
  {
    name: "❌ Hardcoded colors instead of theme variables",
    code: `
@Component({
  selector: 'app-card',
  template: '<div>Card</div>',
  styles: [\`
    .card {
      background-color: #2196F3;
      color: rgba(0, 0, 0, 0.87);
      border: 1px solid #ccc;
    }
  \`]
})
export class CardComponent {}
`
  },
  {
    name: "❌ US currency format",
    code: `
export class PriceComponent {
  formatPrice(amount: number): string {
    return '$' + amount.toFixed(2);
  }
}
`
  },
  {
    name: "❌ console.error instead of Sentry",
    code: `
export class ErrorService {
  handleError(error: Error): void {
    console.error('An error occurred:', error);
    // Should use Sentry.captureException(error)
  }
}
`
  },
  {
    name: "❌ Wrong branded type usage",
    code: `
export class ProjectComponent {
  projectId: ProductId; // Should be ProjectId
  staffId: EmployeeId;  // Should be StaffId
}
`
  },
  {
    name: "❌ Missing return type on public method",
    code: `
export class DataService {
  public processData(input: string) {
    return input.toUpperCase();
  }
  
  public async fetchData(id: string) {
    const result = await this.api.get(id);
    return result;
  }
}
`
  }
];

async function runFibreFlowTests() {
  console.log('🧪 FibreFlow-Specific Hallucination Detection Test\n');
  console.log('Testing tech stack specific validations:\n');
  console.log('- TypeScript strict mode (zero any types)');
  console.log('- Angular v20 patterns (standalone components, inject())');
  console.log('- Angular Material v20 imports');
  console.log('- Firebase/AngularFire imports');
  console.log('- Theme system usage');
  console.log('- South African localization');
  console.log('- Sentry error tracking');
  console.log('- Branded types\n');
  console.log('=' .repeat(60));
  
  const detector = new HallucinationDetector(mockCodebase);
  
  for (const testCase of fibreflowTestCases) {
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
  console.log('✅ FibreFlow tech stack validation test completed!');
}

runFibreFlowTests().catch(console.error);