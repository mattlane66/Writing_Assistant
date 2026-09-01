import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  GripVertical,
  LoaderCircle,
} from "lucide-react";
import type { RevisionState } from "../hooks/useRevision";
import { AgentPath } from "./AgentPath";

type CopyState = "idle" | "copied" | "failed";

interface EditorWorkspaceProps {
  draft: string;
  onDraftChange: (draft: string) => void;
  onClear: () => void;
  revision: RevisionState;
}

function countWords(value: string) {
  const normalized = value.trim();
  return normalized ? normalized.split(/\s+/u).length : 0;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const transfer = document.createElement("textarea");
  transfer.value = value;
  transfer.setAttribute("readonly", "");
  transfer.style.position = "fixed";
  transfer.style.opacity = "0";
  document.body.appendChild(transfer);
  transfer.select();
  const copied = document.execCommand("copy");
  transfer.remove();

  if (!copied) {
    throw new Error("Copy is unavailable");
  }
}

export function EditorWorkspace({
  draft,
  onDraftChange,
  onClear,
  revision,
}: EditorWorkspaceProps) {
  const [copyFeedback, setCopyFeedback] = useState<{
    result: string;
    state: CopyState;
  }>({ result: "", state: "idle" });
  const resetCopyTimer = useRef<number | null>(null);
  const wordCount = countWords(draft);
  const wordLabel = `${wordCount} ${wordCount === 1 ? "word" : "words"}`;
  const hasResult = revision.status === "success" && Boolean(revision.result);
  const copyState =
    copyFeedback.result === revision.result ? copyFeedback.state : "idle";

  useEffect(
    () => () => {
      if (resetCopyTimer.current !== null) {
        window.clearTimeout(resetCopyTimer.current);
      }
    },
    [],
  );

  const handleCopy = async () => {
    if (!hasResult) return;

    try {
      await copyText(revision.result);
      setCopyFeedback({ result: revision.result, state: "copied" });
    } catch {
      setCopyFeedback({ result: revision.result, state: "failed" });
    }

    if (resetCopyTimer.current !== null) {
      window.clearTimeout(resetCopyTimer.current);
    }
    resetCopyTimer.current = window.setTimeout(
      () => setCopyFeedback({ result: revision.result, state: "idle" }),
      1800,
    );
  };

  const copyLabel =
    copyState === "copied"
      ? "Copied"
      : copyState === "failed"
        ? "Try again"
        : "Copy";

  return (
    <section className="editor-frame" aria-label="Writing workspace">
      <div className="editor-pane draft-pane">
        <div className="pane-header">
          <div className="pane-heading">
            <label className="pane-title" htmlFor="draft-input">
              Draft
            </label>
            <span id="draft-word-count" className="word-count" aria-live="polite">
              {wordLabel}
            </span>
          </div>
          <button
            type="button"
            className="clear-button"
            onClick={onClear}
            disabled={!draft}
          >
            Clear
          </button>
        </div>

        <textarea
          id="draft-input"
          className="draft-input"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Paste or write your draft here…"
          aria-describedby="draft-word-count"
          spellCheck="true"
        />
      </div>

      <span className="split-handle" aria-hidden="true">
        <GripVertical size={14} strokeWidth={1.8} />
      </span>

      <div
        className="editor-pane revision-pane"
        aria-busy={revision.status === "loading"}
      >
        <div className="pane-header">
          <h2 className="pane-title">Revision</h2>
          <button
            type="button"
            className="copy-button"
            onClick={handleCopy}
            disabled={!hasResult}
            aria-live="polite"
          >
            {copyState === "copied" ? (
              <Check size={21} strokeWidth={1.8} aria-hidden="true" />
            ) : copyState === "failed" ? (
              <AlertCircle size={21} strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <Copy size={21} strokeWidth={1.8} aria-hidden="true" />
            )}
            <span>{copyLabel}</span>
          </button>
        </div>

        <div className="revision-content" aria-live="polite">
          {revision.status === "loading" ? (
            <div className="revision-state loading-state">
              <LoaderCircle
                className="loading-icon"
                size={28}
                strokeWidth={1.7}
                aria-hidden="true"
              />
              <p>Revising your draft…</p>
              <span>Selecting methods, revising, and auditing the result.</span>
            </div>
          ) : revision.status === "error" ? (
            <div className="revision-state error-state" role="alert">
              <AlertCircle size={28} strokeWidth={1.7} aria-hidden="true" />
              <p>Revision paused</p>
              <span>{revision.error}</span>
            </div>
          ) : hasResult ? (
            <div className="revision-success">
              {revision.meta?.pipeline ? (
                <AgentPath pipeline={revision.meta.pipeline} />
              ) : null}
              <div className="revision-output">{revision.result}</div>
            </div>
          ) : (
            <div className="revision-state empty-state">
              <p>Your revision will appear here.</p>
              <span>Choose a mode and revise when your draft is ready.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
