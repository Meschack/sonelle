export type WordLearningState = "unknown" | "learning" | "known";

export interface WordInsight {
  key: string;
  surface: string;
  definition: string | null;
  translation: string | null;
  partOfSpeech: string | null;
  example: string | null;
  note: string | null;
  state: WordLearningState;
  saved: boolean;
}

export interface SavedWord {
  key: string;
  surface: string;
  state: Exclude<WordLearningState, "unknown">;
  note: string | null;
  example: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LearningNotebook {
  words: Record<string, SavedWord>;
}

export type WordInsightCatalog = Record<string, Omit<WordInsight, "surface">>;

const fixtureCatalog: WordInsightCatalog = {
  attentive: {
    key: "attentive",
    definition: "carefully focused on something.",
    translation: "attentif",
    partOfSpeech: "adjective",
    example: "She stayed attentive while the narrator changed pace.",
    note: null,
    state: "learning",
    saved: false
  },
  cadence: {
    key: "cadence",
    definition: "the rhythm or flow of a voice, sentence, or movement.",
    translation: "cadence",
    partOfSpeech: "noun",
    example: "The cadence made the paragraph easier to follow.",
    note: null,
    state: "learning",
    saved: false
  },
  margin: {
    key: "margin",
    definition: "a quiet edge or open space around the main text.",
    translation: "marge",
    partOfSpeech: "noun",
    example: "The note sat in the margin beside the paragraph.",
    note: null,
    state: "known",
    saved: false
  },
  unfamiliar: {
    key: "unfamiliar",
    definition: "not known yet; new enough to deserve attention.",
    translation: "inconnu",
    partOfSpeech: "adjective",
    example: "An unfamiliar word can be inspected without leaving the page.",
    note: null,
    state: "unknown",
    saved: false
  }
};

export function createLearningNotebook(words: Record<string, SavedWord> = {}): LearningNotebook {
  return { words: { ...words } };
}

export function createWordInsight(
  surface: string,
  notebook: LearningNotebook = createLearningNotebook(),
  catalog = fixtureCatalog
): WordInsight {
  const normalized = normalizeInsightKey(surface);
  const savedWord = notebook.words[normalized];
  const entry = catalog[normalized];

  return {
    key: normalized,
    surface,
    definition: entry?.definition ?? "No saved meaning yet.",
    translation: entry?.translation ?? null,
    partOfSpeech: entry?.partOfSpeech ?? null,
    example: savedWord?.example ?? entry?.example ?? null,
    note: savedWord?.note ?? entry?.note ?? null,
    state: savedWord?.state ?? entry?.state ?? "unknown",
    saved: savedWord != null ? true : (entry?.saved ?? false)
  };
}

export function saveWord(
  notebook: LearningNotebook,
  surface: string,
  state: Exclude<WordLearningState, "unknown"> = "learning",
  now = new Date().toISOString()
): LearningNotebook {
  const key = normalizeInsightKey(surface);
  if (key.length === 0) return notebook;

  const existing = notebook.words[key];
  return upsertWord(notebook, key, {
    key,
    surface: existing?.surface ?? surface,
    state: existing?.state ?? state,
    note: existing?.note ?? null,
    example: existing?.example ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  });
}

export function markWordState(
  notebook: LearningNotebook,
  surface: string,
  state: Exclude<WordLearningState, "unknown">,
  now = new Date().toISOString()
): LearningNotebook {
  const key = normalizeInsightKey(surface);
  if (key.length === 0) return notebook;

  const existing = notebook.words[key];
  return upsertWord(notebook, key, {
    key,
    surface: existing?.surface ?? surface,
    state,
    note: existing?.note ?? null,
    example: existing?.example ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  });
}

export function updateWordNote(
  notebook: LearningNotebook,
  surface: string,
  note: string,
  now = new Date().toISOString()
): LearningNotebook {
  const key = normalizeInsightKey(surface);
  if (key.length === 0) return notebook;

  const word = ensureSavedWord(notebook, surface, now);
  return upsertWord(notebook, key, {
    ...word,
    note: cleanOptionalText(note),
    updatedAt: now
  });
}

export function updateWordExample(
  notebook: LearningNotebook,
  surface: string,
  example: string,
  now = new Date().toISOString()
): LearningNotebook {
  const key = normalizeInsightKey(surface);
  if (key.length === 0) return notebook;

  const word = ensureSavedWord(notebook, surface, now);
  return upsertWord(notebook, key, {
    ...word,
    example: cleanOptionalText(example),
    updatedAt: now
  });
}

export function forgetWord(notebook: LearningNotebook, surface: string): LearningNotebook {
  const key = normalizeInsightKey(surface);
  if (notebook.words[key] == null) return notebook;

  const { [key]: _forgotten, ...words } = notebook.words;
  return { words };
}

export function listSavedWords(notebook: LearningNotebook): SavedWord[] {
  return Object.values(notebook.words).sort((first, second) => {
    const updated = second.updatedAt.localeCompare(first.updatedAt);
    return updated === 0 ? first.surface.localeCompare(second.surface) : updated;
  });
}

export function serializeLearningNotebook(notebook: LearningNotebook): string {
  return JSON.stringify({ words: notebook.words });
}

export function parseLearningNotebook(value: string | null): LearningNotebook {
  if (value == null || value.trim().length === 0) return createLearningNotebook();

  try {
    const parsed = JSON.parse(value) as Partial<LearningNotebook>;
    if (parsed == null || typeof parsed !== "object" || parsed.words == null) {
      return createLearningNotebook();
    }

    return createLearningNotebook(normalizeSavedWords(parsed.words));
  } catch {
    return createLearningNotebook();
  }
}

export function normalizeInsightKey(surface: string): string {
  return surface
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function ensureSavedWord(notebook: LearningNotebook, surface: string, now: string): SavedWord {
  const savedNotebook = saveWord(notebook, surface, "learning", now);
  const key = normalizeInsightKey(surface);
  return savedNotebook.words[key];
}

function upsertWord(notebook: LearningNotebook, key: string, word: SavedWord): LearningNotebook {
  return {
    words: {
      ...notebook.words,
      [key]: word
    }
  };
}

function cleanOptionalText(value: string): string | null {
  const clean = value.trim();
  return clean.length > 0 ? clean : null;
}

function normalizeSavedWords(words: unknown): Record<string, SavedWord> {
  if (words == null || typeof words !== "object") return {};

  return Object.entries(words as Record<string, Partial<SavedWord>>).reduce(
    (normalized, [rawKey, word]) => {
      const key = normalizeInsightKey(word.surface ?? rawKey);
      if (key.length === 0 || word.surface == null) return normalized;

      normalized[key] = {
        key,
        surface: word.surface,
        state: word.state === "known" ? "known" : "learning",
        note: typeof word.note === "string" ? cleanOptionalText(word.note) : null,
        example: typeof word.example === "string" ? cleanOptionalText(word.example) : null,
        createdAt: word.createdAt ?? word.updatedAt ?? new Date(0).toISOString(),
        updatedAt: word.updatedAt ?? word.createdAt ?? new Date(0).toISOString()
      };

      return normalized;
    },
    {} as Record<string, SavedWord>
  );
}
