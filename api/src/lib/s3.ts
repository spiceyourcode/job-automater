import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env.js";

export const s3 = new S3Client({
  endpoint: env.s3Endpoint,
  region: env.s3Region,
  credentials: {
    accessKeyId: env.s3AccessKey,
    secretAccessKey: env.s3SecretKey,
  },
  forcePathStyle: true, // required for MinIO
});

let bucketReady = false;

/** Ensure the configured bucket exists (idempotent). */
export async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.s3Bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: env.s3Bucket }));
  }
  bucketReady = true;
}

/**
 * Upload bytes to MinIO/S3. Returns the object key (stored in DB).
 * Never logs body contents (HG-8).
 */
export async function uploadObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<{ key: string }> {
  await ensureBucket();
  await s3.send(
    new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );
  return { key: params.key };
}

/** Delete object by key — never logs body (HG-8). */
export async function deleteObject(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
    }),
  );
}

/** Download object bytes by key — never logs body (HG-8). */
export async function downloadObject(key: string): Promise<Buffer> {
  const res = await s3.send(
    new GetObjectCommand({ Bucket: env.s3Bucket, Key: key }),
  );
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error("Empty S3 object");
  return Buffer.from(bytes);
}

/** Time-limited download URL for a private object (default 1 hour). */
export async function getPresignedGetUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: env.s3Bucket, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}
