import type {
  NarrationSentence,
  NarrationSentenceSpan,
  PreparedNarration
} from "./narration-contracts";
import { assertPreparedNarration } from "./narration-manifest";

export interface KokoroTimedToken {
  text: string;
  startSample: number;
  endSample: number;
}

export interface KokoroAlignmentResult {
  valid: boolean;
  spans: readonly NarrationSentenceSpan[];
  reason: KokoroAlignmentFailureReason | null;
}

export type KokoroAlignmentFailureReason =
  | "empty-sentences"
  | "empty-token"
  | "missing-token"
  | "reordered-token"
  | "invalid-timing"
  | "incomplete-sentence";

interface NormalizedSentenceToken {
  value: string;
  sentenceIndex: number;
}

const normalizedTokenPattern = /[\p{Letter}\p{Number}]+(?:['’][\p{Letter}\p{Number}]+)?/gu;

export function alignKokoroTimedTokensToSentences(input: {
  sentences: readonly NarrationSentence[];
  tokens: readonly KokoroTimedToken[];
  sampleCount: number;
}): KokoroAlignmentResult {
  if (input.sentences.length === 0) {
    return failedAlignment("empty-sentences");
  }

  const sourceTokens = input.sentences.flatMap((sentence) =>
    normalizeSourceTokens(sentence.text).map((value) => ({
      value,
      sentenceIndex: sentence.index
    }))
  );
  if (sourceTokens.length === 0) return failedAlignment("empty-sentences");

  const sentenceIndexesWithTokens = new Set(sourceTokens.map((token) => token.sentenceIndex));
  if (sentenceIndexesWithTokens.size !== input.sentences.length) {
    return failedAlignment("incomplete-sentence");
  }

  const sentenceStartSamples = new Map<number, number>();
  let sourceCursor = 0;
  let previousTokenEnd = 0;

  for (const token of input.tokens) {
    if (!validTimedToken(token, input.sampleCount, previousTokenEnd)) {
      return failedAlignment("invalid-timing");
    }
    previousTokenEnd = token.endSample;

    const normalizedToken = normalizeEngineToken(token.text);
    if (normalizedToken == null) continue;

    const matchIndex = findNextToken(sourceTokens, sourceCursor, normalizedToken);
    if (matchIndex < 0) return failedAlignment("missing-token");
    if (matchIndex < sourceCursor) return failedAlignment("reordered-token");

    const sourceToken = sourceTokens[matchIndex];
    if (!sentenceStartSamples.has(sourceToken.sentenceIndex)) {
      sentenceStartSamples.set(sourceToken.sentenceIndex, token.startSample);
    }
    sourceCursor = matchIndex + 1;
  }

  if (sourceCursor !== sourceTokens.length) return failedAlignment("missing-token");

  const spans: NarrationSentenceSpan[] = [];
  for (const [position, sentence] of input.sentences.entries()) {
    const nextSentence = input.sentences[position + 1];
    const startSample = position === 0 ? 0 : spans[position - 1].endSample;
    const nextStart =
      nextSentence == null ? input.sampleCount : sentenceStartSamples.get(nextSentence.index);
    if (nextStart == null || nextStart <= startSample || nextStart > input.sampleCount) {
      return failedAlignment("incomplete-sentence");
    }
    spans.push({
      sentenceId: sentence.id,
      startSample,
      endSample: nextStart
    });
  }

  return { valid: true, spans, reason: null };
}

export function assertKokoroPreparedNarration(
  narration: PreparedNarration,
  sentences: readonly NarrationSentence[]
): PreparedNarration {
  if (narration.engineId !== "kokoro") {
    throw new Error("Kokoro prepared narration must use the Kokoro engine.");
  }
  return assertPreparedNarration(narration, sentences);
}

function normalizeSourceTokens(text: string): readonly string[] {
  return [...text.matchAll(normalizedTokenPattern)]
    .map((match) => normalizeToken(match[0]))
    .filter((token): token is string => token != null);
}

function normalizeEngineToken(text: string): string | null {
  return normalizeToken(text);
}

function normalizeToken(text: string): string | null {
  const normalized = text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[’]/gu, "'")
    .match(normalizedTokenPattern)?.[0];
  return normalized == null || normalized.length === 0 ? null : normalized;
}

function findNextToken(
  sourceTokens: readonly NormalizedSentenceToken[],
  startIndex: number,
  value: string
): number {
  for (let index = startIndex; index < sourceTokens.length; index += 1) {
    if (sourceTokens[index].value === value) return index;
  }
  return -1;
}

function validTimedToken(
  token: KokoroTimedToken,
  sampleCount: number,
  previousTokenEnd: number
): boolean {
  return (
    Number.isInteger(token.startSample) &&
    Number.isInteger(token.endSample) &&
    token.startSample >= previousTokenEnd &&
    token.endSample > token.startSample &&
    token.endSample <= sampleCount
  );
}

function failedAlignment(reason: KokoroAlignmentFailureReason): KokoroAlignmentResult {
  return { valid: false, spans: [], reason };
}
