import type { SentenceRef } from "@readex/domain";

export type AudioReadiness = "ready" | "preparing" | "needs-attention" | "unavailable";
export type NarrationPlaybackMode = "html-audio" | "native-speech";

export interface SentenceAudio extends SentenceRef {
  readiness: AudioReadiness;
  durationSec: number | null;
  sourceUrl: string | null;
}

export interface SentenceNarration extends SentenceAudio {
  playbackMode: NarrationPlaybackMode;
  cached: boolean;
  message: string | null;
}

export interface SentenceNarrationRequest extends SentenceRef {
  sentenceIndex: number;
  text: string;
}

export interface NarrationGateway {
  prepareSentenceAudio(request: SentenceNarrationRequest): Promise<SentenceNarration>;
  playPreparedSentenceAudio(
    request: SentenceNarrationRequest,
    narration: SentenceNarration
  ): Promise<void>;
  stopPreparedSentenceAudio(): Promise<void>;
}

export class FakeNarrationGateway implements NarrationGateway {
  private readonly prepared = new Map<string, SentenceNarration>();

  async prepareSentenceAudio(request: SentenceNarrationRequest): Promise<SentenceNarration> {
    const existing = this.prepared.get(request.sentenceId);
    if (existing != null) return { ...existing, cached: true };

    const narration: SentenceNarration = {
      bookId: request.bookId,
      chapterId: request.chapterId,
      sentenceId: request.sentenceId,
      readiness: "ready",
      durationSec: estimateSentenceDurationSec(request.text),
      sourceUrl: createSilentWavDataUrl(estimateSentenceDurationSec(request.text)),
      playbackMode: "html-audio",
      cached: false,
      message: null
    };

    this.prepared.set(request.sentenceId, narration);
    return narration;
  }

  async playPreparedSentenceAudio(): Promise<void> {
    return undefined;
  }

  async stopPreparedSentenceAudio(): Promise<void> {
    return undefined;
  }
}

export function estimateSentenceDurationSec(text: string): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1.1, Math.min(12, wordCount * 0.34 + 0.5));
}

function createSilentWavDataUrl(durationSec: number): string {
  const sampleRate = 8000;
  const sampleCount = Math.max(1, Math.round(durationSec * sampleRate));
  const headerSize = 44;
  const bytes = new Uint8Array(headerSize + sampleCount);
  const view = new DataView(bytes.buffer);

  writeAscii(bytes, 0, "RIFF");
  view.setUint32(4, 36 + sampleCount, true);
  writeAscii(bytes, 8, "WAVE");
  writeAscii(bytes, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeAscii(bytes, 36, "data");
  view.setUint32(40, sampleCount, true);
  bytes.fill(128, headerSize);

  return `data:audio/wav;base64,${encodeBase64(bytes)}`;
}

function writeAscii(bytes: Uint8Array, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index);
  }
}

function encodeBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const hasSecond = index + 1 < bytes.length;
    const hasThird = index + 2 < bytes.length;
    const triplet = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);

    output += alphabet[(triplet >> 18) & 63];
    output += alphabet[(triplet >> 12) & 63];
    output += hasSecond ? alphabet[(triplet >> 6) & 63] : "=";
    output += hasThird ? alphabet[triplet & 63] : "=";
  }

  return output;
}
