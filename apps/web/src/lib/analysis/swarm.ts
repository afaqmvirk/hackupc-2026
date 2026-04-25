import { config } from "@/lib/config";
import { agentReviewJsonSchema, finalReportJsonSchema } from "@/lib/analysis/json-schemas";
import { generateJson } from "@/lib/analysis/gemini";
import { computeFatigueProfile } from "@/lib/analysis/fatigue";
import { attachPersonaActionForecast } from "@/lib/analysis/persona-projections";
import { agentPrompt, aggregatorPrompt, imageOnlyAgentPrompt, imageOnlyAggregatorPrompt, swarmAgents } from "@/lib/analysis/prompts";
import { loadCreativeImage } from "@/lib/data/assets";
import { buildEvidencePack } from "@/lib/data/retrieval";
import { getDatasetCreatives } from "@/lib/data/repository";
import {
  agentReviewSchema,
  behaviorStates,
  defaultProjectedViews,
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

const GEMINI_REQUEST_START_INTERVAL_MS = process.env.NODE_ENV === "test" ? 0 : 5000;

export async function analyzeExperimentWithSwarm({
  brief,
  analysisInputMode = "evidence",
  projectedViews = defaultProjectedViews,
  variants,
  onEvent,
}: {
  brief: CampaignBrief;
  analysisInputMode?: AnalysisInputMode;
  projectedViews?: number;
  variants: CreativeDoc[];
  onEvent?: (event: SwarmEvent) => void | Promise<void>;
}) {
  if (analysisInputMode === "image_only") {
    return analyzeExperimentWithImageOnlySwarm({ brief, projectedViews, variants, onEvent });
  }

  return analyzeExperimentWithEvidenceSwarm({ brief, projectedViews, variants, onEvent });
}

async function analyzeExperimentWithEvidenceSwarm({
  brief,
  projectedViews,
  variants,
  onEvent,
}: {
  brief: CampaignBrief;
  projectedViews: number;
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

  onEvent?.({
    type: "status",
    message: `Gemini swarm agents are queued with one new request every ${GEMINI_REQUEST_START_INTERVAL_MS / 1000} seconds.`,
  });

  const requestScheduler = new RequestStartScheduler(GEMINI_REQUEST_START_INTERVAL_MS);
  reviews.push(
    ...(await runAgentReviewTasks({
      tasks: evidencePacks.flatMap((pack) =>
        swarmAgents.map((agent) => async () => {
          const generatedReview = await generateJson({
            model: config.swarmModel,
            prompt: agentPrompt(agent, pack),
            schema: agentReviewJsonSchema,
            validator: agentReviewSchema,
          });
          return calibrateAgentReviewBehavior(generatedReview, pack);
        }),
      ),
      requestScheduler,
      onReview: async (review) => {
        await onEvent?.({ type: "agent", review });
      },
    })),
  );

  onEvent?.({ type: "status", message: "Aggregator is ranking variants and writing the A/B test plan." });

  const generatedReport = await requestScheduler.schedule(() =>
    generateJson({
      model: config.aggregatorModel,
      prompt: aggregatorPrompt(evidencePacks, reviews),
      schema: finalReportJsonSchema,
      validator: finalReportSchema,
      temperature: 0.25,
    }),
  );
  const report = attachPersonaActionForecast({
    report: applyBehaviorAggregates(generatedReport, reviews),
    reviews,
    projectedViews,
  });

  // Compute deterministic fatigue profiles from dataset signals + visual features.
  // This runs after Gemini so it never blocks the LLM pipeline.
  onEvent?.({ type: "status", message: "Computing fatigue forecasts from historical decay signals." });

  const dataset = await getDatasetCreatives();
  const datasetLookup = new Map(dataset.map((c) => [c.id, c]));

  const fatigueProfiles = variants.map((variant, index) =>
    computeFatigueProfile(variant, evidencePacks[index], datasetLookup),
  );

  const enrichedReport: FinalReport = { ...report, fatigueProfiles };

  await onEvent?.({ type: "report", report: enrichedReport });

  return {
    evidencePacks,
    reviews,
    report: enrichedReport,
  };
}

async function analyzeExperimentWithImageOnlySwarm({
  brief,
  projectedViews,
  variants,
  onEvent,
}: {
  brief: CampaignBrief;
  projectedViews: number;
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

  const images = new Map(
    await Promise.all(publicVariants.map(async (publicVariant) => [publicVariant.publicId, await loadCreativeImage(publicVariant.variant)] as const)),
  );

  onEvent?.({
    type: "status",
    message: `Gemini swarm agents are queued with one new request every ${GEMINI_REQUEST_START_INTERVAL_MS / 1000} seconds.`,
  });

  const requestScheduler = new RequestStartScheduler(GEMINI_REQUEST_START_INTERVAL_MS);
  reviews.push(
    ...(await runAgentReviewTasks({
      tasks: publicVariants.flatMap((publicVariant) =>
        swarmAgents.map((agent) => async () =>
          generateJson({
            model: config.swarmModel,
            prompt: imageOnlyAgentPrompt({
              agent,
              variantId: publicVariant.publicId,
              variantLabel: publicVariant.label,
              campaignContext: brief,
            }),
            schema: agentReviewJsonSchema,
            validator: agentReviewSchema,
            image: images.get(publicVariant.publicId),
          }).then(calibrateImageOnlyReviewBehavior),
        ),
      ),
      requestScheduler,
      onReview: async (review) => {
        await onEvent?.({ type: "agent", review: remapReviewVariantId(review, publicToActual) });
      },
    })),
  );

  onEvent?.({
    type: "status",
    message: "Aggregator is ranking variants from image-only agent reviews.",
  });

  const generatedReport = await requestScheduler.schedule(() =>
    generateJson({
      model: config.aggregatorModel,
      prompt: imageOnlyAggregatorPrompt(reviews),
      schema: finalReportJsonSchema,
      validator: finalReportSchema,
      temperature: 0.25,
    }),
  );

  const remappedReviews = reviews.map((review) => remapReviewVariantId(review, publicToActual));
  const remappedReport = remapReportVariantIds(generatedReport, publicToActual);
  const report: FinalReport = {
    ...attachPersonaActionForecast({
      report: applyBehaviorAggregates(remappedReport, remappedReviews),
      reviews: remappedReviews,
      projectedViews,
    }),
    fatigueProfiles: [],
  };

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

type AgentReviewTask = () => Promise<AgentReview>;

class RequestStartScheduler {
  private nextStartAt = Date.now();

  constructor(private readonly intervalMs: number) {}

  async schedule<T>(request: () => Promise<T>): Promise<T> {
    const startAt = this.nextStartAt;
    this.nextStartAt = startAt + this.intervalMs;
    await wait(Math.max(0, startAt - Date.now()));
    return request();
  }
}

async function runAgentReviewTasks({
  tasks,
  requestScheduler,
  onReview,
}: {
  tasks: AgentReviewTask[];
  requestScheduler: RequestStartScheduler;
  onReview: (review: AgentReview) => void | Promise<void>;
}) {
  let cancelled = false;
  const scheduled = tasks.map((task) =>
    requestScheduler.schedule(async () => {
      if (cancelled) {
        return null;
      }

      try {
        const review = await task();
        if (!cancelled) {
          await onReview(review);
        }
        return review;
      } catch (error) {
        cancelled = true;
        throw error;
      }
    }),
  );
  const reviews = await Promise.all(scheduled);
  return reviews.filter((review): review is AgentReview => Boolean(review));
}

function wait(ms: number) {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function calibrateAgentReviewBehavior(review: AgentReview, pack: EvidencePack): AgentReview {
  const prior = pack.behaviorPrior.probabilityHints;
  const priorWeight = pack.behaviorPrior.source === "target_history" ? 0.92 : pack.behaviorPrior.source === "similar_creatives" ? 0.86 : 0.8;
  const agentWeight = 1 - priorWeight;
  const blended = normalizeBehaviorProbabilities(
    Object.fromEntries(behaviorStates.map((state) => [state, review.behavior.probabilities[state] * agentWeight + prior[state] * priorWeight])) as BehaviorProbabilities,
    review.behavior.primaryState,
  );
  const probabilities =
    review.agentType === "persona"
      ? applyPersonaBehaviorShape(blended, review, prior, pack)
      : constrainActionRates(blended, prior);
  const primaryState = dominantBehaviorState(probabilities);
  const shifted = primaryState !== review.behavior.primaryState;
  const constrained = probabilities.click < review.behavior.probabilities.click || probabilities.convert < review.behavior.probabilities.convert;

  return {
    ...review,
    behavior: {
      ...review.behavior,
      primaryState,
      probabilities,
      rationale: [
        review.behavior.rationale,
        shifted
          ? `Dataset calibration shifts the simulated primary state toward ${behaviorPhrase(primaryState)} because the behavior prior is ${pack.behaviorPrior.datasetSentiment}.`
          : "",
        constrained ? "Action probabilities were constrained to impression-level click/view and conversion/view rates from the evidence pack." : "",
      ]
        .filter(Boolean)
        .join(" "),
    },
  };
}

function calibrateImageOnlyReviewBehavior(review: AgentReview): AgentReview {
  const anchor = {
    click: 0.006,
    convert: 0.0006,
  };
  const probabilities =
    review.agentType === "persona"
      ? applyPersonaBehaviorShape(review.behavior.probabilities, review, anchor)
      : constrainActionRates(review.behavior.probabilities, anchor);
  const primaryState = dominantBehaviorState(probabilities);
  const constrained = probabilities.click < review.behavior.probabilities.click || probabilities.convert < review.behavior.probabilities.convert;

  return {
    ...review,
    behavior: {
      ...review.behavior,
      primaryState,
      probabilities,
      rationale: constrained
        ? `${review.behavior.rationale} Image-only mode has no campaign history, so action probabilities are constrained to conservative impression-level pre-test rates.`
        : review.behavior.rationale,
    },
  };
}

function constrainActionRates(probabilities: BehaviorProbabilities, anchor: Pick<BehaviorProbabilities, "click" | "convert">): BehaviorProbabilities {
  const maxClick = Math.min(Math.max(anchor.click * 1.7, anchor.click + 0.0035), 0.02);
  const maxConvert = Math.min(Math.max(anchor.convert * 2, anchor.convert + 0.0008), 0.004);
  let redistributed = 0;
  const next = { ...probabilities };

  if (next.click > maxClick) {
    redistributed += next.click - maxClick;
    next.click = maxClick;
  }
  if (next.convert > maxConvert) {
    redistributed += next.convert - maxConvert;
    next.convert = maxConvert;
  }

  if (redistributed <= 0) {
    return normalizeBehaviorProbabilities(next);
  }

  const recipients: Array<keyof BehaviorProbabilities> = ["skip", "ignore", "inspect", "exit"];
  const recipientTotal = recipients.reduce((sum, state) => sum + next[state], 0);
  for (const state of recipients) {
    const share = recipientTotal > 0 ? next[state] / recipientTotal : 1 / recipients.length;
    next[state] += redistributed * share;
  }

  return normalizeBehaviorProbabilities(next);
}

function applyPersonaBehaviorShape(
  probabilities: BehaviorProbabilities,
  review: AgentReview,
  anchor: Pick<BehaviorProbabilities, "click" | "convert">,
  pack?: EvidencePack,
): BehaviorProbabilities {
  const trait = personaBehaviorTrait(review, pack);
  const clickScore = bounded(0.72 + (review.attention / 10) * 0.28 + (review.clarity / 10) * 0.18, 0.62, 1.32);
  const convertScore = bounded(
    0.58 + ((review.clarity + review.trust + review.conversionIntent) / 30) * 0.72,
    0.5,
    1.42,
  );
  const clicked = bounded(anchor.click * trait.clickMultiplier * clickScore, 0.0015, 0.018);
  const converted = bounded(anchor.convert * trait.convertMultiplier * convertScore, 0.00008, Math.min(clicked * 0.3, 0.0045));
  const shaped = withBehaviorDeltas(probabilities, trait.deltas);

  return setActionRates(shaped, clicked, converted);
}

function personaBehaviorTrait(review: AgentReview, pack?: EvidencePack) {
  const features = pack?.creative.features;
  const hasVisibleOffer = Boolean(features?.hasReward || features?.hasPrice || /reward|bonus|offer|free|discount|claim/i.test(review.reasoning));
  const hasClearCta = Boolean((features?.ctaText ?? "").trim()) || /cta|button|tap|claim|install|play|get|shop|order/i.test(review.reasoning);
  const novelty = features?.noveltyScore ?? 0.5;
  const clutter = features?.visualClutter ?? 0.5;
  const trustIsWeak = review.trust < 5.5;
  const clarityIsStrong = review.clarity >= 7 || hasClearCta;

  switch (review.agentName) {
    case "Low-Attention Scroller":
      return {
        clickMultiplier: clarityIsStrong ? 0.82 : 0.56,
        convertMultiplier: clarityIsStrong ? 0.72 : 0.48,
        deltas: { skip: 0.1, ignore: 0.035, inspect: -0.055, exit: 0.01 },
      };
    case "Skeptical User":
      return {
        clickMultiplier: trustIsWeak ? 0.5 : 0.72,
        convertMultiplier: trustIsWeak ? 0.42 : 0.76,
        deltas: { skip: 0.045, ignore: 0.02, inspect: -0.02, exit: trustIsWeak ? 0.08 : 0.045 },
      };
    case "Reward-Seeking User":
      return {
        clickMultiplier: hasVisibleOffer ? 1.72 : 1.18,
        convertMultiplier: hasVisibleOffer && !trustIsWeak ? 1.1 : 0.78,
        deltas: { skip: -0.085, ignore: -0.02, inspect: 0.095, exit: trustIsWeak ? 0.025 : -0.01 },
      };
    case "Practical Converter":
      return {
        clickMultiplier: clarityIsStrong ? 0.98 : 0.76,
        convertMultiplier: clarityIsStrong && !trustIsWeak ? 1.52 : 0.82,
        deltas: { skip: clarityIsStrong ? -0.025 : 0.035, inspect: 0.045, exit: clarityIsStrong && !trustIsWeak ? -0.025 : 0.055 },
      };
    case "Visual Trend Seeker":
      return {
        clickMultiplier: novelty >= 0.7 ? 1.28 : novelty <= 0.35 || clutter >= 0.7 ? 0.72 : 1.02,
        convertMultiplier: 0.72,
        deltas: { skip: novelty >= 0.7 ? -0.045 : 0.015, ignore: clutter >= 0.7 ? 0.055 : -0.01, inspect: 0.07, exit: 0.005 },
      };
    case "Category-Matched User":
      return {
        clickMultiplier: review.conversionIntent >= 7 ? 1.22 : review.conversionIntent <= 4 ? 0.78 : 1,
        convertMultiplier: review.conversionIntent >= 7 && !trustIsWeak ? 1.28 : review.conversionIntent <= 4 ? 0.72 : 1,
        deltas: { skip: review.conversionIntent >= 7 ? -0.04 : 0.025, inspect: 0.035, exit: trustIsWeak ? 0.035 : -0.005 },
      };
    default:
      return {
        clickMultiplier: 1,
        convertMultiplier: 1,
        deltas: {},
      };
  }
}

function setActionRates(probabilities: BehaviorProbabilities, click: number, convert: number): BehaviorProbabilities {
  const nextClick = bounded(click, 0, 0.02);
  const nextConvert = bounded(convert, 0, Math.min(nextClick * 0.32, 0.006));
  const remaining = Math.max(1 - nextClick - nextConvert, 0.001);
  const nonActionStates = behaviorStates.filter((state) => state !== "click" && state !== "convert");
  const nonActionTotal = nonActionStates.reduce((sum, state) => sum + probabilities[state], 0);

  return normalizeBehaviorProbabilities(
    Object.fromEntries(
      behaviorStates.map((state) => {
        if (state === "click") return [state, nextClick];
        if (state === "convert") return [state, nextConvert];
        const share = nonActionTotal > 0 ? probabilities[state] / nonActionTotal : 1 / nonActionStates.length;
        return [state, remaining * share];
      }),
    ) as BehaviorProbabilities,
  );
}

function withBehaviorDeltas(
  probabilities: BehaviorProbabilities,
  deltas: Partial<Record<keyof BehaviorProbabilities, number>>,
): BehaviorProbabilities {
  const next = Object.fromEntries(
    behaviorStates.map((state) => [state, Math.min(Math.max(probabilities[state] + (deltas[state] ?? 0), 0), 1)]),
  ) as BehaviorProbabilities;
  return normalizeBehaviorProbabilities(next);
}

function bounded(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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
  return `${(value * 100).toFixed(2)}%`;
}
