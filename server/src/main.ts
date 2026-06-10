import { NestFactory } from "@nestjs/core";
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { AppModule } from "./app.module";
import * as cookieParser from "cookie-parser";
import { McpOAuthProviderService } from "./services/auth/mcp-oauth-provider.service";

const DEFAULT_PORT = "3001";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const authClientBase = process.env.AUTH_CLIENT_BASE;
  if (!authClientBase) {
    throw new Error("AUTH_CLIENT_BASE env var is not set");
  }
  const appDomainUrl = process.env.APP_DOMAIN_URL;
  if (!appDomainUrl) {
    throw new Error("APP_DOMAIN_URL env var is not set");
  }
  const allowedOrigins = [
    authClientBase,
    authClientBase.indexOf("www.") >= 0
      ? authClientBase.replace("www.", "")
      : "",
    ,
    appDomainUrl,
  ].filter(Boolean);

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Origin",
      "X-Requested-With",
      "Mcp-Protocol-Version",
    ],
    exposedHeaders: ["WWW-Authenticate", "Mcp-Session-Id"],
  });
  app.use(cookieParser());

  const mcpOAuthProvider = app.get(McpOAuthProviderService);
  const issuerUrl = new URL(appDomainUrl);
  const mcpResourceUrl = new URL("/mcp", issuerUrl);

  app.use(
    mcpAuthRouter({
      provider: mcpOAuthProvider,
      issuerUrl,
      resourceServerUrl: mcpResourceUrl,
      scopesSupported: ["smart-home"],
      resourceName: "Smart Home LAN",
    }),
  );

  app.use(
    "/mcp",
    requireBearerAuth({
      verifier: mcpOAuthProvider,
      resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpResourceUrl),
    }),
  );

  const port = process.env.PORT ?? DEFAULT_PORT;
  await app.listen(port, "0.0.0.0");

  console.log(`Server listening on http://0.0.0.0:${process.env.PORT}`);
}

bootstrap();
