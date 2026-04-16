import { HueCloudIntegrationService } from "./integration.service";
import { HueClient } from "./hue.client";
import { IntegratedDeviceConfig } from "../integrations-service";
import { HueCloudIntegrationDevice } from "../../config/integration.zod";

function makeHueClient(lightsResponse: Record<string, any> = {}) {
  return {
    getLights: jest.fn().mockResolvedValue(lightsResponse),
    setLightState: jest.fn().mockResolvedValue([{ success: { "/lights/1/state/on": true } }]),
  } as unknown as HueClient;
}

function makeDevice(
  overrides: Partial<IntegratedDeviceConfig<HueCloudIntegrationDevice>> = {},
): IntegratedDeviceConfig<HueCloudIntegrationDevice> {
  return {
    info: { name: "hue_cloud", id: "light-1" },
    type: "smart_light",
    actions: [
      { id: "on", name: "On", parameters: { on: true, bri: 254 } },
      { id: "off", name: "Off", parameters: { on: false } },
    ],
    ...overrides,
  };
}

describe("HueCloudIntegrationService.consolidateDeviceStates", () => {
  it("returns offline state when the device is not found in the Hue API response", async () => {
    const client = makeHueClient({});
    const svc = new HueCloudIntegrationService(client);

    const [result] = await svc.consolidateDeviceStates([makeDevice()]);

    expect(result.online).toBe(false);
    expect(result.state).toBe("off");
  });

  it("maps a smart_light to the best matching action", async () => {
    const client = makeHueClient({
      "light-1": {
        state: { on: true, bri: 254, reachable: true },
      },
    });
    const svc = new HueCloudIntegrationService(client);

    const [result] = await svc.consolidateDeviceStates([makeDevice()]);

    expect(result.online).toBe(true);
    expect(result.state).toBe("on");
  });

  it("maps a smart_light that is off to the off action", async () => {
    const client = makeHueClient({
      "light-1": {
        state: { on: false, bri: 0, reachable: true },
      },
    });
    const svc = new HueCloudIntegrationService(client);

    const [result] = await svc.consolidateDeviceStates([makeDevice()]);

    expect(result.state).toBe("off");
  });

  it("maps a smart_switch by its on/off state", async () => {
    const client = makeHueClient({
      "plug-1": {
        state: { on: true, reachable: true },
      },
    });
    const svc = new HueCloudIntegrationService(client);

    const device = makeDevice({
      info: { name: "hue_cloud", id: "plug-1" },
      type: "smart_switch",
      actions: [{ id: "on", name: "On" }, { id: "off", name: "Off" }],
    });

    const [result] = await svc.consolidateDeviceStates([device]);

    expect(result.state).toBe("on");
    expect(result.online).toBe(true);
  });

  it("defaults online to false when reachable is absent", async () => {
    const client = makeHueClient({
      "light-1": {
        state: { on: true, bri: 254 /* no reachable field */ },
      },
    });
    const svc = new HueCloudIntegrationService(client);

    const [result] = await svc.consolidateDeviceStates([makeDevice()]);

    expect(result.online).toBe(false);
  });
});

describe("HueCloudIntegrationService.tryRunAction", () => {
  it("sets the light state for a smart_light action", async () => {
    const setLightState = jest
      .fn()
      .mockResolvedValue([{ success: { "/lights/1/state/on": true } }]);
    const client = { getLights: jest.fn(), setLightState } as unknown as HueClient;
    const svc = new HueCloudIntegrationService(client);

    const result = await svc.tryRunAction(
      { name: "hue_cloud", id: "light-1" },
      "smart_light",
      { id: "on", name: "On", parameters: { on: true } },
    );

    expect(result).toBe(true);
    expect(setLightState).toHaveBeenCalledWith("light-1", { on: true });
  });

  it("returns an error string when setLightState throws", async () => {
    const client = {
      getLights: jest.fn(),
      setLightState: jest.fn().mockRejectedValue(new Error("Network error")),
    } as unknown as HueClient;
    const svc = new HueCloudIntegrationService(client);

    const result = await svc.tryRunAction(
      { name: "hue_cloud", id: "light-1" },
      "smart_light",
      { id: "on", name: "On", parameters: { on: true } },
    );

    expect(typeof result).toBe("string");
    expect(result).toContain("Network error");
  });

  it("toggles a smart_switch on", async () => {
    const setLightState = jest
      .fn()
      .mockResolvedValue([{ success: {} }]);
    const client = { getLights: jest.fn(), setLightState } as unknown as HueClient;
    const svc = new HueCloudIntegrationService(client);

    await svc.tryRunAction(
      { name: "hue_cloud", id: "plug-1" },
      "smart_switch",
      { id: "on", name: "On" },
    );

    expect(setLightState).toHaveBeenCalledWith("plug-1", { on: true });
  });

  it("toggles a smart_switch off", async () => {
    const setLightState = jest.fn().mockResolvedValue([{ success: {} }]);
    const client = { getLights: jest.fn(), setLightState } as unknown as HueClient;
    const svc = new HueCloudIntegrationService(client);

    await svc.tryRunAction(
      { name: "hue_cloud", id: "plug-1" },
      "smart_switch",
      { id: "off", name: "Off" },
    );

    expect(setLightState).toHaveBeenCalledWith("plug-1", { on: false });
  });

  it("returns an error string for an unsupported device type", async () => {
    const client = makeHueClient();
    const svc = new HueCloudIntegrationService(client);

    const result = await svc.tryRunAction(
      { name: "hue_cloud", id: "sensor-1" },
      "temperature_humidity_sensor",
      { id: "on", name: "On" },
    );

    expect(typeof result).toBe("string");
  });
});
