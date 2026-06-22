import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthGuard } from "../services/auth.guard";
import {
  MetricsPersistenceService,
  Granularity,
} from "./metrics.persistence.service";

const GranularityZod = z
  .enum(["raw", "minute", "hour", "day", "week", "month"] as const)
  .default("hour");

// Normalize a query param that may arrive as a single string or an array
const StringArrayZod = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) =>
    v === undefined ? undefined : Array.isArray(v) ? v : [v],
  );

const ClimateQueryZod = z.object({
  roomIds: StringArrayZod,
  from: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  to: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  granularity: GranularityZod.optional(),
});

const ActionsQueryZod = z.object({
  roomIds: StringArrayZod,
  deviceIds: StringArrayZod,
  from: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  to: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
});

@Controller("api/metrics")
@UseGuards(AuthGuard)
export class MetricsController {
  constructor(
    private readonly metricsPersistenceService: MetricsPersistenceService,
  ) {}

  @Get("/climate")
  public async getClimateMetrics(@Query() query: unknown) {
    const parsed = ClimateQueryZod.parse(query);
    const rows = await this.metricsPersistenceService.queryClimate({
      ...parsed,
      granularity: parsed.granularity as Granularity | undefined,
    });

    const grouped = new Map<
      string,
      { roomId: string; roomName: string; data: object[] }
    >();
    for (const row of rows) {
      if (!grouped.has(row.roomId)) {
        grouped.set(row.roomId, {
          roomId: row.roomId,
          roomName: row.roomName,
          data: [],
        });
      }
      grouped.get(row.roomId)!.data.push({
        timestamp: row.bucket.toISOString(),
        temperature: row.temperature,
        humidity: row.humidity,
      });
    }

    return { series: Array.from(grouped.values()) };
  }

  @Get("/actions")
  public async getDeviceActionMetrics(@Query() query: unknown) {
    const parsed = ActionsQueryZod.parse(query);
    const events =
      await this.metricsPersistenceService.queryDeviceActions(parsed);

    return {
      events: events.map((e) => ({
        roomId: e.roomId,
        roomName: e.roomName,
        deviceId: e.deviceId,
        actionId: e.actionId,
        recordedAt: e.recordedAt.toISOString(),
      })),
    };
  }
}
