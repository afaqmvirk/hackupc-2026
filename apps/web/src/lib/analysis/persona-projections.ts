import {
  defaultProjectedViews,
  personaForecastActionStates,
  projectedViewsSchema,
  type AgentReview,
  type ExpectedActionCounts,
  type FinalReport,
  type PersonaActionForecast,
} from "@/lib/schemas";

export const fullDbPersonaWeights = {
  "Low-Attention Scroller": 0.213225469,
  "Skeptical User": 0.1345679434,
  "Reward-Seeking User": 0.2183092509,
  "Practical Converter": 0.1679873124,
  "Visual Trend Seeker": 0.144335372,
  "Category-Matched User": 0.1215746524,
} as const;

export const fullDbPersonaWeightFit = {
  source: "Smadex creative_summary.csv",
  basis:
    "Impression-weighted soft assignment from creative traits: attention baseline, trust/risk cues, reward/offer framing, practical clarity, visual novelty, and category fit.",
  datasetClickRateMean: 0.005410072946542721,
  datasetConversionPerViewMean: 0.0005673990429667633,
} as const;

type WeightedPersonaName = keyof typeof fullDbPersonaWeights;

export function buildPersonaActionForecast({
  reviews,
  projectedViews = defaultProjectedViews,
}: {
  reviews: AgentReview[];
  projectedViews?: number;
}): PersonaActionForecast[] {
  const normalizedViews = projectedViewsSchema.parse(projectedViews);
  const reviewsByVariant = new Map<string, Map<WeightedPersonaName, AgentReview>>();

  for (const review of reviews) {
    if (review.agentType !== "persona" || !isWeightedPersonaName(review.agentName)) {
      continue;
    }

    const variantReviews = reviewsByVariant.get(review.variantId) ?? new Map<WeightedPersonaName, AgentReview>();
    variantReviews.set(review.agentName, review);
    reviewsByVariant.set(review.variantId, variantReviews);
  }

  return [...reviewsByVariant.entries()].map(([variantId, variantReviews]) => {
    const personas = [...variantReviews.entries()].map(([agentName, review]) => {
      const weight = fullDbPersonaWeights[agentName];
      return {
        agentName,
        weight,
        expectedActions: expectedActionsForReview(normalizedViews, weight, review),
      };
    });

    return {
      variantId,
      projectedViews: normalizedViews,
      personas,
      totals: totalExpectedActions(personas.map((persona) => persona.expectedActions)),
    };
  });
}

export function attachPersonaActionForecast({
  report,
  reviews,
  projectedViews = defaultProjectedViews,
}: {
  report: FinalReport;
  reviews: AgentReview[];
  projectedViews?: number;
}): FinalReport {
  return {
    ...report,
    personaActionForecast: buildPersonaActionForecast({ reviews, projectedViews }),
  };
}

function expectedActionsForReview(projectedViews: number, weight: number, review: AgentReview): ExpectedActionCounts {
  return Object.fromEntries(
    personaForecastActionStates.map((action) => [action, projectedViews * weight * review.behavior.probabilities[action]]),
  ) as ExpectedActionCounts;
}

function totalExpectedActions(items: ExpectedActionCounts[]): ExpectedActionCounts {
  return Object.fromEntries(
    personaForecastActionStates.map((action) => [action, items.reduce((sum, item) => sum + item[action], 0)]),
  ) as ExpectedActionCounts;
}

function isWeightedPersonaName(agentName: string): agentName is WeightedPersonaName {
  return agentName in fullDbPersonaWeights;
}
