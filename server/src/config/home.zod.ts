import { z } from "zod";
import { IntegrationDeviceTypesZod } from "./integration.zod";

export const RoomDeviceTypesZod = z.union([
  z.literal("air_conditioner"),
  z.literal("smart_switch"),
  z.literal("smart_light"),
  z.literal("temperature_humidity_sensor"),
]);

export const OnActionTypeNamesZod = z.union([z.literal("timer")]);
export type OnActionTypeNames = z.infer<typeof OnActionTypeNamesZod>;

export const TimerOnActionZod = z.object({
  type: z.literal("timer"),
  parameters: z
    .object({
      durationInMinutes: z.number().positive().readonly(),
      action: z.string().readonly(),
    })
    .readonly(),
});

export const OnActionZod = z.discriminatedUnion("type", [TimerOnActionZod]);

export const DeviceActionZod = z.object({
  id: z.string().readonly(),
  name: z.string().readonly(),
  // Ideally we would have specific types here based on the deviceType and integrationType name
  parameters: z
    .unknown()
    .readonly()
    .describe(
      "Parameters for the action, if any - these are only validated at run time for specific devices.",
    )
    .optional(),
  onAction: z.array(OnActionZod).optional().readonly(),
});

export const RoomDeviceConfigZod = z.object({
  id: z.string().readonly(),
  icon: z.string().readonly().optional(),
  name: z.string().readonly(),
  type: RoomDeviceTypesZod.readonly(),
  integration: IntegrationDeviceTypesZod.readonly(),
  actions: z.array(DeviceActionZod).readonly().optional().default([]),
});

export const RoomConfigZod = z.object({
  id: z.string().readonly(),
  name: z.string().readonly(),
  icon: z.string().readonly().optional(),
  roomInfo: z
    .object({
      temperatureDeviceId: z.string().optional().readonly(),
      humidityDeviceId: z.string().optional().readonly(),
    })
    .optional()
    .readonly(),
  devices: z.array(RoomDeviceConfigZod).readonly(),
});

export const HomeConfigZod = z.object({
  pageTitle: z.string().optional().readonly(),
  name: z.string().readonly(),
  subTitle: z.string().optional().readonly(),
  rooms: z.array(RoomConfigZod).readonly(),
  ip: z.string().readonly().optional(),
  iconUrl: z.string().readonly().optional(),
  faviconUrl: z.string().readonly().optional(),
});

export type TimerOnAction = z.infer<typeof TimerOnActionZod>;
export type OnAction = z.infer<typeof OnActionZod>;
export type DeviceAction = z.infer<typeof DeviceActionZod>;
export type RoomDeviceTypes = z.infer<typeof RoomDeviceTypesZod>;
export type RoomDeviceConfig = z.infer<typeof RoomDeviceConfigZod>;
export type RoomConfig = z.infer<typeof RoomConfigZod>;
export type HomeConfig = z.infer<typeof HomeConfigZod>;
