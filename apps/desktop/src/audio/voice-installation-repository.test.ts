import { describe, expect, it } from "vitest";
import {
  failedVoiceInstallation,
  projectVoiceInstallationProgress
} from "./voice-installation-repository";

describe("offline voice installation", () => {
  it("projects retryable failures without exposing native details", () => {
    expect(failedVoiceInstallation("en_US-amy-medium", "Please retry.")).toEqual({
      voiceId: "en_US-amy-medium",
      status: "failed",
      downloadSizeBytes: 0,
      downloadedBytes: 0,
      progress: null,
      message: "Please retry."
    });
  });

  it("projects cumulative download bytes for the reader", () => {
    expect(
      projectVoiceInstallationProgress({
        voiceId: "en_US-amy-medium",
        status: "downloading",
        progress: 42,
        downloadedBytes: 36_000_000,
        totalBytes: 85_000_000,
        message: "Downloading voice"
      })
    ).toEqual({
      voiceId: "en_US-amy-medium",
      status: "preparing",
      downloadSizeBytes: 85_000_000,
      downloadedBytes: 36_000_000,
      progress: 42,
      message: "Downloading voice"
    });
  });
});
