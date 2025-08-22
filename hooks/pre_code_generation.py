#!/usr/bin/env python3
"""
Pre-code generation hook for antiHall validation.
Automatically validates code patterns before they're written to files.
"""

import os
import sys
import json
import subprocess
import re
from pathlib import Path

# Add parent directory to path for utils import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.fibreflow_validators import validate_code_pattern

def extract_code_patterns(content):
    """Extract TypeScript/Angular code patterns from content."""
    patterns = []
    
    # Find service method calls
    service_calls = re.findall(r'this\.(\w+Service)\.(\w+)\(', content)
    for service, method in service_calls:
        patterns.append({
            'type': 'service_method',
            'service': service,
            'method': method,
            'full': f'this.{service}.{method}()'
        })
    
    # Find imports
    imports = re.findall(r"import\s*{([^}]+)}\s*from\s*['\"]([^'\"]+)['\"]", content)
    for imported, path in imports:
        patterns.append({
            'type': 'import',
            'items': [i.strip() for i in imported.split(',')],
            'path': path
        })
    
    # Find component decorators
    components = re.findall(r'@Component\({[^}]+}\)', content, re.DOTALL)
    for comp in components:
        if 'standalone: true' not in comp:
            patterns.append({
                'type': 'component',
                'issue': 'missing_standalone',
                'code': comp[:50] + '...'
            })
    
    return patterns

def validate_with_antihall(code_snippet):
    """Run antiHall validation on code snippet."""
    antihall_dir = Path('/home/ldp/VF/Apps/FibreFlow/antiHall')
    
    if not antihall_dir.exists():
        return None, "antiHall directory not found"
    
    try:
        # Run antiHall check
        result = subprocess.run(
            ['npm', 'run', 'check', code_snippet],
            cwd=str(antihall_dir),
            capture_output=True,
            text=True,
            timeout=10
        )
        
        return result.stdout, result.stderr
    except Exception as e:
        return None, str(e)

def main(hook_data):
    """Main hook function called by Claude."""
    tool_name = hook_data.get('tool_name', '')
    
    # Only validate for file writing tools
    if tool_name not in ['Write', 'Edit', 'MultiEdit']:
        return hook_data
    
    # Extract parameters
    params = hook_data.get('params', {})
    file_path = params.get('file_path', '')
    
    # Only validate TypeScript/Angular files
    if not file_path.endswith(('.ts', '.component.ts', '.service.ts')):
        return hook_data
    
    # Get content to validate
    content = ''
    if tool_name == 'Write':
        content = params.get('content', '')
    elif tool_name == 'Edit':
        content = params.get('new_string', '')
    elif tool_name == 'MultiEdit':
        edits = params.get('edits', [])
        content = '\n'.join([e.get('new_string', '') for e in edits])
    
    if not content:
        return hook_data
    
    # Extract and validate patterns
    patterns = extract_code_patterns(content)
    validation_issues = []
    
    for pattern in patterns:
        if pattern['type'] == 'service_method':
            stdout, stderr = validate_with_antihall(pattern['full'])
            if stdout and 'does not exist' in stdout:
                validation_issues.append({
                    'type': 'hallucination',
                    'message': f"Method '{pattern['method']}' not found in {pattern['service']}",
                    'suggestion': 'Check available methods with antiHall'
                })
        
        elif pattern['type'] == 'component' and pattern.get('issue') == 'missing_standalone':
            validation_issues.append({
                'type': 'pattern_violation',
                'message': 'Component must use standalone: true',
                'suggestion': 'All FibreFlow components must be standalone'
            })
    
    # If issues found, add warning to hook data
    if validation_issues:
        hook_data['validation_warnings'] = validation_issues
        
        # Log warnings
        print("\n⚠️ antiHall Validation Warnings:")
        for issue in validation_issues:
            print(f"  - {issue['message']}")
            if issue.get('suggestion'):
                print(f"    💡 {issue['suggestion']}")
        print()
    
    return hook_data

if __name__ == '__main__':
    # This would be called by Claude's hook system
    # For testing, you can pass sample data
    test_data = {
        'tool_name': 'Write',
        'params': {
            'file_path': 'test.service.ts',
            'content': 'this.authService.loginWithMagicLink()'
        }
    }
    
    result = main(test_data)
    print(json.dumps(result, indent=2))