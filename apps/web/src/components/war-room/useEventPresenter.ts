import { useEffect, useRef, useState } from "react";
import type { AgentReview } from "@/lib/schemas";
import { ALL_AGENTS, type AgentVisualState } from "./agent-config";

const MIN_DISPLAY_MS = 3500; // each agent gets at least this long on stage
const POST_VARIANT_PAUSE_MS = 600; // brief beat between variants

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

/**
 * Queues incoming agent reviews and reveals them on a steady cadence,
 * regardless of how fast/slow the backend stream arrives.
 *
 * Reviews arrive in arbitrary order (Gemini calls complete out of order).
 * The presenter:
 *   - buffers them into a FIFO ref (no re-renders on enqueue)
 *   - drips one onto stage every >= MIN_DISPLAY_MS
 *   - tracks per-variant agent state so the ring can light up correctly
 */
export function useEventPresenter(reviews: AgentReview[]): PresenterState {
  const queueRef = useRef<AgentReview[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const tickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [current, setCurrent] = useState<PresentedReview | null>(null);
  const [agentStatesByVariant, setAgentStatesByVariant] = useState<Map<string, Map<string, AgentVisualState>>>(
    new Map(),
  );
  const [queueDepth, setQueueDepth] = useState(0);
  const [totalSeen, setTotalSeen] = useState(0);

  // Enqueue any new reviews we haven't seen yet
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

  // Reset on unmount + when reviews array becomes empty (new analysis run)
  useEffect(() => {
    if (reviews.length === 0) {
      queueRef.current = [];
      seenIdsRef.current = new Set();
      setCurrent(null);
      setAgentStatesByVariant(new Map());
      setQueueDepth(0);
      setTotalSeen(0);
      if (tickTimerRef.current) clearTimeout(tickTimerRef.current);
    }
  }, [reviews.length]);

  // Choreographer: pulls the next review off the queue when the current one's stage time is up
  useEffect(() => {
    const tryAdvance = () => {
      const next = queueRef.current.shift();
      if (!next) {
        // queue empty — keep current on screen, will retry when more arrive
        tickTimerRef.current = setTimeout(tryAdvance, 800);
        return;
      }

      const variantChanged = current?.review.variantId !== next.variantId;
      setCurrent({ review: next, startedAt: Date.now() });
      setQueueDepth(queueRef.current.length);
      setTotalSeen((n) => n + 1);
      setAgentStatesByVariant((prev) => {
        const map = new Map(prev);
        const variantStates = variantChanged
          ? initialAgentStates()
          : new Map(map.get(next.variantId) ?? initialAgentStates());

        // Promote previous speaker (within same variant) to done
        if (current && !variantChanged) {
          variantStates.set(current.review.agentName, "done");
        }
        variantStates.set(next.agentName, "speaking");
        map.set(next.variantId, variantStates);
        return map;
      });

      const dwell = variantChanged ? MIN_DISPLAY_MS + POST_VARIANT_PAUSE_MS : MIN_DISPLAY_MS;
      tickTimerRef.current = setTimeout(tryAdvance, dwell);
    };

    if (current === null && queueRef.current.length > 0) {
      tryAdvance();
    } else if (current === null) {
      // waiting for first arrival
      tickTimerRef.current = setTimeout(tryAdvance, 600);
    }

    return () => {
      if (tickTimerRef.current) clearTimeout(tickTimerRef.current);
    };
    // current is intentionally excluded — we manage the loop manually via setTimeout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  return {
    current,
    agentStatesByVariant,
    currentVariantId: current?.review.variantId ?? null,
    queueDepth,
    totalSeen,
  };
}
