import { z } from "zod";
import { RoomDeviceTypesZod } from "../../config/home.zod";

export const DeviceActionZod = z.object({
  id: z.string(),
  name: z.string(),
});

export const DeviceStateZod = z.object({
  id: z.string(),
  roomId: z.string(),
  name: z.string().optional(),
  icon: z.string().optional(),
  type: RoomDeviceTypesZod.optional(),
  actions: z.array(DeviceActionZod).optional(),

  // The actual data for the state
  state: z.union([z.literal("off"), z.string()]).optional(),
  temperature: z.number().nullable().optional(),
  humidity: z.number().nullable().optional(),
  online: z.boolean().optional(),
});

export const RoomStateZod = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  temperature: z.number().nullable().optional().default(null),
  humidity: z.number().nullable().optional().default(null),
  devices: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      icon: z.string(),
      type: RoomDeviceTypesZod,
      actions: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
        }),
      ),
      state: z.string(),
      online: z.boolean(),
    }),
  ),
});

export const HomeStateZod = z.object({
  name: z.string(),
  pageTitle: z.string(),
  logo: z.string(),
  faviconUrl: z.string(),
  bannerUrl: z.string().optional().default(""),
  subTitle: z.string(),
  rooms: z.array(RoomStateZod),
});

export type DeviceAction = z.infer<typeof DeviceActionZod>;
export type DeviceState = z.infer<typeof DeviceStateZod>;
export type RoomState = z.infer<typeof RoomStateZod>;
export type HomeState = z.infer<typeof HomeStateZod>;
