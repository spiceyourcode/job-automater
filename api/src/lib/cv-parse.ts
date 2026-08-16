/**
 * CV text extraction — PDF (pdf-parse) + DOCX (mammoth). TRD FR-CV-01.
 * Never logs extracted body (HG-8). Never invents content (HG-9).
 */
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export class CvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CvParseError";
  }
}

function normalizeExtracted(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractCvText(params: {
  data: Buffer;
  mimeType: string;
  filename: string;
}): Promise<string> {
  const lower = params.filename.toLowerCase();
  const isPdf =
    params.mimeType === "application/pdf" || lower.endsWith(".pdf");
  const isDocx =
    params.mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx");
  const isLegacyDoc =
    params.mimeType === "application/msword" || lower.endsWith(".doc");

  if (isLegacyDoc && !isDocx) {
    throw new CvParseError(
      "Legacy .doc is not supported — save as PDF or DOCX and upload again",
    );
  }

  let raw = "";
  try {
    if (isPdf) {
      const parser = new PDFParse({ data: params.data });
      try {
        const result = await parser.getText();
        raw = result.text ?? "";
      } finally {
        await parser.destroy().catch(() => {});
      }
    } else if (isDocx) {
      const result = await mammoth.extractRawText({ buffer: params.data });
      raw = result.value ?? "";
    } else {
      throw new CvParseError("Unsupported CV format for text extraction");
    }
  } catch (err) {
    if (err instanceof CvParseError) throw err;
    throw new CvParseError("Could not extract text from this CV file");
  }

  const text = normalizeExtracted(raw);
  if (text.length < 40) {
    throw new CvParseError(
      "Extracted text was empty or too short — try a text-based PDF or DOCX (not a scanned image)",
    );
  }
  return text;
}
