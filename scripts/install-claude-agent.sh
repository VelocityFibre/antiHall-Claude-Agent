#!/bin/bash

# antiHall Claude Agent Installer
# Usage: ./install-claude-agent.sh /path/to/project

set -e

PROJECT_PATH="$1"

if [ -z "$PROJECT_PATH" ]; then
    echo "❌ Error: Please provide the project path"
    echo "Usage: $0 /path/to/project"
    exit 1
fi

if [ ! -d "$PROJECT_PATH" ]; then
    echo "❌ Error: Project path does not exist: $PROJECT_PATH"
    exit 1
fi

echo "🚀 Installing antiHall Claude Agent..."

# Create .claude directories if they don't exist
mkdir -p "$PROJECT_PATH/.claude/agents/yaml"
mkdir -p "$PROJECT_PATH/.claude/commands"
mkdir -p "$PROJECT_PATH/.claude/hooks"

# Copy agent files
echo "📁 Copying agent configuration..."
cp claude-agent/agents/ah.yaml "$PROJECT_PATH/.claude/agents/yaml/"
cp claude-agent/agents/ah-auto.yaml "$PROJECT_PATH/.claude/agents/yaml/"

# Copy command files
echo "📁 Copying command files..."
cp claude-agent/commands/ah.md "$PROJECT_PATH/.claude/commands/"

# Copy hooks (optional)
read -p "Install auto-validation hook? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📁 Installing validation hook..."
    cp hooks/pre_code_generation.py "$PROJECT_PATH/.claude/hooks/"
fi

# Copy antiHall core to project
echo "📁 Setting up antiHall core..."
mkdir -p "$PROJECT_PATH/antiHall"
cp -r src/* "$PROJECT_PATH/antiHall/"
cp -r scripts/* "$PROJECT_PATH/antiHall/scripts/"
cp package.json "$PROJECT_PATH/antiHall/"

# Install dependencies
echo "📦 Installing dependencies..."
cd "$PROJECT_PATH/antiHall"
npm install

# Initial parse
read -p "Parse codebase now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔍 Parsing codebase..."
    npm run parse:improved
fi

echo "✅ antiHall Claude Agent installed successfully!"
echo ""
echo "Available commands in Claude Code:"
echo "  /ah validate \"code\"  - Validate code snippet"
echo "  /ah check Method     - Check if method exists"
echo "  /agent ah           - Invoke AH agent"
echo ""
echo "To update the knowledge graph:"
echo "  cd antiHall && npm run parse:improved"