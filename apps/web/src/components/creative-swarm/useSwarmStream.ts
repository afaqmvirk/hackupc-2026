"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  AgentReview,
  AnalysisInputMode,
  CampaignBrief,
  CreativeDoc,
  EvidencePack,
  SimulatedDecayCurve,
} from "@/lib/schemas";

export type SwarmPhase = "idle" | "analyzing" | "revealing" | "complete" | "error";

export type SwarmMessage =
  | { id: string; type: "status"; message: string }
  | { id: string; type: "agent"; review: AgentReview }
  | { id: string; type: "evidence"; pack: EvidencePack }
  | { id: string; type: "decay"; curves: SimulatedDecayCurve[] }
  | { id: string; type: "error"; message: string };

type StartAnalysisInput = {
  brief: CampaignBrief;
  analysisInputMode: AnalysisInputMode;
  projectedViews: number;
  selectedIds: string[];
  uploadedCreatives: CreativeDoc[];
};

export function useSwarmStream() {
  const [messages, setMessages] = useState<SwarmMessage[]>([]);
  const [completedResultsUrl, setCompletedResultsUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<SwarmPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const agentReviews = useMemo<AgentReview[]>(
    () => messages.filter((m): m is { id: string; type: "agent"; review: AgentReview } => m.type === "agent").map((m) => m.review),
    [messages],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setCompletedResultsUrl(null);
    setError(null);
    setPhase("idle");
  }, []);

  const startAnalysis = useCallback(async (input: StartAnalysisInput) => {
    setError(null);
    setCompletedResultsUrl(null);
    setMessages([]);
    setPhase("analyzing");

    try {
      const createResponse = await fetch("/api/experiments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brief: input.brief,
          analysisInputMode: input.analysisInputMode,
          projectedViews: input.projectedViews,
          creativeIds: input.selectedIds,
          uploadedCreatives: input.uploadedCreatives,
        }),
      });
      const createPayload = await createResponse.json();
      if (!createResponse.ok) {
        throw new Error(createPayload.error ?? "Could not create experiment.");
      }

      const experimentId = createPayload.experiment.id;

      const analyzeResponse = await fetch(`/api/experiments/${experimentId}/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ experiment: createPayload.experiment }),
      });

      if (!analyzeResponse.ok) {
        const payload = await analyzeResponse.json().catch(() => null);
        throw new Error(payload?.error ?? "Analysis request failed.");
      }

      if (!analyzeResponse.body) {
        throw new Error("Analysis stream did not start.");
      }

      const reader = analyzeResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffered = "";
      let reportReceived = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffered += decoder.decode(value, { stream: true });
        const lines = buffered.split("\n");
        buffered = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "report") {
            reportReceived = true;
            setPhase("revealing");
          } else if (event.type === "error") {
            setError(event.message);
            setMessages((current) => [...current, { id: crypto.randomUUID(), type: "error", message: event.message }]);
          } else {
            setMessages((current) => [...current, { id: crypto.randomUUID(), ...event }]);
          }
        }
      }

      if (!reportReceived) {
        throw new Error("Analysis finished without a results report.");
      }

      const resultsUrl = `/experiments/${experimentId}/results`;
      setCompletedResultsUrl(resultsUrl);
      setPhase("complete");
      window.location.assign(resultsUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed.";
      setError(message);
      setPhase("error");
    }
  }, []);

  return {
    messages,
    agentReviews,
    completedResultsUrl,
    phase,
    error,
    isAnalyzing: phase === "analyzing" || phase === "revealing",
    reset,
    startAnalysis,
  };
}
