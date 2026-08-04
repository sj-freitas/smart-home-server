/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_HOSTNAME: string;
  readonly VITE_APP_ENV: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_HOME_SLUG: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
