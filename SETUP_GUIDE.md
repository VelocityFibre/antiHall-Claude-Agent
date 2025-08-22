# antiHall Claude Agent - Setup Guide

## 🚀 For Your Colleague

### Quick Setup (5 minutes)

1. **Clone the antiHall agent**
```bash
git clone https://github.com/VelocityFibre/antiHall-Claude-Agent.git
cd antihall-claude-agent
```

2. **Install it in their project**
```bash
./scripts/install-claude-agent.sh /path/to/their/project
```

3. **Parse their codebase**
```bash
cd /path/to/their/project/antiHall
npm run parse:improved
```

4. **Ready to use in Claude Code!**
```
/ah validate "this.someService.someMethod()"
/agent ah
```

### What They Get

1. **AH Agent** - Validates code snippets
2. **AH-Auto Agent** - Validates entire responses
3. **Slash Commands** - `/ah` for quick validation
4. **Pre-validation Hook** - Catches issues before writing files

### Customization for Their Project

#### 1. Update Service Patterns
If their project uses different naming:
```javascript
// config/patterns.json
{
  "services": {
    "suffix": ["Service", "Manager", "Helper"],
    "patterns": ["*API", "*Client"]
  }
}
```

#### 2. Framework-Specific Setup

**For React Projects:**
```bash
export FRAMEWORK=react
npm run parse
```

**For Vue Projects:**
```bash
export FRAMEWORK=vue
npm run parse
```

#### 3. Add Custom Validators
```javascript
// src/custom-validators.js
export function validateCustomPattern(code, issues) {
  // Add project-specific validation
}
```

### Docker Alternative

If they prefer Docker:

```bash
# Build
docker build -t antihall .

# Parse their project
docker run -v $(pwd):/project antihall parse

# Use interactively
docker run -it -v $(pwd):/project antihall interactive
```

### Sharing Knowledge Graphs

They can share parsed knowledge with team:

```bash
# Export knowledge graph
cd antiHall
tar -czf knowledge-graph.tar.gz knowledge-graphs/

# Import on another machine
tar -xzf knowledge-graph.tar.gz
```

### Troubleshooting

**"Knowledge graph not found"**
```bash
cd antiHall && npm run parse:improved
```

**"Method not detected"**
- Check if method is public
- Update patterns in config/patterns.json

**"Too many false positives"**
- Run parse:improved instead of basic parse
- Check FRAMEWORK environment variable

### Support

- GitHub Issues: https://github.com/VelocityFibre/antiHall-Claude-Agent/issues
- Wiki: https://github.com/VelocityFibre/antiHall-Claude-Agent/wiki
- Discussions: https://github.com/VelocityFibre/antiHall-Claude-Agent/discussions