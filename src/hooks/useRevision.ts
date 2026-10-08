import { useCallback, useEffect, useRef, useState } from "react";
import type { RevisionMeta, RevisionRequest, RevisionResponse } from "../types";

export type RevisionStatus = "idle" | "loading" | "success" | "error";

export interface RevisionState {
  status: RevisionStatus;
  result: string;
  error: string | null;
  meta?: RevisionMeta;
}

const INITIAL_STATE: RevisionState = {
  status: "idle",
  result: "",
  error: null,
};

function messageFromBody(body: unknown) {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }

  return null;
}

// Product intent: clearing a draft aborts its active request and resets revision state.
export function useRevision() {
  const [state, setState] = useState<RevisionState>(INITIAL_STATE);
  const activeRequest = useRef<AbortController | null>(null);

  const revise = useCallback(async (payload: RevisionRequest) => {
    activeRequest.current?.abort();

    const controller = new AbortController();
    activeRequest.current = controller;
    setState({ status: "loading", result: "", error: null });

    try {
      const response = await fetch("/api/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => null)) as
        | RevisionResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          messageFromBody(body) ??
            "The revision could not be completed. Please try again.",
        );
      }

      if (!body || !("result" in body) || typeof body.result !== "string") {
        throw new Error("The revision service returned an unexpected response.");
      }

      const meta =
        "meta" in body && body.meta && typeof body.meta === "object"
          ? body.meta
          : undefined;

      setState({
        status: "success",
        result: body.result,
        error: null,
        meta,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setState({
        status: "error",
        result: "",
        error:
          error instanceof Error
            ? error.message
            : "Something interrupted the revision. Please try again.",
      });
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
      }
    }
  }, []);

  const reset = useCallback(() => {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setState(INITIAL_STATE);
  }, []);

  useEffect(
    () => () => {
      activeRequest.current?.abort();
    },
    [],
  );

  return { state, revise, reset };
}
