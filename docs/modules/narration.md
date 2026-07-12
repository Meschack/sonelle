# Narration

## Owns

- voice catalog metadata and language-aware voice resolution
- narration request identity, prefetching, and playback readiness contracts
- the desktop adapter for native Piper preparation and playback
- selected-voice installation status, progress, verification, and retry

## Refuses To Own

- reader UI state, chapter navigation, or reading progress
- book-language detection and EPUB metadata extraction
- persisted reader preferences

## Interface

Reader workflows depend on `PrefetchingNarrationGateway`. Voice labels, locales, descriptions, and
the default voice come from `packages/audio/src/narration-voices.json`. Browser media lifecycle is
hidden behind the injected `HtmlAudioPlayer` interface. Native voice progress projects cumulative
downloaded bytes, total bytes, and percentage into the reader without exposing network details.
Transient narration notices are presented by the reader as dismissible notifications so the
playback controls retain a stable layout.
Native Piper and Python commands are created through the background-process platform adapter so
voice preparation never opens a console window over the reader on Windows.

## Domain Events

`AudioPreparationRequested`, `SentenceAudioReady`, and `AudioPreparationFailed` describe the
reader-visible narration lifecycle. `VoiceInstallationRequested`, `VoiceInstallationReady`, and
`VoiceInstallationFailed` describe the separately managed offline voice lifecycle.

## Tests

Package tests cover voice selection, settings, request identity, and prefetch behavior. Rust tests
cover native request validation, cache behavior, the shared default voice catalog, platform
selection, safe extraction, and verified voice files without making network requests.
Native checks on each release target compile the platform-specific background process adapter.
