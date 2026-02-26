#!/usr/bin/env bash
# start-mcp.sh — Start the skill-indexer MCP Server (stdio transport)
#
# Usage:
#   ~/.openclaw/skills/skill-indexer/scripts/start-mcp.sh
#
# This script is used by OpenClaw Wrapper Skill and systemd unit files.
# The MCP server communicates via stdio (no network port needed).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
MCP_DIST="$SKILL_DIR/mcp-server/dist/index.js"

# Build if dist is missing
if [ ! -f "$MCP_DIST" ]; then
  echo "MCP server not built. Building now..." >&2
  cd "$SKILL_DIR/mcp-server"
  npm install --silent
  npm run build
fi

exec node "$MCP_DIST"
