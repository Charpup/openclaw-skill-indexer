#!/usr/bin/env node

/**
 * Skill-Indexer MCP Server
 * 
 * Exposes skill-indexer functionality as MCP tools
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// Load skill index
function loadIndex() {
  try {
    const indexPath = join(homedir(), ".openclaw", ".skill-index.json");
    const data = readFileSync(indexPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return { skills: [], byTrigger: {}, byKeyword: {} };
  }
}

// Create MCP server
const server = new McpServer({
  name: "skill-indexer-mcp-server",
  version: "1.2.0"
});

// Tool 1: Search skills
server.registerTool(
  "search_skills",
  {
    title: "Search Skills",
    description: "Search OpenClaw skills by keyword, name, or description",
    inputSchema: {
      query: z.string().min(1).describe("Search query string"),
      limit: z.number().min(1).max(50).default(10).describe("Maximum number of results to return")
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true
    }
  },
  async ({ query, limit }) => {
    const index = loadIndex();
    const q = query.toLowerCase();
    
    const results = index.skills.filter((skill: any) => 
      skill.id.toLowerCase().includes(q) ||
      skill.name.toLowerCase().includes(q) ||
      skill.description.toLowerCase().includes(q)
    ).slice(0, limit);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(results, null, 2)
      }]
    };
  }
);

// Tool 2: Get skill info
server.registerTool(
  "get_skill_info",
  {
    title: "Get Skill Info",
    description: "Get detailed information about a specific skill",
    inputSchema: {
      skill_id: z.string().describe("Skill ID (directory name)")
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true
    }
  },
  async ({ skill_id }) => {
    const index = loadIndex();
    const skill = index.skills.find((s: any) => s.id === skill_id);
    
    if (!skill) {
      return {
        content: [{
          type: "text",
          text: `Skill '${skill_id}' not found`
        }],
        isError: true
      };
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(skill, null, 2)
      }]
    };
  }
);

// Tool 3: List skills
server.registerTool(
  "list_skills",
  {
    title: "List Skills",
    description: "List all indexed skills with optional filtering",
    inputSchema: {
      type: z.enum(["system", "workspace", "all"]).default("all").describe("Filter by skill type"),
      limit: z.number().min(1).max(100).default(50).describe("Maximum number of results")
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true
    }
  },
  async ({ type, limit }) => {
    const index = loadIndex();
    let skills = index.skills;
    
    if (type !== "all") {
      skills = skills.filter((s: any) => s.type === type);
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(skills.slice(0, limit), null, 2)
      }]
    };
  }
);

// Tool 4: Find by trigger
server.registerTool(
  "find_by_trigger",
  {
    title: "Find by Trigger",
    description: "Find skills by trigger keyword",
    inputSchema: {
      trigger: z.string().describe("Trigger keyword to search for")
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true
    }
  },
  async ({ trigger }) => {
    const index = loadIndex();
    const ids = index.byTrigger[trigger.toLowerCase()] || [];
    const results = ids.map((id: any) => index.skills.find((s: any) => s.id === id)).filter(Boolean);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(results, null, 2)
      }]
    };
  }
);

// Tool 5: Refresh index
server.registerTool(
  "refresh_index",
  {
    title: "Refresh Index",
    description: "Get current index statistics (rebuild requires running skill-indexer index)",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true
    }
  },
  async () => {
    const index = loadIndex();
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          version: index.version,
          generatedAt: index.generatedAt,
          stats: index.stats,
          message: "To rebuild index, run: skill-indexer index"
        }, null, 2)
      }]
    };
  }
);

// Start server
const transport = new StdioServerTransport();
server.connect(transport);

console.error("Skill-Indexer MCP Server running on stdio");
