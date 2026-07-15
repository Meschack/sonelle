import type { NarrationEngineId, NarrationPassage, NarrationSentence } from "./narration-contracts";

export interface NarrationAssetIdentityInput {
  schemaVersion: number;
  engineId: NarrationEngineId;
  modelRevision: string;
  voiceId: string;
  language: string;
  sentences: readonly Pick<NarrationSentence, "id" | "text">[];
  synthesisParameters?: Readonly<Record<string, string | number | boolean>>;
  sampleRate: number;
  encodingRevision: string;
}

export function createNarrationAssetIdentity(input: NarrationAssetIdentityInput): string {
  const synthesisParameters = Object.fromEntries(
    Object.entries(input.synthesisParameters ?? {}).sort(([first], [second]) =>
      first.localeCompare(second)
    )
  );
  return JSON.stringify({
    schemaVersion: input.schemaVersion,
    engineId: input.engineId,
    modelRevision: input.modelRevision,
    voiceId: input.voiceId,
    language: input.language,
    sentences: input.sentences.map((sentence) => ({
      id: sentence.id,
      text: normalizeNarrationIdentityText(sentence.text)
    })),
    synthesisParameters,
    sampleRate: input.sampleRate,
    encodingRevision: input.encodingRevision
  });
}

export function digestNarrationPassageText(passage: Pick<NarrationPassage, "sentences">): string {
  let hash = 2_166_136_261;
  for (const sentence of passage.sentences) {
    const value = `${sentence.id}\n${sentence.text}\n`;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16_777_619);
    }
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeNarrationIdentityText(text: string): string {
  return text.trim().replace(/\s+/gu, " ");
}
