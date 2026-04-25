import { config } from "@/lib/config";
import { agentReviewJsonSchema, finalReportJsonSchema } from "@/lib/analysis/json-schemas";
import { generateJson } from "@/lib/analysis/gemini";
import { agentPrompt, aggregatorPrompt, imageOnlyAgentPrompt, imageOnlyAggregatorPrompt, swarmAgents } from "@/lib/analysis/prompts";
import { loadCreativeImage } from "@/lib/data/assets";
import { buildEvidencePack } from "@/lib/data/retrieval";
import {
  agentReviewSchema,
  behaviorStates,
  dominantBehaviorState,
  finalReportSchema,
  normalizeBehaviorProbabilities,
  type AgentReview,
  type AnalysisInputMode,
  type BehaviorProbabilities,
  type CampaignBrief,
  type CreativeDoc,
  type EvidencePack,
  type FinalReport,
} from "@/lib/schemas";

export type SwarmEvent =
  | { type: "status"; message: string }
  | { type: "evidence"; pack: EvidencePack }
  | { type: "agent"; review: AgentReview }
  | { type: "report"; report: FinalReport };

export async function analyzeExperimentWithSwarm({
  brief,
  analysisInputMode = "evidence",
  variants,
  onEvent,
}: {
  brief: CampaignBrief;
  analysisInputMode?: AnalysisInputMode;
  variants: CreativeDoc[];
  onEvent?: (event: SwarmEvent) => void | Promise<void>;
}) {
  if (analysisInputMode === "image_only") {
    return analyzeExperimentWithImageOnlySwarm({ brief, variants, onEvent });
  }

  return analyzeExperimentWithEvidenceSwarm({ brief, variants, onEvent });
}

async function analyzeExperimentWithEvidenceSwarm({
  brief,
  variants,
  onEvent,
}: {
  brief: CampaignBrief;
  variants: CreativeDoc[];
  onEvent?: (event: SwarmEvent) => void | Promise<void>;
}) {
  const evidencePacks: EvidencePack[] = [];
  const reviews: AgentReview[] = [];

  onEvent?.({ type: "status", message: "Building evidence packs from creative metadata, benchmarks, and similar ads." });

  for (let index = 0; index < variants.length; index += 1) {
    const pack = await buildEvidencePack(variants[index], brief, index);
    evidencePacks.push(pack);
    await onEvent?.({ type: "evidence", pack });
  }

  onEvent?.({ type: "status", message: "Gemini swarm agents are reviewing each variant." });

  for (const pack of evidencePacks) {
    for (const agent of swarmAgents) {
      const generatedReview = await generateJson({
        model: config.swarmModel,
        prompt: agentPrompt(agent, pack),
        schema: agentReviewJsonSchema,
        validator: agentReviewSchema,
      });
      const review = calibrateAgentReviewBehavior(generatedReview, pack);
      reviews.push(review);
      await onEvent?.({ type: "agent", review });
    }
  }

  onEvent?.({ type: "status", message: "Aggregator is ranking variants and writing the A/B test plan." });

  const generatedReport = await generateJson({
    model: config.aggregatorModel,
    prompt: aggregatorPrompt(evidencePacks, reviews),
    schema: finalReportJsonSchema,
    validator: finalReportSchema,
    temperature: 0.25,
  });
  const report = applyBehaviorAggregates(generatedReport, reviews);

  await onEvent?.({ type: "report", report });

  return {
    evidencePacks,
    reviews,
    report,
  };
}

async function analyzeExperimentWithImageOnlySwarm({
  brief,
  variants,
  onEvent,
}: {
  brief: CampaignBrief;
  variants: CreativeDoc[];
  onEvent?: (event: SwarmEvent) => void | Promise<void>;
}) {
  const publicVariants = variants.map((variant, index) => ({
    actualId: variant.id,
    publicId: `variant_${index + 1}`,
    label: `Variant ${index + 1}`,
    variant,
  }));
  const publicToActual = new Map(publicVariants.map((variant) => [variant.publicId, variant.actualId]));
  const reviews: AgentReview[] = [];

  onEvent?.({
    type: "status",
    message: "Image-only mode: agents receive only each image plus the user-entered brief.",
  });

  for (const publicVariant of publicVariants) {
    const image = await loadCreativeImage(publicVariant.variant);
    for (const agent of swarmAgents) {
      const review = await generateJson({
        model: config.swarmModel,
        prompt: imageOnlyAgentPrompt({
          agent,
          variantId: publicVariant.publicId,
          variantLabel: publicVariant.label,
          campaignContext: brief,
        }),
        schema: agentReviewJsonSchema,
        validator: agentReviewSchema,
        image,
      });
      reviews.push(review);
      await onEvent?.({ type: "agent", review: remapReviewVariantId(review, publicToActual) });
    }
  }

  onEvent?.({
    type: "status",
    message: "Aggregator is ranking variants from image-only agent reviews.",
  });

  const generatedReport = await generateJson({
    model: config.aggregatorModel,
    prompt: imageOnlyAggregatorPrompt(reviews),
    schema: finalReportJsonSchema,
    validator: finalReportSchema,
    temperature: 0.25,
  });

  const remappedReviews = reviews.map((review) => remapReviewVariantId(review, publicToActual));
  const remappedReport = remapReportVariantIds(generatedReport, publicToActual);
  const report = applyBehaviorAggregates(remappedReport, remappedReviews);

  await onEvent?.({ type: "report", report });

  return {
    evidencePacks: [],
    reviews: remappedReviews,
    report,
  };
}

