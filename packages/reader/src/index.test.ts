import { describe, expect, it } from "vitest";
import {
  advancePlayback,
  createPlaybackState,
  finishSentencePlayback,
  movePlayback,
  playPlayback,
  searchReaderSentences,
  selectPlaybackSentence,
  sentenceMatchesQuery
} from "./index";

describe("reader playback", () => {
  it("starts at the first sentence", () => {
    expect(playPlayback(createPlaybackState(), 3)).toEqual({
      activeSentenceIndex: 0,
      status: "playing"
    });
  });

  it("advances sentence-by-sentence and ends on the last sentence", () => {
    const playing = playPlayback(createPlaybackState(), 2);

    expect(advancePlayback(playing, 2)).toEqual({
      activeSentenceIndex: 1,
      status: "playing"
    });
    expect(advancePlayback({ activeSentenceIndex: 1, status: "playing" }, 2)).toEqual({
      activeSentenceIndex: 1,
      status: "ended"
    });
  });

  it("keeps manual movement inside the available sentence range", () => {
    expect(movePlayback({ activeSentenceIndex: 0, status: "paused" }, 3, -1)).toEqual({
      activeSentenceIndex: 0,
      status: "paused"
    });
    expect(selectPlaybackSentence({ activeSentenceIndex: 0, status: "ended" }, 3, 9)).toEqual({
      activeSentenceIndex: 2,
      status: "paused"
    });
  });

  it("can pause after a sentence when auto-advance is off", () => {
    expect(finishSentencePlayback({ activeSentenceIndex: 0, status: "playing" }, 3, false)).toEqual(
      {
        activeSentenceIndex: 1,
        status: "paused"
      }
    );
  });
});

describe("reader search", () => {
  const sentences = [
    { id: "sentence-1", index: 0, text: "The reader listens carefully." },
    { id: "sentence-2", index: 1, text: "A bookmark keeps the place." }
  ];

  it("finds matching sentences with stable excerpts", () => {
    expect(searchReaderSentences(sentences, "BOOKMARK")).toEqual([
      {
        sentence: sentences[1],
        excerpt: "A bookmark keeps the place."
      }
    ]);
  });

  it("reports whether a sentence matches a query", () => {
    expect(sentenceMatchesQuery(sentences[0], "listens")).toBe(true);
    expect(sentenceMatchesQuery(sentences[0], "")).toBe(false);
  });
});
