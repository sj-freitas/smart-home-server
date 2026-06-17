import { z } from "zod";

export const HueOauth2TokensZod = z
  .object({
    access_token: z.string(),
    access_token_expires_in: z.string(),
    expires_in: z.number(),
    refresh_token: z.string(),
    refresh_token_expires_in: z.string(),
    token_type: z.string(),
  })
  .transform((data) => ({
    accessToken: data.access_token,
    accessTokenExpiresIn: data.access_token_expires_in,
    expiresIn: data.expires_in,
    refreshToken: data.refresh_token,
    refreshTokenExpiresIn: data.refresh_token_expires_in,
    tokenType: data.token_type,
  }));

export type HueOauth2Tokens = z.infer<typeof HueOauth2TokensZod>;
