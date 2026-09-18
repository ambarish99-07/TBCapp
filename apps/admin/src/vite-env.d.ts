/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Absolute API origin (e.g. "https://api.lickyeat.com") once the API is deployed standalone.
  // Unset in local dev — adminClient.ts falls back to the relative "/api" path that vite.config.ts's
  // dev-server proxy rewrites to http://localhost:4000.
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
