import { z } from "zod";

export const campaignBriefSchema = z.object({
  category: z.string().min(1),
  region: z.string().min(1),
  language: z.string().min(1),
  os: z.string().min(1),
  objective: z.string().min(1),
  audienceStyle: z.string().optional().default("mobile users"),
});

export const analysisInputModeSchema = z.enum(["evidence", "image_only"]).default("evidence");
export const defaultProjectedViews = 100000;
export const projectedViewsSchema = z.coerce.number().int().positive().default(defaultProjectedViews);

export const creativeFeaturesSchema = z.object({
  embedding: z.array(z.number()).optional(),
  ocrText: z.string().optional().default(""),
  ctaText: z.string().optional().default(""),
  headline: z.string().optional().default(""),
  subhead: z.string().optional().default(""),
  dominantColors: z.array(z.string()).default([]),
  textDensity: z.number().nullable().optional(),
  visualClutter: z.number().nullable().optional(),
  readabilityScore: z.number().nullable().optional(),
  brandVisibilityScore: z.number().nullable().optional(),
  noveltyScore: z.number().nullable().optional(),
  motionScore: z.number().nullable().optional(),
  facesCount: z.number().default(0),
  productCount: z.number().default(0),
  hasLogo: z.boolean().default(false),
  hasPerson: z.boolean().default(false),
  hasPrice: z.boolean().default(false),
  hasReward: z.boolean().default(false),
  hasGameplay: z.boolean().default(false),
  hasUgcStyle: z.boolean().default(false),
  aspectRatio: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  layoutJson: z.record(z.string(), z.unknown()).optional(),
});

export const metricsSummarySchema = z.object({
  impressions: z.number().default(0),
  clicks: z.number().default(0),
  conversions: z.number().default(0),
  spendUsd: z.number().default(0),
  revenueUsd: z.number().default(0),
  ctr: z.number().nullable().optional(),
  cvr: z.number().nullable().optional(),
  ipm: z.number().nullable().optional(),
  roas: z.number().nullable().optional(),
  perfScore: z.number().nullable().optional(),
  first7dCtr: z.number().nullable().optional(),
  last7dCtr: z.number().nullable().optional(),
  ctrDecayPct: z.number().nullable().optional(),
  first7dCvr: z.number().nullable().optional(),
  last7dCvr: z.number().nullable().optional(),
  cvrDecayPct: z.number().nullable().optional(),
  creativeStatus: z.string().optional(),
  fatigueDay: z.number().nullable().optional(),
});

export const creativeDocSchema = z.object({
  id: z.string(),
  source: z.enum(["dataset", "upload"]),
  label: z.string().optional(),
  assetUrl: z.string(),
  thumbnailUrl: z.string().optional(),
  assetType: z.string(),
  advertiserId: z.string().optional(),
  advertiserName: z.string().optional(),
  campaignId: z.string().optional(),
  appName: z.string().optional(),
  category: z.string(),
  country: z.string().optional(),
  language: z.string(),
  os: z.string().optional(),
  format: z.string(),
  theme: z.string().optional(),
  hookType: z.string().optional(),
  emotionalTone: z.string().optional(),
  durationSec: z.number().default(0),
  createdAt: z.string(),
  features: creativeFeaturesSchema,
  metricsSummary: metricsSummarySchema.optional(),
});

export const benchmarkSchema = z.object({
  contextLabel: z.string(),
  sampleSize: z.number(),
  avgCtr: z.number().nullable(),
  avgCvr: z.number().nullable(),
  avgPerfScore: z.number().nullable(),
  avgCtrDecayPct: z.number().nullable(),
  highPerformerCount: z.number(),
  fatiguedCount: z.number(),
  underperformerCount: z.number(),
  stableCount: z.number(),
  topPerformerRate: z.number().min(0).max(1),
  underperformerRate: z.number().min(0).max(1),
  fatiguedRate: z.number().min(0).max(1),
  stableRate: z.number().min(0).max(1),
});

export const behaviorStates = ["skip", "ignore", "inspect", "click", "convert", "exit"] as const;
export const personaForecastActionStates = ["skip", "click", "convert", "exit"] as const;

const rawBehaviorProbabilitiesSchema = z.object({
  skip: z.number().min(0).max(1),
  ignore: z.number().min(0).max(1),
  inspect: z.number().min(0).max(1),
  click: z.number().min(0).max(1),
  convert: z.number().min(0).max(1),
  exit: z.number().min(0).max(1),
});

