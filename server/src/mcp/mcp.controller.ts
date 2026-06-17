import { All, Controller, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ConfigService } from "../config/config-service";
import { StatePersistenceService } from "../services/state/state.persistence.service";
import { ActionRunnerService } from "../actions/action-runner.service";
import { registerSmartHomeTools } from "./mcp-tools";

@Controller("mcp")
export class McpController {
  constructor(
    private readonly configService: ConfigService,
    private readonly statePersistenceService: StatePersistenceService,
    private readonly actionRunnerService: ActionRunnerService,
  ) {}

  @All("/")
  public async handleMcpRequest(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (req.method !== "POST") {
      res.status(405).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed" },
        id: null,
      });
      return;
    }

    const server = new McpServer({
      name: "smart-home-lan",
      version: "0.1.0",
    });

    registerSmartHomeTools(server, {
      configService: this.configService,
      statePersistenceService: this.statePersistenceService,
      actionRunnerService: this.actionRunnerService,
    });

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
