# System Fonts

## Owns

- discovering font families installed on the local computer
- normalizing, deduplicating, and sorting family names for reader settings
- the native command and desktop adapter implementing the system-font catalog

## Refuses To Own

- typography preferences, CSS presentation, or settings UI state
- copying, embedding, uploading, or serving font files
- narration voice or language selection

## Interface

`SystemFontCatalog.listFamilies()` returns family names. Production uses the native
`list_system_fonts` command; non-native development returns an empty catalog and keeps Sonelle's
bundled defaults available.

## Domain Events

Discovery is a read-only query and emits no event. Selecting a family belongs to the reader
typography workflow and publishes `ReaderTypographyChanged`.

## Invariants

- scanning runs outside the UI thread
- only bounded, non-empty family names cross the native boundary
- font paths and bytes never enter reader UI state

## Tests

Rust tests exercise native discovery and ordering. Adapter tests cover normalization. Reader tests
cover preference validation, event reactions, CSS escaping, and rendered selection.
