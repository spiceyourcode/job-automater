import { checkDatabaseConnection } from "../../db/index.js";
import {
  healthResponseSchema,
  type HealthResponse,
} from "./health.schema.js";

export const getHealth = async (): Promise<{
  body: HealthResponse;
  ok: boolean;
}> => {
  const dbUp = await checkDatabaseConnection();

  const body = healthResponseSchema.parse({
    status: dbUp ? "ok" : "degraded",
    db: dbUp ? "up" : "down",
    timestamp: new Date().toISOString(),
  });

  return { ok: dbUp, body };
};
