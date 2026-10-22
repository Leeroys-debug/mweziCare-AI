import { createDb, EnvKeyProvider, type Database } from "@mwezicare/db";
import { loadServerEnv } from "@mwezicare/validation";
import { lazy } from "./lazy";

export const db: Database = lazy(() => createDb(loadServerEnv().DATABASE_URL));
export const encryptionKeyProvider: EnvKeyProvider = lazy(
  () =>
    new EnvKeyProvider(
      loadServerEnv().ENCRYPTION_KEYS,
      loadServerEnv().ENCRYPTION_KEY_ID,
    ),
);
export const hmacKeyProvider: EnvKeyProvider = lazy(
  () => new EnvKeyProvider(loadServerEnv().HMAC_LOOKUP_KEY),
);
export const analyticsKeyProvider: EnvKeyProvider = lazy(
  () => new EnvKeyProvider(loadServerEnv().ANALYTICS_KEY),
);
