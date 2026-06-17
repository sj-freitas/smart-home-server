import { MelCloudHomeClient } from "./client";
import { MelCloudAuthCookiesPersistenceService } from "./auth-cookies.persistence.service";

const API_URL = "https://mel-cloud.example.com";
const AUTH_COOKIE = "session=abc123";
const FRESH_COOKIE = "session=xyz789";

const minimalUnit = {
  id: "device-1",
  givenDisplayName: "Living Room",
  displayIcon: "LivingRoom",
  unitSettings: null,
  settings: [
    { name: "Power", value: "True" },
    { name: "OperationMode", value: "Cool" },
    { name: "SetFanSpeed", value: "Auto" },
    { name: "SetTemperature", value: "22" },
    { name: "VaneHorizontalDirection", value: "Auto" },
    { name: "VaneVerticalDirection", value: "Auto" },
    { name: "RoomTemperature", value: "24" },
  ],
  schedule: [],
  isInError: false,
  scheduleEnabled: false,
  connectedInterfaceIdentifier: "abc",
  capabilities: {
    isMultiSplitSystem: false,
    isLegacyDevice: false,
    hasStandby: false,
    hasCoolOperationMode: true,
    hasHeatOperationMode: true,
    hasAutoOperationMode: true,
    hasDryOperationMode: false,
    hasAutomaticFanSpeed: true,
    hasAirDirection: true,
    hasSwing: false,
    hasExtendedTemperatureRange: false,
    hasEnergyConsumedMeter: false,
    numberOfFanSpeeds: 5,
    minTempCoolDry: 16,
    maxTempCoolDry: 31,
    minTempHeat: 10,
    maxTempHeat: 31,
    minTempAutomatic: 16,
    maxTempAutomatic: 31,
    hasDemandSideControl: false,
    hasHalfDegreeIncrements: true,
    supportsWideVane: false,
  },
  rssi: -50,
  timeZone: "Europe/Lisbon",
  frostProtection: null,
  overheatProtection: null,
  holidayMode: null,
  isConnected: true,
  connectedInterfaceType: 0,
  systemId: "sys-1",
  energyProducedOptIn: false,
  isEnergyUsageCompatible: false,
};

function makeJsonResponse(buildings: object[]) {
  return { status: 200, json: jest.fn().mockResolvedValue({ buildings }) };
}

function makeClient(
  authOverrides: Partial<MelCloudAuthCookiesPersistenceService> = {},
  forceRefresh: (() => Promise<void>) | null = null,
) {
  const authCookies = {
    retrieveAuthCookies: jest.fn().mockResolvedValue(AUTH_COOKIE),
    storeAuthCookies: jest.fn(),
    ...authOverrides,
  } as unknown as MelCloudAuthCookiesPersistenceService;

  return {
    client: new MelCloudHomeClient(authCookies, forceRefresh, API_URL),
    authCookies,
  };
}

