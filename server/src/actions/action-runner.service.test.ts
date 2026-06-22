import { ActionRunnerService } from "./action-runner.service";
import { IntegrationsService } from "../integrations/integrations-service";
import { StateService } from "../services/state/state.service";
import { HomeStateGateway } from "../sockets/home.state.gateway";
import { OnActionsService } from "./on-actions/on-actions-service";
import { ConfigService } from "../config/config-service";
import { MetricsPersistenceService } from "../metrics/metrics.persistence.service";
import { HomeConfig } from "../config/home.zod";
import { HomeState } from "../services/state/types.zod";

const stubHomeState: HomeState = {
  name: "Test Home",
  pageTitle: "",
  logo: "",
  faviconUrl: "",
  subTitle: "",
  rooms: [],
};

function makeRunner(
  homeConfig: HomeConfig,
  metricsPersistenceService?: MetricsPersistenceService,
) {
  const mockIntegrationService = {
    name: "shelly" as const,
    tryRunAction: jest.fn().mockResolvedValue(true),
    consolidateDeviceStates: jest.fn(),
  };

  const integrations = {
    getIntegrationService: jest.fn().mockReturnValue(mockIntegrationService),
  } as unknown as IntegrationsService;

  const stateService = {
    addToState: jest.fn().mockResolvedValue(stubHomeState),
  } as unknown as StateService;

  const gateway = {
    isInitialized: false,
    updateState: jest.fn(),
  } as unknown as HomeStateGateway;

  const onActions = {
    handleOnAction: jest.fn().mockResolvedValue(undefined),
  } as unknown as OnActionsService;

  const configService = {
    getConfig: jest.fn().mockReturnValue({ home: homeConfig }),
  } as unknown as ConfigService;

  const runner = new ActionRunnerService(
    integrations,
    stateService,
    gateway,
    onActions,
    configService,
    metricsPersistenceService,
  );
  return {
    runner,
    integrations,
    stateService,
    gateway,
    onActions,
    mockIntegrationService,
  };
}

function makeMetrics(): jest.Mocked<MetricsPersistenceService> {
  return {
    recordClimate: jest.fn().mockResolvedValue(undefined),
    recordDeviceAction: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<MetricsPersistenceService>;
}

const baseConfig: HomeConfig = {
  name: "Test Home",
  rooms: [
    {
      id: "living-room",
      name: "Living Room",
      devices: [
        {
          id: "light-1",
          name: "Main Light",
          type: "smart_light",
          integration: { name: "shelly", id: "shelly-abc" },
          actions: [
            { id: "turn-on", name: "Turn On" },
            { id: "turn-off", name: "Turn Off" },
          ],
        },
      ],
    },
  ],
};

describe("ActionRunnerService.run", () => {
  it("returns found:false when the device does not exist", async () => {
    const { runner } = makeRunner(baseConfig);
    const result = await runner.run("living-room", "nonexistent", "turn-on");
    expect(result.found).toBe(false);
  });

  it("returns found:false when the action does not exist on the device", async () => {
    const { runner } = makeRunner(baseConfig);
    const result = await runner.run("living-room", "light-1", "no-such-action");
    expect(result.found).toBe(false);
  });

  it("calls the integration service and updates state when action is found", async () => {
    const { runner, stateService, mockIntegrationService } =
      makeRunner(baseConfig);
    const result = await runner.run("living-room", "light-1", "turn-on");

    expect(result.found).toBe(true);
    expect(mockIntegrationService.tryRunAction).toHaveBeenCalled();
    expect(stateService.addToState).toHaveBeenCalledWith([
      { id: "light-1", roomId: "living-room", state: "turn-on" },
    ]);
  });

  it("does not broadcast state when the gateway is not initialised", async () => {
    const { runner, gateway } = makeRunner(baseConfig);
    await runner.run("living-room", "light-1", "turn-on");
    expect(gateway.updateState).not.toHaveBeenCalled();
  });

  it("broadcasts state when the gateway is initialised", async () => {
    const { runner, gateway } = makeRunner(baseConfig);
    Object.assign(gateway, { isInitialized: true });
    await runner.run("living-room", "light-1", "turn-on");
    expect(gateway.updateState).toHaveBeenCalledWith(stubHomeState);
  });

  it("records the device action metric when MetricsPersistenceService is provided", async () => {
    const metrics = makeMetrics();
    const { runner } = makeRunner(baseConfig, metrics);

    await runner.run("living-room", "light-1", "turn-on");

    expect(metrics.recordDeviceAction).toHaveBeenCalledWith(
      "living-room",
      "Living Room",
      "light-1",
      "turn-on",
    );
  });

  it("does not throw when MetricsPersistenceService is not provided", async () => {
    const { runner } = makeRunner(baseConfig);
    await expect(
      runner.run("living-room", "light-1", "turn-on"),
    ).resolves.not.toThrow();
  });

  it("invokes onAction handlers for each onAction defined on the action", async () => {
    const configWithOnAction: HomeConfig = {
      ...baseConfig,
      rooms: [
        {
          ...baseConfig.rooms[0],
          devices: [
            {
              ...baseConfig.rooms[0].devices[0],
              actions: [
                {
                  id: "turn-on",
                  name: "Turn On",
                  onAction: [
                    {
                      type: "timer",
                      parameters: { durationInMinutes: 30, action: "turn-off" },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const { runner, onActions } = makeRunner(configWithOnAction);
    await runner.run("living-room", "light-1", "turn-on");
    expect(onActions.handleOnAction).toHaveBeenCalledTimes(1);
  });
});
