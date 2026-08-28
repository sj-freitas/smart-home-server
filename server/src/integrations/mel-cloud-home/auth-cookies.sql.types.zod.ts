import { z } from "zod";

export const MelCloudAuthCookiesRowZod = z.object({
  id: z.string().readonly(),
  created_at: z.coerce.date().readonly(),
  cookies: z.string().readonly(),
});

export type MelCloudAuthCookiesRow = z.infer<typeof MelCloudAuthCookiesRowZod>;
