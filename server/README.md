# Important

The backend reads the config file. Store the file anywhere, you can set the path to it using CONFIG_PATH, it needs to be a JSON file,
the schema is written in zod here: [base-config.zod.ts](./src/config/base-config.zod.ts) the types are all referenced there. Each integration
can have their own types specified within the [integrations directory](./src/integrations).

1. When the app bootstraps it'll read the config file.
2. It'll look for any value marked with `{{ENV_VAR_NAME}}` and it'll replace it as a simple text replacement with the .env var if it exists, otherwise it'll throw an error.
3. Depending on the integrations it'll run the initialization code for that integration i.e. get an auth token, cookies, etc.
4. Integration configs for Actions are only run

## Key Concepts

### Config

The config is the unique source of truth for a home. The config can contain one Home and a Home can contain as many Rooms as you wish.
Any room can have as many Devices as needed. Devices can be shared across rooms, but controlling it in one room will impact other rooms.
The full config is served as a generic version on `http://localhost:3001/api/home` where the IDs are the ones specified on the config, this will be the source of truth.
Check the example / base config at [config.json](./config.json)

### Integration

An integration is an element that specifies what service they are using, each integration has a unique schema. Currently there are only 3 integrations supported and these
are tied to the code, maybe in the future I'll have a different repo for each integration and add them as NPM packages. However this isn't really very important right now,
any fork of this repo can add as many integrations as necessary. Once the API bootstraps the modules are loaded dynamically depending on the `config.json` integrations section,
if the integration isn't specified there, it's not loaded.

Currently these are the supported integrations:

- [Philips Hue](./src/integrations/hue-cloud/README.md)
- [MEL Cloud Home](./src/integrations/mel-cloud-home/README.md)
- [Shelly](./src/integrations/shelly/README.md)
- [Tuya (Nedis Smart Life)](./src/integrations/tuya/README.md) *This integration won't be supported anymore and just exists as an exercise even though it's working*.

### Device

The device that we are trying to control, a device is tied to an integration and can have different fields depending on it.
The device has a list of presets called Actions.

### Action

An action is the operation you can do through a device, Actions are performed through a route such as `http://localhost:3001/{room_id}/{device_id}/{actiomn_id}` and these are all
the ones defined in the config file. Once an Action is performed, the specific Integration will run that action based on the parameters in the config file. This should successfully
result in the state of the Device changing such as, for example, turning on some lights or switching their color.

### Home Info

The Home Info feature stores a markdown description of the home (and any images it references) in the database. The API only serves the raw data — markdown rendering happens client-side, in a dedicated page in [client/](../client), guarded by the same auth flow as the rest of the app.

- `home_id` in the config (`home.homeId`, see [home.zod.ts](./src/config/home.zod.ts)) identifies the home and must match the `:homeId` route param on every request below, otherwise a 404 is returned.
- `home_info` table: each row is a markdown entry for a `home_id`. When more than one entry exists for the same home, the most recently created one is served — insert a new row to publish an update, there is no write API, entries are added directly to the database.
- `home_info_images` table: each row is a base64-encoded JPEG for a `home_id`, keyed by a unique `name` (e.g. `cover.jpg`) — also inserted directly into the database, no write API.
- See migration [00007.migration.sql](./db/00007.migration.sql) for both table definitions.

