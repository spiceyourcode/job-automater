"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { BlurText } from "@/components/ui/blur-text";
import { StatefulButton } from "@/components/ui/stateful-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  endMockInterviewAction,
  getMockInterviewAction,
  mockInterviewTurnAction,
  startMockInterviewAction,
  type MockInterviewSessionPublic,
} from "@/lib/actions/applications";

type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: { [i: number]: { [j: number]: { transcript: string } }; length: number } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function MockInterviewPanel({
  applicationId,
  initialSession,
  prepStatus,
}: {
  applicationId: string;
  initialSession: MockInterviewSessionPublic | null;
  prepStatus: string;
}) {
  const [pending, start] = useTransition();
  const [session, setSession] = useState<MockInterviewSessionPublic | null>(
    initialSession,
  );
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const [busyTurn, setBusyTurn] = useState(false);
  const recognitionRef = useRef<InstanceType<NonNullable<ReturnType<typeof getSpeechRecognition>>> | null>(null);

  const prepReady = prepStatus === "ready";
  const active = session?.status === "active";
  const canStart = prepReady && !active;

  const sttSupported = useMemo(() => Boolean(getSpeechRecognition()), []);

  const speak = useCallback(
    (text: string) => {
      if (!speakEnabled || typeof window === "undefined") return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
    },
    [speakEnabled],
  );

  useEffect(() => {
    const last = session?.turns.at(-1);
    if (last?.role === "assistant" && active) {
      speak(last.content);
    }
  }, [session?.turns, active, speak]);

  function appendTurns(
    prev: MockInterviewSessionPublic | null,
    userText: string,
    assistantText: string,
    done: boolean,
  ): MockInterviewSessionPublic | null {
    if (!prev) return prev;
    const turns = [
      ...prev.turns,
      { role: "user" as const, content: userText },
      { role: "assistant" as const, content: assistantText },
    ];
    return {
      ...prev,
      status: done ? "completed" : "active",
      turns,
      turnIndex: prev.turnIndex + 1,
    };
  }

  function onStart() {
    start(async () => {
      const res = await startMockInterviewAction(applicationId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const data = res.data!;
      const next: MockInterviewSessionPublic = {
        sessionId: data.sessionId,
        applicationId,
        status: "active",
        turns: [
          { role: "user", content: "Hello, I'm ready for the interview." },
          { role: "assistant", content: data.assistantText },
        ],
        turnIndex: 0,
        modelUsed: null,
        updatedAt: new Date().toISOString(),
      };
      setSession(next);
      speak(data.assistantText);
      toast.success("Practice session started");
    });
  }

  async function submitAnswer(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !session?.sessionId || session.status !== "active") return;
    setBusyTurn(true);
    setDraft("");
    const res = await mockInterviewTurnAction(applicationId, {
      sessionId: session.sessionId,
      candidateText: trimmed,
    });
    setBusyTurn(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const data = res.data!;
    setSession((prev) =>
      appendTurns(prev, trimmed, data.assistantText, data.done),
    );
    speak(data.assistantText);
    if (data.done) {
      toast.message("Session complete — good practice!");
    }
  }

  function onSendDraft() {
    start(() => submitAnswer(draft));
  }

  function toggleMic() {
    const Ctor = getSpeechRecognition();
    if (!Ctor || !active) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    let buffer = "";
    rec.onresult = (ev) => {
      const parts: string[] = [];
      for (let i = 0; i < ev.results.length; i++) {
        parts.push(ev.results[i]![0]!.transcript);
      }
      buffer = parts.join(" ").trim();
      setDraft(buffer);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      if (buffer.trim()) {
        start(() => submitAnswer(buffer));
      }
    };
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  function onEndSession() {
    if (!session?.sessionId) return;
    start(async () => {
      const res = await endMockInterviewAction(applicationId, session.sessionId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSession((s) => (s ? { ...s, status: "completed" } : s));
      window.speechSynthesis.cancel();
      toast.success("Session ended");
    });
  }

  async function onRefresh() {
    const res = await getMockInterviewAction(applicationId);
    if (res.ok && res.data?.session) {
      setSession(res.data.session);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl space-y-2">
          <BlurText
            text="Voice mock interview"
            className="text-2xl font-semibold tracking-tight text-foreground"
            animateBy="words"
            delay={40}
          />
          <p className="text-sm text-muted-foreground">
            Practice out loud with a mock hiring manager. Voice stays in your
            browser — nothing is sent to employers.
          </p>
        </div>
        {canStart && (
          <StatefulButton
            type="button"
            className="cursor-pointer shrink-0"
            disabled={pending}
            onClick={onStart}
          >
            Start practice
          </StatefulButton>
        )}
      </div>

      {!prepReady && (
        <p className="text-sm text-amber-700 dark:text-amber-200">
          Generate interview prep first — voice practice uses your grounded prep
          pack.
        </p>
      )}

      {active && (
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base">Live session</CardTitle>
            <div className="flex gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="cursor-pointer"
                aria-label={speakEnabled ? "Mute interviewer" : "Unmute interviewer"}
                onClick={() => setSpeakEnabled((v) => !v)}
              >
                {speakEnabled ? (
                  <Volume2 className="size-4" />
                ) : (
                  <VolumeX className="size-4" />
                )}
              </Button>
              {sttSupported && (
                <Button
                  type="button"
                  size="icon"
                  variant={listening ? "default" : "outline"}
                  className="cursor-pointer"
                  disabled={busyTurn}
                  aria-label="Speak answer"
                  onClick={toggleMic}
                >
                  {listening ? (
                    <Mic className="size-4" />
                  ) : (
                    <MicOff className="size-4" />
                  )}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="cursor-pointer"
                onClick={onEndSession}
              >
                End
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border bg-muted/20 p-3 text-sm">
              {session.turns.map((t, i) => (
                <p
                  key={`${i}-${t.role}`}
                  className={
                    t.role === "assistant"
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }
                >
                  <span className="font-medium capitalize">{t.role}: </span>
                  {t.content}
                </p>
              ))}
            </div>
            <div className="space-y-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  sttSupported
                    ? "Type an answer or use the mic"
                    : "Type your answer"
                }
                rows={3}
                disabled={busyTurn}
              />
              <StatefulButton
                type="button"
                className="cursor-pointer"
                disabled={busyTurn || !draft.trim()}
                onClick={onSendDraft}
              >
                {busyTurn ? "Sending…" : "Send answer"}
              </StatefulButton>
            </div>
          </CardContent>
        </Card>
      )}

      {session?.status === "completed" && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Session finished.{" "}
            <button
              type="button"
              className="cursor-pointer text-primary underline"
              onClick={() => {
                setSession(null);
                void onRefresh();
              }}
            >
              Start a new session
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}