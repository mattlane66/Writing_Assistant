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

export interface RevisionResponse {
  result: string;
  meta?: Record<string, unknown>;
}
