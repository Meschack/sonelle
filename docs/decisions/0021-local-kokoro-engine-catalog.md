# 0021. Local Kokoro Engine Catalog

Date: 2026-07-14

## Status

Accepted

## Context

The native Kokoro renderer needs a duration-preserving `kokoro.onnx`, `config.json`, and `.bin`
voice-style files. The public spike catalog still points at Kokoro's PyTorch checkpoint and `.pt`
voice files, which are useful for the Python reference but not directly runnable by Sonelle's
native manifest path.

Until the production Kokoro runtime pack is hosted and pinned, the desktop app still needs a way to
exercise the real installer, cache, and renderer path against the exported local spike artifacts.

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
- The default bundled catalog remains unchanged, so production builds do not silently depend on a
  developer's filesystem.
- The production-ready gate still requires a hosted, license-reviewed, pinned Kokoro runtime pack
  with the same installed layout.
