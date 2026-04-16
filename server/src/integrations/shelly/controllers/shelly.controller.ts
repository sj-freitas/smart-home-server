import { Controller, Get, Query } from "@nestjs/common";
import { StateService } from "../../../services/state/state.service";
import { ShellyAuthService } from "../auth.service";
import { ConfigService } from "../../../config/config-service";
import { DeviceHelper } from "../../../helpers/device-helpers";
import { ShellyIntegrationDevice } from "../../../config/integration.zod";
import { HomeStateGateway } from "../../../sockets/home.state.gateway";

@Controller("api/shelly")
export class ShellyController {
  private readonly deviceHelper: DeviceHelper;

  constructor(
    configService: ConfigService,
    private readonly stateService: StateService,
    private readonly stateGateway: HomeStateGateway,
    private readonly shellyAuthService: ShellyAuthService,
  ) {
    this.deviceHelper = new DeviceHelper(configService.getConfig().home);
  }

  @Get("/webhooks")
  public async getMelCloudHomeContext(
    @Query("tc") temperature: string,
    @Query("rh") relativeHumidity: string,
    @Query("token") token: string,
    @Query("device_id") deviceId: string,
  ) {
    if (!deviceId) {
      return {
        eventConsumed: false,
      };
    }

    if (!this.shellyAuthService.isTokenValid(token)) {
      console.warn(`Malicious request to Shelly Webhook detected.`);
      return {
        eventConsumed: false,
      };
    }

    const matchedDevicePath =
      this.deviceHelper.getDeviceFromIntegration<ShellyIntegrationDevice>(
        "shelly",
        (t) => t.id === deviceId,
      );

    if (!matchedDevicePath) {
      console.warn(`Shelly Device ${deviceId} does not exist.`);
      return {
        eventConsumed: false,
      };
    }

    const device = this.deviceHelper.getDevice(matchedDevicePath);
    if (!device) {
      console.warn(`Shelly Device at path ${matchedDevicePath} could not be loaded.`);
      return { eventConsumed: false };
    }
    const [roomId, homeDeviceId] = matchedDevicePath.split("/");

    const parsedTemperatureInCelsius = Number.parseFloat(temperature);
    const parsedRelativeHumidity = Number.parseFloat(relativeHumidity);
    const updateEvent = {
      id: homeDeviceId,
      roomId: roomId,
      name: device.name,
      icon: device.icon,
      type: device.type,
      actions: device.actions.map((t) => ({
        name: t.name,
        id: t.id,
      })),

      // The actual data for the state
      state: "on",
      online: true,
      temperature: !Number.isNaN(parsedTemperatureInCelsius)
        ? parsedTemperatureInCelsius
        : undefined,
      humidity: !Number.isNaN(parsedRelativeHumidity)
        ? parsedRelativeHumidity
        : undefined,
    };

    const newState = await this.stateService.addToState([updateEvent]);
    this.stateGateway.updateState(newState);

    console.log(
      `Update the state of device ${matchedDevicePath}: ${[
        [`temperature`, temperature],
        [`relative humidity`, relativeHumidity],
      ]
        .filter(([_, value]) => value)
        .map(([key, value]) => `${key} -> ${value}`)}`,
    );

    return {
      eventConsumed: true,
    };
  }
}
