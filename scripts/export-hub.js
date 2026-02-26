#!/usr/bin/env node

/**
 * Hub Index Export for skill-indexer
 * 
 * Generates skillshare-compatible hub index
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Load current index
function loadIndex() {
  const indexPath = path.join(os.homedir(), '.openclaw', '.skill-index.json');
  try {
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  } catch (err) {
    console.error('Error loading index:', err.message);
    process.exit(1);
  }
}

// Generate hub index in skillshare format
function generateHubIndex(index, options = {}) {
  const hubIndex = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    name: options.name || 'skill-indexer-hub',
    description: options.description || 'Auto-generated skill index from skill-indexer',
    source: {
      type: 'skill-indexer',
      version: index.version,
      path: path.join(os.homedir(), '.openclaw', '.skill-index.json')
    },
    skills: index.skills.map(skill => ({
      name: skill.id,
      displayName: skill.name,
      description: skill.description.slice(0, 200),
      version: skill.version || '1.0.0',
      triggers: skill.triggers || [],
      keywords: skill.keywords?.slice(0, 10) || [],
      type: skill.type,
      hasScripts: skill.hasScripts,
      hasReferences: skill.hasReferences,
      lastIndexed: skill.lastIndexed
    }))
  };

  return hubIndex;
}

// Main export function
function exportHub(outputPath, options = {}) {
  console.log('🔍 Loading skill index...');
  const index = loadIndex();
  
  console.log(`📊 Found ${index.skills.length} skills`);
  
  console.log('🏗️  Generating hub index...');
  const hubIndex = generateHubIndex(index, options);
  
  // Write to file
  const finalPath = outputPath || path.join(process.cwd(), 'skill-indexer-hub.json');
  fs.writeFileSync(finalPath, JSON.stringify(hubIndex, null, 2), 'utf-8');
  
  console.log(`✅ Hub index exported to: ${finalPath}`);
  console.log(`📈 Stats: ${hubIndex.skills.length} skills, ${hubIndex.skills.reduce((acc, s) => acc + s.triggers.length, 0)} triggers`);
  
  return finalPath;
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--output');
  const outputPath = outputIndex > -1 ? args[outputIndex + 1] : null;
  
  const nameIndex = args.indexOf('--name');
  const name = nameIndex > -1 ? args[nameIndex + 1] : undefined;
  
  exportHub(outputPath, { name });
}

module.exports = { exportHub, generateHubIndex };
