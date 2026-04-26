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

    let resultsWindow = openWaitingResultsWindow();

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
      writeResultsWindowStatus(
        resultsWindow,
        "Gemini swarm is analyzing",
        "Keep this tab open. Results will load here when the swarm completes.",
      );

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

      if (resultsWindow && !resultsWindow.closed) {
        resultsWindow.location.href = resultsUrl;
      } else {
        resultsWindow = window.open(resultsUrl, "_blank", "noopener,noreferrer");
        if (!resultsWindow) {
          window.location.href = resultsUrl;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed.";
      setError(message);
      setPhase("error");
      writeResultsWindowStatus(resultsWindow, "Analysis failed", message);
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

function openWaitingResultsWindow() {
  const popup = window.open("about:blank", "_blank");
  writeResultsWindowStatus(
    popup,
    "Preparing Gemini swarm",
    "The results page will appear here when analysis completes.",
  );
  return popup;
}

function writeResultsWindowStatus(target: Window | null, title: string, message: string) {
  if (!target || target.closed) return;

  try {
    target.document.title = title;
    target.document.body.innerHTML = `
      <main style="min-height:100vh;margin:0;display:grid;place-items:center;background:#070912;color:#f6f6fb;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <section style="width:min(520px,calc(100vw - 48px));border:1px solid rgba(199,183,255,.16);border-radius:16px;background:#111626;padding:24px;box-shadow:0 24px 80px rgba(0,0,0,.32);">
          <p style="margin:0 0 8px;color:#9d64f6;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">Creative Swarm Copilot</p>
          <h1 style="margin:0;color:#f6f6fb;font-size:22px;line-height:1.25;">${escapeHtml(title)}</h1>
          <p style="margin:12px 0 0;color:#c9c3dd;font-size:14px;line-height:1.6;">${escapeHtml(message)}</p>
        </section>
      </main>
    `;
  } catch {
    // Some browsers restrict writes to newly opened windows; navigation fallback still works.
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
