import { describe, expect, it } from "vitest";
import { CvParseError, extractCvText } from "./cv-parse.js";

describe("extractCvText", () => {
  it("rejects legacy .doc", async () => {
    await expect(
      extractCvText({
        data: Buffer.from("not-a-doc"),
        mimeType: "application/msword",
        filename: "resume.doc",
      }),
    ).rejects.toBeInstanceOf(CvParseError);
  });

  it("rejects empty / unreadable pdf bytes", async () => {
    await expect(
      extractCvText({
        data: Buffer.from("%PDF-1.4 empty"),
        mimeType: "application/pdf",
        filename: "cv.pdf",
      }),
    ).rejects.toBeInstanceOf(CvParseError);
  });
});
