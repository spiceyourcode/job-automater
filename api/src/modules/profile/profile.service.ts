import { createHash, randomUUID } from "node:crypto";
import { extname } from "node:path";
import { and, desc, eq, max, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  applications,
  cvChunks,
  cvDocuments,
  emails,
  jobScores,
  notifications,
  profiles,
  users,
  userSessions,
} from "../../db/schema/index.js";
import { getPresignedGetUrl, uploadObject, deleteObject, downloadObject } from "../../lib/s3.js";
import { enqueueReindexCv } from "../../lib/queue.js";
import { CvParseError, extractCvText } from "../../lib/cv-parse.js";
import {
  ALLOWED_CV_EXTENSIONS,
  MAX_CV_BYTES,
  resolveCvMimeType,
  type PatchProfileBody,
  type ReindexCvBody,
} from "./profile.schema.js";

export class ProfileError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404 | 413 | 422,
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
    nextMin >= nextMax
  ) {
    throw new ProfileError("salaryMin must be < salaryMax", 400);
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

  let parsedText: string;
  try {
    parsedText = await extractCvText({
      data: file.data,
      mimeType,
      filename: file.filename,
    });
  } catch (err) {
    if (err instanceof CvParseError) {
      throw new ProfileError(err.message, 422);
    }
    throw err;
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
          parsedText,
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

  const taskId = randomUUID();
  try {
    await enqueueReindexCv({
      task_id: taskId,
      user_id: userId,
      cv_document_id: created!.id,
    });
  } catch {
    // File + parsed text are saved; client can manually reindex
    console.info(
      JSON.stringify({
        event: "cv_reindex_enqueue_failed",
        userId,
        cvDocumentId: created!.id,
      }),
    );
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
    taskId,
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

async function getCvByVersion(userId: string, version: number) {
  const [doc] = await db
    .select({
      id: cvDocuments.id,
      userId: cvDocuments.userId,
      version: cvDocuments.version,
      originalFilename: cvDocuments.originalFilename,
      fileUrl: cvDocuments.fileUrl,
      fileSize: cvDocuments.fileSize,
      mimeType: cvDocuments.mimeType,
      isActive: cvDocuments.isActive,
      chunkCount: cvDocuments.chunkCount,
      createdAt: cvDocuments.createdAt,
    })
    .from(cvDocuments)
    .where(and(eq(cvDocuments.userId, userId), eq(cvDocuments.version, version)))
    .limit(1);
  if (!doc) throw new ProfileError("CV not found", 404);
  return doc;
}

export async function activateCvVersion(userId: string, version: number) {
  const doc = await getCvByVersion(userId, version);

  await db.transaction(async (tx) => {
    await tx
      .update(cvDocuments)
      .set({ isActive: false })
      .where(and(eq(cvDocuments.userId, userId), eq(cvDocuments.isActive, true)));

    await tx
      .update(cvDocuments)
      .set({ isActive: true })
      .where(eq(cvDocuments.id, doc.id));

    await tx
      .update(profiles)
      .set({
        cvFileId: doc.id,
        cvVersion: doc.version,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId));
  });

  console.info(
    JSON.stringify({
      event: "cv_activate",
      userId,
      cvDocumentId: doc.id,
      version: doc.version,
    }),
  );

  return {
    cvDocument: {
      id: doc.id,
      version: doc.version,
      originalFilename: doc.originalFilename,
      fileUrl: await getPresignedGetUrl(doc.fileUrl),
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      isActive: true,
      chunkCount: doc.chunkCount,
      createdAt: doc.createdAt,
    },
  };
}

export async function deleteCvVersion(userId: string, version: number) {
  const doc = await getCvByVersion(userId, version);

  await db.transaction(async (tx) => {
    // Explicit chunk delete — avoid orphan embeddings even if DB cascade fails
    await tx.delete(cvChunks).where(eq(cvChunks.cvDocumentId, doc.id));
    await tx.delete(cvDocuments).where(eq(cvDocuments.id, doc.id));

    if (doc.isActive) {
      const [next] = await tx
        .select({
          id: cvDocuments.id,
          version: cvDocuments.version,
        })
        .from(cvDocuments)
        .where(eq(cvDocuments.userId, userId))
        .orderBy(desc(cvDocuments.version))
        .limit(1);

      if (next) {
        await tx
          .update(cvDocuments)
          .set({ isActive: true })
          .where(eq(cvDocuments.id, next.id));
        await tx
          .update(profiles)
          .set({
            cvFileId: next.id,
            cvVersion: next.version,
            updatedAt: new Date(),
          })
          .where(eq(profiles.userId, userId));
      } else {
        await tx
          .update(profiles)
          .set({
            cvFileId: null,
            cvVersion: 1,
            updatedAt: new Date(),
          })
          .where(eq(profiles.userId, userId));
      }
    }
  });

  await deleteObject(doc.fileUrl).catch(() => {
    // Object may already be gone — DB rows are authoritative
  });

  console.info(
    JSON.stringify({
      event: "cv_delete",
      userId,
      cvDocumentId: doc.id,
      version: doc.version,
    }),
  );

  return { success: true as const };
}

export async function reindexCv(userId: string, body: ReindexCvBody) {
  let doc: {
    id: string;
    version: number;
    fileUrl: string;
    mimeType?: string | null;
    originalFilename?: string | null;
    parsedText?: string | null;
  };
  if (body.version != null) {
    const full = await getCvByVersion(userId, body.version);
    const [row] = await db
      .select({
        id: cvDocuments.id,
        version: cvDocuments.version,
        fileUrl: cvDocuments.fileUrl,
        mimeType: cvDocuments.mimeType,
        originalFilename: cvDocuments.originalFilename,
        parsedText: cvDocuments.parsedText,
      })
      .from(cvDocuments)
      .where(eq(cvDocuments.id, full.id))
      .limit(1);
    if (!row) throw new ProfileError("CV not found", 404);
    doc = row;
  } else {
    const [active] = await db
      .select({
        id: cvDocuments.id,
        version: cvDocuments.version,
        fileUrl: cvDocuments.fileUrl,
        mimeType: cvDocuments.mimeType,
        originalFilename: cvDocuments.originalFilename,
        parsedText: cvDocuments.parsedText,
      })
      .from(cvDocuments)
      .where(and(eq(cvDocuments.userId, userId), eq(cvDocuments.isActive, true)))
      .limit(1);
    if (!active) throw new ProfileError("No active CV to reindex", 404);
    doc = active;
  }

  // Backfill parsed_text for older uploads that never ran extraction
  if (!doc.parsedText?.trim()) {
    try {
      const bytes = await downloadObject(doc.fileUrl);
      const text = await extractCvText({
        data: bytes,
        mimeType: doc.mimeType || "application/pdf",
        filename: doc.originalFilename || "cv.pdf",
      });
      await db
        .update(cvDocuments)
        .set({ parsedText: text })
        .where(eq(cvDocuments.id, doc.id));
    } catch (err) {
      if (err instanceof CvParseError) {
        throw new ProfileError(err.message, 422);
      }
      throw new ProfileError(
        "Could not re-parse CV from storage — re-upload as PDF or DOCX",
        422,
      );
    }
  }

  const taskId = randomUUID();
  await enqueueReindexCv({
    task_id: taskId,
    user_id: userId,
    cv_document_id: doc.id,
  });

  console.info(
    JSON.stringify({
      event: "cv_reindex_enqueued",
      userId,
      cvDocumentId: doc.id,
      taskId,
    }),
  );

  return { taskId };
}

export async function listCvChunks(
  userId: string,
  version: number,
  opts: { limit: number; offset: number },
) {
  const doc = await getCvByVersion(userId, version);
  const rows = await db
    .select({
      index: cvChunks.chunkIndex,
      content: cvChunks.content,
      sectionType: cvChunks.sectionType,
      tokenCount: cvChunks.tokenCount,
    })
    .from(cvChunks)
    .where(and(eq(cvChunks.cvDocumentId, doc.id), eq(cvChunks.userId, userId)))
    .orderBy(cvChunks.chunkIndex)
    .limit(opts.limit)
    .offset(opts.offset);

  return {
    chunks: rows.map((r) => ({
      index: r.index,
      content: r.content,
      sectionType: r.sectionType,
      tokenCount: r.tokenCount,
    })),
  };
}

/** Side-by-side chunk diff between two owned versions (HG-9 source = chunks). */
export async function diffCvVersions(
  userId: string,
  version: number,
  against: number,
) {
  if (version === against) {
    throw new ProfileError("Cannot diff a version against itself", 400);
  }
  const a = await getCvByVersion(userId, against);
  const b = await getCvByVersion(userId, version);

  const load = async (cvDocumentId: string) =>
    db
      .select({
        index: cvChunks.chunkIndex,
        content: cvChunks.content,
        sectionType: cvChunks.sectionType,
      })
      .from(cvChunks)
      .where(
        and(eq(cvChunks.cvDocumentId, cvDocumentId), eq(cvChunks.userId, userId)),
      )
      .orderBy(cvChunks.chunkIndex);

  const left = await load(a.id);
  const right = await load(b.id);
  const leftMap = new Map(left.map((c) => [c.index, c]));
  const rightMap = new Map(right.map((c) => [c.index, c]));
  const indexes = new Set([...leftMap.keys(), ...rightMap.keys()]);

  const changes: Array<{
    index: number;
    status: "added" | "removed" | "changed" | "unchanged";
    before: string | null;
    after: string | null;
    sectionType: string | null;
  }> = [];

  for (const index of [...indexes].sort((x, y) => x - y)) {
    const L = leftMap.get(index);
    const R = rightMap.get(index);
    if (!L && R) {
      changes.push({
        index,
        status: "added",
        before: null,
        after: R.content,
        sectionType: R.sectionType,
      });
    } else if (L && !R) {
      changes.push({
        index,
        status: "removed",
        before: L.content,
        after: null,
        sectionType: L.sectionType,
      });
    } else if (L && R) {
      changes.push({
        index,
        status: L.content === R.content ? "unchanged" : "changed",
        before: L.content,
        after: R.content,
        sectionType: R.sectionType ?? L.sectionType,
      });
    }
  }

  return {
    fromVersion: against,
    toVersion: version,
    changes,
  };
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

/** GDPR data export — structured JSON of user PII (no secrets). */
export async function exportUserData(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      timezone: users.timezone,
      locale: users.locale,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new ProfileError("Profile not found", 404);

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  const cvs = await db
    .select({
      id: cvDocuments.id,
      version: cvDocuments.version,
      originalFilename: cvDocuments.originalFilename,
      createdAt: cvDocuments.createdAt,
    })
    .from(cvDocuments)
    .where(eq(cvDocuments.userId, userId));

  const apps = await db
    .select({
      id: applications.id,
      jobId: applications.jobId,
      status: applications.status,
      createdAt: applications.createdAt,
    })
    .from(applications)
    .where(eq(applications.userId, userId));

  const notifs = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId));

  return {
    exportedAt: new Date().toISOString(),
    user,
    profile: profile ?? null,
    cvDocuments: cvs,
    applications: apps,
    notifications: notifs,
  };
}

/**
 * GDPR erase — remove CV chunks (pgvector) then cascade-delete the user.
 * Soft-delete alone is insufficient (FAILURE: leftover chunks).
 */
export async function deleteUserAccount(userId: string) {
  return await db.transaction(async (tx) => {
    // Explicit pgvector purge (contract FAILURE if left behind)
    await tx.delete(cvChunks).where(eq(cvChunks.userId, userId));
    await tx.delete(emails).where(eq(emails.userId, userId));
    await tx.delete(notifications).where(eq(notifications.userId, userId));
    await tx.delete(jobScores).where(eq(jobScores.userId, userId));
    await tx.delete(userSessions).where(eq(userSessions.userId, userId));

    // Hard-delete user — FKs cascade remaining owned rows
    const removed = await tx
      .delete(users)
      .where(eq(users.id, userId))
      .returning({ id: users.id });

    if (removed.length === 0) throw new ProfileError("Profile not found", 404);

    return { deleted: true as const, userId };
  });
}