function remapReviewVariantId(review: AgentReview, publicToActual: Map<string, string>): AgentReview {
  return {
    ...review,
    variantId: publicToActual.get(review.variantId) ?? review.variantId,
  };
}

function remapReportVariantIds(report: FinalReport, publicToActual: Map<string, string>): FinalReport {
  return {
    ...report,
    winner: publicToActual.get(report.winner) ?? report.winner,
    ranking: report.ranking.map((item) => ({
      ...item,
      variantId: publicToActual.get(item.variantId) ?? item.variantId,
    })),
    abTestPlan: {
      ...report.abTestPlan,
      control: publicToActual.get(report.abTestPlan.control) ?? report.abTestPlan.control,
      challenger: publicToActual.get(report.abTestPlan.challenger) ?? report.abTestPlan.challenger,
    },
  };
}

export function calibrateAgentReviewBehavior(review: AgentReview, pack: EvidencePack): AgentReview {
  const prior = pack.behaviorPrior.probabilityHints;
  const priorWeight = pack.behaviorPrior.source === "target_history" ? 0.55 : pack.behaviorPrior.source === "similar_creatives" ? 0.35 : 0.25;
  const agentWeight = 1 - priorWeight;
  const probabilities = normalizeBehaviorProbabilities(
    Object.fromEntries(
      behaviorStates.map((state) => [state, review.behavior.probabilities[state] * agentWeight + prior[state] * priorWeight]),
    ) as BehaviorProbabilities,
    review.behavior.primaryState,
  );
  const primaryState = dominantBehaviorState(probabilities);
  const shifted = primaryState !== review.behavior.primaryState;

  return {
    ...review,
    behavior: {
      ...review.behavior,
      primaryState,
      probabilities,
      rationale: shifted
        ? `${review.behavior.rationale} Dataset calibration shifts the simulated primary state toward ${behaviorPhrase(
            primaryState,
          )} because the behavior prior is ${pack.behaviorPrior.datasetSentiment}.`
        : review.behavior.rationale,
    },
  };
}

function applyBehaviorAggregates(report: FinalReport, reviews: AgentReview[]): FinalReport {
  return {
    ...report,
    ranking: report.ranking.map((item) => {
      const variantReviews = reviews.filter((review) => review.variantId === item.variantId);
      if (!variantReviews.length) {
        return item;
      }

      const behaviorProbabilities = averageBehaviorProbabilities(variantReviews);
      const dominantState = dominantBehaviorState(behaviorProbabilities);
      const representative = variantReviews
        .map((review) => review.behavior)
        .sort((left, right) => right.probabilities[dominantState] - left.probabilities[dominantState])[0];
      const clickOrConvert = behaviorProbabilities.click + behaviorProbabilities.convert;
      const skipOrExit = behaviorProbabilities.skip + behaviorProbabilities.exit;

      return {
        ...item,
        dominantBehaviorState: dominantState,
        behaviorProbabilities,
        behaviorSummary:
          `Simulated users most often ${behaviorPhrase(dominantState)}. ` +
          `Click/convert likelihood is ${formatProbability(clickOrConvert)} vs skip/exit ${formatProbability(skipOrExit)}. ` +
          representative.rationale,
      };
    }),
  };
}

function averageBehaviorProbabilities(reviews: AgentReview[]): BehaviorProbabilities {
  const totals = Object.fromEntries(behaviorStates.map((state) => [state, 0])) as BehaviorProbabilities;
  for (const review of reviews) {
    for (const state of behaviorStates) {
      totals[state] += review.behavior.probabilities[state] / reviews.length;
    }
  }
  return normalizeBehaviorProbabilities(totals);
}

function behaviorPhrase(state: string) {
  switch (state) {
    case "skip":
      return "skip or scroll past";
    case "ignore":
      return "understand it but take no action";
    case "inspect":
      return "pause to inspect the offer";
    case "click":
      return "tap the ad or CTA";
    case "convert":
      return "continue toward the conversion";
    case "exit":
      return "bounce because of confusion, distrust, or friction";
    default:
      return "show mixed behavior";
  }
}

function formatProbability(value: number) {
  return `${Math.round(value * 100)}%`;
}
