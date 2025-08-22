# 🛡️ antiHall Claude Agent

Stop AI hallucinations in your code! antiHall is a Claude Code agent that validates AI-generated code against your actual codebase, preventing non-existent methods, incorrect imports, and invalid patterns.

## 🚀 Quick Start (2 minutes)

### Option 1: NPM Install (Recommended)
```bash
# Clone and install
git clone https://github.com/VelocityFibre/antiHall-Claude-Agent.git
cd antiHall-Claude-Agent
npm install

# Parse your codebase
npm run parse /path/to/your/project

# Validate code
npm run validate "this.authService.loginWithMagicLink()"
# Result: ❌ Method 'loginWithMagicLink' doesn't exist!
```

### Option 2: Docker
```bash
# Build container
docker build -t antihall .

# Parse your codebase
docker run -v /path/to/project:/project antihall parse

# Validate code
docker run -v /path/to/project:/project antihall validate "this.userService.deleteAllUsers()"
```

### Option 3: Claude Code Integration
```bash
# Copy agent files to your Claude workspace
cp -r claude-agent/* /path/to/project/.claude/

# The AH agent is now available in Claude Code:
# /ah validate "code"
# /agent ah
```

## 🎯 What It Does

antiHall builds a knowledge graph of your codebase and validates AI suggestions against it:

```typescript
// AI suggests:
this.userService.deleteAllUsers()

// antiHall validates:
✅ userService exists
❌ deleteAllUsers() doesn't exist
💡 Available methods: getUsers(), updateUser(), deleteUser()
```

## 📦 Features

- **Zero Config** - Works out of the box
- **Fast** - Parses in seconds, validates instantly
- **Comprehensive** - Validates services, methods, components, imports, routes
- **Smart Suggestions** - Shows available alternatives
- **Claude Code Ready** - Integrates as an agent

## 🔧 Installation

### Prerequisites
- Node.js 18+ 
- npm or pnpm
- (Optional) Docker for containerized usage

### Step-by-step

1. **Clone the repository**
```bash
git clone https://github.com/VelocityFibre/antiHall-Claude-Agent.git
cd antiHall-Claude-Agent
```

2. **Install dependencies**
```bash
npm install
```

3. **Parse your codebase**
```bash
# Basic parse (components & services)
npm run parse /path/to/your/project

# Full parse (recommended)
npm run parse:improved /path/to/your/project
```

4. **Start validating!**
```bash
npm run validate "your code here"
```

## 🤖 Claude Code Integration

### Install as Claude Agent

1. **Copy agent files**
```bash
./scripts/install-claude-agent.sh /path/to/your/project
```

2. **Available commands in Claude**
- `/ah` - Show help
- `/ah validate "code"` - Validate code
- `/ah check ServiceName.methodName` - Check specific method
- `/agent ah` - Invoke AH agent

### Auto-validation Hook

Enable automatic validation of all code before it's written:

```bash
cp hooks/pre_code_generation.py /path/to/project/.claude/hooks/
```

## 📊 What Gets Validated

### ✅ Service Methods
```typescript
this.authService.login() // ✅ Exists
this.authService.magicLogin() // ❌ Doesn't exist
```

### ✅ Component References
```typescript
<app-user-list></app-user-list> // ✅ Valid
<app-super-component></app-super-component> // ❌ Invalid
```

### ✅ Import Statements
```typescript
import { Component } from '@angular/core' // ✅ Valid
import { Magic } from '@angular/core' // ❌ Invalid
```

### ✅ RxJS Operators
```typescript
pipe(map(), filter()) // ✅ Valid operators
pipe(magical(), transform()) // ❌ Invalid operators
```

### ✅ Routes & Collections
```typescript
router.navigate(['/users']) // ✅ Valid route
collection(db, 'users') // ✅ Valid collection
```

## 🧪 Testing

Run the test suite to verify everything works:

```bash
# Run validation tests
npm test

# Run effectiveness measurement
npm run test:effectiveness

# Interactive testing
npm run test:interactive
```

## 📈 Effectiveness Metrics

Track how well antiHall prevents errors:

```bash
# Generate effectiveness report
npm run metrics

# Sample output:
📊 Effectiveness Score: 94/100
✅ Hallucinations Caught: 127
⏱️ Time Saved: 10.5 hours
💰 ROI: 2100%
```

## 🛠️ Configuration

### Custom Patterns

Edit `config/patterns.json` to add project-specific patterns:

```json
{
  "services": {
    "suffix": "Service",
    "customPatterns": ["*Manager", "*Helper"]
  },
  "components": {
    "suffix": "Component",
    "prefix": "app-"
  }
}
```

### Framework Support

antiHall supports multiple frameworks:

- ✅ Angular (default)
- ✅ React (set `FRAMEWORK=react`)
- ✅ Vue (set `FRAMEWORK=vue`)
- ✅ Node.js/Express (set `FRAMEWORK=node`)

## 🐳 Docker Usage

### Build Image
```bash
docker build -t antihall .
```

### Parse Project
```bash
docker run -v $(pwd):/project antihall parse
```

### Validate Code
```bash
docker run -v $(pwd):/project antihall validate "code to check"
```

### Interactive Mode
```bash
docker run -it -v $(pwd):/project antihall interactive
```

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup
```bash
# Clone repo
git clone https://github.com/VelocityFibre/antiHall-Claude-Agent.git

# Install dev dependencies
npm install --include=dev

# Run in watch mode
npm run dev
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## 🙏 Acknowledgments

- Built for the FibreFlow project
- Inspired by the need for accurate AI code generation
- Special thanks to the Claude Code community

## 🔗 Links

- [Documentation](https://github.com/VelocityFibre/antiHall-Claude-Agent/wiki)
- [Issues](https://github.com/VelocityFibre/antiHall-Claude-Agent/issues)
- [Discussions](https://github.com/VelocityFibre/antiHall-Claude-Agent/discussions)

---

**antiHall** - Because AI shouldn't make up methods that don't exist! 🎯