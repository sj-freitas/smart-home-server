import { DeviceHelper } from "./device-helpers";
import { HomeConfig } from "../config/home.zod";

const makeHome = (): HomeConfig => ({
  name: "test-home",
  rooms: [
    {
      id: "living-room",
      name: "Living Room",
      devices: [
        {
          id: "lamp",
          name: "Lamp",
          type: "smart_light",
          actions: [],
          integration: { name: "hue_cloud", id: "hue-lamp-1" },
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
    {
      id: "bedroom",
      name: "Bedroom",
      devices: [
        {
          id: "ac",
          name: "Air Conditioner",
          type: "air_conditioner",
          actions: [],
          integration: { name: "mel_cloud_home", deviceId: "mel-1" },
        },
      ],
    },
  ],
});

describe("DeviceHelper.getDevice", () => {
  let helper: DeviceHelper;

  beforeEach(() => {
    helper = new DeviceHelper(makeHome());
  });

  it("returns a device for a valid path", () => {
    const device = helper.getDevice("living-room/lamp");
    expect(device).not.toBeNull();
    expect(device!.name).toBe("Lamp");
  });

  it("uses room/device id as path", () => {
    const device = helper.getDevice("bedroom/ac");
    expect(device).not.toBeNull();
    expect(device!.type).toBe("air_conditioner");
  });

  it("returns null for an unknown path", () => {
    expect(helper.getDevice("kitchen/oven")).toBeNull();
  });

  it("returns null for a partial path", () => {
    expect(helper.getDevice("living-room")).toBeNull();
  });
});

describe("DeviceHelper.getDeviceFromIntegration", () => {
  let helper: DeviceHelper;

  beforeEach(() => {
    helper = new DeviceHelper(makeHome());
  });

  it("finds a device belonging to the given integration", () => {
    const path = helper.getDeviceFromIntegration(
      "hue_cloud",
      (d: any) => d.id === "hue-lamp-1",
    );
    expect(path).toBe("living-room/lamp");
  });

  it("returns null when no device matches the picker", () => {
    const path = helper.getDeviceFromIntegration(
      "hue_cloud",
      (d: any) => d.id === "does-not-exist",
    );
    expect(path).toBeNull();
  });

  it("returns null when no devices belong to the given integration", () => {
    const path = helper.getDeviceFromIntegration("tuya_cloud", () => true);
    expect(path).toBeNull();
  });

  it("only searches devices of the specified integration", () => {
    // shelly switch has id "shelly-1"; ensure it does not appear when querying hue
    const path = helper.getDeviceFromIntegration(
      "hue_cloud",
      (d: any) => d.id === "shelly-1",
    );
    expect(path).toBeNull();
  });
});
