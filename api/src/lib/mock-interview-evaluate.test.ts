import { describe, expect, it } from "vitest";
import { heuristicEvaluate } from "./mock-interview-evaluate.js";

describe("heuristicEvaluate", () => {
  it("returns rubric and notes from user turns", () => {
    const summary = heuristicEvaluate(
      [
        { role: "user", content: "Hello, I'm ready for the interview." },
        {
          role: "user",
          content:
            "In my last role I led a migration that reduced latency. The situation was messy APIs; my task was stabilizing releases; I paired with SRE and cut errors; the result was 40% fewer incidents.",
        },
        {
          role: "assistant",
          content: "Thanks — what drew you to this company?",
        },
        {
          role: "user",
          content:
            "Your platform scale matches the distributed systems work I enjoy, and I want to contribute to the observability roadmap you posted publicly.",
        },
      ],
      { jobTitle: "Platform Engineer", company: "Acme" },
    );
    expect(summary.rubric.clarity).toBeGreaterThanOrEqual(1);
    expect(summary.strengths.length + summary.improvements.length).toBeGreaterThan(
      0,
    );
    expect(summary.closingNote).toContain("transcript");
  });
});