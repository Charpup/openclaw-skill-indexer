#!/usr/bin/env node

/**
 * Skill-Indexer MCP Server
 *
 * Exposes skill-indexer functionality as MCP tools for Claude Code
 * and other MCP-compatible clients. All tools are read-only.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CHARACTER_LIMIT = 25000;

interface SkillEntry {
  id: string;
  name: string;
  description: string;
  type: string;
  [key: string]: unknown;
}

interface SkillIndex {
  version?: string;
  generatedAt?: string;
  stats?: Record<string, unknown>;
  skills: SkillEntry[];
  byTrigger: Record<string, string[]>;
  byKeyword: Record<string, string[]>;
}

function loadIndex(): SkillIndex {
  try {
    const indexPath = join(homedir(), ".openclaw", ".skill-index.json");
    const data = readFileSync(indexPath, "utf-8");
    return JSON.parse(data) as SkillIndex;
  } catch {
    return { skills: [], byTrigger: {}, byKeyword: {} };
  }
}

function truncateIfNeeded(text: string): string {
  if (text.length > CHARACTER_LIMIT) {
    return (
      text.slice(0, CHARACTER_LIMIT) +
      `\n...(truncated, ${text.length - CHARACTER_LIMIT} chars omitted. Use offset/limit to paginate.)`
    );
  }
  return text;
}

// Create MCP server
const server = new McpServer({
  name: "skill-indexer-mcp-server",
  version: "1.2.0",
});

// Tool 1: Search skills
server.registerTool(
  "search_skills",
  {
    title: "Search Skills",
    description:
      "Search OpenClaw skills by keyword, name, or description. Returns matching skills with pagination metadata. Does NOT modify any data.",
    inputSchema: {
      query: z.string().min(1).describe("Search query string"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Maximum number of results to return"),
      offset: z
        .number()
        .int()
        .min(0)
        .default(0)
        .describe("Number of results to skip for pagination"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ query, limit, offset }) => {
    try {
      const index = loadIndex();
      const q = query.toLowerCase();

      const allResults = index.skills.filter(
        (skill) =>
          skill.id.toLowerCase().includes(q) ||
          skill.name.toLowerCase().includes(q) ||
          skill.description.toLowerCase().includes(q)
      );

      const total = allResults.length;
      const results = allResults.slice(offset, offset + limit);
      const hasMore = total > offset + results.length;

      const output = {
        total,
        count: results.length,
        offset,
        skills: results,
        has_more: hasMore,
        ...(hasMore ? { next_offset: offset + results.length } : {}),
      };

      return {
        content: [
          {
            type: "text",
            text: truncateIfNeeded(JSON.stringify(output, null, 2)),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error searching skills: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Tool 2: Get skill info
server.registerTool(
  "get_skill_info",
  {
    title: "Get Skill Info",
    description:
      "Get detailed information about a specific skill by its ID (directory name). Returns full metadata including triggers, version, and configuration.",
    inputSchema: {
      skill_id: z
        .string()
        .min(1)
        .describe(
          "Skill ID (directory name, e.g. 'triadev', 'skill-indexer')"
        ),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ skill_id }) => {
    try {
      const index = loadIndex();
      const skill = index.skills.find((s) => s.id === skill_id);

      if (!skill) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Skill '${skill_id}' not found in index. Run 'skill-indexer index' to rebuild.`,
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(skill, null, 2) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error retrieving skill info: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Tool 3: List skills
server.registerTool(
  "list_skills",
  {
    title: "List Skills",
    description:
      "List all indexed OpenClaw skills with optional type filtering and pagination. Returns skills array with total count and pagination metadata.",
    inputSchema: {
      type: z
        .enum(["system", "workspace", "all"])
        .default("all")
        .describe(
          "Filter by skill type: 'system' (from ~/.openclaw/skills), 'workspace', or 'all'"
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(50)
        .describe("Maximum number of results to return"),
      offset: z
        .number()
        .int()
        .min(0)
        .default(0)
        .describe("Number of results to skip for pagination"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ type, limit, offset }) => {
    try {
      const index = loadIndex();
      const filtered =
        type === "all"
          ? index.skills
          : index.skills.filter((s) => s.type === type);

      const total = filtered.length;
      const skills = filtered.slice(offset, offset + limit);
      const hasMore = total > offset + skills.length;

      const output = {
        total,
        count: skills.length,
        offset,
        skills,
        has_more: hasMore,
        ...(hasMore ? { next_offset: offset + skills.length } : {}),
      };

      return {
        content: [
          {
            type: "text",
            text: truncateIfNeeded(JSON.stringify(output, null, 2)),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error listing skills: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Tool 4: Find by trigger
server.registerTool(
  "find_by_trigger",
  {
    title: "Find by Trigger",
    description:
      "Find skills registered for a specific trigger keyword (exact match). Returns all skills that activate on the given trigger phrase.",
    inputSchema: {
      trigger: z
        .string()
        .min(1)
        .describe(
          "Exact trigger keyword to look up (e.g. 'triadev', 'search docs')"
        ),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ trigger }) => {
    try {
      const index = loadIndex();
      const ids = index.byTrigger[trigger.toLowerCase()] ?? [];
      const results = ids
        .map((id) => index.skills.find((s) => s.id === id))
        .filter((s): s is SkillEntry => s !== undefined);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { trigger, count: results.length, skills: results },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error finding by trigger: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Tool 5: Get index statistics
server.registerTool(
  "refresh_index",
  {
    title: "Get Index Statistics",
    description:
      "Get current skill index statistics: version, generation timestamp, and skill counts. Does NOT rebuild the index — to rebuild, run: skill-indexer index",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    try {
      const index = loadIndex();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                version: index.version ?? "unknown",
                generatedAt: index.generatedAt ?? "unknown",
                stats: index.stats ?? { total: index.skills.length },
                message: "To rebuild index, run: skill-indexer index",
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error reading index stats: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Start server
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Skill-Indexer MCP Server running on stdio");
}

main().catch((error: unknown) => {
  console.error("Fatal error starting MCP server:", error);
  process.exit(1);
});
