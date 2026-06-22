import { Pool } from "pg";
import {
  MetricsPersistenceService,
  ClimateQueryOptions,
  DeviceActionQueryOptions,
} from "./metrics.persistence.service";

function makePool(rows: unknown[] = []): jest.Mocked<Pool> {
  return {
    query: jest.fn().mockResolvedValue({ rows }),
  } as unknown as jest.Mocked<Pool>;
}

describe("MetricsPersistenceService", () => {
  describe("recordClimate", () => {
    it("inserts a row with the correct parameters", async () => {
      const pool = makePool();
      const svc = new MetricsPersistenceService(pool);

      await svc.recordClimate("living-room", "Living Room", 22.5, 45.0);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO public.metrics_climate"),
        ["living-room", "Living Room", 22.5, 45.0],
      );
    });

    it("inserts a row with null temperature when not provided", async () => {
      const pool = makePool();
      const svc = new MetricsPersistenceService(pool);

      await svc.recordClimate("bathroom", "Bathroom", null, 65.0);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO public.metrics_climate"),
        ["bathroom", "Bathroom", null, 65.0],
      );
    });
  });

  describe("recordDeviceAction", () => {
    it("inserts a row with the correct parameters", async () => {
      const pool = makePool();
      const svc = new MetricsPersistenceService(pool);

      await svc.recordDeviceAction(
        "living-room",
        "Living Room",
        "ac-1",
        "cool-21",
      );

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO public.metrics_device_actions"),
        ["living-room", "Living Room", "ac-1", "cool-21"],
      );
    });
  });

  describe("queryClimate", () => {
    const stubRow = {
      bucket: new Date("2024-01-01T12:00:00Z"),
      room_id: "living-room",
      room_name: "Living Room",
      temperature: "22.5",
      humidity: "45",
    };

    it("returns mapped aggregate data", async () => {
      const pool = makePool([stubRow]);
      const svc = new MetricsPersistenceService(pool);

      const result = await svc.queryClimate({});

      expect(result).toHaveLength(1);
      expect(result[0].roomId).toBe("living-room");
      expect(result[0].roomName).toBe("Living Room");
      expect(result[0].temperature).toBe(22.5);
      expect(result[0].humidity).toBe(45);
    });

    it("uses raw query when granularity is raw", async () => {
      const pool = makePool([]);
      const svc = new MetricsPersistenceService(pool);

      await svc.queryClimate({ granularity: "raw" });

      const calledQuery = (pool.query as jest.Mock).mock.calls[0][0] as string;
      expect(calledQuery).toContain("recorded_at AS bucket");
      expect(calledQuery).not.toContain("date_trunc");
    });

    it("uses date_trunc for non-raw granularity", async () => {
      const pool = makePool([]);
      const svc = new MetricsPersistenceService(pool);

      await svc.queryClimate({ granularity: "hour" });

      const calledQuery = (pool.query as jest.Mock).mock.calls[0][0] as string;
      expect(calledQuery).toContain("date_trunc('hour'");
      expect(calledQuery).toContain("AVG(temperature)");
    });

    it("uses hour granularity as default", async () => {
      const pool = makePool([]);
      const svc = new MetricsPersistenceService(pool);

      await svc.queryClimate({});

      const calledQuery = (pool.query as jest.Mock).mock.calls[0][0] as string;
      expect(calledQuery).toContain("date_trunc('hour'");
    });

    it("passes roomIds filter as array parameter", async () => {
      const pool = makePool([]);
      const svc = new MetricsPersistenceService(pool);

      const opts: ClimateQueryOptions = {
        roomIds: ["living-room", "bedroom"],
        granularity: "hour",
      };
      await svc.queryClimate(opts);

      const calledParams = (pool.query as jest.Mock).mock.calls[0][1] as unknown[];
      expect(calledParams).toContainEqual(["living-room", "bedroom"]);
    });

    it("passes from and to as date parameters", async () => {
      const pool = makePool([]);
      const svc = new MetricsPersistenceService(pool);

      const from = new Date("2024-01-01T00:00:00Z");
      const to = new Date("2024-01-31T23:59:59Z");
      await svc.queryClimate({ from, to });

      const calledParams = (pool.query as jest.Mock).mock.calls[0][1] as unknown[];
      expect(calledParams).toContain(from);
      expect(calledParams).toContain(to);
    });

    it("handles null temperature and humidity gracefully", async () => {
      const pool = makePool([
        { ...stubRow, temperature: null, humidity: null },
      ]);
      const svc = new MetricsPersistenceService(pool);

      const result = await svc.queryClimate({});

      expect(result[0].temperature).toBeNull();
      expect(result[0].humidity).toBeNull();
    });
  });

  describe("queryDeviceActions", () => {
    const stubRow = {
      id: "uuid-1",
      recorded_at: new Date("2024-01-01T12:00:00Z"),
      room_id: "living-room",
      room_name: "Living Room",
      device_id: "ac-1",
      action_id: "cool-21",
    };

    it("returns mapped device action data", async () => {
      const pool = makePool([stubRow]);
      const svc = new MetricsPersistenceService(pool);

      const result = await svc.queryDeviceActions({});

      expect(result).toHaveLength(1);
      expect(result[0].roomId).toBe("living-room");
      expect(result[0].deviceId).toBe("ac-1");
      expect(result[0].actionId).toBe("cool-21");
    });

    it("passes deviceIds filter when provided", async () => {
      const pool = makePool([]);
      const svc = new MetricsPersistenceService(pool);

      const opts: DeviceActionQueryOptions = { deviceIds: ["ac-1", "heater-1"] };
      await svc.queryDeviceActions(opts);

      const calledParams = (pool.query as jest.Mock).mock.calls[0][1] as unknown[];
      expect(calledParams).toContainEqual(["ac-1", "heater-1"]);
    });

    it("runs query without WHERE clause when no filters provided", async () => {
      const pool = makePool([]);
      const svc = new MetricsPersistenceService(pool);

      await svc.queryDeviceActions({});

      const calledQuery = (pool.query as jest.Mock).mock.calls[0][0] as string;
      expect(calledQuery).not.toContain("WHERE");
    });
  });
});
