#!/usr/bin/env node

/**
 * skill-indexer CLI
 * 
 * Usage:
 *   skill-indexer index          Build/update index
 *   skill-indexer search <query> Search skills
 *   skill-indexer info <skill>   Show skill details
 *   skill-indexer list           List all skills
 *   skill-indexer update-tools   Update TOOLS.md
 *   skill-indexer validate       Validate index
 */

const { SkillIndexer } = require('../lib/skill-indexer');
const { exportHub } = require('../scripts/export-hub');

const command = process.argv[2];
const args = process.argv.slice(3);

const indexer = new SkillIndexer();

async function main() {
  switch (command) {
    case 'index':
      await indexer.buildIndex();
      break;
      
    case 'search':
      if (!args[0]) {
        console.error('Usage: skill-indexer search <query>');
        process.exit(1);
      }
      await indexer.loadIndex();
      const results = indexer.search(args.join(' '));
      printResults(results);
      break;
      
    case 'info':
      if (!args[0]) {
        console.error('Usage: skill-indexer info <skill-id>');
        process.exit(1);
      }
      await indexer.loadIndex();
      const skill = indexer.getSkill(args[0]);
      if (skill) {
        printSkill(skill);
      } else {
        console.log(`Skill '${args[0]}' not found`);
      }
      break;
      
    case 'list':
      await indexer.loadIndex();
      const typeFilter = args.find(a => a.startsWith('--type='))?.split('=')[1];
      const skills = indexer.list({ type: typeFilter });
      printResults(skills);
      break;
      
    case 'update-tools':
      await indexer.loadIndex();
      await indexer.updateToolsMd();
      break;
      
    case 'watch':
      const { SkillWatcher } = require('../scripts/watch');
      const watcher = new SkillWatcher();
      await watcher.start();
      break;
      
    case 'validate':
      await validateIndex();
      break;
      
    case 'export-hub':
      await exportHub(args);
      break;
      
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;
      
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function printResults(skills) {
  if (skills.length === 0) {
    console.log('No skills found');
    return;
  }
  
  console.log(`\n📚 Found ${skills.length} skill(s):\n`);
  console.log('| ID | Name | Type | Triggers |');
  console.log('|----|------|------|----------|');
  
  for (const skill of skills) {
    const triggers = skill.triggers.slice(0, 2).join(', ') || 'N/A';
    console.log(`| ${skill.id} | ${skill.name} | ${skill.type} | ${triggers} |`);
  }
  console.log();
}

function printSkill(skill) {
  console.log(`\n📋 Skill: ${skill.name}\n`);
  console.log(`  ID:          ${skill.id}`);
  console.log(`  Type:        ${skill.type}`);
  console.log(`  Version:     ${skill.version || 'N/A'}`);
  console.log(`  Path:        ${skill.path}`);
  console.log(`  Description: ${skill.description.slice(0, 100)}...`);
  console.log(`  Triggers:    ${skill.triggers.join(', ') || 'N/A'}`);
  console.log(`  Keywords:    ${skill.keywords.slice(0, 10).join(', ')}...`);
  console.log(`  Resources:`);
  console.log(`    - Scripts:    ${skill.hasScripts ? '✅' : '❌'}`);
  console.log(`    - References: ${skill.hasReferences ? '✅' : '❌'}`);
  console.log(`    - Assets:     ${skill.hasAssets ? '✅' : '❌'}`);
  console.log(`  Last Indexed: ${skill.lastIndexed}`);
  console.log();
}

async function validateIndex() {
  try {
    await indexer.loadIndex();
    if (!indexer.index) {
      console.error('❌ No index found. Run "skill-indexer index" first.');
      process.exit(1);
    }
    
    console.log('✅ Index is valid');
    console.log(`   Version: ${indexer.index.version}`);
    console.log(`   Generated: ${indexer.index.generatedAt}`);
    console.log(`   Total Skills: ${indexer.index.stats.total}`);
    console.log(`   System: ${indexer.index.stats.system}`);
    console.log(`   Workspace: ${indexer.index.stats.workspace}`);
  } catch (err) {
    console.error(`❌ Index validation failed: ${err.message}`);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
📚 skill-indexer - OpenClaw Skill Registry

Usage:
  skill-indexer <command> [options]

Commands:
  index                    Build or update skill index
  search <query>           Search skills by keyword
  info <skill-id>          Show detailed skill information
  list [--type=system|workspace]  List all skills
  update-tools             Update TOOLS.md with skill index
  validate                 Validate index integrity
  watch                    Watch mode - auto-reindex on changes
  export-hub [--output=<path>]  Export hub-compatible index
  help                     Show this help message

Examples:
  skill-indexer index
  skill-indexer search "docs"
  skill-indexer info docs-rag
  skill-indexer list --type=system
  skill-indexer update-tools
`);
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
