import { createHash, randomUUID } from "node:crypto";
import { extname } from "node:path";
import { and, desc, eq, max, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { profiles, cvDocuments } from "../../db/schema/index.js";
import { getPresignedGetUrl, uploadObject } from "../../lib/s3.js";
import {
  ALLOWED_CV_EXTENSIONS,
  MAX_CV_BYTES,
  resolveCvMimeType,
  type PatchProfileBody,
} from "./profile.schema.js";

export class ProfileError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404 | 413,
  ) {
    super(message);
    this.name = "ProfileError";
  }
}

/** Ensure a profile row exists for this user (ownership is always auth.userId). */
export async function getOrCreateProfile(userId: string) {
  const [existing] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(profiles)
    .values({ userId })
    .returning();

  if (!created) throw new Error("Failed to create profile");
  return created;
}

export async function getProfile(userId: string) {
  return getOrCreateProfile(userId);
}

export async function patchProfile(userId: string, body: PatchProfileBody) {
  const existing = await getOrCreateProfile(userId);

  // Merge partial salary fields against stored values so min/max stays ordered
  const nextMin =
    body.salaryMin !== undefined ? body.salaryMin : existing.salaryMin;
  const nextMax =
    body.salaryMax !== undefined ? body.salaryMax : existing.salaryMax;
  if (
    nextMin != null &&
    nextMax != null &&
    nextMin > nextMax
  ) {
    throw new ProfileError("salaryMin must be <= salaryMax", 400);
  }

  const [updated] = await db
    .update(profiles)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(profiles.userId, userId))
    .returning();

  if (!updated) throw new ProfileError("Profile not found", 404);
  return updated;
}

function sanitizeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  return base.length > 0 ? base : "cv.pdf";
}

export async function uploadCv(
  userId: string,
  file: {
    filename: string;
    mimeType: string;
    data: Buffer;
  },
) {
  // Size check — do not log body (HG-8)
  if (file.data.byteLength > MAX_CV_BYTES) {
    throw new ProfileError("File exceeds 10MB limit", 413);
  }
  if (file.data.byteLength === 0) {
    throw new ProfileError("Empty file", 400);
  }

  const ext = extname(file.filename).toLowerCase();
  if (!ALLOWED_CV_EXTENSIONS.has(ext)) {
    throw new ProfileError("Only PDF and DOCX files are allowed", 400);
  }

  const mimeType = resolveCvMimeType(file.mimeType, file.filename);
  if (!mimeType) {
    throw new ProfileError("Invalid Content-Type for CV upload", 400);
  }

  const fileHash = createHash("sha256").update(file.data).digest("hex");
  const safeName = sanitizeFilename(file.filename);
  // UUID in key prevents S3 overwrite even under version races
  const objectId = randomUUID();
  const key = `cvs/${userId}/${objectId}/${safeName}`;

  // Upload before DB — unique key; orphaned objects are acceptable if insert fails
  await uploadObject({
    key,
    body: file.data,
    contentType: mimeType,
  });

  let created;
  try {
    [created] = await db.transaction(async (tx) => {
      // Serialize version allocation per user (Postgres advisory xact lock)
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${userId}::text))`,
      );

      const [agg] = await tx
        .select({ maxVersion: max(cvDocuments.version) })
        .from(cvDocuments)
        .where(eq(cvDocuments.userId, userId));
      const nextVersion = (agg?.maxVersion ?? 0) + 1;

      await tx
        .update(cvDocuments)
        .set({ isActive: false })
        .where(
          and(eq(cvDocuments.userId, userId), eq(cvDocuments.isActive, true)),
        );

      const [row] = await tx
        .insert(cvDocuments)
        .values({
          userId,
          version: nextVersion,
          originalFilename: safeName,
          fileUrl: key, // store object key; API returns presigned URL
          fileHash,
          fileSize: file.data.byteLength,
          mimeType,
          isActive: true,
        })
        .returning();

      if (!row) throw new Error("Failed to create cv_document");

      const [existingProfile] = await tx
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      if (!existingProfile) {
        await tx.insert(profiles).values({
          userId,
          cvFileId: row.id,
          cvVersion: nextVersion,
        });
      } else {
        await tx
          .update(profiles)
          .set({
            cvFileId: row.id,
            cvVersion: nextVersion,
            updatedAt: new Date(),
          })
          .where(eq(profiles.userId, userId));
      }

      return [row];
    });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      throw new ProfileError("Concurrent upload conflict — retry", 400);
    }
    throw err;
  }

  const fileUrl = await getPresignedGetUrl(key);

  return {
    cvDocument: {
      id: created!.id,
      version: created!.version,
      originalFilename: created!.originalFilename,
      fileUrl,
      fileSize: created!.fileSize,
      mimeType: created!.mimeType,
      isActive: created!.isActive,
      createdAt: created!.createdAt,
      // Intentionally omit parsedText / parsedSections (HG-8)
    },
    taskId: null as string | null,
  };
}

export async function listCvVersions(userId: string) {
  const rows = await db
    .select({
      id: cvDocuments.id,
      version: cvDocuments.version,
      filename: cvDocuments.originalFilename,
      isActive: cvDocuments.isActive,
      createdAt: cvDocuments.createdAt,
      chunkCount: cvDocuments.chunkCount,
      fileUrl: cvDocuments.fileUrl,
      fileSize: cvDocuments.fileSize,
    })
    .from(cvDocuments)
    .where(eq(cvDocuments.userId, userId))
    .orderBy(desc(cvDocuments.version));

  const versions = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      fileUrl: await getPresignedGetUrl(row.fileUrl),
    })),
  );

  return { versions };
}

/**
 * Fetch a CV document by id — only if it belongs to userId (IDOR guard).
 * Used for ownership-proof tests; never returns parsedText.
 */
export async function getCvDocumentForUser(userId: string, cvId: string) {
  const [doc] = await db
    .select({
      id: cvDocuments.id,
      userId: cvDocuments.userId,
      version: cvDocuments.version,
      fileUrl: cvDocuments.fileUrl,
      originalFilename: cvDocuments.originalFilename,
      isActive: cvDocuments.isActive,
    })
    .from(cvDocuments)
    .where(and(eq(cvDocuments.id, cvId), eq(cvDocuments.userId, userId)))
    .limit(1);

  if (!doc) throw new ProfileError("CV not found", 404);
  return {
    ...doc,
    fileUrl: await getPresignedGetUrl(doc.fileUrl),
  };
}
