import { CodebaseParser } from './codebase-parser';
import { readFileSync } from 'fs';
import { join } from 'path';

async function analyzeParserCoverage() {
  const parser = new CodebaseParser();
  const srcPath = '/home/ldp/VF/Apps/FibreFlow/src';
  
  console.log('🔍 Analyzing parser coverage for FibreFlow codebase...\n');

  // Parse the codebase
  const parsed = await parser.parseCodebase(srcPath);
  
  console.log('📊 Parser Results:');
  console.log(`- Components: ${parsed.components.length}`);
  console.log(`- Services: ${parsed.services.length}`);
  console.log(`- Interfaces: ${parsed.interfaces.length}`);
  console.log(`- Models: ${parsed.models.length}`);
  
  console.log('\n🔍 Checking for missing patterns...\n');

  // Check 1: Services without @Injectable
  console.log('1. Services without @Injectable decorator:');
  const serviceFiles = [
    '/app/core/services/custom-preload.service.ts',
    '/app/core/services/global-error-handler.service.ts',
    '/app/features/staff/services/staff-error-handler.service.ts'
  ];
  
  for (const file of serviceFiles) {
    const fullPath = join(srcPath, file);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      if (!content.includes('@Injectable')) {
        console.log(`   ❌ ${file} - Service without @Injectable`);
      }
    } catch (e) {
      // File doesn't exist
    }
  }

  // Check 2: Function-based guards and interceptors
  console.log('\n2. Function-based guards and interceptors:');
  const functionFiles = [
    { path: '/app/core/guards/auth.guard.ts', type: 'Guard' },
    { path: '/app/core/guards/role.guard.ts', type: 'Guard' },
    { path: '/app/core/interceptors/error.interceptor.ts', type: 'Interceptor' },
    { path: '/app/core/interceptors/loading.interceptor.ts', type: 'Interceptor' }
  ];
  
  let foundFunctionBased = false;
  for (const { path, type } of functionFiles) {
    const fullPath = join(srcPath, path);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      if (content.includes('export const') && content.includes(': ' + (type === 'Guard' ? 'CanActivateFn' : 'HttpInterceptorFn'))) {
        console.log(`   ⚠️  ${path} - Function-based ${type} (not captured)`);
        foundFunctionBased = true;
      }
    } catch (e) {
      // File doesn't exist
    }
  }
  if (!foundFunctionBased) {
    console.log('   ✅ No function-based guards/interceptors found');
  }

  // Check 3: Utility functions and helpers
  console.log('\n3. Utility functions and helper methods:');
  const utilFiles = [
    '/app/core/utils/type-guards.ts',
    '/app/core/utils/type-utils.ts'
  ];
  
  let utilFunctionCount = 0;
  for (const file of utilFiles) {
    const fullPath = join(srcPath, file);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      const functionMatches = content.match(/export\s+function\s+\w+/g);
      if (functionMatches) {
        utilFunctionCount += functionMatches.length;
        console.log(`   ⚠️  ${file} - ${functionMatches.length} utility functions (not captured)`);
      }
    } catch (e) {
      // File doesn't exist
    }
  }

  // Check 4: Static methods and classes with static methods
  console.log('\n4. Classes with static methods:');
  const staticClasses = [
    '/app/shared/models/pagination.model.ts'
  ];
  
  for (const file of staticClasses) {
    const fullPath = join(srcPath, file);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      const staticMatches = content.match(/static\s+\w+\s*\(/g);
      if (staticMatches) {
        console.log(`   ⚠️  ${file} - Class with ${staticMatches.length} static methods (not captured)`);
      }
    } catch (e) {
      // File doesn't exist
    }
  }

  // Check 5: Abstract classes and mixins
  console.log('\n5. Abstract classes and mixins:');
  const abstractClasses = [
    '/app/shared/base/destroyable.component.ts'
  ];
  
  for (const file of abstractClasses) {
    const fullPath = join(srcPath, file);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      if (content.includes('abstract class')) {
        console.log(`   ⚠️  ${file} - Abstract class (not captured)`);
      }
      if (content.includes('export function') && content.includes('extends')) {
        console.log(`   ⚠️  ${file} - Contains mixin function (not captured)`);
      }
    } catch (e) {
      // File doesn't exist
    }
  }

  // Check 6: Directives
  console.log('\n6. Directives:');
  const directiveFiles = [
    '/app/shared/directives/lazy-image.directive.ts'
  ];
  
  for (const file of directiveFiles) {
    const fullPath = join(srcPath, file);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      if (content.includes('@Directive')) {
        console.log(`   ⚠️  ${file} - Directive (not captured)`);
      }
    } catch (e) {
      // File doesn't exist
    }
  }

  // Check 7: Type definitions and enums
  console.log('\n7. Type definitions and enums:');
  let typeCount = 0;
  let enumCount = 0;
  
  const typeFiles = [
    '/app/core/types/branded.types.ts',
    '/app/core/types/route.types.ts',
    '/app/core/types/state.types.ts'
  ];
  
  for (const file of typeFiles) {
    const fullPath = join(srcPath, file);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      const typeMatches = content.match(/export\s+type\s+\w+/g);
      const enumMatches = content.match(/export\s+enum\s+\w+/g);
      
      if (typeMatches) typeCount += typeMatches.length;
      if (enumMatches) enumCount += enumMatches.length;
    } catch (e) {
      // File doesn't exist
    }
  }
  
  if (typeCount > 0 || enumCount > 0) {
    console.log(`   ⚠️  Found ${typeCount} type definitions and ${enumCount} enums (not captured)`);
  }

  // Check 8: Providers in app.config.ts
  console.log('\n8. Custom providers and factories:');
  const configPath = join(srcPath, '/app/app.config.ts');
  try {
    const content = readFileSync(configPath, 'utf-8');
    if (content.includes('provide:') && content.includes('useFactory:')) {
      console.log(`   ⚠️  app.config.ts - Contains custom providers with factories (not captured)`);
    }
  } catch (e) {
    // File doesn't exist
  }

  console.log('\n📋 Summary of Parser Gaps:');
  console.log('- ❌ Function-based guards and interceptors');
  console.log('- ❌ Utility functions and standalone functions');
  console.log('- ❌ Static methods and helper classes');
  console.log('- ❌ Abstract classes and mixins');
  console.log('- ❌ Directives');
  console.log('- ❌ Type definitions and enums');
  console.log('- ❌ Custom providers and factories');
  console.log('- ❌ Services without @Injectable decorator');
  console.log('- ❌ Pipes');
  console.log('- ❌ Standalone components/directives');
  console.log('- ❌ Route configurations');
  console.log('- ❌ Module declarations and imports');
}

analyzeParserCoverage().catch(console.error);