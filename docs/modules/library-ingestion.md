# Library Ingestion And Repair

## Owns

- desktop library ports and neutral library document models
- EPUB selection, import, metadata recovery, extraction, segmentation, and transactional persistence
- background repair of missing language and paragraph projections in legacy libraries
- catalog, bookmark, search, export, cover-asset, and reading-position adapters

## Refuses To Own

- reader presentation models, playback activation, Solid state, or narration preparation
- dictionary lookup and provider selection

## Interface

Renderer workflows depend on the small ports in `library-contracts.ts`. Native `library_import`
turns parsed EPUB data into a storage import. `library_migration` runs after startup on a blocking
runtime task, reads legacy rows in bounded keyset batches, and isolates individual repair failures.

## Domain Events

Import uses requested, cancelled, imported, and failed facts. Native transactions persist
`BookImported`, `BookTextExtracted`, and `ChapterSegmented` with their projections. Legacy repair
persists started, progressed, completed, and failed events, plus recovered language and paragraph
facts.

## Invariants

- library ports never import reader-owned DTOs
- imported projections and their durable facts commit atomically
- repair never blocks Tauri setup and one unreadable book does not stop later repairs
- batches remain bounded and resumable by stable identifiers

## Tests

Rust tests cover EPUB edge cases, transactional import, search, assets, and multi-batch repair with an
isolated failure. Renderer tests cover adapters and library workflows through their ports.
