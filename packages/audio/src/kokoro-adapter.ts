import type {
  NarrationPreparationAdapter,
  NarrationPreparationRequest,
  NarrationSentence,
  PreparedNarration
} from "./narration-contracts";
import { createNarrationAssetIdentity } from "./narration-identity";
import {
  alignKokoroTimedTokensToSentences,
  assertKokoroPreparedNarration,
  type KokoroAlignmentFailureReason,
  type KokoroTimedToken
} from "./kokoro-alignment";

export interface KokoroEngineSynthesis {
  sourceUrl: string;
  sampleRate: number;
  sampleCount: number;
  tokens: readonly KokoroTimedToken[];
}

export interface KokoroSynthesisRequest {
  id: string;
  text: string;
  language: "en";
  voiceId: string;
  modelRevision: string;
}

export interface KokoroSynthesisEngine {
  synthesize(request: KokoroSynthesisRequest, signal?: AbortSignal): Promise<KokoroEngineSynthesis>;
}

export interface KokoroNarrationAdapterOptions {
  engine: KokoroSynthesisEngine;
  onAlignmentFallback?(reason: KokoroAlignmentFailureReason): void;
}

export class KokoroNarrationAdapter implements NarrationPreparationAdapter {
  private readonly prepared = new Map<string, PreparedNarration>();

  constructor(private readonly options: KokoroNarrationAdapterOptions) {}

  async prepare(
    request: NarrationPreparationRequest,
    signal?: AbortSignal
  ): Promise<PreparedNarration> {
    if (request.engineId !== "kokoro") {
      throw new Error("Kokoro adapter received a request for another engine.");
    }
    if (request.passage.language !== "en") {
      throw new Error("Kokoro adapter only prepares confidently English passages.");
    }

    const identity = createNarrationAssetIdentity({
      schemaVersion: 3,
      engineId: request.engineId,
      modelRevision: request.modelRevision,
      voiceId: request.voiceId,
      language: "en",
      sentences: request.passage.sentences,
      synthesisParameters: request.synthesisParameters,
      sampleRate: kokoroSampleRate(request.synthesisParameters),
      encodingRevision: "kokoro-v1"
    });
    const cached = this.prepared.get(identity);
    if (cached != null) return { ...cached, cached: true };

    const passage = await this.synthesizePassage(request, identity, signal);
    this.prepared.set(identity, passage);
    return passage;
  }

  private async synthesizePassage(
    request: NarrationPreparationRequest,
    identity: string,
    signal?: AbortSignal
  ): Promise<PreparedNarration> {
    const text = request.passage.sentences.map((sentence) => sentence.text).join(" ");
    const synthesized = await this.options.engine.synthesize(
      {
        id: identity,
        text,
        language: "en",
        voiceId: request.voiceId,
        modelRevision: request.modelRevision
      },
      signal
    );
    const alignment = alignKokoroTimedTokensToSentences({
      sentences: request.passage.sentences,
      tokens: synthesized.tokens,
      sampleCount: synthesized.sampleCount
    });

    if (alignment.valid) {
      return assertKokoroPreparedNarration(
        {
          assetId: `kokoro-${simpleIdentityHash(identity)}`,
          sourceUrl: synthesized.sourceUrl,
          sampleRate: synthesized.sampleRate,
          sampleCount: synthesized.sampleCount,
          sentences: alignment.spans,
          cached: false,
          engineId: "kokoro",
          modelRevision: request.modelRevision,
          voiceId: request.voiceId,
          sourceTextDigest: request.sourceTextDigest
        },
        request.passage.sentences
      );
    }

    this.options.onAlignmentFallback?.(alignment.reason ?? "missing-token");
    return this.synthesizeSentences(request, identity, signal);
  }

  private async synthesizeSentences(
    request: NarrationPreparationRequest,
    identity: string,
    signal?: AbortSignal
  ): Promise<PreparedNarration> {
    const synthesizedSentences = await Promise.all(
      request.passage.sentences.map((sentence) =>
        this.options.engine.synthesize(
          {
            id: `${identity}:${sentence.id}`,
            text: sentence.text,
            language: "en",
            voiceId: request.voiceId,
            modelRevision: request.modelRevision
          },
          signal
        )
      )
    );

    let startSample = 0;
    const spans = request.passage.sentences.map((sentence, index) => {
      const sampleCount = synthesizedSentences[index].sampleCount;
      const span = {
        sentenceId: sentence.id,
        startSample,
        endSample: startSample + sampleCount
      };
      startSample = span.endSample;
      return span;
    });

    return assertKokoroPreparedNarration(
      {
        assetId: `kokoro-${simpleIdentityHash(identity)}`,
        sourceUrl: combineCompatibilitySources(synthesizedSentences, request.passage.sentences),
        sampleRate: synthesizedSentences[0]?.sampleRate ?? 24_000,
        sampleCount: startSample,
        sentences: spans,
        cached: false,
        engineId: "kokoro",
        modelRevision: request.modelRevision,
        voiceId: request.voiceId,
        sourceTextDigest: request.sourceTextDigest
      },
      request.passage.sentences
    );
  }
}

function kokoroSampleRate(parameters: NarrationPreparationRequest["synthesisParameters"]): number {
  const sampleRate = parameters?.sampleRate;
  return typeof sampleRate === "number" && Number.isInteger(sampleRate) && sampleRate > 0
    ? sampleRate
    : 24_000;
}

function combineCompatibilitySources(
  synthesized: readonly KokoroEngineSynthesis[],
  sentences: readonly NarrationSentence[]
): string {
  if (synthesized.length === 1) return synthesized[0].sourceUrl;
  const encodedIds = sentences.map((sentence) => encodeURIComponent(sentence.id)).join(",");
  return `kokoro-fallback://${encodedIds}`;
}

function simpleIdentityHash(identity: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
