# 0021. Local Kokoro Engine Catalog

Date: 2026-07-14

## Status

Accepted

## Context

The native Kokoro renderer needs a duration-preserving `kokoro.onnx`, `config.json`, and `.bin`
voice-style files. The Python reference uses Kokoro's PyTorch checkpoint and `.pt` voice files,
which are useful for reference generation but not directly runnable by Sonelle's native manifest
path.

The production catalog therefore needs a separate pinned ONNX model, configuration, and `.bin`
voice-style artifacts for the native manifest path.

## Decision

Sonelle supports a development-only engine catalog override through
`SONELLE_NARRATION_ENGINE_CATALOG`. The catalog keeps the same engine-pack schema but allows an
artifact to provide an explicit `url`. The native downloader accepts `file://` artifact URLs so a
local catalog can install the exported Kokoro runtime pack through the same verified pack installer
used by hosted artifacts.

`pnpm spike:narration:kokoro-local-catalog` writes
`.sonelle/narration-spike/local-engine-catalog.json` from the current local Kokoro spike files:

- `.sonelle/narration-spike/kokoro-onnx/kokoro.onnx`
- `.sonelle/narration-spike/sources/kokoro/checkpoints/config.json`
- `.sonelle/narration-spike/sources/kokoro/kokoro.js/voices/af_heart.bin`
- `.sonelle/narration-spike/sources/kokoro/kokoro.js/voices/bf_emma.bin`

Each artifact receives its local file URL, size, and SHA-256. The generated target paths match the
native renderer's installed-pack layout under `assets/`.

## Consequences

- Local desktop QA can install and render Kokoro through the real pack manager before production
  hosting exists.
- The production catalog points to a pinned ONNX export, matching configuration, and pinned `.bin`
  voice-style files, all installed under the layout expected by the native renderer.
- Local development can still override the catalog with file URLs, keeping the same verified pack
  installer path available for runtime QA.
