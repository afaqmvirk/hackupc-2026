/**
 * Creative Fatigue Scoring — calibrated against the Smadex dataset.
 *
 * Empirical findings (creative_summary.csv, n=1080):
 *   - fatigue_day:   10–17 days (median=12) for ALL formats — format is irrelevant
 *   - ctr_decay_pct: every creative decays; range -0.47 to -0.90, median -0.78
 *     → Using |decay| directly collapses scores into 15–53 (useless)
 *     → Must compare relative to cohort median (-0.78)
 *   - perf_score (0–1) by status: top_performer=0.84, fatigued=0.67, stable=0.48, underperformer=0.15
 *   - Counterintuitive: HIGH novelty/motion → MORE fatigued (0.64/0.69 vs stable 0.56/0.53).
 *     High-novelty ads burn bright initially (high CTR) but trip the fatigue threshold faster.
 */

import type { CreativeDoc, CreativeFeatures, EvidencePack, FatigueProfile } from "@/lib/schemas";

const COHORT_MEDIAN_DECAY_ABS = 0.78;
const DATASET_MEDIAN_FATIGUE_DAY = 12;
const COHORT_AVG_PERF = 0.48;

const STATUS_BASE_HEALTH: Record<string, number> = {
  top_performer: 85,
  stable: 58,
  fatigued: 26,
  underperformer: 18,
};

export function computeFatigueProfile(
  creative: CreativeDoc,
  evidencePack: EvidencePack,
  datasetLookup: Map<string, CreativeDoc>,
): FatigueProfile {
  if (creative.source === "dataset" && creative.metricsSummary) {
    return computeDirectProfile(creative);
  }
  return computePredictedProfile(creative, evidencePack, datasetLookup);
}

// --- Dataset creative: real historical decay signals available ---

function computeDirectProfile(creative: CreativeDoc): FatigueProfile {
  const m = creative.metricsSummary!;
  const status = m.creativeStatus ?? "stable";
  const statusBase = STATUS_BASE_HEALTH[status] ?? 50;

  // Relative decay vs cohort median: positive = worse than peers, negative = better.
  const observedDecay = Math.abs(m.ctrDecayPct ?? COHORT_MEDIAN_DECAY_ABS);
  const relativeDecay = observedDecay - COHORT_MEDIAN_DECAY_ABS;
  const healthScore = clamp(Math.round(statusBase - relativeDecay * 150), 0, 100);

  const { risks, strengths } = deriveVisualSignals(creative.features);

  return {
    creativeId: creative.id,
    healthScore,
    urgency: scoreToUrgency(healthScore),
    estimatedLifespanDays: m.fatigueDay ?? null,
    ctrDecayPct: m.ctrDecayPct ?? null,
    cvrDecayPct: m.cvrDecayPct ?? null,
    currentStatus: status,
    visualRiskFactors: risks,
    visualStrengths: strengths,
    dataSource: "historical",
  };
}

// --- Uploaded creative: predict from similar creatives + visual signals ---

type Ref = { similarity: number; doc: CreativeDoc };

function computePredictedProfile(
  creative: CreativeDoc,
  evidencePack: EvidencePack,
  datasetLookup: Map<string, CreativeDoc>,
): FatigueProfile {
  const refs: Ref[] = evidencePack.similarCreatives
    .map((sc) => ({ similarity: sc.similarity, doc: datasetLookup.get(sc.id) }))
    .filter(
      (item): item is Ref =>
        item.doc !== undefined && item.doc.metricsSummary !== undefined,
    );

  const dataSource: FatigueProfile["dataSource"] = refs.length > 0 ? "similarity-predicted" : "visual-only";

  // Weighted-average decay across reference creatives
  const predictedCtrDecayPct = refs.length > 0
    ? -weightedMean(refs, (r) => Math.abs(r.doc.metricsSummary!.ctrDecayPct ?? COHORT_MEDIAN_DECAY_ABS))
    : null;

  // Baseline lifespan: weighted avg fatigue_day from refs that actually fatigued, else cohort median
  const refsThatFatigued = refs.filter((r) => r.doc.metricsSummary!.fatigueDay != null);
  const baseLifespanDays = refsThatFatigued.length > 0
    ? weightedMean(refsThatFatigued, (r) => r.doc.metricsSummary!.fatigueDay!)
    : DATASET_MEDIAN_FATIGUE_DAY;

  const visualMultiplier = computeVisualLifespanMultiplier(creative.features);
  const estimatedLifespanDays = Math.max(5, Math.round(baseLifespanDays * visualMultiplier));

  // Health: project from reference perf_score (clipped to 0–1) + visual quality
  const validPerfRefs = refs.filter((r) => {
    const p = r.doc.metricsSummary!.perfScore;
    return typeof p === "number" && p >= 0 && p <= 1;
  });
  const avgRefPerf = validPerfRefs.length > 0
    ? weightedMean(validPerfRefs, (r) => r.doc.metricsSummary!.perfScore!)
    : COHORT_AVG_PERF;

  const visualHealthAdj = computeVisualHealthAdjustment(creative.features);
  const healthScore = clamp(Math.round(avgRefPerf * 100 + visualHealthAdj), 10, 100);

  const { risks, strengths } = deriveVisualSignals(creative.features);

  return {
    creativeId: creative.id,
    healthScore,
    urgency: scoreToUrgency(healthScore),
    estimatedLifespanDays,
    ctrDecayPct: predictedCtrDecayPct,
    cvrDecayPct: null,
    currentStatus: "predicted",
    visualRiskFactors: risks,
    visualStrengths: strengths,
    dataSource,
  };
}

