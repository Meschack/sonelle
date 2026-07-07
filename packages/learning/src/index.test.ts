import { describe, expect, it } from "vitest";
import {
  createLearningNotebook,
  createWordInsight,
  forgetWord,
  listSavedWords,
  markWordState,
  parseLearningNotebook,
  saveWord,
  serializeLearningNotebook,
  updateWordExample,
  updateWordNote
} from "./index";

describe("word insight", () => {
  it("returns fixture insight for known learner words", () => {
    expect(createWordInsight("Cadence")).toMatchObject({
      key: "cadence",
      translation: "cadence",
      saved: false,
      state: "learning"
    });
  });

  it("falls back without pretending to know a word", () => {
    expect(createWordInsight("rainfall")).toMatchObject({
      surface: "rainfall",
      definition: "No saved meaning yet.",
      state: "unknown"
    });
  });

  it("saves words and lets learner state change without losing notes", () => {
    const saved = saveWord(createLearningNotebook(), "Attentive", "learning", "2026-01-01");
    const noted = updateWordNote(saved, "attentive", "Shows up in narration.", "2026-01-02");
    const known = markWordState(noted, "attentive", "known", "2026-01-03");

    expect(createWordInsight("attentive", known)).toMatchObject({
      saved: true,
      state: "known",
      note: "Shows up in narration."
    });
  });

  it("stores learner examples separately from catalog examples", () => {
    const notebook = updateWordExample(
      createLearningNotebook(),
      "cadence",
      "Her cadence slowed near the comma.",
      "2026-01-01"
    );

    expect(createWordInsight("cadence", notebook).example).toBe(
      "Her cadence slowed near the comma."
    );
  });

  it("lists saved words by latest update", () => {
    const notebook = markWordState(
      saveWord(createLearningNotebook(), "margin", "learning", "2026-01-01"),
      "cadence",
      "known",
      "2026-01-02"
    );

    expect(listSavedWords(notebook).map((word) => word.surface)).toEqual(["cadence", "margin"]);
  });

  it("can forget a saved word", () => {
    const notebook = forgetWord(saveWord(createLearningNotebook(), "margin"), "margin");

    expect(createWordInsight("margin", notebook)).toMatchObject({
      saved: false,
      state: "known"
    });
    expect(listSavedWords(notebook)).toEqual([]);
  });

  it("serializes defensively for app storage", () => {
    const notebook = updateWordNote(
      saveWord(createLearningNotebook(), "cadence", "learning", "2026-01-01"),
      "cadence",
      "Rhythm of the sentence.",
      "2026-01-02"
    );

    expect(parseLearningNotebook(serializeLearningNotebook(notebook))).toEqual(notebook);
    expect(parseLearningNotebook("{ absolutely not json")).toEqual(createLearningNotebook());
  });
});
