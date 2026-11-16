"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { BlurText } from "@/components/ui/blur-text";
import { StatefulButton } from "@/components/ui/stateful-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, } from "@/components/ui/card";
import {
    MockInterviewDebriefCard,
    MockInterviewVoiceStage,
} from "@/components/mock-interview-voice-stage";
import {
    defaultVoiceGatewayWsUrl,
    probeVoiceGateway,
} from "@/lib/voice-gateway-client";
import {
    endMockInterviewAction,
    evaluateMockInterviewAction,
    getMockInterviewAction,
    mockInterviewTurnAction,
    startMockInterviewAction,
    type MockInterviewSessionPublic,
    type MockInterviewSummaryPublic,
    type MockInterviewVoiceContext,
} from "@/lib/actions/applications";
import {
    interviewerVoiceLabel,
    listEnglishVoices,
    pickInterviewerVoice,
    speakAsInterviewer,
    warmInterviewerVoices,
} from "@/lib/interviewer-speech";
type SpeechRecognitionCtor = new () => {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((ev: {
        results: {
            [i: number]: {
                [j: number]: {
                    transcript: string;
                };
            };
            length: number;
        };
    }) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
};
function getSpeechRecognition(): SpeechRecognitionCtor | null {
    if (typeof window === "undefined")
        return null;
    const w = window as Window & {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
export function MockInterviewPanel({ applicationId, initialSession, prepStatus, }: {
    applicationId: string;
    initialSession: MockInterviewSessionPublic | null;
    prepStatus: string;
}) {
    const [pending, start] = useTransition();
    const [session, setSession] = useState<MockInterviewSessionPublic | null>(initialSession);
    const [summary, setSummary] = useState<MockInterviewSummaryPublic | null>(
        initialSession?.summary ?? null,
    );
    const [draft, setDraft] = useState("");
    const [listening, setListening] = useState(false);
    const [speakEnabled, setSpeakEnabled] = useState(true);
    const [busyTurn, setBusyTurn] = useState(false);
    const [voiceOptions, setVoiceOptions] = useState<SpeechSynthesisVoice[]>([]);
    const [interviewerVoice, setInterviewerVoice] = useState<SpeechSynthesisVoice | null>(null);
    const [browserReady, setBrowserReady] = useState(false);
    const [sttSupported, setSttSupported] = useState(false);
    const [gatewayReachable, setGatewayReachable] = useState<boolean | null>(null);
    const [voiceMode, setVoiceMode] = useState(false);
    const [voiceRuntime, setVoiceRuntime] = useState<{
        sessionId: string;
        gatewayUrl: string;
        voiceContext: MockInterviewVoiceContext;
        openingText: string;
    } | null>(null);
    const recognitionRef = useRef<InstanceType<NonNullable<ReturnType<typeof getSpeechRecognition>>> | null>(null);
    const prepReady = prepStatus === "ready";
    const active = session?.status === "active";
    const canStart =
        prepReady &&
        session?.status !== "active" &&
        !summary &&
        !voiceRuntime;
    const useLocalGateway = voiceMode && voiceRuntime && gatewayReachable === true;
    const speak = useCallback((text: string) => {
        speakAsInterviewer(text, {
            enabled: speakEnabled,
            voice: interviewerVoice,
            rate: 0.94,
        });
    }, [speakEnabled, interviewerVoice]);

    const handleVoiceFallback = useCallback(() => {
        setVoiceMode(false);
        setVoiceRuntime(null);
        toast.message("Switched to browser voice");
    }, []);

    const handleVoiceCompleted = useCallback(
        (s: MockInterviewSummaryPublic) => {
            setSummary(s);
            setSession((prev) =>
                prev ? { ...prev, status: "completed", summary: s } : prev,
            );
            setVoiceMode(false);
            setVoiceRuntime(null);
        },
        [],
    );

    useEffect(() => {
        setSttSupported(Boolean(getSpeechRecognition()));
        const off = warmInterviewerVoices(() => {
            const voices = listEnglishVoices();
            setVoiceOptions(voices);
            setInterviewerVoice(pickInterviewerVoice(voices));
            setBrowserReady(true);
        });
        const fallback = window.setTimeout(() => setBrowserReady(true), 600);
        return () => {
            off();
            window.clearTimeout(fallback);
        };
    }, []);

    const refreshGatewayProbe = useCallback(() => {
        void probeVoiceGateway(defaultVoiceGatewayWsUrl()).then((ok) => {
            setGatewayReachable(ok);
        });
    }, []);

    useEffect(() => {
        refreshGatewayProbe();
        const onFocus = () => refreshGatewayProbe();
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [refreshGatewayProbe]);

    function appendTurns(prev: MockInterviewSessionPublic | null, userText: string, assistantText: string, done: boolean): MockInterviewSessionPublic | null {
        if (!prev)
            return prev;
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
            const gatewayUrl = data.voiceGatewayUrl ?? defaultVoiceGatewayWsUrl();
            const reachable = await probeVoiceGateway(gatewayUrl);
            setGatewayReachable(reachable);
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
            setSummary(null);
            if (reachable && data.voiceContext) {
                setVoiceMode(true);
                setVoiceRuntime({
                    sessionId: data.sessionId,
                    gatewayUrl,
                    voiceContext: data.voiceContext,
                    openingText: data.assistantText,
                });
                toast.success("Local voice gateway connected");
            } else {
                setVoiceMode(false);
                setVoiceRuntime(null);
                speak(data.assistantText);
                toast.success("Practice session started (browser voice)");
            }
        });
    }
    async function submitAnswer(text: string) {
        const trimmed = text.trim();
        if (!trimmed || !session?.sessionId || session.status !== "active")
            return;
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
        setSession((prev) => appendTurns(prev, trimmed, data.assistantText, data.done));
        speak(data.assistantText);
        if (data.done) {
            toast.message("Session complete — generating debrief…");
            const evalRes = await evaluateMockInterviewAction(applicationId, data.sessionId);
            if (evalRes.ok) setSummary(evalRes.data!.summary);
        }
    }
    function onSendDraft() {
        start(() => submitAnswer(draft));
    }
    function toggleMic() {
        const Ctor = getSpeechRecognition();
        if (!Ctor || !active)
            return;
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
        if (!session?.sessionId)
            return;
        start(async () => {
            const res = await endMockInterviewAction(applicationId, session.sessionId);
            if (!res.ok) {
                toast.error(res.error);
                return;
            }
            setSession((s) => (s ? { ...s, status: "completed" } : s));
            window.speechSynthesis.cancel();
            const evalRes = await evaluateMockInterviewAction(applicationId, session.sessionId);
            if (evalRes.ok) {
                setSummary(evalRes.data!.summary);
                toast.success("Debrief ready");
            } else {
                toast.success("Session ended");
            }
        });
    }
    async function onRefresh() {
        const res = await getMockInterviewAction(applicationId);
        if (res.ok && res.data?.session) {
            setSession(res.data.session);
            setSummary(res.data.session.summary ?? null);
        }
    }
    function resetForNewSession() {
        setSession(null);
        setSummary(null);
        setVoiceMode(false);
        setVoiceRuntime(null);
        setDraft("");
        window.speechSynthesis.cancel();
        void probeVoiceGateway(defaultVoiceGatewayWsUrl()).then((ok) => {
            setGatewayReachable(ok);
        });
    }
    return (<div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl space-y-2">
          <BlurText text="Voice mock interview" className="text-2xl font-semibold tracking-tight text-foreground" animateBy="words" delay={40}/>
          <p className="text-sm text-muted-foreground">
            Practice out loud. With the local gateway, speech stays on your machine (Whisper + Ollama + Piper).
          </p>
          {gatewayReachable === false && (
            <p className="text-xs text-amber-700 dark:text-amber-200">
              Voice gateway offline — start{" "}
              <code className="rounded bg-muted px-1">python -m voice_gateway</code>{" "}
              or use browser fallback below.
            </p>
          )}
          {!useLocalGateway && browserReady ? (
            voiceOptions.length > 1 ? (
            <label className="flex max-w-md flex-col gap-1 text-xs text-muted-foreground">
              Interviewer voice (browser fallback)
              <select
                className="h-9 cursor-pointer rounded-md border border-input bg-background px-2 text-sm text-foreground"
                value={interviewerVoice?.voiceURI ?? ""}
                onChange={(e) => {
                  const picked = voiceOptions.find(
                    (v) => v.voiceURI === e.target.value,
                  );
                  if (picked) setInterviewerVoice(picked);
                }}
              >
                {voiceOptions.slice(0, 12).map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name}
                    {!v.localService ? " · natural" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">
              Interviewer voice: {interviewerVoiceLabel(interviewerVoice)}
            </p>
          )) : !browserReady ? (
            <p className="text-xs text-muted-foreground">Loading audio…</p>
          ) : null}
        </div>
        {canStart && (<StatefulButton type="button" className="cursor-pointer shrink-0" disabled={pending} onClick={onStart}>
            Start practice
          </StatefulButton>)}
      </div>

      {!prepReady && (<p className="text-sm text-amber-700 dark:text-amber-200">
          Generate interview prep first — voice practice uses your grounded prep
          pack.
        </p>)}

      {useLocalGateway && voiceRuntime && (
        <MockInterviewVoiceStage
          key={voiceRuntime.sessionId}
          applicationId={applicationId}
          sessionId={voiceRuntime.sessionId}
          gatewayUrl={voiceRuntime.gatewayUrl}
          voiceContext={voiceRuntime.voiceContext}
          openingText={voiceRuntime.openingText}
          onFallback={handleVoiceFallback}
          onCompleted={handleVoiceCompleted}
        />
      )}

      {active && !useLocalGateway && (<Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base">Live session (browser)</CardTitle>
            <div className="flex gap-2">
              <Button type="button" size="icon" variant="outline" className="cursor-pointer" aria-label={speakEnabled ? "Mute interviewer" : "Unmute interviewer"} onClick={() => setSpeakEnabled((v) => !v)}>
                {speakEnabled ? (<Volume2 className="size-4"/>) : (<VolumeX className="size-4"/>)}
              </Button>
              {browserReady && sttSupported && (<Button type="button" size="icon" variant={listening ? "default" : "outline"} className="cursor-pointer" disabled={busyTurn} aria-label="Speak answer" onClick={toggleMic}>
                  {listening ? (<Mic className="size-4"/>) : (<MicOff className="size-4"/>)}
                </Button>)}
              <Button type="button" variant="ghost" size="sm" className="cursor-pointer" onClick={onEndSession}>
                End &amp; evaluate
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border bg-muted/20 p-3 text-sm">
              {session.turns.map((t, i) => (<p key={`${i}-${t.role}`} className={t.role === "assistant"
                    ? "text-foreground"
                    : "text-muted-foreground"}>
                  <span className="font-medium capitalize">{t.role}: </span>
                  {t.content}
                </p>))}
            </div>
            <div className="space-y-2">
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={browserReady && sttSupported
                ? "Type an answer or use the mic"
                : "Type your answer"} rows={3} disabled={busyTurn}/>
              <StatefulButton type="button" className="cursor-pointer" disabled={busyTurn || !draft.trim()} onClick={onSendDraft}>
                {busyTurn ? "Sending…" : "Send answer"}
              </StatefulButton>
            </div>
          </CardContent>
        </Card>)}

      {summary && (
        <MockInterviewDebriefCard summary={summary} onNewSession={resetForNewSession} />
      )}

      {session?.status === "completed" && !summary && (<Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Session finished.{" "}
            <button type="button" className="cursor-pointer text-primary underline" onClick={resetForNewSession}>
              Start a new session
            </button>
          </CardContent>
        </Card>)}
    </div>);
}