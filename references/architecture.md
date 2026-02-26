# Skill Indexer Architecture

**Version:** 1.0.0  
**Date:** 2026-02-26  

---

## Overview

skill-indexer is a lightweight skill registry and index manager for OpenClaw. It scans SKILL.md files across OpenClaw directories, extracts metadata, and generates searchable indexes.

---

## Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                     skill-indexer                           │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Scanner    │  │    Parser    │  │ Index Builder│      │
│  │              │  │              │  │              │      │
│  │ - Discover   │  │ - Frontmatter│  │ - Aggregate  │      │
│  │ - Traverse   │  │ - Body scan  │  │ - Validate   │      │
│  │ - Filter     │  │ - Extract    │  │ - Write      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │              │
│         └─────────────────┼─────────────────┘              │
│                           ▼                                │
│                  ┌─────────────────┐                       │
│                  │   Index Store   │                       │
│                  │                 │                       │
│                  │ ~/.openclaw/    │                       │
│                  │ .skill-index.json│                      │
│                  └────────┬────────┘                       │
│                           │                                │
│         ┌─────────────────┼─────────────────┐              │
│         ▼                 ▼                 ▼              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Query API  │  │ TOOLS.md Gen │  │   CLI Tool   │      │
│  │              │  │              │  │              │      │
│  │ - Search     │  │ - Section    │  │ - Index      │      │
│  │ - Filter     │  │   update     │  │ - Search     │      │
│  │ - Suggest    │  │ - Auto-sync  │  │ - Info       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
SKILL.md files → Scanner → Parser → Index Builder → Index Store
                                                    ↓
                                            ┌───────┴───────┐
                                            ▼               ▼
                                      Query API      TOOLS.md Gen
                                            ↓               ↓
                                      Agent/User      Documentation
```

---

## Metadata Schema

### Skill Record

```typescript
interface SkillRecord {
  // Identity
  id: string;                    // Unique identifier (directory name)
  name: string;                  // From SKILL.md frontmatter
  description: string;           // From SKILL.md frontmatter
  version?: string;              // From SKILL.md frontmatter
  
  // Location
  path: string;                  // Absolute path to skill directory
  type: 'system' | 'workspace';  // ~/.openclaw/skills/ vs workspace/skills/
  
  // Discovery
  triggers: string[];            // Extracted trigger keywords
  keywords: string[];            // Additional keywords from body
  
  // Structure
  hasScripts: boolean;           // Has scripts/ directory
  hasReferences: boolean;        // Has references/ directory
  hasAssets: boolean;            // Has assets/ directory
  
  // Metadata
  lastIndexed: string;           // ISO 8601 timestamp
  skillMdHash: string;           // SHA256 of SKILL.md (for change detection)
  skillMdSize: number;           // File size in bytes
}
```

### Index Structure

```typescript
interface SkillIndex {
  version: string;               // Index format version
  generatedAt: string;           // ISO 8601 timestamp
  stats: {
    total: number;               // Total skills
    system: number;              // System skills count
    workspace: number;           // Workspace skills count
  };
  skills: SkillRecord[];         // Array of skill records
  
  // Lookup maps (derived)
  byTrigger: Record<string, string[]>;  // trigger -> skill IDs
  byKeyword: Record<string, string[]>;  // keyword -> skill IDs
}
```

---

## Directory Scanning Strategy

### Scan Targets

| Directory | Type | Priority | Notes |
|-----------|------|----------|-------|
| `~/.openclaw/skills/*` | system | 1 | System-level skills |
| `~/.openclaw/workspace/skills/*` | workspace | 2 | Development/custom skills |

### Discovery Rules

1. **Valid skill directory** must contain `SKILL.md`
2. **Skip** directories starting with `.` (hidden)
3. **Skip** `node_modules/`, `__pycache__/`, etc.
4. **Skip** archived skills (marked with `.archived` file)

---

## SKILL.md Parsing Strategy

### Frontmatter Extraction

```yaml
---
name: skill-name
description: Description with trigger keywords like "search docs"
version: 1.0.0
---
```

- Parse YAML frontmatter between `---` delimiters
- Extract: `name`, `description`, `version`
- Fallback: use directory name as name if missing

### Trigger Extraction

1. **From description**: Parse quoted phrases, action verbs
2. **From body**: Scan for "Trigger on" patterns
3. **Keywords**: Extract nouns and verbs from headers

### Change Detection

- Calculate SHA256 hash of SKILL.md content
- Compare with `skillMdHash` in existing index
- Skip re-indexing if unchanged (performance)

---

## Index Storage

### Primary Index

**Location:** `~/.openclaw/.skill-index.json`

```json
{
  "version": "1.0.0",
  "generatedAt": "2026-02-26T15:50:00Z",
  "stats": { "total": 13, "system": 13, "workspace": 0 },
  "skills": [...],
  "byTrigger": { "search docs": ["docs-rag"], ... },
  "byKeyword": { "rag": ["docs-rag"], ... }
}
```

### Backup Strategy

- Keep last 3 index versions: `.skill-index.json.1`, `.2`, `.3`
- Rotate on each successful index update

---

## TOOLS.md Integration

### Auto-Update Strategy

**Target:** `~/.openclaw/workspace/TOOLS.md`

**Section Marker:**
```markdown
## 📚 Available Skills - Auto-Generated

<!-- SKILL-INDEX-START -->
<!-- Auto-generated by skill-indexer. Do not edit manually. -->

| Skill | Description | Triggers |
|-------|-------------|----------|
| docs-rag | Query OpenClaw docs | openclaw docs, search docs |
| ... | ... | ... |

<!-- SKILL-INDEX-END -->
```

**Update Process:**
1. Read existing TOOLS.md
2. Find markers `<!-- SKILL-INDEX-START -->` and `<!-- SKILL-INDEX-END -->`
3. Replace content between markers
4. Write updated TOOLS.md
5. If markers not found, append to end

---

## CLI Interface

### Commands

```bash
# Build/update index
skill-indexer index

# Search skills
skill-indexer search "docs"
skill-indexer search --trigger "search docs"

# Show skill info
skill-indexer info docs-rag

# List all skills
skill-indexer list
skill-indexer list --type system

# Validate index
skill-indexer validate

# Update TOOLS.md
skill-indexer update-tools

# Watch mode (auto-reindex on changes)
skill-indexer watch
```

---

## API Interface

### JavaScript API

```javascript
const { SkillIndexer } = require('skill-indexer');

const indexer = new SkillIndexer();

// Build index
await indexer.buildIndex();

// Query
const results = indexer.search({ query: 'docs' });
const byTrigger = indexer.findByTrigger('search docs');

// Get skill info
const skill = indexer.getSkill('docs-rag');

// Update TOOLS.md
await indexer.updateToolsMd();
```

---

## Performance Considerations

| Metric | Target | Strategy |
|--------|--------|----------|
| Index build time | < 5s for 50 skills | Incremental updates, hashing |
| Memory usage | < 50MB | Streaming parser, no full text |
| Query latency | < 100ms | In-memory index, pre-built maps |
| File I/O | Minimal | Caching, change detection |

---

## Security Considerations

1. **Path traversal**: Sanitize all paths, validate within OpenClaw root
2. **YAML parsing**: Use safe YAML parser (no code execution)
3. **File permissions**: Respect existing permissions, don't expose sensitive files
4. **No network**: Local-only operation, no external calls

---

## Future Enhancements

- [ ] ClawHub integration (remote skill registry)
- [ ] Skill dependency tracking
- [ ] Version conflict detection
- [ ] Skill usage analytics
- [ ] Auto-suggest based on conversation context
