import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/module";
import { ControllersModule } from "./controllers/module";
import { IntegrationsModule } from "./integrations/module";
import { ServicesModule } from "./services/module";
import { SocketsModule } from "./sockets/module";
import { ActionsModule } from "./actions/module";

@Module({
  imports: [
    ConfigModule,
    ServicesModule,
    SocketsModule,
    IntegrationsModule,
    ActionsModule,
    ControllersModule,
  ],
})
export class AppModule {}
