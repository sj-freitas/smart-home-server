import { MelCloudHomeIntegrationService } from './integration.service';
import { MelCloudHomeClient, RoomDevice } from './client';
import { MelCloudAuthCookiesPersistenceService } from './auth-cookies.persistence.service';
import { IntegratedDeviceConfig } from '../integrations-service';
import { MelCloudHomeIntegrationDevice } from '../../config/integration.zod';
import { AirToAirUnit } from './types.zod';

const DEVICE_ID = '5fa0ecbf-2562-401a-be23-cd8a470d9c9d';

const mockDevice: IntegratedDeviceConfig<MelCloudHomeIntegrationDevice> = {
  type: 'air_conditioner',
  info: { name: 'mel_cloud_home', deviceId: DEVICE_ID },
  actions: [
    {
      id: 'cool',
      name: 'Cool',
      parameters: {
        power: true,
        operationMode: 'Cool',
        setFanSpeed: 'Auto',
        setTemperature: 22,
        vaneHorizontalDirection: 'Auto',
        vaneVerticalDirection: 'Auto',
        temperatureIncrementOverride: null,
        inStandbyMode: null,
      },
    },
    {
      id: 'off',
      name: 'Off',
      parameters: {
        power: false,
        operationMode: 'Cool',
        setFanSpeed: 'Auto',
        setTemperature: 22,
        vaneHorizontalDirection: 'Auto',
        vaneVerticalDirection: 'Auto',
        temperatureIncrementOverride: null,
        inStandbyMode: null,
      },
    },
  ],
};

const contextSettings: Record<string, string> = {
  Power: 'True',
  OperationMode: 'Cool',
  SetFanSpeed: 'Auto',
  SetTemperature: '22',
  VaneHorizontalDirection: 'Auto',
  VaneVerticalDirection: 'Auto',
};

const mockRoomDevice: RoomDevice = {
  id: DEVICE_ID,
  room: { name: 'Lisbon', temperature: 27 },
  mode: 'Cool',
  power: true,
  isConnected: true,
  isInError: false,
  settings: contextSettings,
};

const mockAirToAirUnit: AirToAirUnit = {
  id: DEVICE_ID,
  givenDisplayName: 'Lisbon',
  displayIcon: 'Bedroom',
  unitSettings: null,
  settings: [
    { name: 'Power', value: 'True' },
    { name: 'OperationMode', value: 'Cool' },
    { name: 'SetFanSpeed', value: 'Auto' },
    { name: 'SetTemperature', value: '22' },
    { name: 'VaneHorizontalDirection', value: 'Auto' },
    { name: 'VaneVerticalDirection', value: 'Auto' },
    { name: 'RoomTemperature', value: '27' },
  ],
  schedule: [],
  isInError: false,
  scheduleEnabled: false,
  connectedInterfaceIdentifier: '58e403e5aa45',
  capabilities: {
    isMultiSplitSystem: true,
    isLegacyDevice: false,
    hasStandby: true,
    hasCoolOperationMode: true,
    hasHeatOperationMode: true,
    hasAutoOperationMode: true,
    hasDryOperationMode: true,
    hasAutomaticFanSpeed: true,
    hasAirDirection: true,
    hasSwing: true,
    hasExtendedTemperatureRange: true,
    hasEnergyConsumedMeter: true,
    numberOfFanSpeeds: 5,
    minTempCoolDry: 16,
    maxTempCoolDry: 31,
    minTempHeat: 10,
    maxTempHeat: 31,
    minTempAutomatic: 16,
    maxTempAutomatic: 31,
    hasDemandSideControl: true,
    hasHalfDegreeIncrements: true,
    supportsWideVane: true,
  },
  rssi: -42,
  timeZone: 'Europe/Lisbon',
  frostProtection: null,
  overheatProtection: null,
  holidayMode: null,
  isConnected: true,
  connectedInterfaceType: 0,
  systemId: '09cc9b6d-82a0-419a-b6e9-47d5c85898db',
  energyProducedOptIn: false,
  isEnergyUsageCompatible: false,
} as unknown as AirToAirUnit;

function makeService(overrides: { getContext?: jest.Mock; getDevice?: jest.Mock; retrieveAuthCookies?: jest.Mock } = {}) {
  const client = {
    getContext: overrides.getContext ?? jest.fn().mockResolvedValue([mockRoomDevice]),
    getDevice: overrides.getDevice ?? jest.fn().mockResolvedValue(null),
    putAtAUnit: jest.fn().mockResolvedValue(true),
  } as unknown as MelCloudHomeClient;

  const authCookies = {
    retrieveAuthCookies: overrides.retrieveAuthCookies ?? jest.fn().mockResolvedValue('session=abc'),
  } as unknown as MelCloudAuthCookiesPersistenceService;

  return new MelCloudHomeIntegrationService(client, authCookies);
}

describe('MelCloudHomeIntegrationService.consolidateDeviceStates', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns all devices offline when auth cookies are missing', async () => {
    const service = makeService({ retrieveAuthCookies: jest.fn().mockResolvedValue(null) });
    const result = await service.consolidateDeviceStates([mockDevice]);

    expect(result).toEqual([{ online: false, state: 'off', temperature: null, humidity: null }]);
  });

  it('returns device state from context when device is found', async () => {
    const service = makeService();
    const result = await service.consolidateDeviceStates([mockDevice]);

    expect(result).toHaveLength(1);
    expect(result[0].online).toBe(true);
    expect(result[0].state).toBe('cool');
    expect(result[0].temperature).toBe(27);
  });

  it('falls back to getDevice() when context is empty and returns state from direct fetch', async () => {
    const service = makeService({
      getContext: jest.fn().mockResolvedValue([]),
      getDevice: jest.fn().mockResolvedValue(mockAirToAirUnit),
    });
    const result = await service.consolidateDeviceStates([mockDevice]);

    expect(result).toHaveLength(1);
    expect(result[0].online).toBe(true);
    expect(result[0].state).toBe('cool');
    expect(result[0].temperature).toBe(27);
  });

  it('returns offline when context is empty and getDevice() also returns null', async () => {
    const service = makeService({
      getContext: jest.fn().mockResolvedValue([]),
      getDevice: jest.fn().mockResolvedValue(null),
    });
    const result = await service.consolidateDeviceStates([mockDevice]);

    expect(result).toEqual([{ online: false, state: 'off', temperature: null, humidity: null }]);
  });

  it('calls getDevice() with the correct deviceId when falling back', async () => {
    const getDevice = jest.fn().mockResolvedValue(mockAirToAirUnit);
    const service = makeService({ getContext: jest.fn().mockResolvedValue([]), getDevice });

    await service.consolidateDeviceStates([mockDevice]);

    expect(getDevice).toHaveBeenCalledWith(DEVICE_ID);
  });

  it('does not call getDevice() when the device is found in context', async () => {
    const getDevice = jest.fn();
    const service = makeService({ getDevice });

    await service.consolidateDeviceStates([mockDevice]);

    expect(getDevice).not.toHaveBeenCalled();
  });
});
