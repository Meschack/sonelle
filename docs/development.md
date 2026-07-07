# Development

## Requirements

- Node.js
- pnpm
- Rust and Cargo
- Tauri Linux prerequisites when developing on Linux

Tauri's scaffold reported missing Linux desktop dependencies on this machine. Install the platform prerequisites from the official Tauri docs before running the native desktop shell.

On Debian/Ubuntu-like systems, use the full Tauri prerequisite set:

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

If installing dependencies piecemeal, the direct errors seen on this machine were `dbus-1`, `glib-2.0`, and `gdk-3.0`. Those are provided by development packages such as:

```bash
sudo apt install libdbus-1-dev libglib2.0-dev libgtk-3-dev pkg-config
```

## Commands

```bash
pnpm install
pnpm dev:desktop
pnpm dev:web
pnpm typecheck
pnpm test
pnpm build
pnpm check
pnpm check:native
cargo check
```

## TUI

The project includes a small local TUI at `scripts/dev-tui.mjs`. It reads `.dev-tui.json` with entries for:

- desktop app
- web renderer
- tests
- full JS/TS check
- native Rust/Tauri check

Run it with:

```bash
pnpm dev:tui
```

Use arrow keys or `j`/`k`, press Enter to run a command, and press `q` to quit.

For non-interactive checks, list the configured commands with:

```bash
pnpm dev:tui -- --list
```

## Verification Notes

Current verified commands:

- `pnpm install`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm check`
- `pnpm check:native`
- `cargo fmt --check`
- `cargo check`

Current blocked commands:

- None known after Linux Tauri prerequisites are installed.

Run this from the repository root. The root `Cargo.toml` is a workspace that points to `apps/desktop/src-tauri`.

If native checks report missing system packages through `pkg-config`, install the Tauri prerequisite set above and retry.
