# AH Agent Command

Validate AI-generated code against the FibreFlow codebase to prevent hallucinations.

## Usage
```
/ah                     # Show AH agent help
/ah validate [code]     # Validate code snippet
/ah check [method]      # Check if method exists
/ah test               # Run test suite
```

## Examples

### Quick validation:
```
/ah validate "this.authService.loginWithMagicLink()"
```

### Check specific method:
```
/ah check AuthService.login
```

### Validate multiple patterns:
```
/ah validate "
  this.projectService.archiveAllProjects();
  this.userService.deleteAllUsers();
  this.auditService.logDeletion('user', userId);
"
```

### Run test suite:
```
/ah test
```

## What it validates:
- Service method existence
- Import paths
- Angular patterns
- TypeScript types
- RxJS operators
- Component decorators

## Quick tips:
- Always validate before implementing
- Trust the results - if it says method doesn't exist, it doesn't
- Update knowledge graph regularly: `cd antiHall && npm run parse:improved`