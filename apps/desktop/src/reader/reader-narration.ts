import {
  createNarrationChapterOutline,
  routeNarrationEngine,
  type NarrationRoutingMode,
  type NarrationSessionChapter,
  type NarrationChapterOutline,
  type SentenceNarrationRequest
} from "@sonelle/audio";
import type { ReaderSentenceView, ReaderView } from "./reader-view";

export function createSentenceNarrationRequest(
  currentReader: ReaderView,
  sentence: ReaderSentenceView,
  voiceId: string
): SentenceNarrationRequest {
  return {
    bookId: currentReader.book.id,
    chapterId: currentReader.chapter.id,
    sentenceId: sentence.id,
    sentenceIndex: sentence.index,
    voiceId,
    text: sentence.text
  };
}

export function createReaderNarrationOutline(currentReader: ReaderView): NarrationChapterOutline {
  return createNarrationChapterOutline({
    bookId: currentReader.book.id,
    chapterId: currentReader.chapter.id,
    language: currentReader.book.language,
    sentences: currentReader.sentences.map(({ id, index, text }) => ({ id, index, text })),
    paragraphs: currentReader.paragraphs.map(
      ({ id, index, startSentenceIndex, endSentenceIndex }) => ({
        id,
        index,
        startSentenceIndex,
        endSentenceIndex
      })
    )
  });
}

export function createReaderNarrationSessionChapter(
  currentReader: ReaderView,
  voiceId: string,
  routingMode: NarrationRoutingMode
): NarrationSessionChapter {
  const route = routeNarrationEngine(currentReader.book.language, { mode: routingMode });

  return {
    outline: createReaderNarrationOutline(currentReader),
    engineId: route.engineId,
    modelRevision: `${route.engineId}-desktop-dev`,
    voiceId,
    passageOptions: route.preparationKind === "sentence-batch" ? { maxSentences: 1 } : undefined
  };
}
