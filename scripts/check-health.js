#!/usr/bin/env node
// check-health.js — Health check for skill-indexer MCP server
//
// Usage:
//   node ~/.openclaw/skills/skill-indexer/scripts/check-health.js
//
// Exit code 0 = healthy, 1 = degraded

const { existsSync, readFileSync } = require("fs");
const { join } = require("path");
const { homedir } = require("os");

const SKILL_DIR = join(__dirname, "..");
const MCP_DIST = join(SKILL_DIR, "mcp-server", "dist", "index.js");
const INDEX_FILE = join(homedir(), ".openclaw", ".skill-index.json");

const checks = {
  mcp_built: existsSync(MCP_DIST),
  index_exists: existsSync(INDEX_FILE),
};

let indexStats = null;

if (checks.index_exists) {
  try {
    const data = JSON.parse(readFileSync(INDEX_FILE, "utf-8"));
    indexStats = {
      total: data.stats?.total ?? data.skills?.length ?? 0,
      generatedAt: data.generatedAt ?? "unknown",
      version: data.version ?? "unknown",
    };
    checks.index_valid = true;
  } catch {
    checks.index_valid = false;
  }
}

const allOk = Object.values(checks).every(Boolean);

const report = {
  status: allOk ? "ok" : "degraded",
  checks,
  index: indexStats,
  mcp_dist: MCP_DIST,
  remediation: allOk
    ? null
    : {
        mcp_not_built: "Run: cd ~/.openclaw/skills/skill-indexer/mcp-server && npm run build",
        index_missing: "Run: node ~/.openclaw/skills/skill-indexer/bin/skill-indexer.js index",
      },
};

console.log(JSON.stringify(report, null, 2));
process.exit(allOk ? 0 : 1);
