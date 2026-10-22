import { pgSchema } from "drizzle-orm/pg-core";

export const identitySchema = pgSchema("identity");
export const healthSchema = pgSchema("health");
export const clinicalSchema = pgSchema("clinical");
export const facilitiesSchema = pgSchema("facilities");
export const analyticsSchema = pgSchema("analytics");
export const auditSchema = pgSchema("audit");
