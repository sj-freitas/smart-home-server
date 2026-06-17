import { z } from "zod";

export const TuyaDeviceCommandResultZod = z.object({
  result: z.boolean().readonly(),
  success: z.boolean().readonly(),
  t: z.number().readonly(),
  tid: z.string().readonly(),
});
export const TuyaDeviceStatusZod = z.object({
  result: z
    .array(
      z.object({
        code: z.string().readonly(),
        value: z.boolean().readonly(),
      }),
    )
    .readonly(),
  success: z.boolean().readonly(),
  t: z.number().readonly(),
  tid: z.string().readonly(),
});

export const TuyaDeviceStatusSimpleZod = z.object({
  code: z.string(),
  value: z.boolean(),
});

export const TuyaDeviceZod = z.object({
  id: z.string(),
  status: z.array(TuyaDeviceStatusSimpleZod),
});

export const TuyaBatchStatusResponseZod = z.object({
  result: z.array(TuyaDeviceZod),
  success: z.boolean(),
  t: z.number(),
  tid: z.string(),
});

export type TuyaDeviceStatusSimple = z.infer<typeof TuyaDeviceStatusSimpleZod>;
export type TuyaDevice = z.infer<typeof TuyaDeviceZod>;
export type TuyaBatchStatusResponse = z.infer<
  typeof TuyaBatchStatusResponseZod
>;
export type TuyaDeviceCommandResult = z.infer<
  typeof TuyaDeviceCommandResultZod
>;
export type TuyaDeviceStatus = z.infer<typeof TuyaDeviceStatusZod>;
