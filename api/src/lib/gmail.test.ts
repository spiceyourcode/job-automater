import { describe, expect, it } from "vitest";
import {
  extractPlainText,
  gmailMessageToIngest,
  decodePushData,
} from "./gmail.js";

describe("gmail message parse", () => {
  it("extracts text/plain from nested parts", () => {
    const text = extractPlainText({
      mimeType: "multipart/alternative",
      parts: [
        {
          mimeType: "text/plain",
          body: { data: Buffer.from("Built APIs with FastAPI").toString("base64url") },
        },
      ],
    });
    expect(text).toContain("FastAPI");
  });

  it("maps Gmail payload without requiring body in logs", () => {
    const msg = gmailMessageToIngest({
      id: "msg-1",
      threadId: "th-1",
      snippet: "Please schedule a call",
      internalDate: "1786650000000",
      payload: {
        headers: [
          { name: "From", value: "Ada Lovelace <hr@acme.com>" },
          { name: "Subject", value: "Interview invitation" },
        ],
        mimeType: "text/plain",
        body: { data: Buffer.from("Please schedule").toString("base64url") },
      },
    });
    expect(msg?.fromEmail).toBe("hr@acme.com");
    expect(msg?.fromName).toBe("Ada Lovelace");
    expect(msg?.subject).toBe("Interview invitation");
    expect(msg?.externalId).toBe("msg-1");
  });

  it("decodes Pub/Sub push data", () => {
    const payload = Buffer.from(
      JSON.stringify({ emailAddress: "me@gmail.com", historyId: "99" }),
    ).toString("base64url");
    const decoded = decodePushData(payload);
    expect(decoded.emailAddress).toBe("me@gmail.com");
  });
});
