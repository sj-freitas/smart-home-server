import { Controller, Get, Query } from "@nestjs/common";
import { MelCloudHomeClient } from "../client";

@Controller("api/sandbox")
export class MelCLoudHomeController {
  constructor(private readonly melCloudHomeClient: MelCloudHomeClient) {}

  @Get("/mel-cloud-home-context")
  public async getMelCloudHomeContext() {
    return await this.melCloudHomeClient.getContext();
  }

  @Get("/mel-cloud-home-device")
  public async getMelCloudHomeDevice(@Query("deviceId") deviceId: string) {
    return await this.melCloudHomeClient.getDevice(deviceId);
  }
}
