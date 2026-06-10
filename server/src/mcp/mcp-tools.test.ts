import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSmartHomeTools } from "./mcp-tools";
import { ConfigService } from "../config/config-service";
import { StatePersistenceService } from "../services/state/state.persistence.service";
import { ActionRunnerService } from "../actions/action-runner.service";

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>;

function makeServer() {
  const tools = new Map<string, { config: unknown; handler: ToolHandler }>();
  const server = {
    registerTool: jest.fn((name: string, config: unknown, handler: ToolHandler) => {
      tools.set(name, { config, handler });
    }),
  } as unknown as McpServer;

  return { server, tools };
}

function makeDeps(opts: {
  homeState?: unknown;
  actionResult?: Awaited<ReturnType<ActionRunnerService["run"]>>;
} = {}) {
  const configService = {
    getConfig: jest.fn().mockReturnValue({ home: { name: "my-home" } }),
  } as unknown as ConfigService;

  const statePersistenceService = {
    getHomeState: jest.fn().mockResolvedValue(opts.homeState ?? { rooms: [] }),
  } as unknown as StatePersistenceService;

  const actionRunnerService = {
    run: jest.fn().mockResolvedValue(
      opts.actionResult ?? { found: true, actionResult: true, action: { id: "on_bright" } },
    ),
  } as unknown as ActionRunnerService;

  return { configService, statePersistenceService, actionRunnerService };
}

describe("registerSmartHomeTools", () => {
  it("registers get_home_state and run_device_action", () => {
    const { server, tools } = makeServer();
    registerSmartHomeTools(server, makeDeps());

    expect(tools.has("get_home_state")).toBe(true);
    expect(tools.has("run_device_action")).toBe(true);
  });

  it("includes the default-to-bright instruction in the run_device_action description", () => {
    const { server, tools } = makeServer();
    registerSmartHomeTools(server, makeDeps());

    const config = tools.get("run_device_action")!.config as { description: string };
    expect(config.description).toContain("default to the 'on_bright' action");
  });

  describe("get_home_state handler", () => {
    it("returns the home state for the configured home", async () => {
      const homeState = { rooms: [{ id: "living-room", name: "Living Room" }] };
      const deps = makeDeps({ homeState });
      const { server, tools } = makeServer();
      registerSmartHomeTools(server, deps);

      const result = await tools.get("get_home_state")!.handler({});

      expect(deps.statePersistenceService.getHomeState).toHaveBeenCalledWith("my-home");
      expect(JSON.parse(result.content[0].text)).toEqual(homeState);
    });
  });

  describe("run_device_action handler", () => {
    it("returns a success response when the action runs", async () => {
      const deps = makeDeps({
        actionResult: { found: true, actionResult: true, action: { id: "on_bright" } as never },
      });
      const { server, tools } = makeServer();
      registerSmartHomeTools(server, deps);

      const result = await tools.get("run_device_action")!.handler({
        roomId: "living-room",
        deviceId: "lamp",
        actionId: "on_bright",
      });

      expect(deps.actionRunnerService.run).toHaveBeenCalledWith("living-room", "lamp", "on_bright");
      const response = JSON.parse(result.content[0].text);
      expect(response).toMatchObject({
        room: "living-room",
        deviceId: "lamp",
        action: "on_bright",
        runStatus: "success",
      });
    });

    it("returns a failure response when the device or action is not found", async () => {
      const deps = makeDeps({
        actionResult: { found: false, message: "Device with id lamp not found" },
      });
      const { server, tools } = makeServer();
      registerSmartHomeTools(server, deps);

      const result = await tools.get("run_device_action")!.handler({
        roomId: "living-room",
        deviceId: "lamp",
        actionId: "on_bright",
      });

      const response = JSON.parse(result.content[0].text);
      expect(response).toMatchObject({
        room: "living-room",
        deviceId: "lamp",
        action: "on_bright",
        message: "Device with id lamp not found",
        runStatus: "failure",
      });
    });

    it("returns a failure response when the integration reports a failure message", async () => {
      const deps = makeDeps({
        actionResult: {
          found: true,
          actionResult: "Device offline",
          action: { id: "on_bright" } as never,
        },
      });
      const { server, tools } = makeServer();
      registerSmartHomeTools(server, deps);

      const result = await tools.get("run_device_action")!.handler({
        roomId: "living-room",
        deviceId: "lamp",
        actionId: "on_bright",
      });

      const response = JSON.parse(result.content[0].text);
      expect(response).toMatchObject({
        message: "Device offline",
        runStatus: "failure",
      });
    });
  });
});
