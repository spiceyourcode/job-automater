/** Local voice gateway WebSocket client (127.0.0.1 sidecar — no secrets). */

export type VoiceGatewayPhase = "idle" | "listening" | "thinking" | "speaking";

export type VoiceGatewayContext = {
  jobTitle: string;
  company: string;
  sampleQuestions: string[];
  starTitles: string[];
};

export type VoiceGatewayHandlers = {
  onPhase?: (phase: VoiceGatewayPhase) => void;
  onError?: (code: string) => void;
  onUserText?: (text: string) => void;
  onAssistantText?: (text: string) => void;
  onAssistantPartial?: (text: string) => void;
  onTurnStart?: (turnId: string) => void;
  onTurnEnd?: (turnId: string) => void;
  onInterrupt?: (turnId: string) => void;
  onHandsFree?: (enabled: boolean) => void;
  onAudioLevel?: (level: number) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

export function defaultVoiceGatewayWsUrl(): string {
  return (
    process.env.NEXT_PUBLIC_VOICE_GATEWAY_WS?.trim() ||
    "ws://127.0.0.1:8765/ws"
  );
}

export function voiceGatewayHttpBase(wsUrl: string): string {
  const u = wsUrl.replace(/\/ws\/?$/, "").replace(/^ws:/, "http:");
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

export async function probeVoiceGateway(wsUrl?: string): Promise<boolean> {
  const base = voiceGatewayHttpBase(wsUrl ?? defaultVoiceGatewayWsUrl());
  try {
    const res = await fetch(`${base}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

type WsIncoming =
  | { type: "phase"; phase: VoiceGatewayPhase }
  | { type: "text"; role: "user" | "assistant"; content: string; turnId?: string }
  | { type: "partial_text"; role: "assistant"; content: string; turnId?: string }
  | { type: "audio"; format: string; data: string; turnId?: string; final?: boolean }
  | { type: "audio_chunk"; format: string; data: string; turnId?: string }
  | { type: "error"; code: string }
  | { type: "listen_mode"; mode: string; enabled?: boolean }
  | { type: "turn_start"; turnId: string }
  | { type: "turn_end"; turnId: string }
  | { type: "interrupt"; turnId?: string };

const STT_SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = 480;

function encodePcm16Wav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

/** Decode browser WebM/Opus to 16 kHz mono WAV for faster-whisper (no server ffmpeg). */
async function mediaBlobToWav16k(blob: Blob): Promise<Blob> {
  const decodeCtx = new AudioContext();
  try {
    const decoded = await decodeCtx.decodeAudioData(
      await blob.arrayBuffer(),
    );
    const frames = Math.ceil(decoded.duration * STT_SAMPLE_RATE);
    const offline = new OfflineAudioContext(1, frames, STT_SAMPLE_RATE);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    const pcm = rendered.getChannelData(0);
    return new Blob([encodePcm16Wav(pcm, STT_SAMPLE_RATE)], {
      type: "audio/wav",
    });
  } finally {
    await decodeCtx.close();
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? "");
      const idx = raw.indexOf(",");
      resolve(idx >= 0 ? raw.slice(idx + 1) : raw);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] ?? 0);
  return btoa(binary);
}

function floatToPcm16Base64(samples: Float32Array): string {
  const buf = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return arrayBufferToBase64(buf);
}

export class VoiceGatewayClient {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelStop: (() => void) | null = null;
  private recorder: MediaRecorder | null = null;
  private recordChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private closed = false;
  private handsFree = false;
  private continuousActive = false;
  private scriptNode: ScriptProcessorNode | null = null;
  private captureCtx: AudioContext | null = null;
  private pcmCarry = new Float32Array(0);
  private playbackTurnId: string | null = null;
  private playbackQueue: Promise<void> = Promise.resolve();
  private currentSource: AudioBufferSourceNode | null = null;
  /** Server-side VAD handles barge-in; client mic picks up speaker echo. */
  private clientBargeInEnabled = false;
  private bargeInThreshold = 0.12;

  constructor(
    private readonly wsUrl: string,
    private readonly handlers: VoiceGatewayHandlers = {},
  ) {}

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    this.closed = false;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;
      ws.onopen = () => {
        this.handlers.onOpen?.();
        resolve();
      };
      ws.onerror = () => reject(new Error("ws_failed"));
      ws.onclose = () => {
        if (!this.closed) {
          this.handlers.onClose?.();
        }
        this.ws = null;
      };
      ws.onmessage = (ev) => {
        void this.onMessage(String(ev.data));
      };
    });
  }

  disconnect(): void {
    this.closed = true;
    this.stopContinuousListen();
    this.stopLevelMeter();
    this.stopPlayback();
    this.ws?.close();
    this.ws = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.audioCtx?.close();
    this.audioCtx = null;
  }

  sendHello(
    sessionId: string,
    ctx: VoiceGatewayContext,
    opts?: { requestOpening?: boolean; handsFree?: boolean },
  ): void {
    this.handsFree = Boolean(opts?.handsFree);
    this.send({
      type: "hello",
      sessionId,
      jobTitle: ctx.jobTitle,
      company: ctx.company,
      sampleQuestions: ctx.sampleQuestions,
      starTitles: ctx.starTitles,
      requestOpening: Boolean(opts?.requestOpening),
      handsFree: this.handsFree,
    });
  }

  speakText(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.send({ type: "tts", text: trimmed });
  }

  sendInterrupt(turnId?: string): void {
    this.send({ type: "interrupt", turnId });
    this.stopPlayback();
  }

  async sendUtteranceBlob(blob: Blob, format = "webm"): Promise<void> {
    const data = await blobToBase64(blob);
    this.send({ type: "utterance", format, data });
  }

  sendEnd(): void {
    this.send({ type: "end" });
  }

  async startMic(): Promise<void> {
    if (!this.stream) {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    this.recordChunks = [];
    const mime =
      MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
    const rec = new MediaRecorder(this.stream, { mimeType: mime });
    this.recorder = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordChunks.push(e.data);
    };
    rec.start(250);
    this.handlers.onPhase?.("listening");
  }

  async stopMicAndSend(): Promise<void> {
    const rec = this.recorder;
    if (!rec || rec.state === "inactive") return;
    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
      rec.stop();
    });
    this.recorder = null;
    const blob = new Blob(this.recordChunks, {
      type: rec.mimeType || "audio/webm",
    });
    this.recordChunks = [];
    if (blob.size < 32) {
      this.handlers.onError?.("empty_audio");
      this.handlers.onPhase?.("idle");
      return;
    }
    try {
      const wav = await mediaBlobToWav16k(blob);
      await this.sendUtteranceBlob(wav, "wav");
    } catch {
      this.handlers.onError?.("stt_encode");
      this.handlers.onPhase?.("idle");
    }
  }

  async startContinuousListen(): Promise<void> {
    if (!this.handsFree || this.continuousActive) return;
    if (!this.stream) {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    this.captureCtx = new AudioContext();
    const src = this.captureCtx.createMediaStreamSource(this.stream);
    const processor = this.captureCtx.createScriptProcessor(4096, 1, 1);
    this.scriptNode = processor;
    processor.onaudioprocess = (ev) => {
      if (!this.connected || this.closed) return;
      const input = ev.inputBuffer.getChannelData(0);
      const ratio = this.captureCtx!.sampleRate / STT_SAMPLE_RATE;
      const outLen = Math.floor(input.length / ratio);
      const down = new Float32Array(outLen);
      for (let i = 0; i < outLen; i++) {
        down[i] = input[Math.floor(i * ratio)] ?? 0;
      }
      const merged = new Float32Array(this.pcmCarry.length + down.length);
      merged.set(this.pcmCarry);
      merged.set(down, this.pcmCarry.length);
      let offset = 0;
      while (offset + CHUNK_SAMPLES <= merged.length) {
        const slice = merged.subarray(offset, offset + CHUNK_SAMPLES);
        offset += CHUNK_SAMPLES;
        const b64 = floatToPcm16Base64(slice);
        this.send({
          type: "audio_chunk",
          format: "pcm16",
          sampleRate: STT_SAMPLE_RATE,
          data: b64,
        });
        if (this.clientBargeInEnabled && this.playbackTurnId) {
          let sum = 0;
          for (let i = 0; i < slice.length; i++) sum += Math.abs(slice[i] ?? 0);
          const avg = sum / slice.length;
          if (avg > this.bargeInThreshold) {
            this.sendInterrupt(this.playbackTurnId);
          }
        }
      }
      this.pcmCarry = merged.subarray(offset);
    };
    const silent = this.captureCtx.createGain();
    silent.gain.value = 0;
    src.connect(processor);
    processor.connect(silent);
    silent.connect(this.captureCtx.destination);
    this.continuousActive = true;
  }

  stopContinuousListen(): void {
    this.continuousActive = false;
    this.pcmCarry = new Float32Array(0);
    this.scriptNode?.disconnect();
    this.scriptNode = null;
    void this.captureCtx?.close();
    this.captureCtx = null;
  }

  private send(payload: Record<string, unknown>): void {
    if (!this.connected) {
      this.handlers.onError?.("not_connected");
      return;
    }
    this.ws!.send(JSON.stringify(payload));
  }

  private async ensurePlaybackGraph(): Promise<void> {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }
  }

  private stopPlayback(): void {
    try {
      this.currentSource?.stop();
    } catch {
      /* already stopped */
    }
    this.currentSource = null;
    this.playbackTurnId = null;
    this.stopLevelMeter();
    this.playbackQueue = Promise.resolve();
  }

  private startLevelMeter(): void {
    if (!this.analyser || !this.handlers.onAudioLevel) return;
    this.stopLevelMeter();
    const analyser = this.analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] ?? 0;
      this.handlers.onAudioLevel?.(sum / data.length / 255);
      raf = requestAnimationFrame(tick);
    };
    tick();
    this.levelStop = () => cancelAnimationFrame(raf);
  }

  private stopLevelMeter(): void {
    this.levelStop?.();
    this.levelStop = null;
    this.handlers.onAudioLevel?.(0);
  }

  private enqueuePlayback(task: () => Promise<void>): void {
    this.playbackQueue = this.playbackQueue.then(task).catch(() => undefined);
  }

  private async playWavBase64(b64: string, turnId?: string): Promise<void> {
    if (!b64) return;
    await this.ensurePlaybackGraph();
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    let buffer: AudioBuffer;
    try {
      buffer = await this.audioCtx!.decodeAudioData(bytes.buffer.slice(0));
    } catch {
      throw new Error("decode_failed");
    }
    if (turnId && this.playbackTurnId && turnId !== this.playbackTurnId) {
      return;
    }
    const source = this.audioCtx!.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser!);
    this.currentSource = source;
    if (turnId) this.playbackTurnId = turnId;
    this.startLevelMeter();
    await new Promise<void>((resolve) => {
      source.onended = () => {
        if (this.currentSource === source) this.currentSource = null;
        this.stopLevelMeter();
        resolve();
      };
      source.start(0);
    });
  }

  private async onMessage(raw: string): Promise<void> {
    let msg: WsIncoming;
    try {
      msg = JSON.parse(raw) as WsIncoming;
    } catch {
      this.handlers.onError?.("bad_json");
      return;
    }
    if (msg.type === "phase") {
      this.handlers.onPhase?.(msg.phase);
      if (msg.phase === "idle" && this.handsFree) {
        void this.startContinuousListen();
      }
      return;
    }
    if (msg.type === "listen_mode") {
      this.handsFree = Boolean(msg.enabled ?? msg.mode === "continuous");
      this.handlers.onHandsFree?.(this.handsFree);
      if (this.handsFree) void this.startContinuousListen();
      return;
    }
    if (msg.type === "turn_start") {
      this.playbackTurnId = msg.turnId;
      this.handlers.onTurnStart?.(msg.turnId);
      return;
    }
    if (msg.type === "turn_end") {
      this.handlers.onTurnEnd?.(msg.turnId);
      if (this.playbackTurnId === msg.turnId) {
        this.playbackTurnId = null;
      }
      return;
    }
    if (msg.type === "interrupt") {
      this.stopPlayback();
      if (msg.turnId) this.handlers.onInterrupt?.(msg.turnId);
      return;
    }
    if (msg.type === "error") {
      this.handlers.onError?.(msg.code);
      return;
    }
    if (msg.type === "text") {
      if (msg.role === "user") this.handlers.onUserText?.(msg.content);
      else this.handlers.onAssistantText?.(msg.content);
      return;
    }
    if (msg.type === "partial_text") {
      this.handlers.onAssistantPartial?.(msg.content);
      return;
    }
    if (msg.type === "audio_chunk" && msg.data) {
      const turnId = msg.turnId;
      this.enqueuePlayback(async () => {
        if (turnId) this.playbackTurnId = turnId;
        this.handlers.onPhase?.("speaking");
        try {
          await this.playWavBase64(msg.data, turnId);
        } catch {
          this.handlers.onError?.("audio_playback");
        }
      });
      return;
    }
    if (msg.type === "audio") {
      if (msg.final && !msg.data) {
        await this.playbackQueue;
        this.playbackTurnId = null;
        this.handlers.onPhase?.("idle");
        return;
      }
      if (!msg.data) return;
      const turnId = msg.turnId;
      this.enqueuePlayback(async () => {
        if (turnId) this.playbackTurnId = turnId;
        this.handlers.onPhase?.("speaking");
        try {
          await this.playWavBase64(msg.data, turnId);
        } catch {
          this.handlers.onError?.("audio_playback");
        }
      });
    }
  }
}