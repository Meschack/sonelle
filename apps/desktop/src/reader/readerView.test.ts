import { describe, expect, it } from "vitest";
import { buildFixtureReaderView } from "./readerView";

describe("fixture reader view", () => {
  it("turns the fixture chapter into sentence views with word tokens", () => {
    const reader = buildFixtureReaderView();

    expect(reader.sentences).toHaveLength(5);
    expect(reader.sentences[0]?.id).toBe("fixture-book-mara:chapter-1:sentence-1");
    expect(reader.sentences[0]?.tokens.some((token) => token.kind === "word")).toBe(true);
  });
});
