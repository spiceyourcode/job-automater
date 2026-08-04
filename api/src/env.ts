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
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),
    JWT_ACCESS_TTL: z.string().default("15m"),
    JWT_REFRESH_TTL: z.string().default("7d"),
    S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
    S3_ACCESS_KEY: z.string().min(1).default("minioadmin"),
    S3_SECRET_KEY: z.string().min(1).default("minioadmin"),
    S3_BUCKET: z.string().min(1).default("jobautomater"),
    S3_REGION: z.string().min(1).default("us-east-1"),
  })
  .strict();

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  API_PORT: process.env.API_PORT ?? "3001",
  NODE_ENV: process.env.NODE_ENV ?? "development",
  JWT_SECRET: process.env.JWT_SECRET ?? "",
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL ?? "15m",
  JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL ?? "7d",
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
  S3_SECRET_KEY: process.env.S3_SECRET_KEY,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_REGION: process.env.S3_REGION,
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
  jwtSecret: parsed.data.JWT_SECRET,
  jwtAccessTtl: parsed.data.JWT_ACCESS_TTL,
  jwtRefreshTtl: parsed.data.JWT_REFRESH_TTL,
  s3Endpoint: parsed.data.S3_ENDPOINT,
  s3AccessKey: parsed.data.S3_ACCESS_KEY,
  s3SecretKey: parsed.data.S3_SECRET_KEY,
  s3Bucket: parsed.data.S3_BUCKET,
  s3Region: parsed.data.S3_REGION,
} as const;
