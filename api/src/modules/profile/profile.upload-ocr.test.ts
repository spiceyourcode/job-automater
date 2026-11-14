import { beforeEach, describe, expect, it, vi } from "vitest";

const { enqueueParseCv, enqueueReindexCv, extractCvText } = vi.hoisted(() => ({
  enqueueParseCv: vi.fn(),
  enqueueReindexCv: vi.fn(),
  extractCvText: vi.fn(),
}));

vi.mock("../../lib/queue.js", () => ({
  enqueueParseCv,
  enqueueReindexCv,
}));

vi.mock("../../lib/cv-parse.js", () => ({
  CvParseError: class CvParseError extends Error {},
  extractCvText,
}));

vi.mock("../../lib/s3.js", () => ({
  getPresignedGetUrl: vi.fn(async (k: string) => `https://example/${k}`),
  uploadObject: vi.fn(),
}));

vi.mock("../../db/index.js", () => {
  const row = {
    id: "doc-1",
    version: 1,
    originalFilename: "scan.pdf",
    fileSize: 100,
    mimeType: "application/pdf",
    isActive: true,
    createdAt: new Date("2025-01-01"),
  };
  return {
    db: {
      transaction: async (fn: (tx: unknown) => Promise<unknown[]>) => {
        let selectCalls = 0;
        const tx = {
          execute: vi.fn(),
          select: () => {
            selectCalls += 1;
            if (selectCalls === 1) {
              return {
                from: () => ({
                  where: async () => [{ maxVersion: 0 }],
                }),
              };
            }
            return {
              from: () => ({
                where: () => ({
                  limit: async () => [{ id: "profile-1" }],
                }),
              }),
            };
          },
          update: () => ({
            set: () => ({
              where: () => Promise.resolve(),
            }),
          }),
          insert: () => ({
            values: () => ({
              returning: async () => [row],
            }),
          }),
        };
        return fn(tx);
      },
    },
  };
});

import { uploadCv } from "./profile.service.js";

describe("uploadCv PDF OCR fallback", () => {
  beforeEach(() => {
    enqueueParseCv.mockReset();
    enqueueReindexCv.mockReset();
    extractCvText.mockReset();
  });

  it("accepts PDF with short extract and enqueues parse (not reindex)", async () => {
    extractCvText.mockResolvedValue("hi");

    const result = await uploadCv("user-1", {
      filename: "scan.pdf",
      mimeType: "application/pdf",
      data: Buffer.from("%PDF"),
    });

    expect(result.parsePending).toBe(true);
    expect(enqueueParseCv).toHaveBeenCalledOnce();
    expect(enqueueReindexCv).not.toHaveBeenCalled();
  });

  it("enqueues reindex when PDF text is sufficient", async () => {
    extractCvText.mockResolvedValue("x".repeat(80));

    const result = await uploadCv("user-1", {
      filename: "text.pdf",
      mimeType: "application/pdf",
      data: Buffer.from("%PDF"),
    });

    expect(result.parsePending).toBe(false);
    expect(enqueueReindexCv).toHaveBeenCalledOnce();
    expect(enqueueParseCv).not.toHaveBeenCalled();
  });
});