export type RawBehaviorProbabilities = z.infer<typeof rawBehaviorProbabilitiesSchema>;
export type BehaviorState = (typeof behaviorStates)[number];

export function normalizeBehaviorProbabilities(
  probabilities: RawBehaviorProbabilities,
  fallbackState: BehaviorState = "ignore",
): RawBehaviorProbabilities {
  const clamped = Object.fromEntries(
    behaviorStates.map((state) => [state, Math.min(Math.max(probabilities[state] ?? 0, 0), 1)]),
  ) as RawBehaviorProbabilities;
  const total = behaviorStates.reduce((sum, state) => sum + clamped[state], 0);

  if (total <= 0) {
    return Object.fromEntries(behaviorStates.map((state) => [state, state === fallbackState ? 1 : 0])) as RawBehaviorProbabilities;
  }

  return Object.fromEntries(
    behaviorStates.map((state) => [state, Number((clamped[state] / total).toFixed(4))]),
  ) as RawBehaviorProbabilities;
}

export function dominantBehaviorState(probabilities: RawBehaviorProbabilities): BehaviorState {
  return behaviorStates.reduce((best, state) => (probabilities[state] > probabilities[best] ? state : best), "ignore");
}

export const behaviorStateSchema = z.enum(behaviorStates);

export const behaviorProbabilitiesSchema = rawBehaviorProbabilitiesSchema.transform((probabilities) =>
  normalizeBehaviorProbabilities(probabilities),
);

export const behaviorSimulationSchema = z
  .object({
    primaryState: behaviorStateSchema,
    probabilities: rawBehaviorProbabilitiesSchema,
    confidence: z.enum(["low", "medium", "high"]),
    rationale: z.string(),
  })
  .transform((behavior) => ({
    ...behavior,
    probabilities: normalizeBehaviorProbabilities(behavior.probabilities, behavior.primaryState),
  }));

export const behaviorPriorSchema = z.object({
  source: z.enum(["target_history", "similar_creatives", "benchmark"]),
  datasetSentiment: z.enum(["positive", "neutral", "negative", "fatigue_risk"]),
  probabilityHints: behaviorProbabilitiesSchema,
  drivers: z.array(z.string()),
});

export const similarCreativeSchema = z.object({
  id: z.string(),
  assetUrl: z.string(),
  appName: z.string().optional(),
  category: z.string(),
  format: z.string(),
  ctaText: z.string().optional(),
  headline: z.string().optional(),
  creativeStatus: z.string().optional(),
  perfScore: z.number().nullable().optional(),
  ctr: z.number().nullable().optional(),
  cvr: z.number().nullable().optional(),
  similarity: z.number(),
});

