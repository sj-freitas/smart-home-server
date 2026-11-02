import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import * as pino from "pino";
import { ConfigModule } from "./config/module";
import { ControllersModule } from "./controllers/module";
import { IntegrationsModule } from "./integrations/module";
import { ServicesModule } from "./services/module";
import { SocketsModule } from "./sockets/module";
import { ActionsModule } from "./actions/module";
import { McpModule } from "./mcp/module";
import type { IncomingMessage } from "http";

const isProduction = process.env.NODE_ENV === "production";
const level = process.env.LOG_LEVEL ?? (isProduction ? "info" : "trace");

const pinoLogger = pino({
  level,
  redact: [
    "req.headers.cookie",
    "req.headers.authorization",
    "req.query.token",
  ],
  transport: !isProduction
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});

const pinoHttpOptions = {
  logger: pinoLogger,
  autoLogging: {
    ignore: (req: IncomingMessage & { url?: string }) =>
      req.url === "/api/health",
  },
  customProps: () => ({ service: "smart-home-lan" }),
  serializers: {
    // Webhooks authenticate with a query string token, which is also part of the url.
    req: (req: { url?: string }) => ({
      ...req,
      url: req.url?.replace(/([?&]token=)[^&]*/, "$1[Redacted]"),
    }),
  },
};

@Module({
  imports: [
    LoggerModule.forRoot({ pinoHttp: pinoHttpOptions }),
    ConfigModule,
    ServicesModule,
    SocketsModule,
    IntegrationsModule,
    ActionsModule,
    ControllersModule,
    McpModule,
  ],
})
export class AppModule {}
