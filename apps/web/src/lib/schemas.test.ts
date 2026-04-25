import { describe, expect, it } from "vitest";
import { agentReviewSchema, experimentSchema, finalReportSchema } from "@/lib/schemas";

const behavior = {
  primaryState: "click",
  probabilities: {
    skip: 0.2,
    ignore: 0.2,
    inspect: 0.2,
    click: 0.2,
    convert: 0.2,
    exit: 0.2,
  },
  confidence: "medium",
  rationale: "The CTA is clear enough to earn a tap, but conversion is not guaranteed.",
};

describe("behavior schemas", () => {
  it("normalizes agent behavior probabilities", () => {
    const review = agentReviewSchema.parse({
      agentName: "Practical Converter",
      agentType: "persona",
      variantId: "variant_a",
      attention: 7,
      clarity: 7,
      trust: 6,
      conversionIntent: 6,
      fatigueRisk: "medium",
      recommendation: "test",
      behavior,
      topPositive: "Clear CTA.",
      topConcern: "Offer details are thin.",
      suggestedEdit: "Make the post-click value clearer.",
      reasoning: "The creative is understandable and action-oriented.",
      evidenceRefs: ["fact:CTA"],
    });

    const total = Object.values(review.behavior.probabilities).reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(1, 3);
  });

  it("rejects unknown behavior states", () => {
    expect(() =>
      agentReviewSchema.parse({
        agentName: "Skeptical User",
        agentType: "persona",
        variantId: "variant_a",
        attention: 5,
        clarity: 5,
        trust: 4,
        conversionIntent: 3,
        fatigueRisk: "high",
        recommendation: "edit",
        behavior: { ...behavior, primaryState: "linger" },
        topPositive: "Some offer value is visible.",
        topConcern: "Trust is weak.",
        suggestedEdit: "Clarify the offer.",
        reasoning: "The behavior state is invalid.",
        evidenceRefs: [],
      }),
    ).toThrow();
  });

  it("accepts final ranking behavior summaries", () => {
    const report = finalReportSchema.parse({
      winner: "variant_a",
      executiveSummary: "Variant A is the best pre-test candidate.",
      ranking: [
        {
          variantId: "variant_a",
          rank: 1,
          score: 72,
          predictedOutcome: "Likely above baseline.",
          creativeHealth: 74,
          swarmConfidence: "medium",
          action: "test",
          dominantBehaviorState: "click",
          behaviorProbabilities: behavior.probabilities,
          behaviorSummary: "Simulated users are most likely to click after inspecting the CTA.",
          topReasons: ["Clear CTA"],
          risks: ["Moderate fatigue risk"],
          recommendedEdits: ["Clarify terms"],
        },
      ],
      champion: "Variant A",
      whyItWins: ["Clear CTA"],
      risks: ["Moderate fatigue risk"],
      whatToDoNext: ["Run a controlled test"],
      abTestPlan: {
        primaryMetric: "CVR",
        secondaryMetric: "CTR",
        control: "Variant A",
        challenger: "Variant B",
        trafficSplit: "50/50",
        hypothesis: "Clearer CTA improves conversion.",
        stopCondition: "Stop after minimum spend.",
        actionIfWinner: "Scale",
        actionIfLoser: "Edit",
      },
      personaActionForecast: [
        {
          variantId: "variant_a",
          projectedViews: 100000,
          personas: [
            {
              agentName: "Practical Converter",
              weight: 0.1948222679,
              expectedActions: {
                skip: 1948.222679,
                click: 3896.445358,
                convert: 9741.113395,
                exit: 0,
              },
            },
          ],
          totals: {
            skip: 1948.222679,
            click: 3896.445358,
            convert: 9741.113395,
            exit: 0,
          },
        },
      ],
      fatigueProfiles: [
        {
          creativeId: "variant_a",
          healthScore: 64,
          urgency: "WATCH",
          estimatedLifespanDays: 12,
          ctrDecayPct: -0.52,
          cvrDecayPct: -0.34,
          currentStatus: "stable",
          visualRiskFactors: ["Moderate decay risk"],
          visualStrengths: ["Readable layout"],
          dataSource: "historical",
        },
      ],
    });

    expect(report.ranking[0].dominantBehaviorState).toBe("click");
    expect(report.personaActionForecast[0].totals.convert).toBeGreaterThan(9000);
    expect(report.fatigueProfiles[0].urgency).toBe("WATCH");
  });

  it("defaults experiments to evidence input mode and projected views", () => {
    const experiment = experimentSchema.parse({
      id: "experiment_1",
      brief: {
        category: "gaming",
        region: "global",
        language: "any",
        os: "any",
        objective: "installs",
        audienceStyle: "casual mobile users",
      },
      variants: [
        {
          id: "creative_a",
          source: "upload",
          assetUrl: "/a.png",
          assetType: "uploaded_image",
          category: "gaming",
          language: "any",
          format: "uploaded_image",
          durationSec: 0,
          createdAt: "2026-04-25T00:00:00.000Z",
          features: {},
        },
        {
          id: "creative_b",
          source: "upload",
          assetUrl: "/b.png",
          assetType: "uploaded_image",
          category: "gaming",
          language: "any",
          format: "uploaded_image",
          durationSec: 0,
          createdAt: "2026-04-25T00:00:00.000Z",
          features: {},
        },
      ],
      status: "created",
      createdAt: "2026-04-25T00:00:00.000Z",
    });

    expect(experiment.analysisInputMode).toBe("evidence");
    expect(experiment.projectedViews).toBe(100000);
  });
});
