import { MetricsController } from "./metrics.controller";
import {
  MetricsPersistenceService,
  ClimateAggregate,
  DeviceActionMetric,
} from "./metrics.persistence.service";

function makeController(opts?: {
  climateRows?: ClimateAggregate[];
  actionRows?: DeviceActionMetric[];
}) {
  const climateRows = opts?.climateRows ?? [];
  const actionRows = opts?.actionRows ?? [];

  const svc = {
    queryClimate: jest.fn().mockResolvedValue(climateRows),
    queryDeviceActions: jest.fn().mockResolvedValue(actionRows),
  } as unknown as MetricsPersistenceService;

  const controller = new MetricsController(svc);
  return { controller, svc };
}

function makeClimateRow(overrides: Partial<ClimateAggregate> = {}): ClimateAggregate {
  return {
    bucket: new Date("2024-01-01T12:00:00Z"),
    roomId: "living-room",
    roomName: "Living Room",
    temperature: 22.5,
    humidity: 45,
    ...overrides,
  };
}

function makeActionRow(overrides: Partial<DeviceActionMetric> = {}): DeviceActionMetric {
  return {
    id: "uuid-1",
    recordedAt: new Date("2024-01-01T14:00:00Z"),
    roomId: "living-room",
    roomName: "Living Room",
    deviceId: "ac-1",
    actionId: "cool-21",
    ...overrides,
  };
}

describe("MetricsController", () => {
  describe("getClimateMetrics", () => {
    it("returns an empty series array when there are no rows", async () => {
      const { controller } = makeController();
      const result = await controller.getClimateMetrics({});
      expect(result).toEqual({ series: [] });
    });

    it("groups rows by roomId into separate series", async () => {
      const { controller } = makeController({
        climateRows: [
          makeClimateRow({ roomId: "living-room", roomName: "Living Room" }),
          makeClimateRow({ roomId: "bedroom", roomName: "Bedroom" }),
          makeClimateRow({ roomId: "living-room", roomName: "Living Room" }),
        ],
      });

      const result = await controller.getClimateMetrics({});

      expect(result.series).toHaveLength(2);
      const livingRoom = result.series.find((s) => s.roomId === "living-room");
      expect(livingRoom?.data).toHaveLength(2);
    });

    it("passes parsed query options to the persistence service", async () => {
      const { controller, svc } = makeController();

      await controller.getClimateMetrics({
        roomIds: ["living-room"],
        from: "2024-01-01T00:00:00Z",
        to: "2024-01-31T23:59:59Z",
        granularity: "day",
      });

      expect(svc.queryClimate).toHaveBeenCalledWith(
        expect.objectContaining({
          roomIds: ["living-room"],
          granularity: "day",
        }),
      );
    });

    it("normalises a single roomId string into an array", async () => {
      const { controller, svc } = makeController();

      await controller.getClimateMetrics({ roomIds: "living-room" });

      expect(svc.queryClimate).toHaveBeenCalledWith(
        expect.objectContaining({ roomIds: ["living-room"] }),
      );
    });

    it("formats timestamps as ISO strings in data points", async () => {
      const ts = new Date("2024-06-15T10:00:00Z");
      const { controller } = makeController({
        climateRows: [makeClimateRow({ bucket: ts })],
      });

      const result = await controller.getClimateMetrics({});
      const point = result.series[0].data[0] as { timestamp: string };

      expect(point.timestamp).toBe(ts.toISOString());
    });
  });

  describe("getDeviceActionMetrics", () => {
    it("returns an empty events array when there are no rows", async () => {
      const { controller } = makeController();
      const result = await controller.getDeviceActionMetrics({});
      expect(result).toEqual({ events: [] });
    });

    it("returns mapped event objects", async () => {
      const recordedAt = new Date("2024-01-01T14:00:00Z");
      const { controller } = makeController({
        actionRows: [makeActionRow({ recordedAt })],
      });

      const result = await controller.getDeviceActionMetrics({});

      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({
        roomId: "living-room",
        deviceId: "ac-1",
        actionId: "cool-21",
        recordedAt: recordedAt.toISOString(),
      });
    });

    it("passes parsed query options to the persistence service", async () => {
      const { controller, svc } = makeController();

      await controller.getDeviceActionMetrics({
        deviceIds: ["ac-1"],
        from: "2024-01-01T00:00:00Z",
      });

      expect(svc.queryDeviceActions).toHaveBeenCalledWith(
        expect.objectContaining({ deviceIds: ["ac-1"] }),
      );
    });
  });
});
