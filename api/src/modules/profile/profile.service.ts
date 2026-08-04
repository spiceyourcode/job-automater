import { createHash } from "node:crypto";
import { extname } from "node:path";
import { and, desc, eq, max } from "drizzle-orm";
import { db } from "../../db/index.js";
import { profiles, cvDocuments } from "../../db/schema/index.js";
import { uploadObject } from "../../lib/s3.js";
import {
  ALLOWED_CV_EXTENSIONS,
  ALLOWED_CV_MIME_TYPES,
  MAX_CV_BYTES,
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
  await getOrCreateProfile(userId);

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
  if (!ALLOWED_CV_MIME_TYPES.has(file.mimeType)) {
    throw new ProfileError("Invalid Content-Type for CV upload", 400);
  }

  const fileHash = createHash("sha256").update(file.data).digest("hex");
  const safeName = sanitizeFilename(file.filename);

  // Next version for this user
  const [agg] = await db
    .select({ maxVersion: max(cvDocuments.version) })
    .from(cvDocuments)
    .where(eq(cvDocuments.userId, userId));
  const nextVersion = (agg?.maxVersion ?? 0) + 1;

  const key = `cvs/${userId}/v${nextVersion}/${safeName}`;
  // Upload — body never logged
  const { url } = await uploadObject({
    key,
    body: file.data,
    contentType: file.mimeType,
  });

  const [doc] = await db.transaction(async (tx) => {
    // Deactivate previous active docs for this user
    await tx
      .update(cvDocuments)
      .set({ isActive: false })
      .where(
        and(eq(cvDocuments.userId, userId), eq(cvDocuments.isActive, true)),
      );

    const [created] = await tx
      .insert(cvDocuments)
      .values({
        userId,
        version: nextVersion,
        originalFilename: safeName,
        fileUrl: url,
        fileHash,
        fileSize: file.data.byteLength,
        mimeType: file.mimeType,
        isActive: true,
      })
      .returning();

    if (!created) throw new Error("Failed to create cv_document");

    const [existingProfile] = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (!existingProfile) {
      await tx.insert(profiles).values({
        userId,
        cvFileId: created.id,
        cvVersion: nextVersion,
      });
    } else {
      await tx
        .update(profiles)
        .set({
          cvFileId: created.id,
          cvVersion: nextVersion,
          updatedAt: new Date(),
        })
        .where(eq(profiles.userId, userId));
    }

    return [created];
  });

  return {
    cvDocument: {
      id: doc!.id,
      version: doc!.version,
      originalFilename: doc!.originalFilename,
      fileUrl: doc!.fileUrl,
      fileSize: doc!.fileSize,
      mimeType: doc!.mimeType,
      isActive: doc!.isActive,
      createdAt: doc!.createdAt,
      // Intentionally omit parsedText / parsedSections (HG-8)
    },
    taskId: null as string | null, // async parse deferred to later phase
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

  return { versions: rows };
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
  return doc;
}
