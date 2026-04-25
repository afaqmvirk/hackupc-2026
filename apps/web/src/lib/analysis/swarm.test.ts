import { describe, expect, it } from "vitest";
import { calibrateAgentReviewBehavior } from "@/lib/analysis/swarm";
import { buildEvidencePack } from "@/lib/data/retrieval";
import { loadCreatives } from "@/lib/data/csv";
import type { AgentReview } from "@/lib/schemas";

const brief = {
  category: "gaming",
  region: "global",
  language: "any",
  os: "any",
  objective: "installs",
  audienceStyle: "casual mobile users",
};

function reviewWithBehavior(behavior: AgentReview["behavior"]): AgentReview {
  return {
    agentName: "Fatigue Analyst",
    agentType: "specialist",
    variantId: "variant",
    attention: 5,
    clarity: 5,
    trust: 5,
    conversionIntent: 5,
    fatigueRisk: "medium",
    recommendation: "edit",
    behavior,
    topPositive: "Some visible value.",
    topConcern: "Risk is uncertain.",
    suggestedEdit: "Clarify the message.",
    reasoning: "Mock review.",
    evidenceRefs: [],
  };
}

describe("swarm behavior calibration", () => {
  it("pulls extreme skip behavior back toward positive target history", async () => {
    const creative = loadCreatives().find((item) => item.id === "500038");
    expect(creative).toBeTruthy();
    const pack = await buildEvidencePack(creative!, brief, 0);

    const calibrated = calibrateAgentReviewBehavior(
      reviewWithBehavior({
        primaryState: "skip",
        probabilities: { skip: 0.6, ignore: 0.1, inspect: 0.17, click: 0.1, convert: 0.03, exit: 0 },
        confidence: "medium",
        rationale: "I might skip due to freshness risk.",
      }),
      pack,
    );

    expect(calibrated.behavior.probabilities.click + calibrated.behavior.probabilities.convert).toBeGreaterThan(
      calibrated.behavior.probabilities.skip + calibrated.behavior.probabilities.exit,
    );
  });

  it("pulls optimistic click behavior back toward fatigued target history", async () => {
    const creative = loadCreatives().find((item) => item.id === "500001");
    expect(creative).toBeTruthy();
    const pack = await buildEvidencePack(creative!, brief, 0);

    const calibrated = calibrateAgentReviewBehavior(
      reviewWithBehavior({
        primaryState: "click",
        probabilities: { skip: 0.2, ignore: 0.2, inspect: 0.1, click: 0.3, convert: 0.1, exit: 0.1 },
        confidence: "medium",
        rationale: "The reward can still earn a click.",
      }),
      pack,
    );

    expect(calibrated.behavior.probabilities.skip + calibrated.behavior.probabilities.exit).toBeGreaterThan(
      calibrated.behavior.probabilities.click + calibrated.behavior.probabilities.convert,
    );
  });
});
