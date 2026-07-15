# Reader Experience

## Owns

- composing the reader's UI state and user workflows
- coordinating library, narration, dictionary, preferences, dispatcher, and event-sink interfaces
- projecting domain state into reader, library, and inspector surfaces

## Refuses To Own

- SQLite statements, EPUB parsing, TTS subprocesses, or HTTP response parsing
- construction details for platform adapters
- reusable playback, progress, segmentation, or dictionary rules

## Interface

`ReaderExperience` accepts an optional `ReaderExperienceDependencies` bundle. Production callers use
`createReaderExperienceDependencies`; integration tests can provide stable fakes.

## Domain Events

Library workflows complete their core operation and dispatch the resulting event. `ReaderOpened`
and `ReaderClosed` independently drive playback, surfaces, rails, bookmark refresh, and persistence.
Settings, lookup, installation, export, cache clearing, and narration reactions follow the same
pattern. Events on the domain transient allowlist remain live projections; other renderer events use
an `EventSink`, while native library mutations record durable facts inside their storage transaction.

## Invariants

- initiating workflows publish facts; independent listeners own follow-up reactions
- UI modules depend on product-facing application views, not platform or narration-provider types
- closing the reader stops its playback scope before the library surface becomes active

## Tests

Pure reader behavior is tested in `apps/desktop/src/reader/*.test.ts`. Workflow tests use fake
repositories and the real dispatcher to prove that producers publish facts and listeners react
without mocking Tauri globals.
