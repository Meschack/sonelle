import type { SentenceRef } from "@readex/domain";

export type PlaybackStatus = "idle" | "playing" | "paused" | "ended";

export interface ReaderPosition extends SentenceRef {
  offsetSec: number;
}

export interface HighlightState {
  activeSentenceId: string | null;
}

export interface ReaderPlaybackState {
  activeSentenceIndex: number;
  status: PlaybackStatus;
}

export function highlightSentence(sentenceId: string | null): HighlightState {
  return { activeSentenceId: sentenceId };
}

export function createPlaybackState(): ReaderPlaybackState {
  return {
    activeSentenceIndex: 0,
    status: "idle"
  };
}

export function playPlayback(
  state: ReaderPlaybackState,
  sentenceCount: number
): ReaderPlaybackState {
  if (sentenceCount <= 0) return { activeSentenceIndex: 0, status: "idle" };

  return {
    activeSentenceIndex:
      state.status === "ended" ? 0 : clampSentenceIndex(state.activeSentenceIndex, sentenceCount),
    status: "playing"
  };
}

export function pausePlayback(state: ReaderPlaybackState): ReaderPlaybackState {
  return {
    ...state,
    status: state.status === "playing" ? "paused" : state.status
  };
}

export function advancePlayback(
  state: ReaderPlaybackState,
  sentenceCount: number
): ReaderPlaybackState {
  if (sentenceCount <= 0) return { activeSentenceIndex: 0, status: "idle" };

  const activeSentenceIndex = clampSentenceIndex(state.activeSentenceIndex, sentenceCount);
  const nextIndex = activeSentenceIndex + 1;

  if (nextIndex >= sentenceCount) {
    return {
      activeSentenceIndex,
      status: "ended"
    };
  }

  return {
    activeSentenceIndex: nextIndex,
    status: state.status
  };
}

export function movePlayback(
  state: ReaderPlaybackState,
  sentenceCount: number,
  direction: -1 | 1
): ReaderPlaybackState {
  if (sentenceCount <= 0) return { activeSentenceIndex: 0, status: "idle" };

  return {
    activeSentenceIndex: clampSentenceIndex(state.activeSentenceIndex + direction, sentenceCount),
    status: state.status === "ended" ? "paused" : state.status
  };
}

export function selectPlaybackSentence(
  state: ReaderPlaybackState,
  sentenceCount: number,
  sentenceIndex: number
): ReaderPlaybackState {
  if (sentenceCount <= 0) return { activeSentenceIndex: 0, status: "idle" };

  return {
    activeSentenceIndex: clampSentenceIndex(sentenceIndex, sentenceCount),
    status: state.status === "ended" ? "paused" : state.status
  };
}

export function createSentenceId(bookId: string, chapterId: string, sentenceIndex: number): string {
  return `${bookId}:${chapterId}:sentence-${sentenceIndex + 1}`;
}

function clampSentenceIndex(sentenceIndex: number, sentenceCount: number): number {
  return Math.max(0, Math.min(sentenceIndex, sentenceCount - 1));
}
