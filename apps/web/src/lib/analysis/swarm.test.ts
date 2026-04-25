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

function reviewWithBehavior(behavior: AgentReview["behavior"], overrides: Partial<AgentReview> = {}): AgentReview {
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
    ...overrides,
  };
}

describe("swarm behavior calibration", () => {
  it("pulls unrealistic action probabilities back toward dataset-scale target history", async () => {
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

    expect(calibrated.behavior.probabilities.click).toBeLessThan(0.03);
    expect(calibrated.behavior.probabilities.convert).toBeLessThan(0.007);
    expect(calibrated.behavior.probabilities.click).toBeGreaterThan(pack.behaviorPrior.probabilityHints.click * 0.9);
  });

  it("pulls optimistic click behavior back toward fatigued target history and caps action rates", async () => {
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
    expect(calibrated.behavior.probabilities.click).toBeLessThan(0.02);
    expect(calibrated.behavior.probabilities.convert).toBeLessThan(0.005);
  });

  it("keeps persona action rates distinct around the same evidence anchor", async () => {
    const creative = loadCreatives().find((item) => item.id === "500001");
    expect(creative).toBeTruthy();
    const pack = await buildEvidencePack(creative!, brief, 0);
    const rawBehavior: AgentReview["behavior"] = {
      primaryState: "click",
      probabilities: { skip: 0.2, ignore: 0.2, inspect: 0.2, click: 0.3, convert: 0.08, exit: 0.02 },
      confidence: "medium",
      rationale: "The creative has a visible reward and CTA.",
    };

    const lowAttention = calibrateAgentReviewBehavior(
      reviewWithBehavior(rawBehavior, {
        agentName: "Low-Attention Scroller",
        agentType: "persona",
        attention: 5,
        clarity: 5,
        trust: 5,
        conversionIntent: 4,
      }),
      pack,
    );
    const skeptical = calibrateAgentReviewBehavior(
      reviewWithBehavior(rawBehavior, {
        agentName: "Skeptical User",
        agentType: "persona",
        attention: 6,
        clarity: 6,
        trust: 4,
        conversionIntent: 4,
      }),
      pack,
    );
    const rewardSeeking = calibrateAgentReviewBehavior(
      reviewWithBehavior(rawBehavior, {
        agentName: "Reward-Seeking User",
        agentType: "persona",
        attention: 8,
        clarity: 7,
        trust: 6,
        conversionIntent: 7,
      }),
      pack,
    );
    const practical = calibrateAgentReviewBehavior(
      reviewWithBehavior(rawBehavior, {
        agentName: "Practical Converter",
        agentType: "persona",
        attention: 6,
        clarity: 8,
        trust: 7,
        conversionIntent: 8,
      }),
      pack,
    );

    expect(rewardSeeking.behavior.probabilities.click).toBeGreaterThan(skeptical.behavior.probabilities.click);
    expect(rewardSeeking.behavior.probabilities.click).toBeGreaterThan(lowAttention.behavior.probabilities.click);
    expect(practical.behavior.probabilities.convert).toBeGreaterThan(lowAttention.behavior.probabilities.convert);
    expect(lowAttention.behavior.probabilities.skip).toBeGreaterThan(rewardSeeking.behavior.probabilities.skip);
    expect(skeptical.behavior.probabilities.exit).toBeGreaterThan(rewardSeeking.behavior.probabilities.exit);
  });
});
