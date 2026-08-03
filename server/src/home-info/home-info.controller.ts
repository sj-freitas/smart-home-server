import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import { Response } from "express";
import { marked } from "marked";
import { ConfigService } from "../config/config-service";
import { HomeInfoPersistenceService } from "./home-info.persistence.service";

@Controller("home-info")
export class HomeInfoController {
  constructor(
    private readonly configService: ConfigService,
    private readonly homeInfoPersistenceService: HomeInfoPersistenceService,
  ) {}

  @Get("/:homeId")
  public async getHomeInfo(
    @Param("homeId") homeId: string,
    @Res() response: Response,
  ) {
    const { homeId: configuredHomeId, name } =
      this.configService.getConfig().home;

    if (homeId !== configuredHomeId) {
      throw new NotFoundException("Home not found");
    }

    const homeInfo =
      await this.homeInfoPersistenceService.getLatestByHomeId(homeId);

    if (!homeInfo) {
      throw new NotFoundException("Home info not found");
    }

    const contentHtml = await marked.parse(homeInfo.markdown);

    response.set("Content-Type", "text/html; charset=utf-8");
    return response.send(
      `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${name}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body>
    ${contentHtml}
  </body>
</html>`,
    );
  }
}
