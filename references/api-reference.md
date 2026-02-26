# API Reference

**Version:** 1.1.0  

---

## SkillIndexer Class

Main class for skill indexing operations.

### Constructor

```javascript
const { SkillIndexer } = require('skill-indexer');

const indexer = new SkillIndexer({
  systemSkillsDir: '/path/to/.openclaw/skills',      // optional
  workspaceSkillsDir: '/path/to/workspace/skills',   // optional
  indexPath: '/path/to/.skill-index.json',           // optional
  toolsMdPath: '/path/to/TOOLS.md'                   // optional
});
```

### Methods

#### buildIndex()

Scans directories and builds the skill index.

```javascript
const index = await indexer.buildIndex();
// Returns: Index object with stats, skills, byTrigger, byKeyword
```

#### loadIndex()

Loads existing index from disk.

```javascript
await indexer.loadIndex();
// Returns: Index object or null if not found
```

#### search(query)

Search skills by keyword.

```javascript
const results = indexer.search('docs');
// Returns: Array of SkillRecord objects
```

#### findByTrigger(trigger)

Find skills by trigger keyword.

```javascript
const results = indexer.findByTrigger('search docs');
// Returns: Array of SkillRecord objects
```

#### getSkill(id)

Get skill by ID.

```javascript
const skill = indexer.getSkill('triadev');
// Returns: SkillRecord or null
```

#### list(options)

List all skills with optional filtering.

```javascript
const all = indexer.list();
const systemOnly = indexer.list({ type: 'system' });
// Returns: Array of SkillRecord objects
```

#### updateToolsMd()

Updates TOOLS.md with auto-generated skill catalog.

```javascript
await indexer.updateToolsMd();
```

---

## Data Types

### SkillRecord

```typescript
interface SkillRecord {
  id: string;              // Directory name
  name: string;            // From SKILL.md frontmatter
  description: string;     // From SKILL.md frontmatter
  version?: string;        // From SKILL.md frontmatter
  path: string;            // Absolute path
  type: 'system' | 'workspace';
  triggers: string[];      // Extracted trigger keywords
  keywords: string[];      // Additional keywords
  hasScripts: boolean;     // Has scripts/ directory
  hasReferences: boolean;  // Has references/ directory
  hasAssets: boolean;      // Has assets/ directory
  lastIndexed: string;     // ISO 8601 timestamp
  skillMdHash: string;     // SHA256 hash
  skillMdSize: number;     // File size in bytes
}
```

### SkillIndex

```typescript
interface SkillIndex {
  version: string;
  generatedAt: string;
  stats: {
    total: number;
    system: number;
    workspace: number;
  };
  skills: SkillRecord[];
  byTrigger: Record<string, string[]>;
  byKeyword: Record<string, string[]>;
}
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `skill-indexer index` | Build or update index |
| `skill-indexer search <query>` | Search skills |
| `skill-indexer info <id>` | Show skill details |
| `skill-indexer list [--type=system\|workspace]` | List skills |
| `skill-indexer update-tools` | Update TOOLS.md |
| `skill-indexer validate` | Validate index |

---

## Error Handling

All methods throw on critical errors. YAML parsing errors are logged as warnings but don't stop indexing.
