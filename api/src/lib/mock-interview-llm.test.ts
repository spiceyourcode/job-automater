import { describe, expect, it } from "vitest";
import {
  generateMockInterviewReply,
  isInterviewEndPhrase,
  openingLine,
  shouldEndSession,
} from "./mock-interview-llm.js";

const ctx = {
  jobTitle: "Engineer",
  company: "Acme",
  sampleQuestions: ["Why Acme?", "Describe a bug you fixed."],
  starTitles: ["Migration project"],
};

describe("mock-interview-llm", () => {
  it("detects end phrases", () => {
    expect(isInterviewEndPhrase("end interview please")).toBe(true);
    expect(isInterviewEndPhrase("I led the team")).toBe(false);
  });

  it("heuristic uses prep questions", async () => {
    const out = await generateMockInterviewReply(ctx, [
      { role: "user", content: "Ready." },
    ]);
    expect(out.assistantText.length).toBeGreaterThan(10);
    expect(out.modelUsed).toMatch(/heuristic|google|openai|groq/);
  });

  it("opening line mentions role", () => {
    const out = openingLine(ctx);
    expect(out.assistantText).toContain("Engineer");
    expect(out.assistantText).toContain("Acme");
  });

  it("should end after max turns", () => {
    expect(shouldEndSession(10)).toBe(true);
    expect(shouldEndSession(3)).toBe(false);
  });
});