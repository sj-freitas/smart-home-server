import { Controller, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../services/auth.guard";
import { ActionRunnerService } from "../actions/action-runner.service";

@Controller("api/actions")
export class ActionsController {
  constructor(private readonly actionRunner: ActionRunnerService) {}

  @UseGuards(AuthGuard)
  @Post("/:roomId/:deviceId/:actionId")
  @HttpCode(200)
  public async performAction(
    @Param("roomId") roomId: string,
    @Param("deviceId") deviceId: string,
    @Param("actionId") actionId: string,
  ) {
    const result = await this.actionRunner.run(roomId, deviceId, actionId);

    if (result.found === false) {
      return {
        room: roomId,
        deviceId,
        action: actionId,
        message: result.message,
        runStatus: "failure",
      };
    }

    return {
      room: roomId,
      deviceId,
      action: actionId,
      message: result.actionResult === true ? undefined : result.actionResult,
      runStatus: result.actionResult === true ? "success" : "failure",
    };
  }
}
