import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/module";
import { IntegrationsModule } from "../integrations/module";
import { ServicesModule } from "../services/module";
import { SocketsModule } from "../sockets/module";
import { ActionsModule } from "../actions/module";
import { MetricsModule } from "../metrics/module";
import { HomeController } from "./home.controller";
import { ActionsController } from "./actions.controller";
import { AuthController } from "./auth.controller";
import { SandboxController } from "./sandbox.controller";
import { StaticController } from "./static.controller";
import { AdminDashboardController } from "./admin-dashboard.controller";
import { AuthConfig } from "./auth.config";
import { AuthGoogleController } from "./auth-google/auth-google.controller";
import { ApiController } from "./api.controller";
import { AdminController } from "./admin.controller";
import { MetricsController } from "src/metrics/metrics.controller";

const AuthConfigProvider = {
  provide: AuthConfig,
  useFactory: () => new AuthConfig(),
};

@Module({
  providers: [AuthConfigProvider],
  imports: [
    ConfigModule,
    IntegrationsModule,
    ServicesModule,
    SocketsModule,
    ActionsModule,
    MetricsModule,
  ],
  controllers: [
    ApiController,
    HomeController,
    ActionsController,
    AuthController,
    AuthGoogleController,
    SandboxController,
    AdminController,
    AdminDashboardController,
    MetricsController,
    StaticController,
  ],
})
export class ControllersModule {}