Routes (both under `/api`, both gated by [AuthGuard](./src/services/auth.guard.ts) — same IP/session/API-key check as the rest of the API, see [Authorization](#authorization) below):

- `GET /api/home-info/:homeId` — returns `{ markdown, updatedAt, bannerUrl }` JSON for the latest entry. `bannerUrl` is read straight from `home.bannerUrl` in the config (not the database) — `null` when not configured.
- `GET /api/static/images/:homeId/:name` — decodes the stored base64 data and serves it as `image/jpeg`. Accepts optional `?width=` and/or `?height=` query params (integers, 1-4000) to resize the image on the fly via [sharp](https://www.npmjs.com/package/sharp), preserving aspect ratio (`fit: "inside"`) — pass just one dimension to scale by that axis alone. Omit both to get the original stored bytes untouched.

Since images are served from the same host, markdown entries (and `home.bannerUrl` in the config) can reference them with an absolute path, e.g. `![Living room](/api/static/images/palais-freitas/cover.jpg)` or `![Living room](/api/static/images/palais-freitas/cover.jpg?width=800)`.

The client renders this at `/home-info/:homeId` (see [home-info-page.tsx](../client/src/home-info-page.tsx)) — markdown → HTML via [marked](https://www.npmjs.com/package/marked), same login-redirect behavior as the main app on a 401.

### Authorization

The API supports 3 ways to access the resources:

1. As long as you are within the same network / IP as the home, make sure to have ip set in the config and AUTH_ALWAYS_DISALLOW_THE_IP=false (default).
2. API Keys are supported using the `Authorization: Bearer {API_KEY}` header, the keys can be generated via a sandbox path `GET 'http://localhost:3001/api/sandbox/generate-api-key'` but then need to be stored individually in the database. Eventually there'll be a back-office or request to do this.
3. Google Auth using the code flow which then stores the access and refresh tokens into the database.
   For either Google Auth or API Key the access can expire, in the case of Google Auth there needs to be an email access set.

For more details see:

- [AuthorizationService](./src/services/auth/authorization.service.ts) Has the core of the authorization logic and integrates with the other services.
- [AuthGuard](./src/services/auth-guard.ts) A [NestJS Guard](https://docs.nestjs.com/guards) that calls the [AuthorizationService](./src/services/auth/authorization.service.ts).
- [GoogleAuthService](./src/services/auth/google-auth.service.ts) Manages the Google integration layer directly with its API or the [Google Auth Library](https://www.npmjs.com/package/google-auth-library).
- [GoogleSessionService](./src/services/auth/google-session.service.ts) Manages the refresh and validation flow of the sessions including storing them via [another service](./src/services/auth/google-session.service.ts).
- [AuthGoogleController](./src/controllers/auth-google/auth-google.controller.ts) Handles the callback and logout flows from the client.

## Env Vars

In the `.env` please include the following Environmental Variables:

```shell
# ENV Vars that do not depend on your config:
PORT=3001 # Defaults to 3001.
CONFIG_PATH="../config.json" # Mandatory, points to your config file. You can use the example one as a base.

# You don't need these but if you use the example ./config.json these are the specified there.
# If you don't version the file you can use the values directly in it.
MEL_CLOUD_HOME_USERNAME=""
MEL_CLOUD_HOME_PASSWORD=""
TUYA_CLOUD_ACCESS_KEY=""
TUYA_CLOUD_SECRET_KEY=""
HUE_CLOUD_CLIENT_ID=""
HUE_CLOUD_SECRET=""
HUE_CLOUD_BRIDGE_USERNAME=""

# Authorization and Authentication env vars, need to be configured.
# However the whole process can be bypassed with AUTH_ALWAYS_DISALLOW_THE_IP="false" locally and in prod. As the local addresses are always allowed without Auth.
AUTH_ALWAYS_DISALLOW_THE_IP="false" # If true it'll always bypass the IP check, meaning that the rest of the Auth will run. Should only be set to true when testing Auth locally.
AUTH_API_KEY_SECRET="" # Used to store and validate API keys.
AUTH_GOOGLE_CLIENT_ID="" # The Google Auth ID check https://console.cloud.google.com/auth/overview
AUTH_GOOGLE_CLIENT_SECRET="" # Google Auth Secret for the Backend only.
AUTH_GOOGLE_URL="https://oauth2.googleapis.com" # The Google Auth API
AUTH_CLIENT_BASE="http://localhost:5173" # The client address.
AUTH_SET_SECURE_COOKIE="false" # Cookie options. Set true in prod
AUTH_SET_DOMAIN_COOKIE="localhost" # Cookie options. Set to the app domain in prod.
AUTH_SET_SAME_SITE_COOKIE="lax" # Cookie options. Set to none in prod.

# Optional Values also dependant on the config.json
APP_HOME_IP="" # It is used to enable the restricted remote mode. Allows only users within the IP to use the app, otherwise it's readonly.
APP_DOMAIN_URL="" # Domain is used for OAuth2 but also for the SSL certification
DATABASE_URL="" # Database is used to persist tokens and user access
MY_HOME_ADDRESS_1= # Address line one to be shown on the app. Please be sure to not version these to not dox yourself!
MY_HOME_ADDRESS_2= # Address line two to be shown on the app. Please be sure to not version these to not dox yourself!
```

# Building

For production build just run `npm run build` and the

# Running

All API routes are served on `/api/`.
Documentation for the routes can be seen using the [Bruno Requests](../smart_home_requests) you can [get Bruno via Homebrew](https://formulae.brew.sh/formula/bruno-cli).
The API is very simple and it also services WebSockets using the `/api/state` route and sockets are served on `/api/socket.io`.

## Running Locally

To run locally simple do `npm run start:dev`. The default port is 3001.

## Running Docker

### Before Building

Make sure that this config matches your machine's platform (or wherever you are hosting)

```yml
app:
  platform: linux/arm64
```

Or you can use the current docker-compose.yml as long as you set the HOST_PLATFORM on your .env
for Mac ARM just set to `"linux/arm64"`.

### Running

Building: `docker compose -f docker-compose.yml --env-file .env up -d --no-deps --build`
It'll run the server and you can access it on the same way as usual. This will run both Client and API on port 3001.
The Client is served as static files on the `/*` route, you can see more on [the StaticController](./src/controllers/static.controller.ts).
