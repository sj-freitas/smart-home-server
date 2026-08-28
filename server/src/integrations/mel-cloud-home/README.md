# MEL Cloud Home

This integration **is not officially supported in any form by MEL Cloud Home, use at own risk!**.

There is a [decent API](https://melcloudhome.com/api) developed by Mitsubishi Electric but it doesn't include a server-to-server login flow. The current way that the server authenticates is by using a [puppeteer bot](./authorization-cookies.ts). The Auth cookies are then persisted in the `mel_cloud_home_auth_cookies` table (see [auth-cookies.persistence.service.ts](./auth-cookies.persistence.service.ts)).

## Integration config

On the `json.config` file, in the integrations array add:

```json
{
  "name": "mel_cloud_home",
  "siteUrl": "https://melcloudhome.com",
  "apiUrl": "https://melcloudhome.com/api",
  "username": "{{MEL_CLOUD_HOME_USERNAME}}",
  "password": "{{MEL_CLOUD_HOME_PASSWORD}}"
},
```

## Device Types Supported

For each type there's a set of different supported parameters in the config:

Integration Schema:

```ts
type HueIntegration = {
  name: "mel_cloud_home";
  deviceId: string;
};
```

To find the IDs the API supports a sandbox endpoint: `http://localhost:3001/api/sandbox/mel-cloud-home-context`.

### Air Conditioners

These devices can be used for the `room.roomInfo` data:

```json
"roomInfo": {
  "temperatureDeviceId": "{room}/{device}"
}
```

device.type: `air_conditioner`
parameters schema:

```ts
type Action = {
  id: string;
  name: string;
  parameters: AirConditionerStateParameters;
}

type AirConditionerStateParameters = {
    power?: boolean;
    operationMode?: "Heat" | "Cool" | "Fan" | "Dry" | "Automatic";
    setFanSpeed?: "One" | "Two" | "Three" | "Four" | "Five" | "Auto";
    vaneHorizontalDirection?: "Auto" | "Left" | "LeftCentre" | "Centre" | "RightCentre" | "Right" | "Swing";
    vaneVerticalDirection?: "One" | "Two" | "Three" | "Four" | "Five" | "Auto" | "Swing";
    setTemperature?: 10 | 30 | 10.5 | 11 | 11.5 | 12 | 12.5 | 13 | 13.5 | 14 | 14.5 | 15 | 15.5 | 16 | 16.5 | 17 | 17.5 | 18 | 18.5 | 19 | 19.5 | 20 | 20.5 | 21 | 21.5 | 22 | 22.5 | 23 | 23.5 | 24 | 24.5 | 25 | 25.5 | 26 | 26.5 | 27 | 27.5 | ... 5 more ... | 31;
}
```

### Example Device Config

```json
{
  "id": "ac",
  "name": "Air Conditioner",
  "icon": "air_conditioner",
  "type": "air_conditioner",
  "integration": {
    "name": "mel_cloud_home",
    "deviceId": "{mel_cloud_home_deviceId}"
  },
  "actions": [
    {
      "id": "off",
      "name": "Off",
      "parameters": {
        "power": false,
        "operationMode": null,
        "setFanSpeed": null,
        "vaneHorizontalDirection": null,
        "vaneVerticalDirection": null,
        "setTemperature": null,
        "temperatureIncrementOverride": null,
        "inStandbyMode": null
      }
    },
    {
      "id": "on_heat",
      "name": "Heat",
      "parameters": {
        "power": true,
        "operationMode": "Heat",
        "setFanSpeed": "Auto",
        "vaneHorizontalDirection": "LeftCentre",
        "vaneVerticalDirection": "Two",
        "setTemperature": 27,
        "temperatureIncrementOverride": null,
        "inStandbyMode": null
      }
    },
    {
      "id": "on_cool",
      "name": "Cool",
      "parameters": {
        "power": true,
        "operationMode": "Cool",
        "setFanSpeed": "Auto",
        "vaneHorizontalDirection": "LeftCentre",
        "vaneVerticalDirection": "Two",
        "setTemperature": 21,
        "temperatureIncrementOverride": null,
        "inStandbyMode": null
      }
    }
  ]
}
```
