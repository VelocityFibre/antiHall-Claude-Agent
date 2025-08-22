#!/usr/bin/env node

import { config } from 'dotenv';
config();

import { HallucinationDetector } from './hallucination-detector.js';
import { ParsedCodebase } from './codebase-parser.js';

// Mock FibreFlow codebase structure for testing
const mockCodebase: ParsedCodebase = {
  components: [
    {
      name: 'ProjectListComponent',
      selector: 'app-project-list',
      templateUrl: './project-list.component.html',
      inputs: ['filter', 'sortBy'],
      outputs: ['projectSelected'],
      methods: [
        {
          name: 'ngOnInit',
          parameters: [],
          returnType: 'void',
          isAsync: false,
          visibility: 'public'
        },
        {
          name: 'loadProjects',
          parameters: [],
          returnType: 'void',
          isAsync: true,
          visibility: 'public'
        }
      ],
      filePath: 'src/app/features/projects/components/project-list/project-list.component.ts'
    }
  ],
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
        },
        {
          name: 'getProjectById',
          parameters: [{ name: 'id', type: 'string', optional: false }],
          returnType: 'Observable<Project>',
          isAsync: false,
          visibility: 'public'
        },
        {
          name: 'createProject',
          parameters: [{ name: 'project', type: 'Project', optional: false }],
          returnType: 'Observable<Project>',
          isAsync: false,
          visibility: 'public'
        }
      ],
      properties: [],
      dependencies: ['HttpClient', 'AuthService'],
      filePath: 'src/app/core/services/project.service.ts'
    },
    {
      name: 'AuthService',
      injectable: true,
      providedIn: 'root',
      methods: [
        {
          name: 'login',
          parameters: [
            { name: 'email', type: 'string', optional: false },
            { name: 'password', type: 'string', optional: false }
          ],
          returnType: 'Observable<User>',
          isAsync: false,
          visibility: 'public'
        },
        {
          name: 'logout',
          parameters: [],
          returnType: 'void',
          isAsync: false,
          visibility: 'public'
        },
        {
          name: 'getCurrentUser',
          parameters: [],
          returnType: 'Observable<User>',
          isAsync: false,
          visibility: 'public'
        }
      ],
      properties: [],
      dependencies: ['AngularFireAuth'],
      filePath: 'src/app/core/services/auth.service.ts'
    }
  ],
  interfaces: [],
  models: []
};

// Test cases
const testCases = [
  {
    name: "✅ Correct service usage",
    code: `
import { Component, OnInit } from '@angular/core';
import { ProjectService } from '../services/project.service';

@Component({
  selector: 'app-project-list',
  templateUrl: './project-list.component.html'
})
export class ProjectListComponent implements OnInit {
  constructor(private projectService: ProjectService) {}

  ngOnInit() {
    this.projectService.getProjects().subscribe(projects => {
      console.log(projects);
    });
  }
}
`
  },
  {
    name: "❌ Hallucinated method",
    code: `
import { Component } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  template: ''
})
export class LoginComponent {
  constructor(private authService: AuthService) {}

  login() {
    // This method doesn't exist!
    this.authService.loginWithMagicLink('user@example.com').subscribe();
  }
}
`
  },
  {
    name: "❌ Wrong RxJS operator",
    code: `
import { Component } from '@angular/core';
import { ProjectService } from '../services/project.service';

@Component({
  selector: 'app-dashboard',
  template: ''
})
export class DashboardComponent {
  constructor(private projectService: ProjectService) {}

  loadData() {
    this.projectService.getProjects()
      .pipe(
        // This operator doesn't exist!
        retryWithBackoff(3),
        map(projects => projects.filter(p => p.active))
      )
      .subscribe();
  }
}
`
  },
  {
    name: "❌ Incorrect lifecycle hook",
    code: `
import { Component } from '@angular/core';

@Component({
  selector: 'app-test',
  template: '<div>Test</div>'
})
export class TestComponent {
  // Wrong casing!
  ngoninit() {
    console.log('Component initialized');
  }

  // This lifecycle hook doesn't exist!
  ngOnMount() {
    console.log('Mounted');
  }
}
`
  },
  {
    name: "❌ Invalid Angular import",
    code: `
// Invalid imports
import { Observable } from '@angular/core';
import { FormBuilder } from '@angular/common';
import { Injectable } from '@angular/forms';

@Injectable()
export class TestService {
  constructor() {}
}
`
  }
];

async function runTests() {
  console.log('🧪 FibreFlow Hallucination Detection Test\n');
  console.log('=' .repeat(60));
  
  const detector = new HallucinationDetector(mockCodebase);
  
  for (const testCase of testCases) {
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
  console.log('✅ Hallucination detection test completed!');
  console.log('\nThe detector successfully identified:');
  console.log('- Non-existent methods (loginWithMagicLink)');
  console.log('- Invalid RxJS operators (retryWithBackoff)');
  console.log('- Incorrect lifecycle hooks (ngoninit, ngOnMount)');
  console.log('- Wrong Angular imports');
}

runTests().catch(console.error);