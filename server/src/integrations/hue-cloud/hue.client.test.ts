import { HueClient } from './hue.client';
import { HueCloudIntegration } from '../../config/integration.zod';
import { HueOAuth2PersistenceService } from './oauth2/hue-oauth2.persistence.service';
import { HueOAuth2ClientService } from './oauth2/hue-oauth2.client.service';
import { HueOauth2Tokens } from './oauth2/hue-oauth2.types.zod';

// Expose the spy so tests can control what fetchWithRetries returns.
// The factory runs before module load, so `fn` is captured by `withRetries` call inside hue.client.ts.
jest.mock('../../helpers/retry', () => {
  const fn = jest.fn();
  return { withRetries: () => fn, _fn: fn };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockFetch: jest.Mock = require('../../helpers/retry')._fn;

const FUTURE = Date.now() + 10_000_000;

const mockTokens: HueOauth2Tokens = {
  accessToken: 'test-access-token',
  accessTokenExpiresIn: String(FUTURE),
  expiresIn: 10000,
  refreshToken: 'test-refresh-token',
  refreshTokenExpiresIn: String(FUTURE),
  tokenType: 'bearer',
};

const mockConfig: HueCloudIntegration = {
  name: 'hue_cloud',
  apiUrl: 'https://api.meethue.com',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://redirect.uri',
  bridgeUsername: 'bridge-user',
};

function makeClient() {
  const persistenceService = {
    retrieveTokens: jest.fn().mockResolvedValue({
      tokens: mockTokens,
      storedAt: 0,
    }),
    storeTokens: jest.fn(),
  } as unknown as HueOAuth2PersistenceService;

  const client = new HueClient(mockConfig, {} as HueOAuth2ClientService, persistenceService);
  return { client };
}

describe('HueClient.getLights', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('returns null when the API responds with a non-200 status', async () => {
    mockFetch.mockResolvedValue({
      status: 401,
      text: jest.fn().mockResolvedValue('Unauthorized'),
    });

    const { client } = makeClient();
    const result = await client.getLights();

    expect(result).toBeNull();
  });

  it('returns null for any non-200 status code (e.g. 500)', async () => {
    mockFetch.mockResolvedValue({
      status: 500,
      text: jest.fn().mockResolvedValue('Internal Server Error'),
    });

    const { client } = makeClient();
    const result = await client.getLights();

    expect(result).toBeNull();
  });

  it('returns parsed lights when the API responds with 200', async () => {
    const apiResponse = {
      '1': {
        state: { on: true, bri: 254, reachable: true },
        swupdate: { state: 'noupdates', lastinstall: '2024-01-01T00:00:00' },
        type: 'Extended color light',
        name: 'Bedroom',
        modelid: 'LCT007',
        manufacturername: 'Signify Netherlands B.V.',
        productname: 'Hue color lamp',
        capabilities: {
          certified: true,
          control: {
            mindimlevel: 5000,
            maxlumen: 800,
            colorgamuttype: 'B',
            colorgamut: [[0.675, 0.322], [0.409, 0.518], [0.167, 0.04]],
            ct: { min: 153, max: 500 },
          },
          streaming: { renderer: true, proxy: false },
        },
        config: {
          archetype: 'sultanbulb',
          function: 'mixed',
          direction: 'omnidirectional',
          startup: { mode: 'safety', configured: true },
        },
        uniqueid: 'aa:bb:cc:dd',
        swversion: '1.50.1_r',
        swconfigid: 'abc',
        productid: 'Philips-LCT007',
      },
    };

    mockFetch.mockResolvedValue({
      status: 200,
      json: jest.fn().mockResolvedValue(apiResponse),
    });

    const { client } = makeClient();
    const result = await client.getLights();

    expect(result).not.toBeNull();
    expect(result!['1'].name).toBe('Bedroom');
  });

  it('returns null and logs rate-limit info when the API responds with 429', async () => {
    const headers = new Map([
      ['x-ratelimit-limit', '50000, 50000;w=86400'],
      ['x-ratelimit-reset', '60418'],
    ]);

    mockFetch.mockResolvedValue({
      status: 429,
      headers: { get: (key: string) => headers.get(key) ?? null },
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = makeClient();
    const result = await client.getLights();

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('50000 req/24h'),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('resets in:'),
    );
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('remaining'),
    );
    warnSpy.mockRestore();
  });

  it('throws when bridgeUsername is missing', async () => {
    const configWithoutBridge: HueCloudIntegration = { ...mockConfig, bridgeUsername: undefined };
    const client = new HueClient(configWithoutBridge, {} as HueOAuth2ClientService, {
      retrieveTokens: jest.fn(),
    } as unknown as HueOAuth2PersistenceService);

    await expect(client.getLights()).rejects.toThrow('bridgeUsername');
  });
});
