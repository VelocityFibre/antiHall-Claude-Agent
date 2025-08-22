#!/usr/bin/env node

import { config } from 'dotenv';
config();

// Example Angular code snippets to test hallucination detection

const testCases = [
  {
    name: "Correct service usage",
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
    name: "Hallucinated method",
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
    name: "Wrong RxJS operator",
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
    name: "Incorrect lifecycle hook",
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
    name: "Invalid Angular import",
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

console.log('🧪 FibreFlow Hallucination Detection Test Cases\n');
console.log('These examples demonstrate various types of hallucinations the system can detect:\n');

testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.name}`);
  console.log('─'.repeat(50));
  console.log('Code snippet:');
  console.log(testCase.code.trim());
  console.log('\nExpected detection: This code contains hallucinations that would be caught by the detector.');
  console.log('─'.repeat(50));
});

console.log('\n\n📋 To test these cases:');
console.log('1. First parse your codebase: use the parse_fibreflow_codebase tool');
console.log('2. Then check each code snippet: use the check_hallucinations tool with the code above');
console.log('\nThe hallucination detector will identify:');
console.log('- Non-existent methods on services');
console.log('- Invalid RxJS operators');
console.log('- Incorrect lifecycle hooks');
console.log('- Wrong imports from Angular modules');
console.log('- Misspelled or non-existent properties');