import { describe, expect, it, vi } from "vitest";
import { createNativeManifestNarrationAdapter } from "./native-manifest-narration-adapter";

describe("createNativeManifestNarrationAdapter", () => {
  it("prepares manifest narration through the native command", async () => {
    const invoke = vi.fn().mockResolvedValue({
      assetId: "kokoro-asset",
      sourceUrl: "/tmp/sonelle/audio.wav",
      sampleRate: 24_000,
      sampleCount: 48_000,
      sentences: [{ sentenceId: "sentence-1", startSample: 0, endSample: 48_000 }],
      cached: false,
      engineId: "kokoro",
      modelRevision: "kokoro-test",
      voiceId: "kokoro:af_heart",
      sourceTextDigest: "digest"
    });
    const convertFileSrc = vi.fn((path: string, protocol?: string) => `${protocol}:${path}`);
    const adapter = createNativeManifestNarrationAdapter({ invoke, convertFileSrc });

    const narration = await adapter.prepare({
      requestId: "request-1",
      passage: {
        id: "passage-1",
        bookId: "book-1",
        chapterId: "chapter-1",
        paragraphId: "paragraph-1",
        language: "en",
        sentences: [{ id: "sentence-1", index: 0, text: "Prepared narration is alive." }]
      },
      engineId: "kokoro",
      modelRevision: "kokoro-test",
      voiceId: "kokoro:af_heart",
      sourceTextDigest: "digest",
      synthesisParameters: { speed: 1 }
    });

    expect(invoke).toHaveBeenCalledWith("prepare_manifest_narration", {
      request: expect.objectContaining({ engineId: "kokoro" })
    });
    expect(convertFileSrc).toHaveBeenCalledWith("/tmp/sonelle/audio.wav", "asset");
    expect(narration.sourceUrl).toBe("asset:/tmp/sonelle/audio.wav");
  });

  it("does not invoke native preparation after cancellation", async () => {
    const invoke = vi.fn();
    const controller = new AbortController();
    controller.abort(new Error("stale"));
    const adapter = createNativeManifestNarrationAdapter({ invoke });

    await expect(
      adapter.prepare(
        {
          requestId: "request-1",
          passage: {
            id: "passage-1",
            bookId: "book-1",
            chapterId: "chapter-1",
            paragraphId: "paragraph-1",
            language: "en",
            sentences: [{ id: "sentence-1", index: 0, text: "Cancelled." }]
          },
          engineId: "kokoro",
          modelRevision: "kokoro-test",
          voiceId: "kokoro:af_heart",
          sourceTextDigest: "digest"
        },
        controller.signal
      )
    ).rejects.toThrow("stale");
    expect(invoke).not.toHaveBeenCalled();
  });
});
