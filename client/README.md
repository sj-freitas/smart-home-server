# Getting Started

The UI is built using Vite and uses React. Everything is written in Typescript.

The frontend works in a similar way to HATEOAS (although not entirely the same). The main principle is that the API feeds a state from `/api/home` which is fed from the
config file. The sample config file is [here](../server/config.json). The UI will know how to render Rooms (collapsible cards) and Devices (rows).
Each device has a set of presets (actions) which will be rendered as buttons with a state, showing the current preset.
API Calls to any action will follow `/api/actions/{roomId}/{deviceId}/{actionId}`.

## Env Vars

Vite uses a `.env` naming convention:

- `.env.local`: Sets the local development env vars. `VITE_APP_ENV="development"`
- `.env.production`: Sets the production development env vars: `VITE_APP_ENV="production"`
- `VITE_API_HOSTNAME:` The API hostname, locally should be `"http://localhost:3001/api"`
- `VITE_GOOGLE_CLIENT_ID:` The Client Id for authentication. This flow can be bypassed if the API has AUTH_ALWAYS_DISALLOW_THE_IP set to "false".
- `VITE_HOME_SLUG:` The home's `homeId` (must match `home.homeId` in the server's `config.json`). Used to build the link to the Home Info page and as the `:homeId` route param.

## Home Info

`/home-info/:homeId` ([home-info-page.tsx](./src/home-info-page.tsx)) fetches raw markdown from `GET <VITE_API_HOSTNAME>/home-info/:homeId` and renders it to HTML client-side via [marked](https://www.npmjs.com/package/marked). It's linked from the main app's "Home Info" link (built from `VITE_HOME_SLUG`).

This page intentionally does **not** use the main app's dark dashboard theme (`styles.css`) — it renders its own scoped `<style>` block with a plain, readable default (light/dark aware via `prefers-color-scheme`), since it's meant to read as a standalone document, not part of the app shell.

There's no router library in this app — `main.tsx` matches `window.location.pathname` against `/home-info/:homeId` directly and renders either `HomeInfoPage` or `Application`. The endpoint is gated by the same auth as the rest of the API: a 401 triggers the same Google login redirect used elsewhere (via `useAuthentication().startLogin()`), a 403 shows an access-denied message, a 404 shows a not-found message.

## Auth

The application requests a GET: `curl '<VITE_API_HOSTNAME>/api/auth/check'` to make sure that the user has access to the API.
This request can return a 401, the app handles the login via GoogleAuth, 403, the app shows the state but should run in ReadOnly mode. 200, all the actions can be executed normally.
The login is handled by Google by redirecting the page to the login page, once the flow is complete the API will set a `session` cookie. The API will persist the cookies
in the database. So the client doesn't need to handle any of the session logic as long as the `credentials` are sent to the API.

`startLogin()` sends the current path (`window.location.pathname + search`) as the OAuth `state` param, so after Google redirects back to the API's callback, the API redirects the browser back to the page the user was actually on (e.g. `/home-info/palais-freitas`) instead of always landing on `/`. The API only honors `state` as a redirect target when it's a same-origin relative path — see `isSafeReturnPath` in [auth-google.controller.ts](../server/src/controllers/auth-google/auth-google.controller.ts).

To test locally the VITE_GOOGLE_CLIENT_ID can be set but you'll need to create a GoogleAuth Client.

## Building and Running

To run locally simply do `npm run dev` and it loads the `.env.local` file.
To run in production:

- Build using `npm run build:prod`
- Run using `npm run preview`

The application is designed to be hosted via the NestJS API, you can see more on the [Server's Dockerfile](../server/dockerfile).
