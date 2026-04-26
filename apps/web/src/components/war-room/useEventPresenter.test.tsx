import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentReview } from "@/lib/schemas";
import { useEventPresenter } from "./useEventPresenter";

function review(variantId: string, agentName: string): AgentReview {
  return {
    agentName,
    agentType: agentName.includes("User") ? "persona" : "specialist",
    variantId,
    attention: 6,
    clarity: 6,
    trust: 6,
    conversionIntent: 6,
    directResponseIntent: 0.6,
    fatigueRisk: "medium",
    recommendation: "test",
    behavior: {
      primaryState: "inspect",
      probabilities: { skip: 0.4, ignore: 0.25, inspect: 0.33, click: 0.015, convert: 0.002, exit: 0.003 },
      confidence: "medium",
      rationale: "Mock behavior rationale.",
    },
    topPositive: "Clear hook.",
    topConcern: "Moderate fatigue risk.",
    suggestedEdit: "Tighten the CTA.",
    reasoning: `${agentName} reasoning for ${variantId}.`,
    evidenceRefs: [],
  };
}

describe("useEventPresenter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps advancing queued reviews and marks previous speakers done", () => {
    vi.useFakeTimers();

    const first = review("variant-a", "Performance Analyst");
    const second = review("variant-a", "Creative Director");
    const { result, rerender } = renderHook(({ reviews }) => useEventPresenter(reviews), {
      initialProps: { reviews: [] as AgentReview[] },
    });

    act(() => {
      rerender({ reviews: [first, second] });
    });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current.current?.review.agentName).toBe("Performance Analyst");

    act(() => {
      vi.advanceTimersByTime(3500);
    });

    expect(result.current.current?.review.agentName).toBe("Creative Director");
    expect(result.current.agentStatesByVariant.get("variant-a")?.get("Performance Analyst")).toBe("done");
    expect(result.current.agentStatesByVariant.get("variant-a")?.get("Creative Director")).toBe("speaking");
  });

  it("resets presenter state when a new run clears reviews", () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(({ reviews }) => useEventPresenter(reviews), {
      initialProps: { reviews: [review("variant-a", "Performance Analyst")] as AgentReview[] },
    });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current.current).not.toBeNull();

    act(() => {
      rerender({ reviews: [] });
    });

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(result.current.current).toBeNull();
    expect(result.current.totalSeen).toBe(0);
  });
});
