export type RevisionMode =
  | "proofread"
  | "edit"
  | "rewrite"
  | "compress"
  | "draft"
  | "analyze";

export interface RevisionRequest {
  draft: string;
  direction: string;
  mode: RevisionMode;
  ceiling: boolean;
}

export type PipelineStageName =
  | "plan"
  | "retrieve"
  | "write"
  | "audit"
  | "repair";

export interface PipelineStage {
  name: PipelineStageName;
  status: "completed" | "skipped";
}

export interface SelectedConcept {
  id: string;
  name: string;
}

export interface AgentPipelineMeta {
  version: string;
  registryVersion: string;
  selectedConcepts: SelectedConcept[];
  stages: PipelineStage[];
  auditDisposition: "passed" | "repaired";
}

export interface RevisionMeta {
  model?: string;
  mode?: RevisionMode;
  ceiling?: boolean;
  grounded?: boolean;
  pipeline?: AgentPipelineMeta;
}

export interface RevisionResponse {
  result: string;
  meta?: RevisionMeta;
}