describe("MelCloudHomeClient.getContext", () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, "fetch" as never);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("returns empty array when the API responds with a non-200 status", async () => {
    fetchSpy.mockResolvedValue({
      status: 503,
      text: jest.fn().mockResolvedValue(""),
    });

    const { client } = makeClient();
    const result = await client.getContext();

    expect(result).toEqual([]);
  });

  it("returns mapped devices when buildings are populated", async () => {
    fetchSpy.mockResolvedValue(
      makeJsonResponse([{ airToAirUnits: [minimalUnit] }]),
    );

    const { client } = makeClient();
    const result = await client.getContext();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("device-1");
    expect(result[0].room.temperature).toBe(24);
    expect(result[0].power).toBe(true);
  });

  it("throws when auth cookie is missing", async () => {
    const { client } = makeClient({
      retrieveAuthCookies: jest.fn().mockResolvedValue(null),
    });

    await expect(client.getContext()).rejects.toThrow(
      "Unexpected missing Auth cookie",
    );
  });

  it("returns empty array when buildings is empty and forceRefresh is null", async () => {
    fetchSpy.mockResolvedValue(makeJsonResponse([]));

    const { client } = makeClient();
    const result = await client.getContext();

    expect(result).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("retries after forceRefresh when buildings is empty and returns devices from retry", async () => {
    const forceRefresh = jest.fn().mockResolvedValue(undefined);
    const retrieveAuthCookies = jest
      .fn()
      .mockResolvedValueOnce(AUTH_COOKIE)
      .mockResolvedValueOnce(FRESH_COOKIE);

    fetchSpy
      .mockResolvedValueOnce(makeJsonResponse([]))
      .mockResolvedValueOnce(
        makeJsonResponse([{ airToAirUnits: [minimalUnit] }]),
      );

    const { client } = makeClient({ retrieveAuthCookies }, forceRefresh);
    const result = await client.getContext();

    expect(forceRefresh).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("device-1");
  });

  it("uses the fresh cookie on the retry request", async () => {
    const forceRefresh = jest.fn().mockResolvedValue(undefined);
    const retrieveAuthCookies = jest
      .fn()
      .mockResolvedValueOnce(AUTH_COOKIE)
      .mockResolvedValueOnce(FRESH_COOKIE);

    fetchSpy
      .mockResolvedValueOnce(makeJsonResponse([]))
      .mockResolvedValueOnce(
        makeJsonResponse([{ airToAirUnits: [minimalUnit] }]),
      );

    const { client } = makeClient({ retrieveAuthCookies }, forceRefresh);
    await client.getContext();

    const retryCall = fetchSpy.mock.calls[1];
    expect(retryCall[1].headers.Cookie).toBe(FRESH_COOKIE);
  });

  it("exhausts all retries when forceRefresh always returns empty buildings", async () => {
    const forceRefresh = jest.fn().mockResolvedValue(undefined);
    const retrieveAuthCookies = jest
      .fn()
      .mockResolvedValueOnce(AUTH_COOKIE)
      .mockResolvedValue(FRESH_COOKIE);

    fetchSpy.mockResolvedValue(makeJsonResponse([]));

    const { client } = makeClient({ retrieveAuthCookies }, forceRefresh);
    const result = await client.getContext();

    // withRetries(fn, 1) = 2 total attempts (1 initial + 1 retry)
    expect(forceRefresh).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result).toEqual([]);
  });

  it("exhausts all retries when forceRefresh always responds with non-200", async () => {
    const forceRefresh = jest.fn().mockResolvedValue(undefined);
    const retrieveAuthCookies = jest
      .fn()
      .mockResolvedValueOnce(AUTH_COOKIE)
      .mockResolvedValue(FRESH_COOKIE);

    fetchSpy.mockResolvedValueOnce(makeJsonResponse([])).mockResolvedValue({
      status: 401,
      text: jest.fn().mockResolvedValue("Unauthorized"),
    });

    const { client } = makeClient({ retrieveAuthCookies }, forceRefresh);
    const result = await client.getContext();

    // withRetries(fn, 1) = 2 total attempts (1 initial + 1 retry)
    expect(forceRefresh).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result).toEqual([]);
  });

  it("exhausts all retries when fresh cookie is always null after refresh", async () => {
    const forceRefresh = jest.fn().mockResolvedValue(undefined);
    const retrieveAuthCookies = jest
      .fn()
      .mockResolvedValueOnce(AUTH_COOKIE)
      .mockResolvedValue(null);

    fetchSpy.mockResolvedValueOnce(makeJsonResponse([]));

    const { client } = makeClient({ retrieveAuthCookies }, forceRefresh);
    const result = await client.getContext();

    // withRetries(fn, 1) = 2 total attempts (1 initial + 1 retry); fetch never called on null cookie
    expect(forceRefresh).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  it("deduplicates concurrent forceRefresh calls — only one Puppeteer session runs at a time", async () => {
    let resolveRefresh!: () => void;
    const refreshPromise = new Promise<void>((res) => {
      resolveRefresh = res;
    });
    const forceRefresh = jest.fn().mockReturnValue(refreshPromise);
    const retrieveAuthCookies = jest
      .fn()
      .mockResolvedValueOnce(AUTH_COOKIE)
      .mockResolvedValueOnce(AUTH_COOKIE)
      .mockResolvedValue(FRESH_COOKIE);

    fetchSpy
      .mockResolvedValueOnce(makeJsonResponse([]))
      .mockResolvedValueOnce(makeJsonResponse([]))
      .mockResolvedValue(makeJsonResponse([{ airToAirUnits: [minimalUnit] }]));

    const { client } = makeClient({ retrieveAuthCookies }, forceRefresh);

    // Fire two concurrent getContext calls while the first refresh is still in flight
    const [r1, r2] = await Promise.all([
      client.getContext(),
      client.getContext(),
      // Unblock the shared refresh after both calls are waiting on it
      Promise.resolve().then(() => resolveRefresh()),
    ]);

    // forceRefresh should have been called exactly once despite two concurrent callers
    expect(forceRefresh).toHaveBeenCalledTimes(1);
    expect(r1).toHaveLength(1);
    expect(r2).toHaveLength(1);
  });
});
