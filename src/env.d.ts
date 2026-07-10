/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly MONGODB_URI: string;
  readonly ADMIN_PASSWORD: string;
  readonly SESSION_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    user: import("./lib/users").PublicUser | null;
  }
}
