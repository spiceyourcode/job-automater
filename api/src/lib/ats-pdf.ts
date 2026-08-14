import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import JSZip from "jszip";

/**
 * ATS-friendly PDF: embedded standard font, selectable text (not image).
 * Never invents content — renders the provided text only (HG-9).
 */
export async function textToAtsPdf(
  title: string,
  body: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  const lineHeight = 14;
  const margin = 50;
  let page = doc.addPage();
  let { width, height } = page.getSize();
  let y = height - margin;

  const drawLine = (text: string, size = fontSize) => {
    if (y < margin + lineHeight) {
      page = doc.addPage();
      ({ width, height } = page.getSize());
      y = height - margin;
    }
    page.drawText(text.slice(0, 110), {
      x: margin,
      y,
      size,
      font,
      color: rgb(0.05, 0.05, 0.05),
      maxWidth: width - margin * 2,
    });
    y -= lineHeight;
  };

  drawLine(title, 14);
  y -= 6;
  for (const raw of body.replace(/\r/g, "").split("\n")) {
    const line = raw.length === 0 ? " " : raw;
    // Wrap long lines
    const maxChars = 95;
    if (line.length <= maxChars) {
      drawLine(line);
    } else {
      let rest = line;
      while (rest.length > 0) {
        drawLine(rest.slice(0, maxChars));
        rest = rest.slice(maxChars);
      }
    }
  }

  return doc.save();
}

export async function buildApplicationZip(params: {
  cvText: string;
  clText: string;
  metadata: Record<string, unknown>;
}): Promise<Buffer> {
  const zip = new JSZip();
  const cvPdf = await textToAtsPdf("Tailored CV", params.cvText);
  const clPdf = await textToAtsPdf("Cover Letter", params.clText);
  zip.file("tailored-cv.pdf", cvPdf);
  zip.file("cover-letter.pdf", clPdf);
  zip.file("tailored-cv.md", params.cvText);
  zip.file("cover-letter.md", params.clText);
  zip.file("metadata.json", JSON.stringify(params.metadata, null, 2));
  const out = await zip.generateAsync({ type: "nodebuffer" });
  return out;
}
