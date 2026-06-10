import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const baseUrl = process.env.SMART_HOME_API_BASE_URL;
const apiKey = process.env.SMART_HOME_API_KEY;

if (!baseUrl) {
  throw new Error("SMART_HOME_API_BASE_URL env var is not set");
}
if (!apiKey) {
  throw new Error("SMART_HOME_API_KEY env var is not set");
}

async function callApi(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Request to ${path} failed with status ${response.status}: ${text}`,
    );
  }

  return text ? JSON.parse(text) : undefined;
}

const server = new McpServer({
  name: "smart-home-lan",
  version: "0.1.0",
});

server.registerTool(
  "get_home_state",
  {
    title: "Get home state",
    description:
      "Fetches the full state of the smart home: every room and its devices, including current state (on/off, temperature, humidity, online status) and the actions available on each device. Use this to answer questions about the home and to discover the roomId/deviceId/actionId values needed for run_device_action.",
    inputSchema: {},
  },
  async () => {
    const state = await callApi("/api/home");

    return {
      content: [{ type: "text" as const, text: JSON.stringify(state, null, 2) }],
    };
  },
);

server.registerTool(
  "run_device_action",
  {
    title: "Run a device action",
    description:
      "Performs an action on a device, e.g. turning a light or AC unit on/off. The roomId, deviceId and actionId must come from the actions listed for that device in get_home_state.",
    inputSchema: {
      roomId: z.string().describe("The id of the room the device belongs to"),
      deviceId: z.string().describe("The id of the device within the room"),
      actionId: z.string().describe("The id of the action to run on the device"),
    },
  },
  async ({ roomId, deviceId, actionId }) => {
    const result = await callApi(
      `/api/actions/${encodeURIComponent(roomId)}/${encodeURIComponent(deviceId)}/${encodeURIComponent(actionId)}`,
      { method: "POST" },
    );

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Smart Home MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in Smart Home MCP server:", error);
  process.exit(1);
});
