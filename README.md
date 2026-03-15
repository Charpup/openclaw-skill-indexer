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
- 🧭 **Repo Mapping** - Captures GitHub metadata per skill (`repoUrl`, `repoFullName`, `repoHost`, `repoDefaultBranch`)
- 💾 **Cross-Session Persistence** - Index stored in `~/.openclaw/.skill-index.json`
- 🗓️ **Weekly GitHub Check** - Dry-run drift detection and optional fast-forward sync
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

# Weekly GitHub drift check (dry run)
npm run github-check

# Apply safe fast-forward updates
npm run github-sync
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
skill-indexer github-check       # Weekly check (dry run)
skill-indexer github-check --apply  # Safe ff-only sync
```

## Repo Mapping & Weekly Maintenance

Each indexed skill keeps backward-compatible metadata plus optional GitHub mapping fields:

- `repoUrl` → normalized URL (`https://github.com/owner/repo`)
- `repoFullName` → `owner/repo`
- `repoHost` → `github.com` or `null`
- `repoDefaultBranch` → best effort (`main` / `master` / detected branch / `null`)

`github-check` status values:

- `up-to-date`, `behind`, `ahead`, `diverged`
- `dirty` (local changes), `no-git`, `no-origin`

`--apply` only updates safe repos (`clean + behind`) via `git pull --ff-only`.

## MCP Server

skill-indexer can run as an MCP server for integration with AI assistants (Claude Code):

```bash
# Build MCP Server (first time)
cd ~/.openclaw/skills/skill-indexer/mcp-server && npm install && npm run build

# Start directly
node ~/.openclaw/skills/skill-indexer/mcp-server/dist/index.js

# Or use the start script (handles build automatically)
~/.openclaw/skills/skill-indexer/scripts/start-mcp.sh
```

### Claude Code Registration

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "skill-indexer": {
      "command": "node",
      "args": ["/root/.openclaw/skills/skill-indexer/mcp-server/dist/index.js"]
    }
  }
}
```

### Available MCP Tools

- `search_skills(query, limit, offset)` - Paginated keyword search
- `get_skill_info(skill_id)` - Get full skill details
- `list_skills(type, limit, offset)` - Paginated listing with type filter
- `find_by_trigger(trigger)` - Find by trigger phrase
- `refresh_index()` - Get index statistics

## Health Check

Validate your build and index status:

```bash
node ~/.openclaw/skills/skill-indexer/scripts/check-health.js
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
- [GALATEA_GUIDE.md](GALATEA_GUIDE.md) - Galatea integration guide (防止错误配置)
- [Architecture](references/architecture.md) - System design
- [API Reference](references/api-reference.md) - Complete API docs

## License

MIT

## Changelog
- 2026-03-11: Skill audit upgrade — normalized SKILL.md frontmatter to `name` + `description`, revalidated trigger wording, and rechecked lightweight lint/smoke compatibility with OpenClaw.
