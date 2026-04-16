import { updateStateForDevicesOfIntegration } from "./state-updater.helper";
import { HomeConfig } from "../config/home.zod";
import { IntegrationService } from "../integrations/integrations-service";
import { StateService } from "../services/state/state.service";
import { HomeStateGateway } from "../sockets/home.state.gateway";
import { HomeState } from "../services/state/types.zod";

const HOME_CONFIG: HomeConfig = {
  name: "test-home",
  rooms: [
    {
      id: "living-room",
      name: "Living Room",
      devices: [
        {
          id: "lamp",
          name: "Lamp",
          icon: "bulb",
          type: "smart_light",
          actions: [{ id: "on", name: "On" }],
          integration: { name: "hue_cloud", id: "hue-1" },
        },
        {
          id: "switch",
          name: "Switch",
          type: "smart_switch",
          actions: [],
          integration: { name: "shelly", id: "shelly-1" },
        },
      ],
    },
  ],
};

const MOCK_HOME_STATE: HomeState = {
  name: "test-home",
  pageTitle: "",
  logo: "",
  faviconUrl: "",
  subTitle: "",
  rooms: [],
};

function makeIntegration(
  name: "hue_cloud" | "shelly",
  deviceStates: { online: boolean; state: string; temperature: number | null; humidity: number | null }[],
): IntegrationService<unknown> {
  return {
    name,
    consolidateDeviceStates: jest.fn().mockResolvedValue(deviceStates),
    tryRunAction: jest.fn(),
  };
}

function makeStateService(returnState: HomeState = MOCK_HOME_STATE) {
  return {
    addToState: jest.fn().mockResolvedValue(returnState),
  } as unknown as StateService;
}

function makeGateway(initialized: boolean) {
  return {
    isInitialized: initialized,
    updateState: jest.fn(),
  } as unknown as HomeStateGateway;
}

describe("updateStateForDevicesOfIntegration", () => {
  it("calls consolidateDeviceStates only with devices of the given integration", async () => {
    const hueIntegration = makeIntegration("hue_cloud", [
      { online: true, state: "on", temperature: null, humidity: null },
    ]);
    const stateService = makeStateService();
    const gateway = makeGateway(false);

    await updateStateForDevicesOfIntegration(
      HOME_CONFIG,
      hueIntegration,
      stateService,
      gateway,
    );

    const consolidateMock = hueIntegration.consolidateDeviceStates as jest.Mock;
    expect(consolidateMock).toHaveBeenCalledTimes(1);
    // Only the hue lamp should be passed — not the shelly switch
    const [calledDevices] = consolidateMock.mock.calls[0];
    expect(calledDevices).toHaveLength(1);
    expect((calledDevices[0] as any).info.name).toBe("hue_cloud");
  });

  it("calls addToState with correctly zipped device + config data", async () => {
    const integration = makeIntegration("hue_cloud", [
      { online: true, state: "warm_white", temperature: null, humidity: null },
    ]);
    const stateService = makeStateService();
    const gateway = makeGateway(false);

    await updateStateForDevicesOfIntegration(
      HOME_CONFIG,
      integration,
      stateService,
      gateway,
    );

    const [calledChanges] = (stateService.addToState as jest.Mock).mock.calls[0];
    expect(calledChanges).toHaveLength(1);
    expect(calledChanges[0]).toMatchObject({
      id: "lamp",
      roomId: "living-room",
      state: "warm_white",
      online: true,
    });
  });

  it("broadcasts the new state when the gateway is initialized", async () => {
    const integration = makeIntegration("hue_cloud", [
      { online: false, state: "off", temperature: null, humidity: null },
    ]);
    const stateService = makeStateService(MOCK_HOME_STATE);
    const gateway = makeGateway(true);

    await updateStateForDevicesOfIntegration(
      HOME_CONFIG,
      integration,
      stateService,
      gateway,
    );

    expect(gateway.updateState).toHaveBeenCalledWith(MOCK_HOME_STATE);
  });

  it("does not broadcast when the gateway is not yet initialized", async () => {
    const integration = makeIntegration("hue_cloud", [
      { online: false, state: "off", temperature: null, humidity: null },
    ]);
    const stateService = makeStateService();
    const gateway = makeGateway(false);

    await updateStateForDevicesOfIntegration(
      HOME_CONFIG,
      integration,
      stateService,
      gateway,
    );

    expect(gateway.updateState).not.toHaveBeenCalled();
  });

  it("passes an empty array to addToState when the integration has no matching devices", async () => {
    const integration = makeIntegration("tuya_cloud" as any, []);
    const stateService = makeStateService();
    const gateway = makeGateway(false);

    await updateStateForDevicesOfIntegration(
      HOME_CONFIG,
      integration,
      stateService,
      gateway,
    );

    const [calledChanges] = (stateService.addToState as jest.Mock).mock.calls[0];
    expect(calledChanges).toHaveLength(0);
  });
});
