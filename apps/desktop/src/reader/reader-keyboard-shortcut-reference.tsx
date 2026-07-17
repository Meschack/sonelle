import { For, onCleanup, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import { CloseIcon } from "./reader-icons";
import { readerKeyboardShortcutReference } from "./reader-keyboard-shortcuts";

interface ReaderKeyboardShortcutReferenceProps {
  onClose: () => void;
}

export function ReaderKeyboardShortcutReference(props: ReaderKeyboardShortcutReferenceProps) {
  let dialog: HTMLDivElement | undefined;
  const previouslyFocused = document.activeElement as HTMLElement | null;

  onMount(() => dialog?.focus());
  onCleanup(() => previouslyFocused?.focus());

  const keepFocusInside = (event: KeyboardEvent) => {
    if (event.key !== "Tab" || dialog == null) return;
    const controls = [...dialog.querySelectorAll<HTMLElement>("button:not(:disabled)")];
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (
      document.activeElement === dialog ||
      (event.shiftKey && document.activeElement === first) ||
      (!event.shiftKey && document.activeElement === last)
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  };

  return (
    <Portal>
      <div
        class="shortcut-reference-backdrop"
        onClick={(event) => {
          if (event.target === event.currentTarget) props.onClose();
        }}
      >
        <div
          ref={dialog}
          class="shortcut-reference"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcut-reference-title"
          tabIndex={-1}
          onKeyDown={keepFocusInside}
        >
          <header class="shortcut-reference-header">
            <div>
              <span>Quick reference</span>
              <h2 id="shortcut-reference-title">Keyboard shortcuts</h2>
            </div>
            <button
              type="button"
              aria-label="Close keyboard shortcuts"
              title="Close (Esc)"
              onClick={props.onClose}
            >
              <CloseIcon />
            </button>
          </header>
          <div class="shortcut-reference-groups">
            <For each={readerKeyboardShortcutReference}>
              {(group) => (
                <section
                  class="shortcut-reference-group"
                  aria-labelledby={`shortcut-${group.title}`}
                >
                  <h3 id={`shortcut-${group.title}`}>{group.title}</h3>
                  <dl>
                    <For each={group.shortcuts}>
                      {(shortcut) => (
                        <div class="shortcut-reference-row">
                          <dt>
                            <For each={shortcut.keys}>
                              {(key, index) => (
                                <>
                                  <kbd>{key}</kbd>
                                  {index() < shortcut.keys.length - 1 ? <span>or</span> : null}
                                </>
                              )}
                            </For>
                          </dt>
                          <dd>{shortcut.label}</dd>
                        </div>
                      )}
                    </For>
                  </dl>
                </section>
              )}
            </For>
          </div>
        </div>
      </div>
    </Portal>
  );
}
