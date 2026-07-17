# Reader Command Palette

## Owns

- presenting searchable commands for the current Sonelle surface
- keyboard selection within the command list
- returning the selected semantic command to the reader composition root

## Refuses To Own

- playback, navigation, Library, import, export, sidebar, or fullscreen behavior
- shortcut resolution and global key listeners
- persistence or platform APIs

## Interface

`ReaderCommandPalette` receives the active `AppView`, an `onClose` callback, and one
`onSelect(ReaderKeyboardCommand)` callback. It filters a static command catalog by surface and user
query, then returns the selected command. `ReaderExperience` closes the palette and routes that
command through the same executor used by direct keyboard shortcuts.

## Domain Events

The palette emits no domain events. Selected commands invoke existing application workflows, which
remain responsible for publishing reader and Library facts.

## Tests

`reader-experience.integration.test.tsx` verifies focus, dismissal, filtering, command execution,
and the resulting reader-close reaction.
