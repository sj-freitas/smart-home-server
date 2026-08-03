import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import { Response } from "express";
import { ConfigService } from "../config/config-service";
import { HomeInfoImagesPersistenceService } from "./home-info-images.persistence.service";

@Controller("static/images")
export class HomeInfoImagesController {
  constructor(
    private readonly configService: ConfigService,
    private readonly homeInfoImagesPersistenceService: HomeInfoImagesPersistenceService,
  ) {}

  @Get("/:homeId/:name")
  public async getImage(
    @Param("homeId") homeId: string,
    @Param("name") name: string,
    @Res() response: Response,
  ) {
    const { homeId: configuredHomeId } = this.configService.getConfig().home;

    if (homeId !== configuredHomeId) {
      throw new NotFoundException("Home not found");
    }

    const image =
      await this.homeInfoImagesPersistenceService.getByHomeIdAndName(
        homeId,
        name,
      );

    if (!image) {
      throw new NotFoundException("Image not found");
    }

    const buffer = Buffer.from(image.imageBase64, "base64");

    response.set("Content-Type", "image/jpeg");
    return response.send(buffer);
  }
}
