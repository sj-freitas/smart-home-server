import { Controller, Get, UseGuards } from "@nestjs/common";
import { StatePersistenceService } from "../services/state/state.persistence.service";
import { ConfigService } from "../config/config-service";
import { RoleGuard } from "../services/role.guard";

@Controller("api/home")
@UseGuards(RoleGuard(["User", "Admin"]))
export class HomeController {
  constructor(
    private readonly configService: ConfigService,
    private readonly statePersistenceService: StatePersistenceService,
  ) {}

  @Get("/")
  public async getHomeInfo() {
    const homeName = this.configService.getConfig().home.name;
    const currState = await this.statePersistenceService.getHomeState(homeName);

    return currState;
  }
}
