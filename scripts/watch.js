#!/usr/bin/env node

/**
 * Watch Mode for skill-indexer
 * 
 * Monitors skill directories and auto-reindexes on changes
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

class SkillWatcher {
  constructor(options = {}) {
    this.systemSkillsDir = options.systemSkillsDir || path.join(os.homedir(), '.openclaw', 'skills');
    this.workspaceSkillsDir = options.workspaceSkillsDir || path.join(os.homedir(), '.openclaw', 'workspace', 'skills');
    this.debounceMs = options.debounceMs || 2000;
    this.watchedDirs = new Set();
    this.changeTimers = new Map();
    this.isWatching = false;
  }

  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }

  async start() {
    this.log('👁️  Starting watch mode...');
    this.log(`📁 Watching: ${this.systemSkillsDir}`);
    this.log(`📁 Watching: ${this.workspaceSkillsDir}`);
    
    // Initial index
    await this.reindex();
    
    // Watch system skills
    if (fs.existsSync(this.systemSkillsDir)) {
      this.watchDirectory(this.systemSkillsDir);
    }
    
    // Watch workspace skills
    if (fs.existsSync(this.workspaceSkillsDir)) {
      this.watchDirectory(this.workspaceSkillsDir);
    }
    
    this.isWatching = true;
    this.log('✅ Watch mode active. Press Ctrl+C to stop.');
    
    // Keep process alive
    process.stdin.resume();
  }

  watchDirectory(dir) {
    if (this.watchedDirs.has(dir)) return;
    
    try {
      const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
        // Only care about SKILL.md changes
        if (filename && filename.includes('SKILL.md')) {
          this.handleChange(dir, filename, eventType);
        }
      });
      
      this.watchedDirs.add(dir);
      this.log(`🔍 Watching: ${dir}`);
    } catch (err) {
      this.log(`⚠️  Failed to watch ${dir}: ${err.message}`);
    }
  }

  handleChange(dir, filename, eventType) {
    const key = `${dir}:${filename}`;
    
    // Debounce
    if (this.changeTimers.has(key)) {
      clearTimeout(this.changeTimers.get(key));
    }
    
    this.log(`📝 Detected ${eventType}: ${filename}`);
    
    const timer = setTimeout(() => {
      this.reindex();
      this.changeTimers.delete(key);
    }, this.debounceMs);
    
    this.changeTimers.set(key, timer);
  }

  async reindex() {
    this.log('🔄 Reindexing skills...');
    
    return new Promise((resolve, reject) => {
      const indexerPath = path.join(__dirname, '..', 'bin', 'skill-indexer.js');
      const child = exec(`node ${indexerPath} index`, (error, stdout, stderr) => {
        if (error) {
          this.log(`❌ Reindex failed: ${error.message}`);
          reject(error);
        } else {
          this.log('✅ Reindex complete');
          resolve();
        }
      });
    });
  }

  stop() {
    this.log('🛑 Stopping watch mode...');
    this.isWatching = false;
    
    // Clear all timers
    for (const [key, timer] of this.changeTimers) {
      clearTimeout(timer);
    }
    this.changeTimers.clear();
    
    process.exit(0);
  }
}

// CLI
if (require.main === module) {
  const watcher = new SkillWatcher();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => watcher.stop());
  process.on('SIGTERM', () => watcher.stop());
  
  watcher.start().catch(err => {
    console.error('Watch mode failed:', err);
    process.exit(1);
  });
}

module.exports = { SkillWatcher };
