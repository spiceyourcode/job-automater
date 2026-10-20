import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import JSZip from "jszip";

const WINANSI_REPLACEMENTS: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201A": "'",
  "\u201B": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u201E": '"',
  "\u201F": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\u2015": "-",
  "\u2212": "-",
  "\u2022": "-",
  "\u25CF": "-",
  "\u25AA": "-",
  "\u25AB": "-",
  "\u25E6": "-",
  "\u00B7": "-",
  "\u2023": "-",
  "\u2043": "-",
  "\u2026": "...",
  "\u2192": "->",
  "\u2190": "<-",
  "\u21D2": "=>",
  "\u21D0": "<=",
  "\u2713": "[x]",
  "\u2714": "[x]",
  "\u2717": "[ ]",
  "\u2718": "[ ]",
  "\u00A0": " ",
  "\u2007": " ",
  "\u202F": " ",
  "\u200B": "",
  "\u200C": "",
  "\u200D": "",
  "\uFEFF": "",
  "\u00AD": "-",
};

/**
 * pdf-lib's StandardFonts use WinAnsi encoding, which throws on code points it
 * cannot encode (e.g. "●" U+25CF, "•" U+2022). Normalise typography to ASCII
 * and drop code points outside WinAnsi so PDF generation never 500s.
 */
export function sanitizeForWinAnsi(text: string): string {
  let out = "";
  for (const ch of text) {
    const mapped = WINANSI_REPLACEMENTS[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x0a) {
      out += "\n";
    } else if (code === 0x09) {
      out += " ";
    } else if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) {
      out += ch;
    } else if (code >= 0x20) {
      out += "-";
    }
  }
  return out;
}

/**
 * ATS-friendly PDF: embedded standard font, selectable text (not image).
 * Never invents content — renders the provided text only (HG-9).
 */
export async function textToAtsPdf(
  title: string,
  body: string,
): Promise<Uint8Array> {
  const safeTitle = sanitizeForWinAnsi(title);
  const safeBody = sanitizeForWinAnsi(body);
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

  drawLine(safeTitle, 14);
  y -= 6;
  for (const raw of safeBody.replace(/\r/g, "").split("\n")) {
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
