export type MockInterviewContext = {
    jobTitle: string;
    company: string;
    sampleQuestions: string[];
    starTitles: string[];
};
export type ChatMessage = {
    role: "system" | "user" | "assistant";
    content: string;
};
const MAX_REPLY_CHARS = 400;
const MAX_TURNS = 10;
function groqKey(): string {
    return (process.env.QROK_API_KEY?.trim() ||
        process.env.GROQ_API_KEY?.trim() ||
        "");
}
export function hasMockInterviewLlm(): boolean {
    return Boolean(process.env.GOOGLE_API_KEY?.trim() ||
        process.env.OPENAI_API_KEY?.trim() ||
        groqKey() ||
        process.env.CEREBRAS_API_KEY?.trim());
}
function stripMarkdown(text: string): string {
    return text
        .replace(/[#*_`[\]]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_REPLY_CHARS);
}
function buildSystemPrompt(ctx: MockInterviewContext): string {
    const topics = ctx.sampleQuestions.slice(0, 8).join(" | ");
    const stars = ctx.starTitles.slice(0, 5).join(" | ");
    return (`You are a hiring manager interviewing for ${ctx.jobTitle} at ${ctx.company}. ` +
        "Ask ONE question per turn. Max two short spoken sentences. No lists, markdown, or emojis. " +
        "Briefly acknowledge the candidate's last answer when natural. " +
        "Only discuss this role and company; never invent employers or credentials. " +
        `Sample topics from prep (do not read verbatim): ${topics || "general fit"}. ` +
        `STAR story titles for reference: ${stars || "none"}.`);
}
function historyForLlm(turns: ChatMessage[]): ChatMessage[] {
    const system = turns.find((t) => t.role === "system");
    const rest = turns.filter((t) => t.role !== "system");
    const kept = rest.slice(-12);
    return system ? [system, ...kept] : kept;
}
async function chatGoogle(messages: ChatMessage[]): Promise<{
    text: string;
    model: string;
}> {
    const key = process.env.GOOGLE_API_KEY?.trim();
    if (!key)
        throw new Error("google_missing_key");
    const model = "gemini-2.5-flash";
    const system = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n");
    const dialog = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
    }));
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
            systemInstruction: system
                ? { parts: [{ text: system }] }
                : undefined,
            contents: dialog,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 180,
                thinkingConfig: { thinkingBudget: 0 },
            },
        }),
    });
    if (!res.ok)
        throw new Error(`google_http_${res.status}`);
    const data = (await res.json()) as {
        candidates?: {
            content?: {
                parts?: {
                    text?: string;
                }[];
            };
        }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
        "";
    if (!text.trim())
        throw new Error("google_empty");
    return { text: stripMarkdown(text), model: `google:${model}` };
}
async function chatOpenAiCompat(provider: "openai" | "groq", messages: ChatMessage[]): Promise<{
    text: string;
    model: string;
}> {
    const key = provider === "openai"
        ? process.env.OPENAI_API_KEY?.trim()
        : groqKey();
    if (!key)
        throw new Error(`${provider}_missing_key`);
    const url = provider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.groq.com/openai/v1/chat/completions";
    const model = provider === "openai" ? "gpt-4o-mini" : "openai/gpt-oss-20b";
    const res = await fetch(url, {
        method: "POST",
        headers: {
            authorization: `Bearer ${key}`,
            "content-type": "application/json",
        },
        body: JSON.stringify({
            model,
            temperature: 0.7,
            max_tokens: 180,
            messages,
        }),
    });
    if (!res.ok)
        throw new Error(`${provider}_http_${res.status}`);
    const data = (await res.json()) as {
        choices?: {
            message?: {
                content?: string;
            };
        }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text)
        throw new Error(`${provider}_empty`);
    return { text: stripMarkdown(text), model: `${provider}:${model}` };
}
export async function generateMockInterviewReply(ctx: MockInterviewContext, turns: MockInterviewTurnForLlm[]): Promise<{
    assistantText: string;
    modelUsed: string;
}> {
    const messages: ChatMessage[] = [
        { role: "system", content: buildSystemPrompt(ctx) },
        ...turns.map((t) => ({
            role: t.role,
            content: t.content,
        })),
    ];
    const providers: Array<() => Promise<{
        text: string;
        model: string;
    }>> = [];
    if (process.env.GOOGLE_API_KEY?.trim()) {
        providers.push(() => chatGoogle(historyForLlm(messages)));
    }
    if (process.env.OPENAI_API_KEY?.trim()) {
        providers.push(() => chatOpenAiCompat("openai", historyForLlm(messages)));
    }
    if (groqKey()) {
        providers.push(() => chatOpenAiCompat("groq", historyForLlm(messages)));
    }
    for (const attempt of providers) {
        try {
            const { text, model } = await attempt();
            return { assistantText: text, modelUsed: model };
        }
        catch {
            continue;
        }
    }
    return heuristicReply(ctx, turns);
}
export type MockInterviewTurnForLlm = {
    role: "user" | "assistant";
    content: string;
};
export function isInterviewEndPhrase(text: string): boolean {
    const lower = text.toLowerCase();
    return (lower.includes("end interview") ||
        lower.includes("goodbye") ||
        lower === "quit");
}
export function shouldEndSession(userTurnCount: number): boolean {
    return userTurnCount >= MAX_TURNS;
}
function heuristicReply(ctx: MockInterviewContext, turns: MockInterviewTurnForLlm[]): {
    assistantText: string;
    modelUsed: string;
} {
    const userCount = turns.filter((t) => t.role === "user").length;
    const questions = ctx.sampleQuestions.length
        ? ctx.sampleQuestions
        : [
            `What interests you about the ${ctx.jobTitle} role?`,
            "Tell me about a challenging project you led.",
            "How do you handle tight deadlines?",
            "Where do you see yourself contributing in the first 90 days?",
        ];
    const q = questions[userCount % questions.length] ?? questions[0]!;
    const lead = userCount === 0
        ? `Thanks for joining. I'm hiring for ${ctx.jobTitle} at ${ctx.company}.`
        : "Thanks for sharing that.";
    return {
        assistantText: stripMarkdown(`${lead} ${q}`),
        modelUsed: "heuristic:v1",
    };
}
export function openingLine(ctx: MockInterviewContext): {
    assistantText: string;
    modelUsed: string;
} {
    const first = ctx.sampleQuestions[0] ??
        `What draws you to the ${ctx.jobTitle} role here?`;
    const text = stripMarkdown(`Hi — I'm conducting a practice interview for ${ctx.jobTitle} at ${ctx.company}. ${first}`);
    return { assistantText: text, modelUsed: "heuristic:opening" };
}
