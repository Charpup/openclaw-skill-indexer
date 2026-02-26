#!/usr/bin/env node

/**
 * Skill Indexer - Main Library
 * 
 * Scans OpenClaw skills directories, parses SKILL.md files,
 * and generates searchable indexes.
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');

class SkillIndexer {
  constructor(options = {}) {
    this.options = {
      systemSkillsDir: options.systemSkillsDir || path.join(process.env.HOME, '.openclaw', 'skills'),
      workspaceSkillsDir: options.workspaceSkillsDir || path.join(process.env.HOME, '.openclaw', 'workspace', 'skills'),
      indexPath: options.indexPath || path.join(process.env.HOME, '.openclaw', '.skill-index.json'),
      toolsMdPath: options.toolsMdPath || path.join(process.env.HOME, '.openclaw', 'workspace', 'TOOLS.md'),
      ...options
    };
    
    this.index = null;
  }

  /**
   * Build or update the skill index
   */
  async buildIndex() {
    console.log('🔍 Scanning for skills...');
    
    const skills = [];
    
    // Scan system skills
    const systemSkills = await this.scanDirectory(this.options.systemSkillsDir, 'system');
    skills.push(...systemSkills);
    
    // Scan workspace skills
    const workspaceSkills = await this.scanDirectory(this.options.workspaceSkillsDir, 'workspace');
    skills.push(...workspaceSkills);
    
    // Build lookup maps
    const byTrigger = {};
    const byKeyword = {};
    
    for (const skill of skills) {
      // Index by trigger
      for (const trigger of skill.triggers) {
        const key = trigger.toLowerCase();
        if (!byTrigger[key]) byTrigger[key] = [];
        if (!byTrigger[key].includes(skill.id)) {
          byTrigger[key].push(skill.id);
        }
      }
      
      // Index by keyword
      for (const keyword of skill.keywords) {
        const key = keyword.toLowerCase();
        if (!byKeyword[key]) byKeyword[key] = [];
        if (!byKeyword[key].includes(skill.id)) {
          byKeyword[key].push(skill.id);
        }
      }
    }
    
    // Build index object
    this.index = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      stats: {
        total: skills.length,
        system: systemSkills.length,
        workspace: workspaceSkills.length
      },
      skills,
      byTrigger,
      byKeyword
    };
    
    // Write to disk
    await this.saveIndex();
    
    console.log(`✅ Indexed ${skills.length} skills (${systemSkills.length} system, ${workspaceSkills.length} workspace)`);
    
    return this.index;
  }

  /**
   * Scan a directory for skills
   */
  async scanDirectory(dir, type) {
    const skills = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;
        
        const skillPath = path.join(dir, entry.name);
        const skillMdPath = path.join(skillPath, 'SKILL.md');
        
        // Check if SKILL.md exists
        try {
          await fs.access(skillMdPath);
        } catch {
          continue; // Skip if no SKILL.md
        }
        
        // Parse skill
        const skill = await this.parseSkill(skillPath, entry.name, type);
        if (skill) {
          skills.push(skill);
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn(`⚠️  Warning: Could not scan ${dir}: ${err.message}`);
      }
    }
    
    return skills;
  }

  /**
   * Parse a SKILL.md file
   */
  async parseSkill(skillPath, dirName, type) {
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    
    try {
      const content = await fs.readFile(skillMdPath, 'utf-8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      
      // Parse frontmatter
      const { frontmatter, body } = this.parseFrontmatter(content);
      
      // Extract triggers from description
      const triggers = this.extractTriggers(frontmatter.description || '', body);
      
      // Extract additional keywords
      const keywords = this.extractKeywords(body);
      
      // Check for bundled resources
      const hasScripts = await this.directoryExists(path.join(skillPath, 'scripts'));
      const hasReferences = await this.directoryExists(path.join(skillPath, 'references'));
      const hasAssets = await this.directoryExists(path.join(skillPath, 'assets'));
      
      return {
        id: dirName,
        name: frontmatter.name || dirName,
        description: frontmatter.description || '',
        version: frontmatter.version || null,
        path: skillPath,
        type,
        triggers,
        keywords,
        hasScripts,
        hasReferences,
        hasAssets,
        lastIndexed: new Date().toISOString(),
        skillMdHash: hash,
        skillMdSize: content.length
      };
    } catch (err) {
      console.warn(`⚠️  Warning: Could not parse ${skillMdPath}: ${err.message}`);
      return null;
    }
  }

  /**
   * Parse YAML frontmatter from markdown content
   */
  parseFrontmatter(content) {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    
    if (match) {
      try {
        const frontmatter = yaml.load(match[1]) || {};
        return { frontmatter, body: match[2] };
      } catch (err) {
        console.warn(`⚠️  Warning: Could not parse frontmatter: ${err.message}`);
      }
    }
    
    return { frontmatter: {}, body: content };
  }

  /**
   * Extract trigger keywords from description and body
   */
  extractTriggers(description, body) {
    const triggers = new Set();
    
    // Extract quoted phrases from description
    const quoted = description.match(/"([^"]+)"/g);
    if (quoted) {
      quoted.forEach(q => triggers.add(q.replace(/"/g, '').toLowerCase()));
    }
    
    // Extract phrases after "Triggers on"
    const triggerMatches = body.match(/[Tt]riggers? on[:\s]+([^\n.]+)/g);
    if (triggerMatches) {
      triggerMatches.forEach(match => {
        const phrase = match.replace(/[Tt]riggers? on[:\s]+/, '').trim();
        if (phrase) triggers.add(phrase.toLowerCase());
      });
    }
    
    // Extract keywords from description (comma-separated after quotes)
    if (description.includes('"')) {
      const afterQuotes = description.split('"').pop();
      const keywords = afterQuotes.split(/[,;]/).map(s => s.trim().toLowerCase()).filter(s => s);
      keywords.forEach(k => triggers.add(k));
    }
    
    return Array.from(triggers);
  }

  /**
   * Extract additional keywords from body
   */
  extractKeywords(body) {
    const keywords = new Set();
    
    // Extract section headers
    const headers = body.match(/^#{1,3}\s+(.+)$/gm);
    if (headers) {
      headers.forEach(h => {
        const text = h.replace(/^#+\s+/, '').toLowerCase();
        // Split and add individual words
        text.split(/\s+/).forEach(word => {
          if (word.length > 3) keywords.add(word.replace(/[^a-z0-9]/g, ''));
        });
      });
    }
    
    // Extract code block languages
    const codeBlocks = body.match(/```(\w+)/g);
    if (codeBlocks) {
      codeBlocks.forEach(cb => {
        const lang = cb.replace('```', '').trim();
        if (lang) keywords.add(lang.toLowerCase());
      });
    }
    
    return Array.from(keywords);
  }

  /**
   * Check if a directory exists
   */
  async directoryExists(dirPath) {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Save index to disk
   */
  async saveIndex() {
    // Ensure directory exists
    const indexDir = path.dirname(this.options.indexPath);
    await fs.mkdir(indexDir, { recursive: true });
    
    // Rotate backups
    await this.rotateBackups();
    
    // Write new index
    await fs.writeFile(
      this.options.indexPath,
      JSON.stringify(this.index, null, 2),
      'utf-8'
    );
  }

  /**
   * Rotate backup files
   */
  async rotateBackups() {
    const maxBackups = 3;
    
    for (let i = maxBackups - 1; i >= 1; i--) {
      const oldPath = `${this.options.indexPath}.${i}`;
      const newPath = `${this.options.indexPath}.${i + 1}`;
      
      try {
        await fs.rename(oldPath, newPath);
      } catch {
        // Ignore if file doesn't exist
      }
    }
    
    // Move current to .1
    try {
      await fs.rename(this.options.indexPath, `${this.options.indexPath}.1`);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Load index from disk
   */
  async loadIndex() {
    try {
      const content = await fs.readFile(this.options.indexPath, 'utf-8');
      this.index = JSON.parse(content);
      return this.index;
    } catch (err) {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  /**
   * Search skills by query
   */
  search(query) {
    if (!this.index) return [];
    
    const q = query.toLowerCase();
    const results = new Set();
    
    // Search by ID
    for (const skill of this.index.skills) {
      if (skill.id.toLowerCase().includes(q)) {
        results.add(skill);
      }
    }
    
    // Search by name
    for (const skill of this.index.skills) {
      if (skill.name.toLowerCase().includes(q)) {
        results.add(skill);
      }
    }
    
    // Search by description
    for (const skill of this.index.skills) {
      if (skill.description.toLowerCase().includes(q)) {
        results.add(skill);
      }
    }
    
    // Search by trigger
    const triggerMatches = this.index.byTrigger[q] || [];
    for (const id of triggerMatches) {
      const skill = this.index.skills.find(s => s.id === id);
      if (skill) results.add(skill);
    }
    
    return Array.from(results);
  }

  /**
   * Find skills by trigger
   */
  findByTrigger(trigger) {
    if (!this.index) return [];
    
    const ids = this.index.byTrigger[trigger.toLowerCase()] || [];
    return ids.map(id => this.index.skills.find(s => s.id === id)).filter(Boolean);
  }

  /**
   * Get skill by ID
   */
  getSkill(id) {
    if (!this.index) return null;
    return this.index.skills.find(s => s.id === id) || null;
  }

  /**
   * List all skills
   */
  list(options = {}) {
    if (!this.index) return [];
    
    let skills = this.index.skills;
    
    if (options.type) {
      skills = skills.filter(s => s.type === options.type);
    }
    
    return skills;
  }

  /**
   * Update TOOLS.md with skill index
   */
  async updateToolsMd() {
    if (!this.index) {
      throw new Error('Index not built. Run buildIndex() first.');
    }
    
    console.log('📝 Updating TOOLS.md...');
    
    let toolsMd = '';
    
    try {
      toolsMd = await fs.readFile(this.options.toolsMdPath, 'utf-8');
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      // File doesn't exist, will create
    }
    
    // Generate skill table
    const skillTable = this.generateSkillTable();
    
    // Find or create markers
    const startMarker = '\x3c!-- SKILL-INDEX-START --\x3e';
    const endMarker = '\x3c!-- SKILL-INDEX-END --\x3e';
    
    const newSection = `${startMarker}\n\x3c!-- Auto-generated by skill-indexer. Do not edit manually. --\x3e\n\n${skillTable}\n${endMarker}`;
    
    let newContent;
    if (toolsMd.includes(startMarker) && toolsMd.includes(endMarker)) {
      // Replace existing section
      const startIdx = toolsMd.indexOf(startMarker);
      const endIdx = toolsMd.indexOf(endMarker) + endMarker.length;
      newContent = toolsMd.slice(0, startIdx) + newSection + toolsMd.slice(endIdx);
    } else {
      // Append to end
      newContent = toolsMd + '\n\n' + newSection;
    }
    
    await fs.writeFile(this.options.toolsMdPath, newContent, 'utf-8');
    console.log('✅ TOOLS.md updated');
  }

  /**
   * Generate skill table for TOOLS.md
   */
  generateSkillTable() {
    const lines = [
      '## 📚 Available Skills - Auto-Generated',
      '',
      '| Skill | Description | Triggers |',
      '|-------|-------------|----------|'
    ];
    
    // Sort skills: system first, then alphabetically
    const sorted = [...this.index.skills].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'system' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    
    for (const skill of sorted) {
      const triggers = skill.triggers.slice(0, 3).join(', ');
      // Escape pipe characters in description
      const desc = skill.description.replace(/\|/g, '\\|').slice(0, 50);
      lines.push(`| ${skill.name} | ${desc}... | ${triggers} |`);
    }
    
    return lines.join('\n');
  }
}

module.exports = { SkillIndexer };
