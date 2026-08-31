import { useCallback, useEffect } from "react";
import { DirectionField } from "./components/DirectionField";
import { EditorWorkspace } from "./components/EditorWorkspace";
import { Header } from "./components/Header";
import { ModeSelector } from "./components/ModeSelector";
import { RevisionActions } from "./components/RevisionActions";
import { SourceRail } from "./components/SourceRail";
import { usePersistentState } from "./hooks/usePersistentState";
import { useRevision } from "./hooks/useRevision";
import type { RevisionMode } from "./types";

const STORAGE_KEYS = {
  draft: "writing-assistant:v1:draft",
  direction: "writing-assistant:v1:direction",
  mode: "writing-assistant:v1:mode",
  ceiling: "writing-assistant:v1:ceiling",
} as const;

const VALID_MODES: ReadonlyArray<RevisionMode> = [
  "proofread",
  "edit",
  "rewrite",
  "compress",
  "draft",
  "analyze",
];

function isRevisionMode(value: unknown): value is RevisionMode {
  return VALID_MODES.some((mode) => mode === value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export default function App() {
  const [draft, setDraft] = usePersistentState(
    STORAGE_KEYS.draft,
    "",
    isString,
  );
  const [direction, setDirection] = usePersistentState(
    STORAGE_KEYS.direction,
    "",
    isString,
  );
  const [storedMode, setStoredMode] = usePersistentState<RevisionMode>(
    STORAGE_KEYS.mode,
    "edit",
    isRevisionMode,
  );
  const [ceiling, setCeiling] = usePersistentState(
    STORAGE_KEYS.ceiling,
    true,
    isBoolean,
  );
  const { state: revision, revise, reset } = useRevision();
  const mode = isRevisionMode(storedMode) ? storedMode : "edit";
  const loading = revision.status === "loading";
  const canSubmit = Boolean(draft.trim()) && !loading;

  const submitRevision = useCallback(() => {
    if (!canSubmit) return;
    void revise({ draft, direction, mode, ceiling });
  }, [canSubmit, ceiling, direction, draft, mode, revise]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.key === "Enter" &&
        (event.metaKey || event.ctrlKey) &&
        !event.isComposing
      ) {
        event.preventDefault();
        submitRevision();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [submitRevision]);

  const clearDraft = () => {
    setDraft("");
    reset();
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>("#draft-input")?.focus();
    });
  };

  return (
    <div className="app-shell">
      <Header guideCount={7} />
      <main className="app-main">
        <ModeSelector mode={mode} onChange={setStoredMode} />

        <form
          className="revision-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitRevision();
          }}
        >
          <DirectionField value={direction} onChange={setDirection} />
          <EditorWorkspace
            draft={draft}
            onDraftChange={setDraft}
            onClear={clearDraft}
            revision={revision}
          />
          <RevisionActions
            ceiling={ceiling}
            onCeilingChange={setCeiling}
            loading={loading}
            disabled={!canSubmit}
          />
        </form>
      </main>
      <SourceRail />
    </div>
  );
}
