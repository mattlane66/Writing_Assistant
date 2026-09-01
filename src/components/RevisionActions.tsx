import { LoaderCircle } from "lucide-react";

interface RevisionActionsProps {
  ceiling: boolean;
  onCeilingChange: (ceiling: boolean) => void;
  loading: boolean;
  disabled: boolean;
}

export function RevisionActions({
  ceiling,
  onCeilingChange,
  loading,
  disabled,
}: RevisionActionsProps) {
  return (
    <div className="revision-actions">
      <div className="primary-action-row">
        <button
          className="revise-button"
          type="submit"
          disabled={disabled}
          aria-keyshortcuts="Meta+Enter Control+Enter"
          title="Revise (⌘/Ctrl + Enter)"
        >
          {loading && (
            <LoaderCircle
              className="button-spinner"
              size={20}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          )}
          <span>{loading ? "Revising…" : "Revise at full strength"}</span>
        </button>

        <div className="ceiling-control">
          <span id="ceiling-label">Ceiling pass</span>
          <button
            className="toggle-switch"
            type="button"
            role="switch"
            aria-labelledby="ceiling-label"
            aria-checked={ceiling}
            data-checked={ceiling || undefined}
            onClick={() => onCeilingChange(!ceiling)}
          >
            <span className="toggle-knob" />
          </button>
        </div>
      </div>
      <p className="privacy-note">
        Drafts are sent to OpenAI only when you revise; bounded agent stages run there.
      </p>
    </div>
  );
}
