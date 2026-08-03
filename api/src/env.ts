import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const apiRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = resolve(apiRoot, "..");

config({ path: resolve(repoRoot, ".env") });
config({ path: resolve(apiRoot, ".env"), override: true });

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    NODE_ENV: z.string().default("development"),
  })
  .strict();

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  API_PORT: process.env.API_PORT ?? "3001",
  NODE_ENV: process.env.NODE_ENV ?? "development",
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment: ${details}`);
}

export const env = {
  databaseUrl: parsed.data.DATABASE_URL,
  apiPort: parsed.data.API_PORT,
  nodeEnv: parsed.data.NODE_ENV,
} as const;
