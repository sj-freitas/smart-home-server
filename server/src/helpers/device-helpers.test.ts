import { DeviceHelper } from './device-helpers';
import { HomeConfig } from '../config/home.zod';
import { ShellyIntegrationDevice } from '../config/integration.zod';

const mockHome: HomeConfig = {
  name: 'Test Home',
  rooms: [
    {
      id: 'living-room',
      name: 'Living Room',
      devices: [
        {
          id: 'light-1',
          name: 'Main Light',
          type: 'smart_light',
          integration: { name: 'shelly', id: 'shelly-abc' },
          actions: [],
        },
        {
          id: 'switch-1',
          name: 'Power Strip',
          type: 'smart_switch',
          integration: { name: 'shelly', id: 'shelly-xyz' },
          actions: [],
        },
      ],
    },
    {
      id: 'bedroom',
      name: 'Bedroom',
      devices: [
        {
          id: 'ac-1',
          name: 'Air Conditioner',
          type: 'air_conditioner',
          integration: { name: 'mel_cloud_home', deviceId: 'mel-111' },
          actions: [],
        },
      ],
    },
  ],
};

describe('DeviceHelper', () => {
  let helper: DeviceHelper;

  beforeEach(() => {
    helper = new DeviceHelper(mockHome);
  });

  describe('getDevice', () => {
    it('returns device by full room/device path', () => {
      const device = helper.getDevice('living-room/light-1');
      expect(device).not.toBeNull();
      expect(device!.name).toBe('Main Light');
    });

    it('returns null for an unknown device path', () => {
      expect(helper.getDevice('living-room/nonexistent')).toBeNull();
    });

    it('returns null for an unknown room', () => {
      expect(helper.getDevice('kitchen/light-1')).toBeNull();
    });

    it('distinguishes devices across rooms with the same device id', () => {
      const device = helper.getDevice('bedroom/ac-1');
      expect(device!.type).toBe('air_conditioner');
    });
  });

  describe('getDeviceFromIntegration', () => {
    it('finds a device matching integration name and picker predicate', () => {
      const path = helper.getDeviceFromIntegration<ShellyIntegrationDevice>('shelly', (d) => d.id === 'shelly-abc');
      expect(path).toBe('living-room/light-1');
    });

    it('returns the first device when picker matches multiple', () => {
      const path = helper.getDeviceFromIntegration<ShellyIntegrationDevice>('shelly', () => true);
      expect(path).not.toBeNull();
    });

    it('returns null when no device matches the picker', () => {
      const path = helper.getDeviceFromIntegration<ShellyIntegrationDevice>('shelly', (d) => d.id === 'does-not-exist');
      expect(path).toBeNull();
    });

    it('returns null when no device belongs to the given integration', () => {
      const path = helper.getDeviceFromIntegration('hue_cloud', () => true);
      expect(path).toBeNull();
    });
  });
});
