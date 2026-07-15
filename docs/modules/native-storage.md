# Native Storage

## Owns

- SQLite schema, migrations, transactions, and durable library projections
- local cover assets and reading-data queries
- transactional persistence of native library domain events

## Refuses To Own

- Solid state, UI copy decisions, TTS subprocesses, or dictionary HTTP requests
- EPUB archive parsing and text segmentation rules

## Interface

`SonelleStore` exposes library use cases to thin Tauri commands. Transport models live in
`storage/model.rs`; event persistence lives in `storage/event_journal.rs`.

The `.readex` application-data directory is retained as an intentional compatibility path for
existing local libraries. New user-facing naming remains Sonelle.

## Domain Events

Imports, reading-position changes, bookmark mutations, exports, and legacy repair are appended in
the same native workflow as their projection update. Repair progress is batched and never blocks app
startup.

## Invariants

- a durable projection and its domain event commit in the same SQLite transaction
- renderer-originated durable events must be explicitly admitted by the native event allowlist
- migrations preserve existing local libraries, including the intentional `.readex` compatibility path

## Tests

Rust tests use temporary SQLite databases and exercise the public store behavior, migrations,
search, bookmarks, exports, and event persistence.
