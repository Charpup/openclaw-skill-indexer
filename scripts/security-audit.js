#!/usr/bin/env node

/**
 * Security Audit Script for skill-indexer
 * Basic security checks before full security-auditor integration
 */

const fs = require('fs');
const path = require('path');

const TARGET_DIR = process.argv[2] || '/root/.openclaw/workspace/01_active/skill-indexer/skill-indexer';

const RULES = [
  {
    id: 'hardcoded-secret',
    name: 'Hardcoded Secrets',
    level: 'HIGH',
    patterns: [
      /['"]?(api[_-]?key|apikey|api-secret|password|token|secret)['"]?\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/i,
      /['"]?(ntn_|ghp_|sk-)[a-zA-Z0-9_\-]{20,}['"]/i
    ],
    excludeFiles: ['security-audit.js'] // Exclude audit script itself
  },
  {
    id: 'eval-usage',
    name: 'Dangerous eval() Usage',
    level: 'HIGH',
    patterns: [
      /\beval\s*\([^)]*\)/,
      /new\s+Function\s*\([^)]*\)/
    ],
    excludeFiles: ['security-audit.js']
  },
  {
    id: 'shell-injection',
    name: 'Shell Injection Risk',
    level: 'HIGH',
    patterns: [
      /exec\s*\(\s*[^)]*\+[^)]*\)/,
      /spawn\s*\(\s*[^)]*\+[^)]*\)/
    ],
    excludeFiles: ['security-audit.js']
  },
  {
    id: 'insecure-http',
    name: 'Insecure HTTP URLs',
    level: 'MEDIUM',
    patterns: [
      /http:\/\/[^\s'"]+/
    ],
    excludeFiles: ['package-lock.json', 'security-audit.js'] // package-lock is generated
  },
  {
    id: 'path-traversal',
    name: 'Path Traversal Risk',
    level: 'MEDIUM',
    patterns: [
      /\.\.[\/\\]/
    ],
    excludeFiles: ['security-audit.js']
  }
];

const findings = [];

function scanFile(filePath, rules) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const fileName = path.basename(filePath);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    for (const rule of rules) {
      // Skip if file is excluded
      if (rule.excludeFiles && rule.excludeFiles.some(ex => fileName.includes(ex))) {
        continue;
      }
      
      for (const pattern of rule.patterns) {
        if (pattern.test(line)) {
          findings.push({
            rule: rule.id,
            level: rule.level,
            name: rule.name,
            file: path.relative(TARGET_DIR, filePath),
            line: lineNum,
            snippet: line.trim().slice(0, 80)
          });
        }
      }
    }
  }
}

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      scanDirectory(fullPath);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.js') || entry.name.endsWith('.json')) {
        scanFile(fullPath, RULES);
      }
    }
  }
}

console.log('🔍 Security Audit Report');
console.log('========================\n');
console.log(`Target: ${TARGET_DIR}`);
console.log(`Timestamp: ${new Date().toISOString()}\n`);

scanDirectory(TARGET_DIR);

// Summary
const high = findings.filter(f => f.level === 'HIGH').length;
const medium = findings.filter(f => f.level === 'MEDIUM').length;
const low = findings.filter(f => f.level === 'LOW').length;

console.log('Summary:');
console.log(`  ✗ HIGH: ${high}`);
console.log(`  ⚠️  MEDIUM: ${medium}`);
console.log(`  ℹ️  LOW: ${low}`);
console.log(`  ✓ Passed: ${high === 0 ? 'All critical checks' : 'Some checks failed'}`);
console.log();

if (findings.length > 0) {
  console.log('Findings:');
  console.log();
  
  // Sort by level
  const levelOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  findings.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);
  
  for (const f of findings) {
    console.log(`  [${f.level}] ${f.name}`);
    console.log(`    File: ${f.file}:${f.line}`);
    console.log(`    Code: ${f.snippet}`);
    console.log();
  }
} else {
  console.log('✅ No security issues found!');
}

console.log('\n📋 Manual Review Checklist:');
console.log('  [ ] No hardcoded secrets in code');
console.log('  [ ] File paths are properly sanitized');
console.log('  [ ] No user input passed to shell commands');
console.log('  [ ] Dependencies are from trusted sources');

process.exit(high > 0 ? 1 : 0);
