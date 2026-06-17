import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ConfigService } from "../config/config-service";
import { StatePersistenceService } from "../services/state/state.persistence.service";
import { ActionRunnerService } from "../actions/action-runner.service";

export type McpToolsDeps = {
  configService: ConfigService;
  statePersistenceService: StatePersistenceService;
  actionRunnerService: ActionRunnerService;
};

export function registerSmartHomeTools(
  server: McpServer,
  deps: McpToolsDeps,
): void {
  const { configService, statePersistenceService, actionRunnerService } = deps;

  server.registerTool(
    "get_home_state",
    {
      title: "Get home state",
      description:
        "Fetches the full state of the smart home: every room and its devices, including current state (on/off, temperature, humidity, online status) and the actions available on each device. Use this to answer questions about the home and to discover the roomId/deviceId/actionId values needed for run_device_action.",
      inputSchema: {},
    },
    async () => {
      const homeName = configService.getConfig().home.name;
      const state = await statePersistenceService.getHomeState(homeName);

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(state, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "run_device_action",
    {
      title: "Run a device action",
      description:
        "Performs an action on a device, e.g. turning a light or AC unit on/off. The roomId, deviceId and actionId must come from the actions listed for that device in get_home_state. " +
        "If the user asks to turn a light 'on' without specifying a brightness/mode, and the device's actions don't include a plain 'on', default to the 'on_bright' action.",
      inputSchema: {
        roomId: z.string().describe("The id of the room the device belongs to"),
        deviceId: z.string().describe("The id of the device within the room"),
        actionId: z
          .string()
          .describe("The id of the action to run on the device"),
      },
    },
    async ({ roomId, deviceId, actionId }) => {
      const result = await actionRunnerService.run(roomId, deviceId, actionId);

      const response =
        result.found === false
          ? {
              room: roomId,
              deviceId,
              action: actionId,
              message: result.message,
              runStatus: "failure",
            }
          : {
              room: roomId,
              deviceId,
              action: actionId,
              message:
                result.actionResult === true ? undefined : result.actionResult,
              runStatus: result.actionResult === true ? "success" : "failure",
            };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(response, null, 2) },
        ],
      };
    },
  );
}
