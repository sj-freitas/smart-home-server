import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/module";
import { ServicesModule } from "../services/module";
import { ActionsModule } from "../actions/module";
import { McpController } from "./mcp.controller";

@Module({
  imports: [ConfigModule, ServicesModule, ActionsModule],
  controllers: [McpController],
})
export class McpModule {}
