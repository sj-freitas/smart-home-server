import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../services/auth.guard";
import { ConfigService } from "../config/config-service";
import { HomeInfoPersistenceService } from "./home-info.persistence.service";

@Controller("api/home-info")
@UseGuards(AuthGuard)
export class HomeInfoController {
  constructor(
    private readonly configService: ConfigService,
    private readonly homeInfoPersistenceService: HomeInfoPersistenceService,
  ) {}

  @Get("/:homeId")
  public async getHomeInfo(@Param("homeId") homeId: string) {
    const { homeId: configuredHomeId, bannerUrl } =
      this.configService.getConfig().home;

    if (homeId !== configuredHomeId) {
      throw new NotFoundException("Home not found");
    }

    const homeInfo =
      await this.homeInfoPersistenceService.getLatestByHomeId(homeId);

    if (!homeInfo) {
      throw new NotFoundException("Home info not found");
    }

    return {
      markdown: homeInfo.markdown,
      updatedAt: homeInfo.createdAt,
      bannerUrl: bannerUrl ?? null,
    };
  }
}
