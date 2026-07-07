import { describe, expect, it } from "vitest";
import { FakeNarrationGateway, estimateSentenceDurationSec } from "./index";

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
});
