"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Orb from "@/components/Orb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  endMockInterviewAction,
  evaluateMockInterviewAction,
  mockInterviewTurnAction,
  type MockInterviewSummaryPublic,
} from "@/lib/actions/applications";
import {
  VoiceGatewayClient,
  type VoiceGatewayContext,
  type VoiceGatewayPhase,
} from "@/lib/voice-gateway-client";

type PendingTurn = { userText: string; assistantText: string };

type Props = {
  applicationId: string;
  sessionId: string;
  gatewayUrl: string;
  voiceContext: VoiceGatewayContext;
  openingText: string;
  onFallback: () => void;
  onCompleted: (summary: MockInterviewSummaryPublic) => void;
};

const phaseLabel: Record<VoiceGatewayPhase, string> = {
  idle: "Tap the orb or hold Space to answer",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking",
};

export function MockInterviewVoiceStage({
  applicationId,
  sessionId,
  gatewayUrl,
  voiceContext,
  openingText,
  onFallback,
  onCompleted,
}: Props) {
  const clientRef = useRef<VoiceGatewayClient | null>(null);
  const pendingTurnRef = useRef<PendingTurn | null>(null);
  const userLineRef = useRef("");
  const [phase, setPhase] = useState<VoiceGatewayPhase>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastLine, setLastLine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncTurn = useCallback(
    async (userText: string, assistantText: string) => {
      setBusy(true);
      const res = await mockInterviewTurnAction(applicationId, {
        sessionId,
        candidateText: userText,
        assistantText,
      });
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return null;
      }
      return res.data!;
    },
    [applicationId, sessionId],
  );

  const onFallbackRef = useRef(onFallback);
  const onCompletedRef = useRef(onCompleted);
  onFallbackRef.current = onFallback;
  onCompletedRef.current = onCompleted;

  const flushPendingTurn = useCallback(async () => {
    const pending = pendingTurnRef.current;
    if (!pending?.userText.trim() || !pending.assistantText.trim()) return;
    pendingTurnRef.current = null;
    const data = await syncTurn(pending.userText, pending.assistantText);
    if (!data) return;
    setLastLine(data.assistantText);
    if (data.done) {
      const endRes = await endMockInterviewAction(applicationId, sessionId);
      if (!endRes.ok) {
        toast.error(endRes.error);
        return;
      }
      const evalRes = await evaluateMockInterviewAction(applicationId, sessionId);
      if (!evalRes.ok) {
        toast.error(evalRes.error);
        return;
      }
      clientRef.current?.sendEnd();
      onCompletedRef.current(evalRes.data!.summary);
      toast.success("Debrief ready");
    }
  }, [applicationId, sessionId, syncTurn]);

  const flushPendingRef = useRef(flushPendingTurn);
  flushPendingRef.current = flushPendingTurn;

  useEffect(() => {
    let fellBack = false;
    const fallBackOnce = () => {
      if (fellBack) return;
      fellBack = true;
      onFallbackRef.current();
    };
    const client = new VoiceGatewayClient(gatewayUrl, {
      onPhase: (p) => {
        setPhase(p);
        if (p === "idle") void flushPendingRef.current();
      },
      onError: (code) => {
        setError(code);
        if (code === "not_connected") {
          fallBackOnce();
          return;
        }
        const recoverable = new Set([
          "empty_audio",
          "stt_encode",
          "stt_failed",
          "stt_webm_unsupported",
          "no_speech_detected",
          "ollama_unavailable",
          "ollama_empty",
          "piper_failed",
          "utterance_failed",
          "audio_playback",
        ]);
        if (recoverable.has(code)) {
          toast.message(`Voice issue (${code}) — try again or use browser fallback`);
        }
      },
      onUserText: (t) => {
        userLineRef.current = t;
        setLastLine(t);
        pendingTurnRef.current = {
          userText: t,
          assistantText: pendingTurnRef.current?.assistantText ?? "",
        };
      },
      onAssistantText: (t) => {
        setLastLine(t);
        pendingTurnRef.current = {
          userText: userLineRef.current,
          assistantText: t,
        };
      },
      onAudioLevel: setAudioLevel,
      onClose: () => {
        fallBackOnce();
      },
    });
    clientRef.current = client;

    let cancelled = false;
    (async () => {
      try {
        await client.connect();
        if (cancelled) return;
        client.sendHello(sessionId, voiceContext);
        client.speakText(openingText);
      } catch {
        if (!cancelled) fallBackOnce();
      }
    })();

    return () => {
      cancelled = true;
      client.disconnect();
      clientRef.current = null;
    };
    // One gateway connection per session; props captured at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable session wire-up
  }, [gatewayUrl, sessionId]);

  const beginListen = useCallback(async () => {
    const client = clientRef.current;
    if (!client?.connected || busy) return;
    if (phase === "thinking" || phase === "speaking") return;
    setListening(true);
    setError(null);
    pendingTurnRef.current = null;
    try {
      await client.startMic();
    } catch {
      toast.error("Microphone permission denied");
      setListening(false);
    }
  }, [busy, phase]);

  const endListen = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !listening) return;
    setListening(false);
    await client.stopMicAndSend();
  }, [listening]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (phase !== "idle" && phase !== "listening") return;
      e.preventDefault();
      void beginListen();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (!listening) return;
      e.preventDefault();
      void endListen();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [beginListen, endListen, listening, phase]);

  async function onOrbClick() {
    if (listening) await endListen();
    else await beginListen();
  }

  async function onEndSession() {
    const client = clientRef.current;
    client?.sendEnd();
    const endRes = await endMockInterviewAction(applicationId, sessionId);
    if (!endRes.ok) {
      toast.error(endRes.error);
      return;
    }
    const evalRes = await evaluateMockInterviewAction(applicationId, sessionId);
    if (!evalRes.ok) {
      toast.error(evalRes.error);
      return;
    }
    onCompleted(evalRes.data!.summary);
  }

  const orbIntensity =
    phase === "speaking"
      ? 0.55 + audioLevel * 2.2
      : phase === "listening"
        ? 1.15
        : phase === "thinking"
          ? 0.85
          : 0.45;

  return (
    <div className="relative flex min-h-[72vh] flex-col items-center justify-center gap-6">
      <button
        type="button"
        className="relative flex size-72 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={listening ? "Stop speaking" : "Speak answer"}
        disabled={busy || phase === "thinking" || phase === "speaking"}
        onClick={() => void onOrbClick()}
      >
        <Orb
          className="pointer-events-none size-full max-h-72 max-w-72"
          hoverIntensity={orbIntensity}
          forceHoverState={phase !== "idle"}
          glow={1.1 + audioLevel * 1.5}
          speed={phase === "thinking" ? 1.4 : 1}
          opacity={0.95}
        />
      </button>
      <p className="text-center text-sm text-muted-foreground">
        {busy ? "Saving turn…" : phaseLabel[phase]}
      </p>
      {lastLine && (
        <p className="max-w-lg text-center text-sm text-foreground/90 line-clamp-3">
          {lastLine}
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive">Gateway: {error}</p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={onFallback}
        >
          Browser fallback
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="cursor-pointer"
          disabled={busy}
          onClick={() => void onEndSession()}
        >
          End &amp; evaluate
        </Button>
      </div>
    </div>
  );
}

export function MockInterviewDebriefCard({
  summary,
  onNewSession,
}: {
  summary: MockInterviewSummaryPublic;
  onNewSession: () => void;
}) {
  const rows = [
    ["Clarity", summary.rubric.clarity],
    ["Relevance", summary.rubric.relevance],
    ["Structure", summary.rubric.structure],
    ["Role fit", summary.rubric.roleFit],
  ] as const;
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">Practice debrief</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map(([label, score]) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2"
            >
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium tabular-nums">{score}/5</span>
            </div>
          ))}
        </div>
        {summary.strengths.length > 0 && (
          <div>
            <p className="mb-1 font-medium">Strengths</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {summary.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {summary.improvements.length > 0 && (
          <div>
            <p className="mb-1 font-medium">Improve next time</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {summary.improvements.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{summary.closingNote}</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="cursor-pointer"
          onClick={onNewSession}
        >
          Start another session
        </Button>
      </CardContent>
    </Card>
  );
}