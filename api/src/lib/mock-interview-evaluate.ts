/**
 * Post-session debrief from transcript (HG-9) — optional Ollama JSON, else heuristic.
 */

import type { MockInterviewSummary } from "../db/schema/mock-interview-sessions.js";

type Turn = { role: string; content: string };

function clampScore(n: number): number {
  return Math.max(1, Math.min(5, Math.round(n)));
}

export function heuristicEvaluate(
  turns: Turn[],
  meta: { jobTitle: string; company: string },
): MockInterviewSummary {
  const userLines = turns
    .filter((t) => t.role === "user")
    .map((t) => t.content.trim())
    .filter((t) => t.length > 15 && !t.toLowerCase().includes("ready for the interview"));

  const avgLen =
    userLines.length > 0
      ? userLines.reduce((s, l) => s + l.length, 0) / userLines.length
      : 0;

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (userLines.length >= 3) {
    strengths.push("You stayed engaged through multiple questions.");
  } else {
    improvements.push("Practice longer answers — aim for at least three full responses.");
  }

  if (avgLen >= 120) {
    strengths.push("Answers had enough detail to show experience.");
  } else if (userLines.length > 0) {
    improvements.push("Expand answers with one concrete example per question (STAR).");
  }

  const starHint = userLines.some((l) =>
    /\b(result|action|situation|task)\b/i.test(l),
  );
  if (starHint) {
    strengths.push("You used situation/action/result language.");
  } else if (userLines.length > 0) {
    improvements.push(
      "Structure behavioral answers: situation, task, action, result.",
    );
  }

  improvements.push(
    `Tie examples explicitly to the ${meta.jobTitle} role at ${meta.company}.`,
  );

  const clarity = clampScore(avgLen > 80 ? 4 : 3);
  const relevance = clampScore(userLines.length >= 2 ? 4 : 3);
  const structure = clampScore(starHint ? 4 : 3);
  const roleFit = 3;

  return {
    strengths: strengths.slice(0, 5),
    improvements: improvements.slice(0, 5),
    rubric: { clarity, relevance, structure, roleFit },
    closingNote:
      "This debrief reflects your practice transcript only — not employer feedback.",
  };
}

async function ollamaEvaluate(
  turns: Turn[],
  meta: { jobTitle: string; company: string },
): Promise<MockInterviewSummary | null> {
  const url = process.env.OLLAMA_URL?.trim();
  const model = process.env.OLLAMA_MODEL?.trim() || "llama3.2:1b";
  if (!url) return null;

  const base = url.replace(/\/api\/chat\/?$/, "");
  const chatUrl = base.endsWith("/api/chat")
    ? base
    : `${base.replace(/\/$/, "")}/api/chat`;

  const transcript = turns
    .map((t) => `${t.role}: ${t.content}`)
    .join("\n")
    .slice(0, 8000);

  const body = {
    model,
    messages: [
      {
        role: "system",
        content:
          "Return JSON only with keys: strengths (string[]), improvements (string[]), " +
          "rubric {clarity,relevance,structure,roleFit} each 1-5, closingNote. " +
          "Only critique what appears in the transcript. Do not invent employers.",
      },
      {
        role: "user",
        content: JSON.stringify({
          job_title: meta.jobTitle,
          company: meta.company,
          transcript,
        }),
      },
    ],
    stream: false,
    format: "json",
    options: { temperature: 0.2, num_predict: 400 },
  };

  try {
    const res = await fetch(chatUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      message?: { content?: string };
    };
    const raw = data.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const rubric = (parsed.rubric as Record<string, unknown>) || {};
    return {
      strengths: Array.isArray(parsed.strengths)
        ? (parsed.strengths as string[]).slice(0, 8)
        : [],
      improvements: Array.isArray(parsed.improvements)
        ? (parsed.improvements as string[]).slice(0, 8)
        : [],
      rubric: {
        clarity: clampScore(Number(rubric.clarity) || 3),
        relevance: clampScore(Number(rubric.relevance) || 3),
        structure: clampScore(Number(rubric.structure) || 3),
        roleFit: clampScore(Number(rubric.roleFit) || 3),
      },
      closingNote:
        typeof parsed.closingNote === "string"
          ? parsed.closingNote.slice(0, 500)
          : "Practice session complete.",
    };
  } catch {
    return null;
  }
}

export async function buildMockInterviewSummary(
  turns: Turn[],
  meta: { jobTitle: string; company: string },
): Promise<MockInterviewSummary> {
  const fromOllama = await ollamaEvaluate(turns, meta);
  if (fromOllama) return fromOllama;
  return heuristicEvaluate(turns, meta);
}

export function voiceGatewayWsUrl(): string {
  return (
    process.env.VOICE_GATEWAY_WS?.trim() || "ws://127.0.0.1:8765/ws"
  );
}