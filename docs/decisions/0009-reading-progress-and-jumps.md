# 0009: Reading Progress and Jumps

Status: accepted

## Context

Chapter navigation made it possible to move around a real book, but progress still behaved like a single-chapter meter. Sentence, bookmark, search, and chapter jumps also needed one consistent state path so highlighting, playback, and saved position do not drift apart.

## Decision

Reader progress is calculated from chapter navigation metadata plus the active chapter and sentence index. The footer shows both whole-book progress and active-chapter progress.

Manual sentence jumps go through a shared playback transition that clears stale narration, notices, and selected word UI. Chapter, bookmark, and search-result navigation reuse the same activation path. Jumps inside the open book preserve the current play/pause intent; opening another book starts idle.

Saved reading position remains event-driven: once reader state and playback state point at the new active sentence, the existing persistence effect saves that position for library books.

## Consequences

Resume, bookmark navigation, and search navigation now derive visible progress from the same state that drives highlighting and persistence.

Opening a different book is intentionally calm: it selects the right place without starting playback unexpectedly.
