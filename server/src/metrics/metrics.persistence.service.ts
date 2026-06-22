import { Pool } from "pg";
import { z } from "zod";

export const VALID_GRANULARITIES = [
  "raw",
  "minute",
  "hour",
  "day",
  "week",
  "month",
] as const;

export type Granularity = (typeof VALID_GRANULARITIES)[number];

const ClimateAggregateZod = z
  .object({
    bucket: z.date(),
    room_id: z.string(),
    room_name: z.string(),
    temperature: z.union([z.string(), z.number()]).nullable(),
    humidity: z.union([z.string(), z.number()]).nullable(),
  })
  .transform((d) => ({
    bucket: d.bucket,
    roomId: d.room_id,
    roomName: d.room_name,
    temperature: d.temperature !== null ? Number(d.temperature) : null,
    humidity: d.humidity !== null ? Number(d.humidity) : null,
  }));

const DeviceActionMetricZod = z
  .object({
    id: z.string(),
    recorded_at: z.date(),
    room_id: z.string(),
    room_name: z.string(),
    device_id: z.string(),
    action_id: z.string(),
  })
  .transform((d) => ({
    id: d.id,
    recordedAt: d.recorded_at,
    roomId: d.room_id,
    roomName: d.room_name,
    deviceId: d.device_id,
    actionId: d.action_id,
  }));

export type ClimateAggregate = z.infer<typeof ClimateAggregateZod>;
export type DeviceActionMetric = z.infer<typeof DeviceActionMetricZod>;

export interface ClimateQueryOptions {
  roomIds?: string[];
  from?: Date;
  to?: Date;
  granularity?: Granularity;
}

export interface DeviceActionQueryOptions {
  roomIds?: string[];
  deviceIds?: string[];
  from?: Date;
  to?: Date;
}

export class MetricsPersistenceService {
  constructor(private readonly pool: Pool) {}

  public async recordClimate(
    roomId: string,
    roomName: string,
    temperature: number | null,
    humidity: number | null,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.metrics_climate (room_id, room_name, temperature, humidity)
       VALUES ($1, $2, $3, $4)`,
      [roomId, roomName, temperature, humidity],
    );
  }

  public async recordDeviceAction(
    roomId: string,
    roomName: string,
    deviceId: string,
    actionId: string,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.metrics_device_actions (room_id, room_name, device_id, action_id)
       VALUES ($1, $2, $3, $4)`,
      [roomId, roomName, deviceId, actionId],
    );
  }

  public async queryClimate(
    options: ClimateQueryOptions,
  ): Promise<ClimateAggregate[]> {
    const { roomIds, from, to, granularity = "hour" } = options;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (roomIds?.length) {
      params.push(roomIds);
      conditions.push(`room_id = ANY($${params.length})`);
    }
    if (from) {
      params.push(from);
      conditions.push(`recorded_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`recorded_at <= $${params.length}`);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Whitelist the granularity to prevent injection (date_trunc doesn't accept params)
    const safeGranularity = VALID_GRANULARITIES.includes(granularity)
      ? granularity
      : "hour";

    let query: string;
    if (safeGranularity === "raw") {
      query = `
        SELECT
          recorded_at AS bucket,
          room_id,
          room_name,
          temperature,
          humidity
        FROM public.metrics_climate
        ${where}
        ORDER BY bucket ASC
      `;
    } else {
      query = `
        SELECT
          date_trunc('${safeGranularity}', recorded_at) AS bucket,
          room_id,
          room_name,
          AVG(temperature)::numeric AS temperature,
          AVG(humidity)::numeric AS humidity
        FROM public.metrics_climate
        ${where}
        GROUP BY bucket, room_id, room_name
        ORDER BY bucket ASC
      `;
    }

    const { rows } = await this.pool.query(query, params);
    return rows.map((row) => ClimateAggregateZod.parse(row));
  }

  public async queryDeviceActions(
    options: DeviceActionQueryOptions,
  ): Promise<DeviceActionMetric[]> {
    const { roomIds, deviceIds, from, to } = options;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (roomIds?.length) {
      params.push(roomIds);
      conditions.push(`room_id = ANY($${params.length})`);
    }
    if (deviceIds?.length) {
      params.push(deviceIds);
      conditions.push(`device_id = ANY($${params.length})`);
    }
    if (from) {
      params.push(from);
      conditions.push(`recorded_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`recorded_at <= $${params.length}`);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await this.pool.query(
      `SELECT id, recorded_at, room_id, room_name, device_id, action_id
       FROM public.metrics_device_actions
       ${where}
       ORDER BY recorded_at ASC`,
      params,
    );

    return rows.map((row) => DeviceActionMetricZod.parse(row));
  }
}
