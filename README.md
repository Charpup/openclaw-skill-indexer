# skill-indexer

[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)](https://github.com/Charpup/openclaw-skill-indexer/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

OpenClaw Skill Registry & Index Manager - Scans, indexes, and manages OpenClaw skills with automatic TOOLS.md integration.

## Features

- 🔍 **Automatic Scanning** - Discovers skills in `~/.openclaw/skills/` and `workspace/skills/`
- 📊 **Metadata Extraction** - Parses SKILL.md frontmatter (name, description, version, triggers)
- 🔎 **Smart Search** - Search by keywords, triggers, or descriptions
- 📝 **TOOLS.md Integration** - Auto-updates TOOLS.md with skill catalog
- 🔄 **Incremental Updates** - SHA256-based change detection
- 💾 **Cross-Session Persistence** - Index stored in `~/.openclaw/.skill-index.json`
- 🌐 **MCP Server** - Expose skills as MCP tools for AI assistants
- 👁️ **Watch Mode** - Auto-reindex on file changes
- 📦 **Hub Export** - Export skillshare-compatible hub index

## Installation

```bash
git clone https://github.com/Charpup/openclaw-skill-indexer.git ~/.openclaw/skills/skill-indexer
cd ~/.openclaw/skills/skill-indexer
npm install
```

## Quick Start

```bash
# Build the skill index
npm run index

# Update TOOLS.md
npm run update-tools

# Search for skills
npm run search -- "docs"
```

## CLI Usage

```bash
skill-indexer index              # Build/update index
skill-indexer search "docs"      # Search skills
skill-indexer info triadev       # Show skill details
skill-indexer list               # List all skills
skill-indexer update-tools       # Update TOOLS.md
skill-indexer validate           # Validate index
skill-indexer watch              # Watch mode - auto-reindex
skill-indexer export-hub         # Export hub-compatible index
```

## MCP Server

skill-indexer can run as an MCP server for integration with AI assistants:

```bash
# Start MCP server
skill-indexer mcp-server

# Or via npx
npx skill-indexer mcp-server
```

Available MCP tools:
- `search_skills` - Search skills by keyword
- `get_skill_info` - Get skill details
- `list_skills` - List all skills
- `find_by_trigger` - Find by trigger word
- `refresh_index` - Refresh index stats

## Programming API

```javascript
const { SkillIndexer } = require('skill-indexer');

const indexer = new SkillIndexer();
await indexer.buildIndex();

const results = indexer.search('docs');
const skill = indexer.getSkill('triadev');
```

## Documentation

- [SKILL.md](SKILL.md) - Skill documentation
- [Architecture](references/architecture.md) - System design
- [API Reference](references/api-reference.md) - Complete API docs

## License

MIT
