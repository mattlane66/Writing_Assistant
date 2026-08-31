import {
  AlignLeft,
  ArrowRightLeft,
  ChartNoAxesColumnIncreasing,
  Feather,
  PenLine,
  Search,
} from "lucide-react";
import type { RevisionMode } from "../types";

const MODES = [
  { value: "proofread", label: "Proofread", Icon: Search },
  { value: "edit", label: "Edit", Icon: PenLine },
  { value: "rewrite", label: "Rewrite", Icon: ArrowRightLeft },
  { value: "compress", label: "Compress", Icon: AlignLeft },
  { value: "draft", label: "Draft", Icon: Feather },
  {
    value: "analyze",
    label: "Analyze",
    description: "Analyze craft, logic, and internal consistency",
    Icon: ChartNoAxesColumnIncreasing,
  },
] satisfies ReadonlyArray<{
  value: RevisionMode;
  label: string;
  description?: string;
  Icon: typeof Search;
}>;

interface ModeSelectorProps {
  mode: RevisionMode;
  onChange: (mode: RevisionMode) => void;
}

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <nav className="mode-selector" aria-label="Revision modes">
      <div className="mode-list">
        {MODES.map(({ value, label, description, Icon }) => {
          const selected = value === mode;

          return (
            <button
              key={value}
              className="mode-button"
              type="button"
              aria-pressed={selected}
              aria-label={description ?? label}
              title={description}
              data-selected={selected || undefined}
              onClick={() => onChange(value)}
            >
              <Icon size={25} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
