import { describe, expect, it } from "vitest";
import { buildPersonaActionForecast, fullDbPersonaWeights } from "@/lib/analysis/persona-projections";
import type { AgentReview } from "@/lib/schemas";

describe("persona action projections", () => {
  it("uses persona weights that sum to approximately one", () => {
    const total = Object.values(fullDbPersonaWeights).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBeCloseTo(1, 8);
  });

  it("uses the dataset-fitted audience composition", () => {
    expect(fullDbPersonaWeights["Scam-Sensitive User"]).toBeGreaterThan(0.15);
    expect(fullDbPersonaWeights["Skeptical User"]).toBeGreaterThanOrEqual(fullDbPersonaWeights["Reward-Seeking User"]);
    expect(fullDbPersonaWeights["Low-Attention Scroller"]).toBeGreaterThan(fullDbPersonaWeights["Practical Converter"]);
    expect(fullDbPersonaWeights["Privacy-Conscious User"]).toBeLessThan(fullDbPersonaWeights["Skeptical User"]);
  });

  it("applies projected views times persona weight times action probability", () => {
    const [forecast] = buildPersonaActionForecast({
      projectedViews: 1000,
      reviews: [
        review({
          agentName: "Practical Converter",
          agentType: "persona",
          variantId: "variant_a",
          probabilities: { skip: 0.1, ignore: 0.1, inspect: 0.1, click: 0.2, convert: 0.5, exit: 0 },
        }),
      ],
    });

    expect(forecast.variantId).toBe("variant_a");
    expect(forecast.personas[0].expectedActions.click).toBeCloseTo(1000 * fullDbPersonaWeights["Practical Converter"] * 0.2);
    expect(forecast.personas[0].expectedActions.convert).toBeCloseTo(1000 * fullDbPersonaWeights["Practical Converter"] * 0.5);
  });

  it("ignores specialist reviews and unknown persona names", () => {
    const forecasts = buildPersonaActionForecast({
      projectedViews: 1000,
      reviews: [
        review({
          agentName: "Performance Analyst",
          agentType: "specialist",
          variantId: "variant_a",
          probabilities: { skip: 0, ignore: 0, inspect: 0, click: 1, convert: 0, exit: 0 },
        }),
        review({
          agentName: "Unweighted Persona",
          agentType: "persona",
          variantId: "variant_a",
          probabilities: { skip: 0, ignore: 0, inspect: 0, click: 1, convert: 0, exit: 0 },
        }),
      ],
    });

    expect(forecasts).toEqual([]);
  });

  it("does not change projections when non-persona reviews are missing", () => {
    const persona = review({
      agentName: "Low-Attention Scroller",
      agentType: "persona",
      variantId: "variant_a",
      probabilities: { skip: 0.4, ignore: 0.1, inspect: 0.2, click: 0.2, convert: 0.05, exit: 0.05 },
    });
    const specialist = review({
      agentName: "Creative Director",
      agentType: "specialist",
      variantId: "variant_a",
      probabilities: { skip: 0, ignore: 0, inspect: 0, click: 1, convert: 0, exit: 0 },
    });

    const [withSpecialist] = buildPersonaActionForecast({ projectedViews: 1000, reviews: [persona, specialist] });
    const [withoutSpecialist] = buildPersonaActionForecast({ projectedViews: 1000, reviews: [persona] });

    expect(withSpecialist.totals).toEqual(withoutSpecialist.totals);
  });
});

function review({
  agentName,
  agentType,
  variantId,
  probabilities,
}: {
  agentName: string;
  agentType: AgentReview["agentType"];
  variantId: string;
  probabilities: AgentReview["behavior"]["probabilities"];
}): AgentReview {
  return {
    agentName,
    agentType,
    variantId,
    attention: 6,
    clarity: 6,
    trust: 6,
    conversionIntent: 6,
    directResponseIntent: 0.5,
    fatigueRisk: "medium",
    recommendation: "test",
    behavior: {
      primaryState: "click",
      probabilities,
      confidence: "medium",
      rationale: "Mock behavior.",
    },
    topPositive: "Clear enough.",
    topConcern: "Some uncertainty.",
    suggestedEdit: "Clarify the CTA.",
    reasoning: "Mock review.",
    evidenceRefs: [],
  };
}
