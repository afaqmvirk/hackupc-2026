import { useEffect, useRef, useState } from "react";
import type { AgentReview } from "@/lib/schemas";
import { ALL_AGENTS, type AgentVisualState } from "./agent-config";

const MIN_DISPLAY_MS = 3500;
const POST_VARIANT_PAUSE_MS = 600;
const TICK_MS = 250;

export type PresentedReview = {
  review: AgentReview;
  startedAt: number;
};

export type PresenterState = {
  current: PresentedReview | null;
  agentStatesByVariant: Map<string, Map<string, AgentVisualState>>;
  currentVariantId: string | null;
  queueDepth: number;
  totalSeen: number;
};

const initialAgentStates = (): Map<string, AgentVisualState> => {
  const m = new Map<string, AgentVisualState>();
  for (const a of ALL_AGENTS) m.set(a.name, "dim");
  return m;
};

export function useEventPresenter(reviews: AgentReview[]): PresenterState {
  const queueRef = useRef<AgentReview[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const currentRef = useRef<PresentedReview | null>(null);
  const nextAdvanceAtRef = useRef(0);

  const [current, setCurrent] = useState<PresentedReview | null>(null);
  const [agentStatesByVariant, setAgentStatesByVariant] = useState<Map<string, Map<string, AgentVisualState>>>(
    new Map(),
  );
  const [queueDepth, setQueueDepth] = useState(0);
  const [totalSeen, setTotalSeen] = useState(0);

  useEffect(() => {
    let appended = 0;
    for (const r of reviews) {
      const id = `${r.variantId}::${r.agentName}`;
      if (seenIdsRef.current.has(id)) continue;
      seenIdsRef.current.add(id);
      queueRef.current.push(r);
      appended += 1;
    }
    if (appended > 0) {
      setQueueDepth(queueRef.current.length);
    }
  }, [reviews]);

  useEffect(() => {
    if (reviews.length !== 0) return;

    queueRef.current = [];
    seenIdsRef.current = new Set();
    currentRef.current = null;
    nextAdvanceAtRef.current = 0;
    const timeoutId = setTimeout(() => {
      setCurrent(null);
      setAgentStatesByVariant(new Map());
      setQueueDepth(0);
      setTotalSeen(0);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [reviews.length]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (Date.now() < nextAdvanceAtRef.current) return;

      const next = queueRef.current.shift();
      if (!next) {
        setQueueDepth(0);
        return;
      }

      const previous = currentRef.current;
      const variantChanged = previous ? previous.review.variantId !== next.variantId : false;
      const presented: PresentedReview = { review: next, startedAt: Date.now() };

      currentRef.current = presented;
      setCurrent(presented);
      setQueueDepth(queueRef.current.length);
      setTotalSeen((n) => n + 1);
      setAgentStatesByVariant((prev) => {
        const map = new Map(prev);

        if (previous) {
          const previousStates = new Map(map.get(previous.review.variantId) ?? initialAgentStates());
          previousStates.set(previous.review.agentName, "done");
          map.set(previous.review.variantId, previousStates);
        }

        const nextStates = variantChanged ? initialAgentStates() : new Map(map.get(next.variantId) ?? initialAgentStates());
        nextStates.set(next.agentName, "speaking");
        map.set(next.variantId, nextStates);
        return map;
      });

      nextAdvanceAtRef.current = Date.now() + MIN_DISPLAY_MS + (variantChanged ? POST_VARIANT_PAUSE_MS : 0);
    }, TICK_MS);

    return () => clearInterval(intervalId);
  }, []);

  return {
    current,
    agentStatesByVariant,
    currentVariantId: current?.review.variantId ?? null,
    queueDepth,
    totalSeen,
  };
}
