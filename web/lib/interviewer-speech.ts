/** Browser TTS tuned for mock-interview — picks the least robotic English voice available. */

function scoreVoice(v: SpeechSynthesisVoice): number {
  let score = 0;
  const name = v.name.toLowerCase();
  const lang = v.lang.toLowerCase();
  if (!lang.startsWith("en")) return -1000;
  if (lang.startsWith("en-us")) score += 8;

  if (!v.localService) score += 45;
  if (name.includes("natural") || name.includes("neural")) score += 40;
  if (name.includes("online")) score += 25;
  if (name.includes("google")) score += 30;
  if (name.includes("microsoft")) score += 20;
  if (
    name.includes("jenny") ||
    name.includes("aria") ||
    name.includes("sonia") ||
    name.includes("emma")
  ) {
    score += 18;
  }
  if (name.includes("samantha") || name.includes("karen") || name.includes("moira")) {
    score += 12;
  }
  if (name.includes("zira") || name.includes("david") || name.includes("mark")) {
    score -= 25;
  }
  return score;
}

export function listEnglishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined") return [];
  const voices = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith("en"));
  return [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
}

export function pickInterviewerVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const sorted = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return sorted[0] ?? null;
}

export function prepareTextForSpeech(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/—/g, ", ")
    .trim();
}

export function splitForNaturalSpeech(text: string): string[] {
  const clean = prepareTextForSpeech(text);
  if (!clean) return [];
  const parts = clean.split(/(?<=[.?!])\s+/).filter((p) => p.length > 0);
  return parts.length > 0 ? parts : [clean];
}

/** Call once after mount so Chromium loads cloud voices (voiceschanged). */
export function warmInterviewerVoices(onReady: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const synth = window.speechSynthesis;
  const handler = () => {
    onReady();
  };
  synth.addEventListener("voiceschanged", handler);
  synth.getVoices();
  if (synth.getVoices().length > 0) handler();
  return () => synth.removeEventListener("voiceschanged", handler);
}

export function speakAsInterviewer(
  text: string,
  options: {
    enabled: boolean;
    voice: SpeechSynthesisVoice | null;
    rate?: number;
  },
): void {
  if (!options.enabled || typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  synth.cancel();

  const clauses = splitForNaturalSpeech(text);
  const rate = options.rate ?? 0.94;
  let index = 0;

  const speakNext = () => {
    if (index >= clauses.length) return;
    const utter = new SpeechSynthesisUtterance(clauses[index]!);
    utter.voice = options.voice;
    utter.rate = rate;
    utter.pitch = 1;
    utter.volume = 1;
    index += 1;
    utter.onend = () => {
      if (index < clauses.length) speakNext();
    };
    synth.speak(utter);
  };

  speakNext();
}

export function interviewerVoiceLabel(v: SpeechSynthesisVoice | null): string {
  if (!v) return "System default";
  const tag = v.localService ? "local" : "natural";
  return `${v.name} (${tag})`;
}