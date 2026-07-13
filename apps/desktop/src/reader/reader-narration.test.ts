import { describe, expect, it } from "vitest";
import {
  createReaderNarrationOutline,
  createReaderNarrationSessionChapter
} from "./reader-narration";
import { buildFixtureReaderView } from "./reader-view";

describe("reader narration outline", () => {
  it("projects reader sentences and paragraphs without leaking reader UI state", () => {
    const reader = buildFixtureReaderView();
    const outline = createReaderNarrationOutline(reader);

    expect(outline).toMatchObject({
      bookId: reader.book.id,
      chapterId: reader.chapter.id,
      language: "en"
    });
    expect(outline.sentences.map((sentence) => sentence.id)).toEqual(
      reader.sentences.map((sentence) => sentence.id)
    );
    expect(outline.paragraphs).toEqual(
      reader.paragraphs.map(({ id, index, startSentenceIndex, endSentenceIndex }) => ({
        id,
        index,
        startSentenceIndex,
        endSentenceIndex
      }))
    );
  });

  it("builds legacy Piper session chapters without leaking playback details", () => {
    const reader = buildFixtureReaderView();
    const chapter = createReaderNarrationSessionChapter(
      reader,
      "en_US-lessac-medium",
      "legacy-piper"
    );

    expect(chapter).toMatchObject({
      engineId: "piper",
      modelRevision: "piper-desktop-dev",
      voiceId: "en_US-lessac-medium",
      passageOptions: { maxSentences: 1 }
    });
    expect(chapter.outline.bookId).toBe(reader.book.id);
    expect(chapter.outline.chapterId).toBe(reader.chapter.id);
  });
});
