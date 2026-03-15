#!/usr/bin/env node

/**
 * Weekly GitHub maintenance check for skill-indexer.
 *
 * - Reads indexed skills (or builds index if missing)
 * - Checks git status against remote HEAD (via git fetch)
 * - Reports per-skill status:
 *   up-to-date | behind | ahead | diverged | dirty | no-git | no-origin
 * - Optional --apply: fast-forward safe repos only (clean + behind)
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const { SkillIndexer } = require('../lib/skill-indexer');

const execFileAsync = promisify(execFile);

async function runGitHubWeeklyCheck(argv = process.argv.slice(2)) {
  const apply = argv.includes('--apply');

  const indexer = new SkillIndexer();
  let index = await indexer.loadIndex();

  if (!index) {
    console.log('ℹ️  No index found. Building index first...');
    index = await indexer.buildIndex();
  }

  const skills = index.skills || [];
  if (skills.length === 0) {
    console.log('No skills found in index.');
    process.exit(0);
  }

  console.log(`\n🔎 GitHub weekly check (${apply ? 'apply mode' : 'dry run'})`);
  console.log(`Checking ${skills.length} skill(s)...\n`);

  const repoCache = new Map();
  const results = [];
  let errorCount = 0;

  for (const skill of skills) {
    const result = await evaluateSkill(skill, { apply, repoCache });
    results.push(result);
    if (result.error) errorCount += 1;

    const note = result.note ? ` (${result.note})` : '';
    const marker = result.error ? '❌' : '•';
    console.log(`${marker} ${skill.id}: ${result.status}${note}`);
  }

  const summary = summarize(results);

  console.log('\n📊 Summary');
  for (const status of [
    'up-to-date',
    'behind',
    'ahead',
    'diverged',
    'dirty',
    'no-git',
    'no-origin'
  ]) {
    const count = summary[status] || 0;
    console.log(`- ${status}: ${count}`);
  }

  if (apply) {
    const applied = results.filter(r => r.applied).length;
    console.log(`- applied (ff-only): ${applied}`);
  }

  console.log(`- errors: ${errorCount}`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

async function evaluateSkill(skill, { apply, repoCache }) {
  const repoRootRes = await runGit(skill.path, ['rev-parse', '--show-toplevel']);
  if (!repoRootRes.ok) {
    return baseResult(skill, 'no-git');
  }

  const repoRoot = repoRootRes.stdout.trim();

  if (!repoCache.has(repoRoot)) {
    repoCache.set(repoRoot, await evaluateRepo(repoRoot, { apply }));
  }

  const repoState = repoCache.get(repoRoot);

  return {
    ...baseResult(skill, repoState.status),
    repoRoot,
    note: repoState.note,
    applied: repoState.applied,
    error: repoState.error
  };
}

async function evaluateRepo(repoRoot, { apply }) {
  const originRes = await runGit(repoRoot, ['remote', 'get-url', 'origin']);
  if (!originRes.ok || !originRes.stdout.trim()) {
    return { status: 'no-origin', note: null, applied: false, error: false };
  }

  const dirtyRes = await runGit(repoRoot, ['status', '--porcelain']);
  if (!dirtyRes.ok) {
    return { status: 'dirty', note: 'unable to read working tree status', applied: false, error: true };
  }

  if (dirtyRes.stdout.trim()) {
    return { status: 'dirty', note: 'working tree has local changes', applied: false, error: false };
  }

  const fetchRes = await runGit(repoRoot, ['fetch', '--prune', 'origin']);
  if (!fetchRes.ok) {
    return { status: 'diverged', note: `fetch failed: ${compact(fetchRes.stderr)}`, applied: false, error: true };
  }

  const upstream = await resolveUpstream(repoRoot);
  if (!upstream) {
    return { status: 'no-origin', note: 'no upstream branch', applied: false, error: false };
  }

  const compareRes = await runGit(repoRoot, ['rev-list', '--left-right', '--count', `HEAD...${upstream}`]);
  if (!compareRes.ok) {
    return { status: 'diverged', note: `compare failed: ${compact(compareRes.stderr)}`, applied: false, error: true };
  }

  const [aheadCount, behindCount] = parseAheadBehind(compareRes.stdout);
  let status = 'up-to-date';

  if (aheadCount > 0 && behindCount > 0) {
    status = 'diverged';
  } else if (aheadCount > 0) {
    status = 'ahead';
  } else if (behindCount > 0) {
    status = 'behind';
  }

  if (apply && status === 'behind') {
    const branch = upstream.startsWith('origin/') ? upstream.slice('origin/'.length) : upstream;
    const pullRes = await runGit(repoRoot, ['pull', '--ff-only', 'origin', branch]);
    if (!pullRes.ok) {
      return {
        status,
        note: `ff-only pull failed: ${compact(pullRes.stderr)}`,
        applied: false,
        error: true
      };
    }

    return {
      status: 'up-to-date',
      note: `fast-forwarded from ${upstream}`,
      applied: true,
      error: false
    };
  }

  return {
    status,
    note: status === 'up-to-date' ? `synced with ${upstream}` : `${aheadCount} ahead / ${behindCount} behind vs ${upstream}`,
    applied: false,
    error: false
  };
}

async function resolveUpstream(repoRoot) {
  const upstreamRes = await runGit(repoRoot, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (upstreamRes.ok && upstreamRes.stdout.trim()) {
    return upstreamRes.stdout.trim();
  }

  const remoteHeadRes = await runGit(repoRoot, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (remoteHeadRes.ok && remoteHeadRes.stdout.trim().startsWith('origin/')) {
    return remoteHeadRes.stdout.trim();
  }

  for (const candidate of ['main', 'master']) {
    const checkRes = await runGit(repoRoot, ['show-ref', '--verify', `refs/remotes/origin/${candidate}`]);
    if (checkRes.ok) {
      return `origin/${candidate}`;
    }
  }

  return null;
}

function parseAheadBehind(output) {
  const parts = output.trim().split(/\s+/).map(n => Number.parseInt(n, 10));
  if (parts.length !== 2 || parts.some(Number.isNaN)) {
    return [0, 0];
  }
  return parts;
}

function summarize(results) {
  return results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {});
}

function baseResult(skill, status) {
  return {
    skillId: skill.id,
    skillPath: skill.path,
    status,
    note: null,
    applied: false,
    error: false
  };
}

function compact(text) {
  return (text || '').trim().replace(/\s+/g, ' ').slice(0, 140) || 'unknown error';
}

async function runGit(cwd, args) {
  try {
    const { stdout, stderr } = await execFileAsync('git', ['-C', cwd, ...args], { encoding: 'utf-8' });
    return { ok: true, stdout: stdout || '', stderr: stderr || '' };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || ''
    };
  }
}

module.exports = {
  runGitHubWeeklyCheck
};

if (require.main === module) {
  runGitHubWeeklyCheck().catch((error) => {
    console.error(`❌ github-weekly-check failed: ${error.message}`);
    process.exit(1);
  });
}
