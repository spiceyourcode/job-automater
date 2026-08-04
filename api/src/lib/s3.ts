import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
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
 * Upload bytes to MinIO/S3. Returns the object key and a public-ish URL.
 * Never logs body contents (HG-8).
 */
export async function uploadObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<{ key: string; url: string }> {
  await ensureBucket();
  await s3.send(
    new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );
  const url = `${env.s3Endpoint}/${env.s3Bucket}/${params.key}`;
  return { key: params.key, url };
}