export const evidencePackSchema = z.object({
  variantId: z.string(),
  variantLabel: z.string(),
  campaignContext: campaignBriefSchema,
  creative: creativeDocSchema,
  benchmark: benchmarkSchema,
  similarCreatives: z.array(similarCreativeSchema),
  behaviorPrior: behaviorPriorSchema,
  facts: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const agentReviewSchema = z.object({
  agentName: z.string(),
  agentType: z.enum(["specialist", "persona"]),
  variantId: z.string(),
  attention: z.number().min(0).max(10),
  clarity: z.number().min(0).max(10),
  trust: z.number().min(0).max(10),
  conversionIntent: z.number().min(0).max(10),
  fatigueRisk: z.enum(["low", "medium", "high"]),
  recommendation: z.enum(["scale", "test", "edit", "pivot", "pause"]),
  behavior: behaviorSimulationSchema,
  topPositive: z.string(),
  topConcern: z.string(),
  suggestedEdit: z.string(),
  reasoning: z.string(),
  evidenceRefs: z.array(z.string()).default([]),
});

export const variantAnalysisSchema = z.object({
  variantId: z.string(),
  rank: z.number(),
  score: z.number().min(0).max(100),
  predictedOutcome: z.string(),
  creativeHealth: z.number().min(0).max(100),
  swarmConfidence: z.enum(["low", "medium", "high"]),
  action: z.enum(["scale", "test", "edit", "pivot", "pause"]),
  dominantBehaviorState: behaviorStateSchema,
  behaviorProbabilities: behaviorProbabilitiesSchema,
  behaviorSummary: z.string(),
  topReasons: z.array(z.string()),
  risks: z.array(z.string()),
  recommendedEdits: z.array(z.string()),
});

export const expectedActionCountsSchema = z.object({
  skip: z.number().nonnegative(),
  click: z.number().nonnegative(),
  convert: z.number().nonnegative(),
  exit: z.number().nonnegative(),
});

export const personaActionForecastSchema = z.object({
  variantId: z.string(),
  projectedViews: projectedViewsSchema,
  personas: z.array(
    z.object({
      agentName: z.string(),
      weight: z.number().min(0).max(1),
      expectedActions: expectedActionCountsSchema,
    }),
  ),
  totals: expectedActionCountsSchema,
});

export const fatigueProfileSchema = z.object({
  creativeId: z.string(),
  healthScore: z.number().min(0).max(100),
  urgency: z.enum(["HEALTHY", "WATCH", "INTERVENE", "PAUSE"]),
  estimatedLifespanDays: z.number().nullable(),
  ctrDecayPct: z.number().nullable(),
  cvrDecayPct: z.number().nullable(),
  currentStatus: z.string().nullable(),
  visualRiskFactors: z.array(z.string()),
  visualStrengths: z.array(z.string()).default([]),
  dataSource: z.enum(["historical", "similarity-predicted", "visual-only"]),
});

export const finalReportSchema = z.object({
  winner: z.string(),
  executiveSummary: z.string(),
  ranking: z.array(variantAnalysisSchema),
  personaActionForecast: z.array(personaActionForecastSchema).default([]),
  champion: z.string(),
  whyItWins: z.array(z.string()),
  risks: z.array(z.string()),
  whatToDoNext: z.array(z.string()),
  abTestPlan: z.object({
    primaryMetric: z.string(),
    secondaryMetric: z.string(),
    control: z.string(),
    challenger: z.string(),
    trafficSplit: z.string(),
    hypothesis: z.string(),
    stopCondition: z.string(),
    actionIfWinner: z.string(),
    actionIfLoser: z.string(),
  }),
  fatigueProfiles: z.array(fatigueProfileSchema).default([]),
});

export const copilotAnswerSchema = z.object({
  answer: z.string(),
  citedVariantIds: z.array(z.string()).default([]),
  nextAction: z.string(),
});

export const experimentSchema = z.object({
  id: z.string(),
  brief: campaignBriefSchema,
  analysisInputMode: analysisInputModeSchema,
  projectedViews: projectedViewsSchema,
  variants: z.array(creativeDocSchema).min(2).max(6),
  status: z.enum(["created", "analyzing", "complete", "failed"]),
  createdAt: z.string(),
  report: finalReportSchema.optional(),
  agentReviews: z.array(agentReviewSchema).optional(),
});

export type FatigueProfile = z.infer<typeof fatigueProfileSchema>;
export type CampaignBrief = z.infer<typeof campaignBriefSchema>;
export type AnalysisInputMode = z.infer<typeof analysisInputModeSchema>;
export type CreativeFeatures = z.infer<typeof creativeFeaturesSchema>;
export type CreativeDoc = z.infer<typeof creativeDocSchema>;
export type MetricsSummary = z.infer<typeof metricsSummarySchema>;
export type Benchmark = z.infer<typeof benchmarkSchema>;
export type SimilarCreative = z.infer<typeof similarCreativeSchema>;
export type BehaviorProbabilities = z.infer<typeof behaviorProbabilitiesSchema>;
export type BehaviorPrior = z.infer<typeof behaviorPriorSchema>;
export type BehaviorSimulation = z.infer<typeof behaviorSimulationSchema>;
export type EvidencePack = z.infer<typeof evidencePackSchema>;
export type AgentReview = z.infer<typeof agentReviewSchema>;
export type VariantAnalysis = z.infer<typeof variantAnalysisSchema>;
export type ExpectedActionCounts = z.infer<typeof expectedActionCountsSchema>;
export type PersonaActionForecast = z.infer<typeof personaActionForecastSchema>;
export type FinalReport = z.infer<typeof finalReportSchema>;
export type CopilotAnswer = z.infer<typeof copilotAnswerSchema>;
export type Experiment = z.infer<typeof experimentSchema>;
