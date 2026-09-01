import { Check, ChevronDown, Route, Wrench } from "lucide-react";
import type { AgentPipelineMeta, PipelineStageName } from "../types";

const STAGE_LABELS: Record<PipelineStageName, string> = {
  plan: "Plan",
  retrieve: "Retrieve",
  write: "Write",
  audit: "Audit",
  repair: "Repair",
};

interface AgentPathProps {
  pipeline: AgentPipelineMeta;
}

export function AgentPath({ pipeline }: AgentPathProps) {
  const repaired = pipeline.auditDisposition === "repaired";

  return (
    <details className="agent-path">
      <summary>
        <span className="agent-path-title">
          <Route size={17} strokeWidth={1.8} aria-hidden="true" />
          Agent path
        </span>
        <span className="agent-path-summary-tail">
          <span className="agent-path-outcome">
            {repaired ? (
              <Wrench size={15} strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <Check size={15} strokeWidth={1.8} aria-hidden="true" />
            )}
            {repaired ? "Audited and repaired" : "Audit passed"}
          </span>
          <ChevronDown
            className="agent-path-chevron"
            size={16}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </span>
      </summary>

      <ol className="agent-stage-list" aria-label="Bounded agent stages">
        {pipeline.stages.map((stage) => (
          <li key={stage.name} data-skipped={stage.status === "skipped" || undefined}>
            {STAGE_LABELS[stage.name]}
          </li>
        ))}
      </ol>

      <div className="agent-methods">
        <span>Selected methods</span>
        <p>
          {pipeline.selectedConcepts.length > 0
            ? pipeline.selectedConcepts.map((concept) => concept.name).join(" · ")
            : "Baseline editorial contract"}
        </p>
      </div>
    </details>
  );
}
