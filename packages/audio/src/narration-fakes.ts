import type {
  NarrationEngineId,
  NarrationPreparationAdapter,
  NarrationPreparationRequest,
  NarrationSentence,
  NarrationSentenceSpan,
  PreparedNarration
} from "./narration-contracts";
import type {
  NarrationGateway,
  SentenceNarration,
  SentenceNarrationRequest
} from "./legacy-narration";
import { createNarrationAssetIdentity } from "./narration-identity";
import { assertPreparedNarration } from "./narration-manifest";

export class FakePassageNarrationAdapter implements NarrationPreparationAdapter {
  private readonly adapter = new DeterministicNarrationAdapter("kokoro", 24_000);

  prepare(request: NarrationPreparationRequest, signal?: AbortSignal): Promise<PreparedNarration> {
    return this.adapter.prepare(request, signal);
  }
}

export class FakeSentenceBatchNarrationAdapter implements NarrationPreparationAdapter {
  private readonly adapter = new DeterministicNarrationAdapter("supertonic", 44_100);

  prepare(request: NarrationPreparationRequest, signal?: AbortSignal): Promise<PreparedNarration> {
    return this.adapter.prepare(request, signal);
  }
}

export class FakeNarrationGateway implements NarrationGateway {
  private readonly prepared = new Map<string, SentenceNarration>();

  async prepareSentenceAudio(request: SentenceNarrationRequest): Promise<SentenceNarration> {
    const key = [
      request.bookId,
      request.chapterId,
      request.sentenceId,
      request.sentenceIndex,
      request.voiceId,
      request.text
    ].join("\u001f");
    const existing = this.prepared.get(key);
    if (existing != null) return { ...existing, cached: true };

    const narration: SentenceNarration = {
      bookId: request.bookId,
      chapterId: request.chapterId,
      sentenceId: request.sentenceId,
      readiness: "ready",
      durationSec: 1,
      sourceUrl: "data:audio/wav;base64,UklGRg==",
      playbackMode: "html-audio",
      cached: false,
      message: null
    };
    this.prepared.set(key, narration);
    return narration;
  }

  async playPreparedSentenceAudio(): Promise<void> {}

  async stopPreparedSentenceAudio(): Promise<void> {}
}

class DeterministicNarrationAdapter implements NarrationPreparationAdapter {
  private readonly prepared = new Map<string, PreparedNarration>();

  constructor(
    private readonly engineId: NarrationEngineId,
    private readonly sampleRate: number
  ) {}

  async prepare(
    request: NarrationPreparationRequest,
    signal?: AbortSignal
  ): Promise<PreparedNarration> {
    throwIfAborted(signal);
    if (request.engineId !== this.engineId) {
      throw new Error(`${this.engineId} cannot prepare a ${request.engineId} request.`);
    }

    const identity = createNarrationAssetIdentity({
      schemaVersion: 3,
      engineId: request.engineId,
      modelRevision: request.modelRevision,
      voiceId: request.voiceId,
      language: request.passage.language ?? "na",
      sentences: request.passage.sentences,
      synthesisParameters: request.synthesisParameters,
      sampleRate: this.sampleRate,
      encodingRevision: "fake-pcm-v1"
    });
    const existing = this.prepared.get(identity);
    if (existing != null) return { ...existing, cached: true };

    const sentences = createDeterministicSpans(request.passage.sentences, this.sampleRate);
    const narration: PreparedNarration = {
      assetId: `fake:${simpleIdentityHash(identity)}`,
      sourceUrl: "data:audio/wav;base64,UklGRg==",
      sampleRate: this.sampleRate,
      sampleCount: sentences[sentences.length - 1]?.endSample ?? 0,
      sentences,
      cached: false,
      engineId: request.engineId,
      modelRevision: request.modelRevision,
      voiceId: request.voiceId,
      sourceTextDigest: request.sourceTextDigest
    };
    throwIfAborted(signal);
    assertPreparedNarration(narration, request.passage.sentences);
    this.prepared.set(identity, narration);
    return narration;
  }
}

function createDeterministicSpans(
  sentences: readonly NarrationSentence[],
  sampleRate: number
): NarrationSentenceSpan[] {
  let startSample = 0;
  return sentences.map((sentence) => {
    const words = sentence.text.trim().split(/\s+/u).filter(Boolean).length;
    const sampleCount = Math.max(
      Math.round(sampleRate * 0.5),
      words * Math.round(sampleRate * 0.28)
    );
    const span = {
      sentenceId: sentence.id,
      startSample,
      endSample: startSample + sampleCount
    };
    startSample = span.endSample;
    return span;
  });
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted)
    throw signal.reason ?? new DOMException("Preparation cancelled.", "AbortError");
}

function simpleIdentityHash(identity: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
