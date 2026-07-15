# 0017: Supertonic Native Synthesis

## Status

Accepted for the hybrid development path.

## Context

The hybrid narration path needs real local audio before user testing can mean anything. Supertonic is
the lowest-risk first runtime because Sonelle already installs its ONNX files and voice styles as one
verified offline narration pack. Kokoro still needs a production ONNX artifact in the engine catalog;
the current Kokoro pack downloads the upstream PyTorch checkpoint and voices.

## Decision

Sonelle prepares Supertonic requests inside the native manifest command when `engineId` is
`supertonic`.

The `supertonic_narration` module owns:

- loading the installed Supertonic ONNX assets and both supported voice styles once per installed pack;
- serializing access to the reusable native runtime to bound CPU and memory use;
- rendering up to two ordinary Sonelle sentences in one bounded ONNX batch, while retaining the
  provider's existing single-sentence path for long internally split text;
- converting returned samples into one WAV asset;
- projecting exact sentence spans from returned sample lengths.

It refuses to own:

- routing a book to an engine;
- installing or verifying engine files;
- cache identity and cache writes;
- playback and sentence highlighting;
- Kokoro preprocessing or alignment.

The manifest command remains the interface used by the desktop frontend. It receives a
`ManifestNarrationRequest` and returns the same `PreparedManifestNarration` shape whether audio came
from Supertonic synthesis or cache. Missing rendered audio is an error; silent placeholders are not
valid prepared narration.

## Events

No provider-specific event is introduced by this slice. The shared narration lifecycle uses
`NarrationPreparationStarted`, `PassageNarrationReady`, sentence-entry, playback-ended, and failure
facts regardless of provider.

## Testing

Automated tests cover:

- rendering sentence spans from synthesized sample counts;
- rejecting mismatched synthesized sentence output;
- storing rendered Supertonic audio through the manifest cache path;
- rejecting missing rendered audio instead of caching a silent placeholder.
- separating padded batch output into exact sentence audio using provider durations.

The release-candidate provider gate runs real Supertonic ONNX synthesis, installs the verified local
pack, and renders again from the installed layout. The same tests remain directly runnable with
`SONELLE_SUPERTONIC_FIXTURE_ROOT`.

## Consequences

French and other non-English hybrid requests produce real local audio after the Supertonic offline
files are installed. Active inference receives terminable ONNX `RunOptions`; cancellation calls
`terminate()` and also prevents stale output from becoming current playback.

Supertonic remains serialized through one reusable runtime and defaults to one ONNX thread. Normal
passages contain at most two sentences and the session prepares at most two passages ahead. A local
two-sentence provider smoke produced 9.29 seconds of audio in 4.72 seconds of warm synthesis with a
476 MB peak resident set; startup model loading took 1.60 seconds. Development builds log startup,
synthesis, request duration, audio duration, and real-time factor without logging book text.

Long-sentence splitting preserves source order when an oversized comma-delimited section must be
split again by words. This text-processing correction advances the Supertonic preparation revision,
so previously cached audio generated with the reordered prefix is not reused.

The current pinned ONNX Runtime static build requires the Linux bundle job to run on Ubuntu 24.04.
Ubuntu 22.04 verification remains useful for non-linking checks, but release packaging must use the
newer runner until Sonelle owns a lower-glibc ONNX Runtime build or a proven dynamic-loading bundle.

The same static ONNX Runtime package does not provide a prebuilt `x86_64-apple-darwin` distribution.
Until Sonelle owns a compatible Intel macOS runtime bundle or switches to a proven dynamic-loading
strategy, release candidate and release packaging target macOS Apple Silicon, Linux x64, and Windows
x64 only.
