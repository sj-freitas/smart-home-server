import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { z } from "zod";
import sharp = require("sharp");
import { AuthGuard } from "../services/auth.guard";
import { ConfigService } from "../config/config-service";
import { HomeInfoImagesPersistenceService } from "./home-info-images.persistence.service";

const MAX_DIMENSION = 4000;

const ImageQueryZod = z.object({
  width: z.coerce.number().int().positive().max(MAX_DIMENSION).optional(),
  height: z.coerce.number().int().positive().max(MAX_DIMENSION).optional(),
});

@Controller("static/images")
@UseGuards(AuthGuard)
export class HomeInfoImagesController {
  constructor(
    private readonly configService: ConfigService,
    private readonly homeInfoImagesPersistenceService: HomeInfoImagesPersistenceService,
  ) {}

  @Get("/:homeId/:name")
  public async getImage(
    @Param("homeId") homeId: string,
    @Param("name") name: string,
    @Query() query: unknown,
    @Res() response: Response,
  ) {
    const { homeId: configuredHomeId } = this.configService.getConfig().home;

    if (homeId !== configuredHomeId) {
      throw new NotFoundException("Home not found");
    }

    const parsedQuery = ImageQueryZod.safeParse(query);
    if (!parsedQuery.success) {
      throw new BadRequestException("Invalid width/height query parameters.");
    }
    const { width, height } = parsedQuery.data;

    const image =
      await this.homeInfoImagesPersistenceService.getByHomeIdAndName(
        homeId,
        name,
      );

    if (!image) {
      throw new NotFoundException("Image not found");
    }

    const buffer = Buffer.from(image.imageBase64, "base64");

    const outputBuffer =
      width || height
        ? await sharp(buffer)
            .resize(width, height, { fit: "inside" })
            .jpeg()
            .toBuffer()
        : buffer;

    response.set("Content-Type", "image/jpeg");
    return response.send(outputBuffer);
  }
}
