import { describe, expect, it } from "vitest";
import {
  advancePlayback,
  createPlaybackState,
  movePlayback,
  playPlayback,
  selectPlaybackSentence
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
});
