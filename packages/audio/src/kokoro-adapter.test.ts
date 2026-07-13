import { describe, expect, it } from "vitest";
import type { NarrationPreparationRequest } from "./narration-contracts";
import { alignKokoroTimedTokensToSentences } from "./kokoro-alignment";
import {
  KokoroNarrationAdapter,
  type KokoroEngineSynthesis,
  type KokoroSynthesisEngine,
  type KokoroSynthesisRequest
} from "./kokoro-adapter";

describe("Kokoro English alignment", () => {
  it("maps punctuation-heavy English timing back to Sonelle sentences", () => {
    const result = alignKokoroTimedTokensToSentences({
      sentences: [
        {
          id: "s1",
          index: 0,
          text: '"Dr. Vale paid $3.50 -- not $4 -- at 10 a.m.," she said.'
        },
        {
          id: "s2",
          index: 1,
          text: 'Then No. 7 replied: "That\'s fine."'
        }
      ],
      tokens: timedTokens([
        "Dr",
        "Vale",
        "paid",
        "3",
        "50",
        "not",
        "4",
        "at",
        "10",
        "a",
        "m",
        "she",
        "said",
        "Then",
        "No",
        "7",
        "replied",
        "That's",
        "fine"
      ]),
      sampleCount: 1_900
    });

    expect(result).toEqual({
      valid: true,
      reason: null,
      spans: [
        { sentenceId: "s1", startSample: 0, endSample: 1_300 },
        { sentenceId: "s2", startSample: 1_300, endSample: 1_900 }
      ]
    });
  });

  it("rejects missing or reordered tokens instead of guessing sentence boundaries", () => {
    const missing = alignKokoroTimedTokensToSentences({
      sentences,
      tokens: timedTokens(["One", "sentence", "Another"]),
      sampleCount: 300
    });
    const reordered = alignKokoroTimedTokensToSentences({
      sentences,
      tokens: timedTokens(["Another", "sentence", "One", "steady", "sentence"]),
      sampleCount: 500
    });

    expect(missing).toMatchObject({ valid: false, reason: "missing-token" });
    expect(reordered).toMatchObject({ valid: false, reason: "missing-token" });
  });
});

describe("Kokoro narration adapter", () => {
  it("prepares paragraph passages with validated sentence spans", async () => {
    const engine = new ControlledKokoroEngine();
    const adapter = new KokoroNarrationAdapter({ engine });

    const narration = await adapter.prepare(preparationRequest());
    const cached = await adapter.prepare(preparationRequest());

    expect(engine.requests.map((request) => request.text)).toEqual([
      "One steady sentence. Another sentence follows."
    ]);
    expect(narration.sentences).toEqual([
      { sentenceId: "s1", startSample: 0, endSample: 300 },
      { sentenceId: "s2", startSample: 300, endSample: 600 }
    ]);
    expect(narration.cached).toBe(false);
    expect(cached.cached).toBe(true);
  });

  it("falls back to independent sentences when paragraph alignment is invalid", async () => {
    const fallbackReasons: string[] = [];
    const engine = new ControlledKokoroEngine({
      passageTokens: timedTokens(["One", "sentence", "Another"])
    });
    const adapter = new KokoroNarrationAdapter({
      engine,
      onAlignmentFallback: (reason) => fallbackReasons.push(reason)
    });

    const narration = await adapter.prepare(preparationRequest());

    expect(fallbackReasons).toEqual(["missing-token"]);
    expect(engine.requests.map((request) => request.text)).toEqual([
      "One steady sentence. Another sentence follows.",
      "One steady sentence.",
      "Another sentence follows."
    ]);
    expect(narration.sourceUrl).toBe("kokoro-fallback://s1,s2");
    expect(narration.sentences).toEqual([
      { sentenceId: "s1", startSample: 0, endSample: 300 },
      { sentenceId: "s2", startSample: 300, endSample: 600 }
    ]);
  });

  it("only accepts confidently English Kokoro requests", async () => {
    const adapter = new KokoroNarrationAdapter({ engine: new ControlledKokoroEngine() });

    await expect(
      adapter.prepare({
        ...preparationRequest(),
        passage: { ...preparationRequest().passage, language: "fr" }
      })
    ).rejects.toThrow("confidently English");
  });
});

const sentences = [
  { id: "s1", index: 0, text: "One steady sentence." },
  { id: "s2", index: 1, text: "Another sentence follows." }
];

function preparationRequest(): NarrationPreparationRequest {
  return {
    requestId: "request-1",
    passage: {
      id: "passage-1",
      bookId: "book-1",
      chapterId: "chapter-1",
      paragraphId: "paragraph-1",
      language: "en",
      sentences
    },
    engineId: "kokoro",
    modelRevision: "kokoro-test",
    voiceId: "kokoro:af-heart",
    sourceTextDigest: "digest"
  };
}

function timedTokens(tokens: readonly string[]): KokoroEngineSynthesis["tokens"] {
  return tokens.map((text, index) => ({
    text,
    startSample: index * 100,
    endSample: (index + 1) * 100
  }));
}

class ControlledKokoroEngine implements KokoroSynthesisEngine {
  readonly requests: KokoroSynthesisRequest[] = [];

  constructor(
    private readonly options: {
      passageTokens?: KokoroEngineSynthesis["tokens"];
    } = {}
  ) {}

  async synthesize(request: KokoroSynthesisRequest): Promise<KokoroEngineSynthesis> {
    this.requests.push(request);
    const tokens =
      this.requests.length === 1
        ? (this.options.passageTokens ??
          timedTokens(["One", "steady", "sentence", "Another", "sentence", "follows"]))
        : timedTokens(request.text.match(/[\p{Letter}\p{Number}]+/gu) ?? []);

    return {
      sourceUrl: `asset://${request.id}`,
      sampleRate: 24_000,
      sampleCount: tokens[tokens.length - 1]?.endSample ?? 300,
      tokens
    };
  }
}
