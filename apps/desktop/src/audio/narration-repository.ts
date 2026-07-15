import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../platform/tauri-runtime";
import {
  type NarrationGateway,
  type NarrationPlaybackMode,
  type SentenceNarration
} from "@sonelle/audio/compatibility";

interface NarrationDevelopmentErrorContext {
  stage: "prepare" | "playback" | "prefetch" | "stop";
  sentenceId: string;
  voiceId: string;
  playbackMode?: NarrationPlaybackMode | "manifest" | null;
}

export function createNarrationRepository(): NarrationGateway {
  return isTauriRuntime() ? nativeNarrationRepository : unavailableNarrationRepository;
}

const unavailableNarrationRepository: NarrationGateway = {
  async prepareSentenceAudio() {
    throw new Error("Narration is available in the desktop app.");
  },
  async playPreparedSentenceAudio() {
    throw new Error("Narration is available in the desktop app.");
  },
  async stopPreparedSentenceAudio() {}
};

const nativeNarrationRepository: NarrationGateway = {
  async prepareSentenceAudio(request) {
    const narration = await invoke<SentenceNarration>("prepare_sentence_audio", { request });
    return {
      ...narration,
      sourceUrl: narration.sourceUrl == null ? null : convertFileSrc(narration.sourceUrl, "asset")
    };
  },

  async playPreparedSentenceAudio(request, narration) {
    if (narration.playbackMode === "native-speech") {
      await invoke("play_sentence_audio", { request });
    }
  },

  async stopPreparedSentenceAudio() {
    await invoke("stop_sentence_audio");
  }
};

export function toFriendlyNarrationError(error: unknown): string {
  const message = diagnosticErrorMessage(error).toLocaleLowerCase();
  if (message.includes("download") || message.includes("network")) {
    return "We couldn't download narration files. Check your connection and try again.";
  }
  if (message.includes("catalog") || message.includes("verify")) {
    return "We couldn't verify the offline narration files. Please try again.";
  }
  if (message.includes("files changed")) {
    return "Narration files changed. Please try again.";
  }
  if (message.includes("cancel")) return "Narration preparation was cancelled.";

  return "Narration needs attention. Please try again.";
}

export function reportNarrationDevelopmentError(
  error: unknown,
  context: NarrationDevelopmentErrorContext
) {
  if (!import.meta.env.DEV) return;

  const message = diagnosticErrorMessage(error);
  const detail = [
    `stage=${context.stage}`,
    `sentenceId=${context.sentenceId}`,
    `voiceId=${context.voiceId}`,
    `playbackMode=${context.playbackMode ?? "unknown"}`,
    `error=${message}`
  ].join(" ");

  console.error(`[sonelle][audio][${context.stage}] ${message}`, error, context);
  if (!isTauriRuntime()) return;

  void invoke("report_development_error", {
    scope: `audio.${context.stage}`,
    message: detail
  }).catch((reportingError) => {
    console.error("[sonelle][audio][reporting] Could not forward the error.", reportingError);
  });
}

function diagnosticErrorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim().length > 0) return error;
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return "Unknown narration error";
}
