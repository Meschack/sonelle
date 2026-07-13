import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type {
  NarrationPreparationAdapter,
  NarrationPreparationRequest,
  PreparedNarration
} from "@sonelle/audio";

type NativeManifestNarration = PreparedNarration;

type InvokeCommand = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type ConvertSourceUrl = (filePath: string, protocol?: string) => string;

interface NativeManifestNarrationAdapterDependencies {
  invoke?: InvokeCommand;
  convertFileSrc?: ConvertSourceUrl;
}

export function createNativeManifestNarrationAdapter(
  dependencies: NativeManifestNarrationAdapterDependencies = {}
): NarrationPreparationAdapter {
  const invokeCommand = dependencies.invoke ?? invoke;
  const convertSourceUrl = dependencies.convertFileSrc ?? convertFileSrc;

  return {
    async prepare(
      request: NarrationPreparationRequest,
      signal?: AbortSignal
    ): Promise<PreparedNarration> {
      throwIfAborted(signal);
      const narration = await abortable(
        invokeCommand<NativeManifestNarration>("prepare_manifest_narration", { request }),
        signal
      );
      throwIfAborted(signal);

      return {
        ...narration,
        sourceUrl: convertSourceUrl(narration.sourceUrl, "asset")
      };
    }
  };
}

function abortable<T>(operation: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (signal == null) return operation;
  if (signal.aborted) return Promise.reject(abortReason(signal));

  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(abortReason(signal));
    signal.addEventListener("abort", abort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      }
    );
  });
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) throw abortReason(signal);
}

function abortReason(signal: AbortSignal) {
  return signal.reason ?? new DOMException("Narration preparation cancelled.", "AbortError");
}
