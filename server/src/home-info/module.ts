import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/module";
import { ServicesModule } from "../services/module";
import { HomeInfoController } from "./home-info.controller";
import { HomeInfoImagesController } from "./home-info-images.controller";

@Module({
  imports: [ConfigModule, ServicesModule],
  controllers: [HomeInfoController, HomeInfoImagesController],
})
export class HomeInfoModule {}
