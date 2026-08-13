import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const apiRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = resolve(apiRoot, "..");

config({ path: resolve(repoRoot, ".env") });
config({ path: resolve(apiRoot, ".env"), override: true });

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProd = nodeEnv === "production";

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    NODE_ENV: z.string().default("development"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),
    JWT_ACCESS_TTL: z.string().default("15m"),
    JWT_REFRESH_TTL: z.string().default("7d"),
    S3_ENDPOINT: z.string().url(),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
    S3_BUCKET: z.string().min(1),
    S3_REGION: z.string().min(1).default("us-east-1"),
    REDIS_URL: z.string().url().default("redis://localhost:6379"),
    APP_URL: z.string().url().default("http://localhost:3000"),
    EMAIL_FROM: z.string().email().default("noreply@jobautomater.local"),
    SMTP_WEBHOOK_URL: z.string().url().optional(),
    EMAIL_VERIFY_TTL: z.string().default("24h"),
    PASSWORD_RESET_TTL: z.string().default("1h"),
  })
  .strict();

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  API_PORT: process.env.API_PORT ?? "3001",
  NODE_ENV: nodeEnv,
  JWT_SECRET: process.env.JWT_SECRET ?? "",
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL ?? "15m",
  JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL ?? "7d",
  // Dev-only defaults for local MinIO; production must set explicitly (fail closed)
  S3_ENDPOINT:
    process.env.S3_ENDPOINT ??
    (isProd ? undefined : "http://localhost:9000"),
  S3_ACCESS_KEY:
    process.env.S3_ACCESS_KEY ?? (isProd ? undefined : "minioadmin"),
  S3_SECRET_KEY:
    process.env.S3_SECRET_KEY ?? (isProd ? undefined : "minioadmin"),
  S3_BUCKET: process.env.S3_BUCKET ?? (isProd ? undefined : "jobautomater"),
  S3_REGION: process.env.S3_REGION ?? "us-east-1",
  REDIS_URL: process.env.REDIS_URL ?? process.env.CELERY_BROKER_URL,
  APP_URL: process.env.APP_URL ?? "http://localhost:3000",
  EMAIL_FROM: process.env.EMAIL_FROM ?? "noreply@jobautomater.local",
  SMTP_WEBHOOK_URL: process.env.SMTP_WEBHOOK_URL || undefined,
  EMAIL_VERIFY_TTL: process.env.EMAIL_VERIFY_TTL ?? "24h",
  PASSWORD_RESET_TTL: process.env.PASSWORD_RESET_TTL ?? "1h",
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
  redisUrl: parsed.data.REDIS_URL,
  appUrl: parsed.data.APP_URL,
  emailFrom: parsed.data.EMAIL_FROM,
  smtpWebhookUrl: parsed.data.SMTP_WEBHOOK_URL,
  emailVerifyTtl: parsed.data.EMAIL_VERIFY_TTL,
  passwordResetTtl: parsed.data.PASSWORD_RESET_TTL,
} as const;
