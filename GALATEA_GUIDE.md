# GALATEA_GUIDE.md — skill-indexer Integration Guide for Galatea

> **Purpose**: Prevent misconfiguration. Read this before attempting any skill-indexer integration work.

---

## 1. Overview

`skill-indexer` is an OpenClaw skill that scans, indexes, and manages skills in `~/.openclaw/skills/`. It provides:

- Keyword search across all installed skills
- Skill metadata extraction (name, version, triggers, description)
- TOOLS.md auto-update for the OpenClaw workspace
- MCP Server for Claude Code (AI assistant) integration

**Galatea's role**: Use skill-indexer as an OpenClaw Skill — via CLI commands or the OpenClaw Skill invocation mechanism. Galatea does **not** use the MCP server.

---

## 2. Integration Architecture

```
┌─────────────────────────────────────────────────┐
│                 OpenClaw System                  │
│                                                 │
│  Galatea (Agent) ──→ OpenClaw Skill mechanism   │
│                         │                       │
│                         ▼                       │
│               ~/.openclaw/skills/               │
│               skill-indexer/                    │
│               ├── SKILL.md  ◄── Galatea reads   │
│               ├── lib/      ◄── Node.js API     │
│               └── bin/      ◄── CLI commands    │
│                                                 │
│  Claude Code ──→ MCP Server (separate path)     │
│                  mcp-server/dist/index.js        │
└─────────────────────────────────────────────────┘
```

Galatea integrates with skill-indexer through the **OpenClaw Skill system** (SKILL.md). The MCP server is a separate integration path exclusively for Claude Code users.

---

## 3. Correct Usage

### CLI Commands (run in shell or via OpenClaw tool execution)

```bash
# Build/rebuild the skill index
skill-indexer index

# Search for skills by keyword
skill-indexer search "planning"

# Get full info on a specific skill
skill-indexer info triadev

# List all indexed skills
skill-indexer list

# Update TOOLS.md with current skill catalog
skill-indexer update-tools

# Validate index integrity
skill-indexer validate

# Watch mode — auto-reindex on file changes
skill-indexer watch

# Export hub-compatible index
skill-indexer export-hub
```

### OpenClaw Skill Invocation

When Galatea references skill-indexer capabilities (search, list, info), the invocation goes through the OpenClaw Skill mechanism using the triggers defined in `SKILL.md`:

- Trigger: `"index skills"` → builds/updates index
- Trigger: `"search skills"` → searches indexed skills
- Trigger: `"skill info"` → retrieves skill metadata

### Node.js API (for programmatic use inside OpenClaw skill logic)

```javascript
const { SkillIndexer } = require('/root/.openclaw/skills/skill-indexer');

const indexer = new SkillIndexer();
await indexer.buildIndex();

const results = indexer.search('docs');
const skill = indexer.getSkill('triadev');
```

---

## 4. Forbidden Operations ❌

### ❌ DO NOT attempt to configure MCP via `openclaw.json`

**The following config paths do NOT exist in OpenClaw schema v2026.2.19-2:**

```json
// INVALID — these fields are not in the schema
{
  "agents": {
    "defaults": {
      "mcp": { ... },          // ❌ not a valid path
      "mcpServers": { ... }     // ❌ not a valid path
    }
  },
  "mcpServers": { ... }         // ❌ not a valid top-level key
}
```

**Why**: OpenClaw config schema (v2026.2.19-2) has 22 top-level nodes. None of them include `mcpServers` or `mcp`. Attempting to set these via `config.patch` will either silently fail or produce a schema validation error.

**Verified via**: `openclaw config schema` — confirmed absence of any MCP-related fields.

### ❌ DO NOT start the MCP server for Galatea's own use

The MCP server (`mcp-server/dist/index.js`) communicates via stdio MCP protocol. It is designed for Claude Code (the CLI tool), not for Galatea. Galatea cannot consume MCP tools directly.

### ❌ DO NOT run `skill-indexer mcp-server` as a CLI command

This command does not exist. The correct way to start the MCP server is:
```bash
node ~/.openclaw/skills/skill-indexer/mcp-server/dist/index.js
```

---

## 5. MCP Server — For Claude Code Users Only

The MCP server exposes skill-indexer as MCP tools for Claude Code. This is **not** Galatea's integration path.

**Who uses it**: Claude Code (the CLI AI tool running on the user's machine)

**How it's registered** (in `~/.claude/settings.json`, not `openclaw.json`):
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

**Available MCP tools** (for Claude Code, not Galatea):
- `search_skills(query, limit, offset)` — paginated keyword search
- `get_skill_info(skill_id)` — full skill metadata
- `list_skills(type, limit, offset)` — paginated listing with type filter
- `find_by_trigger(trigger)` — exact trigger phrase lookup
- `refresh_index()` — get index statistics

---

## 6. Index Maintenance

### When to rebuild the index

Rebuild when:
- A new skill is installed to `~/.openclaw/skills/`
- A skill's `SKILL.md` is updated (version, triggers, description)
- The index file (`~/.openclaw/.skill-index.json`) is missing or corrupted
- `skill-indexer validate` reports errors

### How to rebuild

```bash
# Full rebuild
skill-indexer index

# Verify the result
skill-indexer validate

# Check index health (build + index validation)
node ~/.openclaw/skills/skill-indexer/scripts/check-health.js
```

### Index file location

```
~/.openclaw/.skill-index.json
```

This file is maintained automatically by skill-indexer. Do not edit it manually.

---

## Summary

| Action | Correct Path |
|--------|-------------|
| Galatea uses skill-indexer | OpenClaw Skill mechanism (SKILL.md triggers) |
| Claude Code uses skill-indexer | MCP Server (`~/.claude/settings.json`) |
| Configure MCP for OpenClaw agent | ❌ Not possible — no schema support |
| Configure MCP for Claude Code | `~/.claude/settings.json → mcpServers` |
| Rebuild skill index | `skill-indexer index` |
| Check health | `node scripts/check-health.js` |
