# 0005: Word Learning Tools

## Status

Accepted.

## Decision

Readex word tools are interaction-driven. A user clicks or taps a word to inspect it, save it, mark it as learning or known, and add notes or examples.

Word learning state lives behind the `packages/learning` boundary. The package owns:

- word normalization
- insight composition
- saved-word notebook state
- learning and known transitions
- notes and learner examples
- notebook serialization

The desktop renderer stores the notebook in local browser storage for this phase. Native SQLite persistence can replace that storage adapter later without changing the learning model or reader UI behavior.

## Why

Word tools should support reading, not compete with narration.

Keeping word interactions separate from playback timing means:

- sentence highlighting stays stable
- playback does not pause when a word is inspected
- word lookup does not need word-level timestamps
- the learning model can be tested without Solid, Tauri, or storage details

Local browser storage is enough for the first usable notebook because the state is small and private to the desktop shell. It avoids adding native migrations before the broader learning-storage shape is clear.

## Consequences

The reader UI can show:

- a compact popover beside the selected word
- a richer side inspector
- saved words
- learning state controls
- notes and examples

The learning package does not fetch dictionary data yet. Fixture insight data keeps the first workflow useful while the boundary stays ready for real dictionary or translation adapters later.

## User-Facing Language

Use:

- saved
- learning
- known
- note
- example

Avoid:

- token id
- timing metadata
- word timestamp
- lookup pipeline
