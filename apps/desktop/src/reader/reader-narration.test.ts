import { describe, expect, it } from "vitest";
import {
  createReaderNarrationOutline,
  createReaderNarrationPreparationRequests,
  createReaderNarrationSessionChapter,
  readerHybridNarrationEngineId
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

  it("builds Kokoro session chapters with Kokoro voice ids for English books", () => {
    const reader = buildFixtureReaderView();
    const chapter = createReaderNarrationSessionChapter(reader, "en_GB-alba-medium", "hybrid-v1", {
      kokoro: { modelRevision: "kokoro-test" }
    });

    expect(chapter).toMatchObject({
      engineId: "kokoro",
      modelRevision: "kokoro-test",
      voiceId: "kokoro:bf-emma"
    });
    expect(readerHybridNarrationEngineId(reader, "hybrid-v1")).toBe("kokoro");
  });

  it("builds Supertonic session chapters with Supertonic voice ids for non-English books", () => {
    const reader = {
      ...buildFixtureReaderView(),
      book: { ...buildFixtureReaderView().book, language: "fr" }
    };
    const chapter = createReaderNarrationSessionChapter(reader, "supertonic:M1", "hybrid-v1", {
      supertonic: { modelRevision: "supertonic-test" }
    });

    expect(chapter).toMatchObject({
      engineId: "supertonic",
      modelRevision: "supertonic-test",
      voiceId: "supertonic:M1",
      passageOptions: { maxSentences: 2 }
    });
    expect(readerHybridNarrationEngineId(reader, "hybrid-v1")).toBe("supertonic");
  });

  it("builds preparation requests for background chapter preloading", () => {
    const reader = buildFixtureReaderView();
    const requests = createReaderNarrationPreparationRequests(
      reader,
      "en_US-lessac-medium",
      "hybrid-v1",
      { kokoro: { modelRevision: "kokoro-test" } },
      2,
      createIncrementingIds()
    );

    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({
      requestId: "request-1",
      engineId: "kokoro",
      voiceId: "kokoro:af-heart",
      modelRevision: "kokoro-test",
      passage: {
        bookId: reader.book.id,
        chapterId: reader.chapter.id
      }
    });
    expect(requests[0]?.sourceTextDigest).toMatch(/^[a-f0-9]{8}$/u);
    expect(requests[1]?.requestId).toBe("request-2");
  });
});

function createIncrementingIds() {
  let nextId = 0;
  return () => `request-${(nextId += 1)}`;
}
