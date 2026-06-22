import { StateService } from "./state.service";
import { StatePersistenceService } from "./state.persistence.service";
import { MetricsPersistenceService } from "../../metrics/metrics.persistence.service";
import { HomeConfig } from "../../config/home.zod";
import { DeviceState, HomeState } from "./types.zod";

const homeConfig: HomeConfig = {
  name: "My Home",
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
          actions: [],
        },
      ],
    },
  ],
};

function makePersistence(
  existing: HomeState | null = null,
): jest.Mocked<StatePersistenceService> {
  return {
    getHomeState: jest.fn().mockResolvedValue(existing),
    storeHomeState: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<StatePersistenceService>;
}

function makeMetrics(): jest.Mocked<MetricsPersistenceService> {
  return {
    recordClimate: jest.fn().mockResolvedValue(undefined),
    recordDeviceAction: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<MetricsPersistenceService>;
}

describe("StateService.addToState", () => {
  it("initialises state from config when no existing state is stored", async () => {
    const persistence = makePersistence(null);
    const svc = new StateService(homeConfig, persistence);

    const result = await svc.addToState([
      {
        id: "light-1",
        roomId: "living-room",
        state: "on",
        name: "Main Light",
        type: "smart_light",
        online: true,
      },
    ]);

    expect(result.name).toBe("My Home");
    expect(result.rooms).toHaveLength(1);
    expect(result.rooms[0].id).toBe("living-room");
    expect(result.rooms[0].devices[0].state).toBe("on");
    expect(persistence.storeHomeState).toHaveBeenCalledWith(result);
  });

  it("merges device changes into existing state", async () => {
    const existing: HomeState = {
      name: "My Home",
      pageTitle: "",
      logo: "",
      faviconUrl: "",
      subTitle: "",
      rooms: [
        {
          id: "living-room",
          name: "Living Room",
          icon: "",
          temperature: null,
          humidity: null,
          devices: [
            {
              id: "light-1",
              name: "Main Light",
              icon: "",
              type: "smart_light",
              actions: [],
              state: "off",
              online: false,
            },
          ],
        },
      ],
    };

    const persistence = makePersistence(existing);
    const svc = new StateService(homeConfig, persistence);

    const result = await svc.addToState([
      { id: "light-1", roomId: "living-room", state: "warm_white" },
    ]);

    expect(result.rooms[0].devices[0].state).toBe("warm_white");
  });

  it("adds a new device to the room when it was not previously in state", async () => {
    const existing: HomeState = {
      name: "My Home",
      pageTitle: "",
      logo: "",
      faviconUrl: "",
      subTitle: "",
      rooms: [
        {
          id: "living-room",
          name: "Living Room",
          icon: "",
          temperature: null,
          humidity: null,
          devices: [],
        },
      ],
    };

    const persistence = makePersistence(existing);
    const svc = new StateService(homeConfig, persistence);

    const result = await svc.addToState([
      {
        id: "light-1",
        roomId: "living-room",
        state: "on",
        type: "smart_light",
        online: true,
      },
    ]);

    expect(result.rooms[0].devices).toHaveLength(1);
    expect(result.rooms[0].devices[0].id).toBe("light-1");
  });

  it("updates room temperature from the designated temperature device", async () => {
    const configWithSensor: HomeConfig = {
      name: "My Home",
      rooms: [
        {
          id: "living-room",
          name: "Living Room",
          roomInfo: { temperatureDeviceId: "living-room/sensor-1" },
          devices: [
            {
              id: "sensor-1",
              name: "Sensor",
              type: "temperature_humidity_sensor",
              integration: { name: "shelly", id: "x" },
              actions: [],
            },
          ],
        },
      ],
    };

    const persistence = makePersistence(null);
    const svc = new StateService(configWithSensor, persistence);

    const result = await svc.addToState([
      { id: "sensor-1", roomId: "living-room", temperature: 22.5 },
    ] as DeviceState[]);

    expect(result.rooms[0].temperature).toBe(22.5);
  });
});

describe("StateService.addToState — climate metrics recording", () => {
  const sensorConfig: HomeConfig = {
    name: "My Home",
    rooms: [
      {
        id: "living-room",
        name: "Living Room",
        roomInfo: {
          temperatureDeviceId: "living-room/sensor-1",
          humidityDeviceId: "living-room/sensor-1",
        },
        devices: [
          {
            id: "sensor-1",
            name: "Sensor",
            type: "temperature_humidity_sensor",
            integration: { name: "shelly", id: "x" },
            actions: [],
          },
        ],
      },
    ],
  };

  it("records climate when a device change includes temperature", async () => {
    const persistence = makePersistence(null);
    const metrics = makeMetrics();
    const svc = new StateService(sensorConfig, persistence, metrics);

    await svc.addToState([
      {
        id: "sensor-1",
        roomId: "living-room",
        temperature: 22.5,
        humidity: null,
      },
    ] as DeviceState[]);

    expect(metrics.recordClimate).toHaveBeenCalledWith(
      "living-room",
      "Living Room",
      22.5,
      null,
    );
  });

  it("records climate when a device change includes humidity", async () => {
    const persistence = makePersistence(null);
    const metrics = makeMetrics();
    const svc = new StateService(sensorConfig, persistence, metrics);

    await svc.addToState([
      {
        id: "sensor-1",
        roomId: "living-room",
        temperature: null,
        humidity: 60,
      },
    ] as DeviceState[]);

    expect(metrics.recordClimate).toHaveBeenCalledWith(
      "living-room",
      "Living Room",
      null,
      60,
    );
  });

  it("does not record climate when changes have no temperature or humidity", async () => {
    const persistence = makePersistence(null);
    const metrics = makeMetrics();
    const svc = new StateService(sensorConfig, persistence, metrics);

    await svc.addToState([
      { id: "sensor-1", roomId: "living-room", state: "on" },
    ] as DeviceState[]);

    expect(metrics.recordClimate).not.toHaveBeenCalled();
  });

  it("does not attempt to record metrics when no MetricsPersistenceService is provided", async () => {
    const persistence = makePersistence(null);
    const svc = new StateService(sensorConfig, persistence);

    await expect(
      svc.addToState([
        { id: "sensor-1", roomId: "living-room", temperature: 22.5 },
      ] as DeviceState[]),
    ).resolves.not.toThrow();
  });

  it("does not record climate for a device not referenced in any roomInfo", async () => {
    const persistence = makePersistence(null);
    const metrics = makeMetrics();
    const svc = new StateService(sensorConfig, persistence, metrics);

    await svc.addToState([
      { id: "ac", roomId: "living-room", temperature: 22.5 },
    ] as DeviceState[]);

    expect(metrics.recordClimate).not.toHaveBeenCalled();
  });

  it("records climate for multiple rooms that share the same sensor", async () => {
    const sharedSensorConfig: HomeConfig = {
      name: "My Home",
      rooms: [
        {
          id: "living-room",
          name: "Living Room",
          roomInfo: {
            temperatureDeviceId: "living-room/sensor-1",
            humidityDeviceId: "living-room/sensor-1",
          },
          devices: [
            {
              id: "sensor-1",
              name: "Sensor",
              type: "temperature_humidity_sensor",
              integration: { name: "shelly", id: "x" },
              actions: [],
            },
          ],
        },
        {
          id: "kitchen",
          name: "Kitchen",
          roomInfo: {
            temperatureDeviceId: "living-room/sensor-1",
            humidityDeviceId: "living-room/sensor-1",
          },
          devices: [],
        },
      ],
    };

    const persistence = makePersistence(null);
    const metrics = makeMetrics();
    const svc = new StateService(sharedSensorConfig, persistence, metrics);

    await svc.addToState([
      {
        id: "sensor-1",
        roomId: "living-room",
        temperature: 21.0,
        humidity: 55,
      },
    ] as DeviceState[]);

    expect(metrics.recordClimate).toHaveBeenCalledTimes(2);
    expect(metrics.recordClimate).toHaveBeenCalledWith(
      "living-room",
      "Living Room",
      21.0,
      55,
    );
    expect(metrics.recordClimate).toHaveBeenCalledWith(
      "kitchen",
      "Kitchen",
      21.0,
      55,
    );
  });
});
