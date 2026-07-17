# App Window Controller

## Owns

- toggling fullscreen in the native Tauri window
- providing a browser-preview fallback for frontend development

## Refuses To Own

- keyboard interpretation, reader state, layout state, or user notifications
- any other window-management policy

## Interface

`AppWindowController.toggleFullscreen()` checks the current native window state and applies its
inverse. Outside Tauri it uses the standard document fullscreen API when available.

## Domain Events

None. Fullscreen is transient platform state, not a reading-domain fact.

## Tests

The reader integration suite injects a fake controller and verifies that `F11` and palette commands
reach the platform boundary. Native API behavior remains covered by Tauri itself.
