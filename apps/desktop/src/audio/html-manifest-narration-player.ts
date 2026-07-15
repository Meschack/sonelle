import type {
  ManifestAwareNarrationPlayer,
  ManifestPlaybackHandlers,
  ManifestPlaybackInput,
  NarrationOutputSettings
} from "@sonelle/audio/narration";
import type { EntityId } from "@sonelle/domain";
import type { HtmlAudioPlayer } from "./html-audio-player";

export function createHtmlManifestNarrationPlayer(
  htmlAudioPlayer: HtmlAudioPlayer
): ManifestAwareNarrationPlayer {
  let playbackRate = 1;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let activeTimeline: ActiveSentenceTimeline | null = null;

  const clearSentenceTimers = () => {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
  };

  return {
    async play(input: ManifestPlaybackInput, handlers: ManifestPlaybackHandlers): Promise<void> {
      clearSentenceTimers();
      const startSpan = input.narration.sentences.find(
        (candidate) => candidate.sentenceId === input.startSentenceId
      );
      if (startSpan == null) throw new Error("Prepared narration cannot start at this sentence.");
      const stopSpan =
        input.stopAfterSentenceId == null
          ? input.narration.sentences[input.narration.sentences.length - 1]
          : input.narration.sentences.find(
              (candidate) => candidate.sentenceId === input.stopAfterSentenceId
            );
      if (stopSpan == null) throw new Error("Prepared narration cannot stop at this sentence.");
      if (stopSpan.endSample <= startSpan.startSample)
        throw new Error("Prepared narration has an invalid playback range.");

      activeTimeline = {
        spans: playbackSpans(
          input.narration.sentences,
          input.startSentenceId,
          input.stopAfterSentenceId
        ),
        sampleRate: input.narration.sampleRate,
        anchorSample: startSpan.startSample,
        anchorTimeMs: performance.now(),
        playbackRate,
        handlers
      };
      scheduleSentenceEntries(activeTimeline, true);

      try {
        await htmlAudioPlayer.play(input.narration.sourceUrl, {
          offsetSeconds: startSpan.startSample / input.narration.sampleRate,
          durationSeconds: (stopSpan.endSample - startSpan.startSample) / input.narration.sampleRate
        });
      } finally {
        clearSentenceTimers();
        activeTimeline = null;
      }
    },

    setOutput(settings: NarrationOutputSettings): void {
      if (activeTimeline != null) {
        activeTimeline.anchorSample = currentTimelineSample(activeTimeline);
        activeTimeline.anchorTimeMs = performance.now();
        activeTimeline.playbackRate = settings.playbackRate;
        clearSentenceTimers();
        scheduleSentenceEntries(activeTimeline, false);
      }
      playbackRate = settings.playbackRate;
      htmlAudioPlayer.setPlaybackRate(settings.playbackRate);
      htmlAudioPlayer.setVolume(settings.volume);
    },

    stop(): void {
      clearSentenceTimers();
      activeTimeline = null;
      htmlAudioPlayer.stop();
    }
  };

  function scheduleSentenceEntries(timeline: ActiveSentenceTimeline, includeAnchor: boolean) {
    const rate = timeline.playbackRate > 0 ? timeline.playbackRate : 1;
    for (const span of timeline.spans) {
      const sampleDelta = span.startSample - timeline.anchorSample;
      if (sampleDelta < 0 || (!includeAnchor && sampleDelta === 0)) continue;
      const delayMs = Math.max(0, (sampleDelta / timeline.sampleRate / rate) * 1_000);
      if (delayMs === 0) {
        timeline.handlers.sentenceEntered(span.sentenceId);
        continue;
      }

      timers.push(setTimeout(() => timeline.handlers.sentenceEntered(span.sentenceId), delayMs));
    }
  }
}

interface ActiveSentenceTimeline {
  spans: readonly { sentenceId: EntityId; startSample: number }[];
  sampleRate: number;
  anchorSample: number;
  anchorTimeMs: number;
  playbackRate: number;
  handlers: ManifestPlaybackHandlers;
}

function currentTimelineSample(timeline: ActiveSentenceTimeline): number {
  const elapsedSeconds = Math.max(0, performance.now() - timeline.anchorTimeMs) / 1_000;
  return timeline.anchorSample + elapsedSeconds * timeline.playbackRate * timeline.sampleRate;
}

function playbackSpans(
  spans: ManifestPlaybackInput["narration"]["sentences"],
  startSentenceId: EntityId,
  stopAfterSentenceId: EntityId | null
) {
  const startIndex = spans.findIndex((span) => span.sentenceId === startSentenceId);
  if (startIndex < 0) return [];
  const stopIndex =
    stopAfterSentenceId == null
      ? spans.length - 1
      : spans.findIndex((span) => span.sentenceId === stopAfterSentenceId);
  if (stopIndex < startIndex) return [];
  return spans.slice(startIndex, stopIndex + 1);
}
