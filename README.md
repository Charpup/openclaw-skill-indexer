# skill-indexer

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](https://github.com/Charpup/openclaw-skill-indexer/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

OpenClaw Skill Registry & Index Manager - Scans, indexes, and manages OpenClaw skills with automatic TOOLS.md integration.

## Features

- 🔍 **Automatic Scanning** - Discovers skills in `~/.openclaw/skills/` and `workspace/skills/`
- 📊 **Metadata Extraction** - Parses SKILL.md frontmatter (name, description, version, triggers)
- 🔎 **Smart Search** - Search by keywords, triggers, or descriptions
- 📝 **TOOLS.md Integration** - Auto-updates TOOLS.md with skill catalog
- 🔄 **Incremental Updates** - SHA256-based change detection
- 💾 **Cross-Session Persistence** - Index stored in `~/.openclaw/.skill-index.json`

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
```

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
