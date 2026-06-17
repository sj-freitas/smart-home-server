import { Controller, Get, HttpCode, Query } from "@nestjs/common";
import { HueOAuth2ClientService } from "../oauth2/hue-oauth2.client.service";
import { HueOAuth2PersistenceService } from "../oauth2/hue-oauth2.persistence.service";
import { HueClient } from "../hue.client";

@Controller()
export class HueController {
  constructor(
    private readonly hueClient: HueClient,
    private readonly hueOauth2Service: HueOAuth2ClientService,
    private readonly huePersistenceService: HueOAuth2PersistenceService,
  ) {}

  @Get("api/auth/oauth2-hue")
  @HttpCode(200)
  public async oauth2(@Query("code") code: string) {
    console.log(`OAuth2 Hue endpoint hit code = ${code}`);

    const accessToken = await this.hueOauth2Service.getAccessToken(code);
    this.huePersistenceService.storeTokens(accessToken);

    return {
      nextSteps:
        `Hue OAuth2 tokens stored successfully. However, you need to do the following ` +
        `request to link the bridge. Press the Bridge Physical Link Button and run the following CURL:` +
        `curl -X POST "https://api.meethue.com/bridge" \
  -H "Authorization: Bearer ${accessToken.accessToken}" \
  -H "Content-Type: application/json" \
  -d '{"devicetype":"my_server#your_name"}'`,
      finalSteps:
        `After you should get a JSON with a success.username. Store that username in your ` +
        `HueCloudIntegration configuration as the 'bridgeUsername' field.`,
      codeConsumed: code,
    };
  }

  @Get("api/sandbox/hue-lights")
  public async getHueLightsState() {
    // Very useful to get the HUE light configs to create presets.
    const result = await this.hueClient.getLights();

    if (result === null) {
      return {
        error:
          "Could not fetch lights. This might be because the bridge is offline or we are rate-limited.",
      };
    }

    return result;
  }
}
