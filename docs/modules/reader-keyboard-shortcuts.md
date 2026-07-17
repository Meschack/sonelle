# Reader Keyboard Shortcuts

## Owns

- translating keyboard input into semantic reader commands
- defining the user-facing shortcut reference shown by the desktop app
- deciding which commands are global, reader-only, or allowed while editing text
- resolving Library navigation, filter, sidebar, fullscreen, and command-palette commands

## Refuses To Own

- playback, navigation, import, bookmark, export, or inspector behavior
- DOM event subscriptions and Solid state
- platform-specific file dialogs or persistence

## Interface

`resolveReaderKeyboardShortcut(input)` returns a `ReaderKeyboardCommand` or `null`. The reader
composition root prevents the browser default only when a command was resolved, then delegates the
command to the existing application workflow. `readerKeyboardShortcutReference` supplies the
visible quick-reference groups without performing any action.

Library card geometry is handled by `library-keyboard-navigation.ts`. It resolves movement from the
current card index and the rendered column count while the composition root performs the final DOM
focus operation. `Enter` then opens the focused card through the existing Library application.

Primary-modifier commands remain available while an input has focus. Unmodified letter keys are
ignored there so typing in search and settings fields never triggers reader actions.

## Domain Events

This module emits no events. Commands such as returning to the Library or importing a book invoke
application workflows that publish the same domain events as their visible controls.

## Tests

`reader-keyboard-shortcuts.test.ts` covers mapping, surface boundaries, modal dismissal, and text
editing behavior. `reader-experience.integration.test.tsx` proves that commands reach narration
settings, navigation, inspector tools, paragraph export, Library filtering and opening, sidebar
state, fullscreen, and EPUB import.