// --- Helpers ---

function weightedMean(refs: Ref[], pick: (r: Ref) => number): number {
  const totalWeight = refs.reduce((sum, r) => sum + r.similarity, 0);
  if (totalWeight === 0) return pick(refs[0]); // fallback if all similarities are 0
  return refs.reduce((sum, r) => sum + pick(r) * r.similarity, 0) / totalWeight;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Thresholds match healthGradient() in CreativeSwarmApp.tsx
function scoreToUrgency(health: number): FatigueProfile["urgency"] {
  if (health >= 70) return "HEALTHY";
  if (health >= 45) return "WATCH";
  if (health >= 25) return "INTERVENE";
  return "PAUSE";
}

/**
 * Visual lifespan multiplier (×0.5–×1.7), applied to baseline fatigue_day.
 *
 * Data-backed: high novelty/motion → fast-burn (shorter lifespan).
 * gameplay/UGC sustain engagement; reward hooks lose surprise fast.
 *
 * (text_density and clutter were not analysed in the dataset for fatigue
 *  correlation, so we don't use them as lifespan modifiers — only as
 *  qualitative risk factors below.)
 */
function computeVisualLifespanMultiplier(features: CreativeFeatures): number {
  let m = 1.0;
  const novelty = features.noveltyScore ?? 0.56;
  const motion = features.motionScore ?? 0.53;

  m -= (novelty - 0.56) * 0.5;
  m -= (motion - 0.53) * 0.35;

  if (features.hasGameplay) m += 0.12;
  if (features.hasUgcStyle) m += 0.08;
  if (features.hasReward) m -= 0.1;

  return clamp(m, 0.5, 1.7);
}

/**
 * Visual health adjustment (additive, in points).
 * Predicts initial performance quality, independent of lifespan.
 */
function computeVisualHealthAdjustment(features: CreativeFeatures): number {
  let adj = 0;
  const novelty = features.noveltyScore ?? 0.56;
  const motion = features.motionScore ?? 0.53;
  const readability = features.readabilityScore ?? 0.65;
  const clutter = features.visualClutter ?? 0.4;

  adj += (novelty - 0.5) * 25;
  adj += (motion - 0.5) * 12;
  adj += (readability - 0.5) * 15;
  adj -= Math.max(0, clutter - 0.5) * 20;

  if (features.hasGameplay) adj += 8;
  if (features.hasUgcStyle) adj += 5;
  if (features.hasPerson) adj += 3;

  return Math.round(adj);
}

/**
 * Splits visual cues into risks (negative) and strengths (positive) so the UI
 * can render each appropriately instead of mislabeling positive signals as warnings.
 */
function deriveVisualSignals(features: CreativeFeatures): { risks: string[]; strengths: string[] } {
  const risks: string[] = [];
  const strengths: string[] = [];

  const novelty = features.noveltyScore ?? 0.56;
  const motion = features.motionScore ?? 0.53;
  const textDensity = features.textDensity ?? 0.35;
  const clutter = features.visualClutter ?? 0.4;

  // Fast-burn signals (counterintuitive but data-backed)
  if (novelty > 0.7) risks.push("High novelty: strong opener but fast-burn pattern in dataset — plan refresh by day 10");
  if (motion > 0.7) risks.push("High motion: engaging but audiences adapt quickly, expect sharp drop after day 12");

  // Slow-burn / sustainability
  if (novelty < 0.4) strengths.push("Low novelty: more sustainable trajectory, less risk of a sharp performance cliff");

  // Quality concerns
  if (textDensity > 0.6) risks.push("High text density: copy becomes invisible over repeated views");
  if (clutter > 0.6) risks.push("High visual clutter: irritation builds with each impression");

  // Hook patterns
  if (features.hasReward) risks.push("Reward hook: high pull on first view, drops sharply once users learn the mechanic");
  if (!features.hasGameplay && !features.hasUgcStyle && novelty < 0.5) {
    risks.push("No interactive or UGC element: limited reason to re-engage on repeat views");
  }

  // Pure positive signals
  if (features.hasUgcStyle) strengths.push("UGC-style framing: authenticity sustains engagement longer");
  if (features.hasGameplay) strengths.push("Gameplay element: interactive feel keeps curiosity high");

  return { risks, strengths };
}
