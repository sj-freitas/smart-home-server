import { Module } from "@nestjs/common";
import { ServicesModule } from "../services/module";
import { MetricsController } from "./metrics.controller";

@Module({
  imports: [ServicesModule],
  controllers: [MetricsController],
})
export class MetricsModule {}
