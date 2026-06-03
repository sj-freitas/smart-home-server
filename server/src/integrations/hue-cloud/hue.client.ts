import { HueCloudIntegration } from "../../config/integration.zod";
import { HueOAuth2PersistenceService } from "./oauth2/hue-oauth2.persistence.service";
import { HueOauth2Tokens } from "./oauth2/hue-oauth2.types.zod";
import { isTokenActive } from "../../helpers/token-expiration-checker";
import { HueOAuth2ClientService } from "./oauth2/hue-oauth2.client.service";
import {
  HueLightsResponse,
  HueLightsResponseZod,
  HueLightsStateResponses,
  HueLightsStateResponsesZod,
  LightState,
} from "./hue.types.zod";
import { withRetries } from "../../helpers/retry";

const fetchWithRetries = withRetries(fetch);

export class HueClient {
  /**
   * URL to start the OAuth2 flow with Hue.
   * This will generate a code and the user needs to hit the /api/auth/oauth2-hue endpoint with that code.
   * The code will be automatically exchanged for tokens.
   */
  private readonly HUE_OAUTH2_URL: string;

  /**
   * In Flight to avoid multiple promises resolving the same thing.
   * Not a very big concern but this approach only works with a single instance of the application.
   * A more robust solution would be implementing a distributed lock.
   */
  private refreshInFlight: Promise<HueOauth2Tokens> | null = null;

  constructor(
    private readonly hueCloudConfig: HueCloudIntegration,
    private readonly hueOauth2ClientService: HueOAuth2ClientService,
    private readonly hueOauth2PersistenceService: HueOAuth2PersistenceService,
  ) {
    this.HUE_OAUTH2_URL =
      `${this.hueCloudConfig.apiUrl}/oauth2/auth?client_id=${this.hueCloudConfig.clientId}&` +
      `response_type=code&scope=remote_control&redirect_uri=${this.hueCloudConfig.redirectUri}`;
  }

  private async getOrRefreshAccessTokenIfNeeded(): Promise<HueOauth2Tokens> {
    const currentTokens =
      await this.hueOauth2PersistenceService.retrieveTokens();
    if (
      // Cannot refresh the access token if the refresh token is expired
      // Need to re-authorize via user flow.
      !isTokenActive(
        Number.parseInt(currentTokens.tokens.refreshTokenExpiresIn) +
          currentTokens.storedAt,
        60_000,
      )
    ) {
      throw new Error(
        `Refresh token expired, re-authorization required. Please go to: ${this.HUE_OAUTH2_URL} and follow the steps.`,
      );
    }

    // access token still valid?
    if (
      isTokenActive(
        Number.parseInt(currentTokens.tokens.accessTokenExpiresIn) +
          currentTokens.storedAt,
      )
    ) {
      return currentTokens.tokens;
    }

    // If a refresh is already happening, return that promise (single-flight)
    if (this.refreshInFlight) {
      try {
        return await this.refreshInFlight;
      } catch (err) {
        // previous refresh failed — clear and propagate
        this.refreshInFlight = null;
        throw err;
      }
    }

    // Start refresh and save the promise so others can await it
    this.refreshInFlight = (async () => {
      try {
        const newTokens = await this.hueOauth2ClientService.refreshAccessToken(
          currentTokens.tokens,
        );
        await this.hueOauth2PersistenceService.storeTokens(newTokens);
        return newTokens;
      } finally {
        // ensure we clear even on error (so future attempts can retry)
        this.refreshInFlight = null;
      }
    })();

    return await this.refreshInFlight;
  }

  public async getLights(): Promise<HueLightsResponse | null> {
    if (!this.hueCloudConfig.bridgeUsername) {
      throw new Error(
        `You are missing the bridgeUsername configuration field in HueCloudIntegration. ` +
          `Please follow the OAuth2 flow to get the bridge username. Go to ${this.HUE_OAUTH2_URL} and follow the steps.`,
      );
    }

    const { accessToken } = await this.getOrRefreshAccessTokenIfNeeded();
    const response = await fetchWithRetries(
      `${this.hueCloudConfig.apiUrl}/bridge/${this.hueCloudConfig.bridgeUsername}/lights`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (response.status !== 200) {
      console.warn(`Hue Error:`, await response.text(), `Try restarting the bridge or waiting for a bit if you are being rate limited.`);
      return null;
    }

    const lights = await response.json();
    const parsedLights = HueLightsResponseZod.parse(lights);

    return parsedLights;
  }

  public async setLightState(
    lightId: string,
    state: LightState,
  ): Promise<HueLightsStateResponses> {
    if (!this.hueCloudConfig.bridgeUsername) {
      throw new Error(
        `You are missing the bridgeUsername configuration field in HueCloudIntegration. ` +
          `Please follow the OAuth2 flow to get the bridge username. Go to ${this.HUE_OAUTH2_URL} and follow the steps.`,
      );
    }

    const { accessToken } = await this.getOrRefreshAccessTokenIfNeeded();
    const response = await fetchWithRetries(
      `${this.hueCloudConfig.apiUrl}/bridge/${this.hueCloudConfig.bridgeUsername}/lights/${lightId}/state`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(state),
      },
    );

    const result = await response.json();
    const parsedResult = HueLightsStateResponsesZod.parse(result);

    return parsedResult;
  }
}
