import { describe, expect, it } from "vitest";
import {
  createAudioSettings,
  FakeNarrationGateway,
  estimateSentenceDurationSec,
  parseAudioSettings,
  serializeAudioSettings
} from "./index";

describe("sentence narration", () => {
  it("keeps fake narration deterministic and cached for tests", async () => {
    const gateway = new FakeNarrationGateway();
    const request = {
      bookId: "book",
      chapterId: "chapter",
      sentenceId: "sentence",
      sentenceIndex: 0,
      text: "Hello reader."
    };

    const first = await gateway.prepareSentenceAudio(request);
    const second = await gateway.prepareSentenceAudio(request);

    expect(first).toMatchObject({
      readiness: "ready",
      playbackMode: "html-audio",
      cached: false
    });
    expect(second.cached).toBe(true);
    expect(second.sourceUrl).toBe(first.sourceUrl);
  });

  it("estimates sentence duration without exposing timing internals", () => {
    expect(estimateSentenceDurationSec("One two three.")).toBeGreaterThan(1);
  });

  it("keeps audio settings inside supported playback behavior", () => {
    expect(createAudioSettings({ playbackRate: 8, autoAdvance: false })).toEqual({
      playbackRate: 1.5,
      autoAdvance: false
    });
    expect(parseAudioSettings("{nope")).toEqual({
      playbackRate: 1,
      autoAdvance: true
    });
    expect(
      parseAudioSettings(serializeAudioSettings({ playbackRate: 0.9, autoAdvance: false }))
    ).toEqual({
      playbackRate: 0.9,
      autoAdvance: false
    });
  });
});
