export type WordLearningState = "unknown" | "learning" | "known" | "saved";

export interface WordInsight {
  surface: string;
  definition: string | null;
  translation: string | null;
  partOfSpeech: string | null;
  example: string | null;
  state: WordLearningState;
}

export type WordInsightCatalog = Record<string, Omit<WordInsight, "surface">>;

const fixtureCatalog: WordInsightCatalog = {
  attentive: {
    definition: "carefully focused on something.",
    translation: "attentif",
    partOfSpeech: "adjective",
    example: "She stayed attentive while the narrator changed pace.",
    state: "learning"
  },
  cadence: {
    definition: "the rhythm or flow of a voice, sentence, or movement.",
    translation: "cadence",
    partOfSpeech: "noun",
    example: "The cadence made the paragraph easier to follow.",
    state: "saved"
  },
  margin: {
    definition: "a quiet edge or open space around the main text.",
    translation: "marge",
    partOfSpeech: "noun",
    example: "The note sat in the margin beside the paragraph.",
    state: "known"
  },
  unfamiliar: {
    definition: "not known yet; new enough to deserve attention.",
    translation: "inconnu",
    partOfSpeech: "adjective",
    example: "An unfamiliar word can be inspected without leaving the page.",
    state: "unknown"
  }
};

export function createWordInsight(surface: string, catalog = fixtureCatalog): WordInsight {
  const normalized = normalizeInsightKey(surface);
  const entry = catalog[normalized];

  return {
    surface,
    definition: entry?.definition ?? "No saved meaning yet.",
    translation: entry?.translation ?? null,
    partOfSpeech: entry?.partOfSpeech ?? null,
    example: entry?.example ?? null,
    state: entry?.state ?? "unknown"
  };
}

export function normalizeInsightKey(surface: string): string {
  return surface
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}
