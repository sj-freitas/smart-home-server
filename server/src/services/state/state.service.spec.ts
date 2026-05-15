import { StateService } from "./state.service";
import { StatePersistenceService } from "./state.persistence.service";
import { HomeConfig } from "../../config/home.zod";
import { HomeState, DeviceState } from "./types.zod";

const HOME_CONFIG: HomeConfig = {
  name: "test-home",
  pageTitle: "Test Home",
  iconUrl: "icon.png",
  faviconUrl: "favicon.png",
  subTitle: "My Home",
  rooms: [
    {
      id: "living-room",
      name: "Living Room",
      devices: [
        {
          id: "lamp",
          name: "Lamp",
          type: "smart_light",
          actions: [{ id: "on", name: "On" }, { id: "off", name: "Off" }],
          integration: { name: "hue_cloud", id: "hue-1" },
        },
      ],
    },
    {
      id: "bedroom",
      name: "Bedroom",
      devices: [],
    },
  ],
};

const EXISTING_STATE: HomeState = {
  name: "test-home",
  pageTitle: "Test Home",
  logo: "icon.png",
  faviconUrl: "favicon.png",
  subTitle: "My Home",
  rooms: [
    {
      id: "living-room",
      name: "Living Room",
      icon: "sofa",
      temperature: null,
      humidity: null,
      devices: [
        {
          id: "lamp",
          name: "Lamp",
          icon: "bulb",
          type: "smart_light",
          actions: [{ id: "on", name: "On" }, { id: "off", name: "Off" }],
          state: "off",
          online: true,
        },
      ],
    },
  ],
};

function makePersistence(storedState: HomeState | null = null) {
  return {
    getHomeState: jest.fn().mockResolvedValue(storedState),
    storeHomeState: jest.fn().mockResolvedValue(undefined),
  } as unknown as StatePersistenceService;
}

describe("StateService.addToState", () => {
  it("creates a new state from config when no previous state exists", async () => {
    const persistence = makePersistence(null);
    const svc = new StateService(HOME_CONFIG, persistence);

    const changes: DeviceState[] = [
      {
        id: "lamp",
        roomId: "living-room",
        name: "Lamp",
        icon: "bulb",
        type: "smart_light",
        actions: [{ id: "on", name: "On" }],
        state: "on",
        online: true,
      },
    ];

    const result = await svc.addToState(changes);

    expect(result.name).toBe("test-home");
    expect(result.rooms).toHaveLength(2);
    const livingRoom = result.rooms.find((r) => r.id === "living-room")!;
    expect(livingRoom.devices).toHaveLength(1);
    expect(livingRoom.devices[0].state).toBe("on");
  });

  it("updates an existing device's state in the persisted state", async () => {
    const persistence = makePersistence(EXISTING_STATE);
    const svc = new StateService(HOME_CONFIG, persistence);

    const changes: DeviceState[] = [
      {
        id: "lamp",
        roomId: "living-room",
        state: "on",
        online: true,
      },
    ];

    const result = await svc.addToState(changes);
    const lamp = result.rooms
      .find((r) => r.id === "living-room")!
      .devices.find((d) => d.id === "lamp")!;

    expect(lamp.state).toBe("on");
    expect(lamp.online).toBe(true);
  });

  it("preserves existing device fields when change only updates some fields", async () => {
    const persistence = makePersistence(EXISTING_STATE);
    const svc = new StateService(HOME_CONFIG, persistence);

    const changes: DeviceState[] = [
      { id: "lamp", roomId: "living-room", state: "warm_white" },
    ];

    const result = await svc.addToState(changes);
    const lamp = result.rooms
      .find((r) => r.id === "living-room")!
      .devices.find((d) => d.id === "lamp")!;

    expect(lamp.state).toBe("warm_white");
    expect(lamp.name).toBe("Lamp");    // preserved from prior state
    expect(lamp.icon).toBe("bulb");    // preserved from prior state
  });

  it("ignores device changes for unknown rooms", async () => {
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const persistence = makePersistence(EXISTING_STATE);
    const svc = new StateService(HOME_CONFIG, persistence);

    const changes: DeviceState[] = [
      { id: "sensor", roomId: "kitchen", state: "on" },
    ];

    const result = await svc.addToState(changes);
    // bedroom still has no devices, kitchen doesn't exist
    expect(result.rooms.find((r) => r.id === "bedroom")!.devices).toHaveLength(0);
    consoleSpy.mockRestore();
  });

  it("persists the new state after computing it", async () => {
    const persistence = makePersistence(null);
    const svc = new StateService(HOME_CONFIG, persistence);

    await svc.addToState([]);

    expect(persistence.storeHomeState).toHaveBeenCalledTimes(1);
  });

  it("updates room temperature from a mapped device change", async () => {
    const configWithSensor: HomeConfig = {
      ...HOME_CONFIG,
      rooms: [
        {
          id: "living-room",
          name: "Living Room",
          roomInfo: { temperatureDeviceId: "sensor" },
          devices: [
            {
              id: "sensor",
              name: "Sensor",
              type: "temperature_humidity_sensor",
              actions: [],
              integration: { name: "shelly", id: "sh-1" },
            },
          ],
        },
      ],
    };

    const persistence = makePersistence(null);
    const svc = new StateService(configWithSensor, persistence);

    const changes: DeviceState[] = [
      {
        id: "sensor",
        roomId: "living-room",
        temperature: 22.5,
        humidity: 50,
        state: "on",
        online: true,
      },
    ];

    const result = await svc.addToState(changes);
    const room = result.rooms.find((r) => r.id === "living-room")!;
    expect(room.temperature).toBe(22.5);
  });
});
