/**
 * Creative fatigue scoring calibrated against the Smadex dataset.
 *
 * Empirical anchors from creative_summary.csv:
 * - fatigue_day ranges roughly 10-17 days, with a median near 12.
 * - CTR decay is common across creatives, with a cohort median near -0.78.
 * - Health compares each creative against the cohort rather than treating decay
 *   as an absolute score.
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

type Ref = { similarity: number; doc: CreativeDoc };

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

function computeDirectProfile(creative: CreativeDoc): FatigueProfile {
  const metrics = creative.metricsSummary!;
  const status = metrics.creativeStatus ?? "stable";
  const statusBase = STATUS_BASE_HEALTH[status] ?? 50;

  const observedDecay = Math.abs(metrics.ctrDecayPct ?? COHORT_MEDIAN_DECAY_ABS);
  const relativeDecay = observedDecay - COHORT_MEDIAN_DECAY_ABS;
  const healthScore = clamp(Math.round(statusBase - relativeDecay * 150), 0, 100);
  const { risks, strengths } = deriveVisualSignals(creative.features);

  return {
    creativeId: creative.id,
    healthScore,
    urgency: scoreToUrgency(healthScore),
    estimatedLifespanDays: metrics.fatigueDay ?? null,
    ctrDecayPct: metrics.ctrDecayPct ?? null,
    cvrDecayPct: metrics.cvrDecayPct ?? null,
    currentStatus: status,
    visualRiskFactors: risks,
    visualStrengths: strengths,
    dataSource: "historical",
  };
}

function computePredictedProfile(
  creative: CreativeDoc,
  evidencePack: EvidencePack,
  datasetLookup: Map<string, CreativeDoc>,
): FatigueProfile {
  const refs: Ref[] = evidencePack.similarCreatives
    .map((similar) => ({ similarity: similar.similarity, doc: datasetLookup.get(similar.id) }))
    .filter((item): item is Ref => item.doc !== undefined && item.doc.metricsSummary !== undefined);

  const dataSource: FatigueProfile["dataSource"] = refs.length > 0 ? "similarity-predicted" : "visual-only";
  const predictedCtrDecayPct =
    refs.length > 0
      ? -weightedMean(refs, (ref) => Math.abs(ref.doc.metricsSummary!.ctrDecayPct ?? COHORT_MEDIAN_DECAY_ABS))
      : null;

  const refsThatFatigued = refs.filter((ref) => ref.doc.metricsSummary!.fatigueDay != null);
  const baseLifespanDays =
    refsThatFatigued.length > 0
      ? weightedMean(refsThatFatigued, (ref) => ref.doc.metricsSummary!.fatigueDay!)
      : DATASET_MEDIAN_FATIGUE_DAY;

  const estimatedLifespanDays = Math.max(5, Math.round(baseLifespanDays * computeVisualLifespanMultiplier(creative.features)));
  const validPerfRefs = refs.filter((ref) => {
    const perfScore = ref.doc.metricsSummary!.perfScore;
    return typeof perfScore === "number" && perfScore >= 0 && perfScore <= 1;
  });
  const avgRefPerf =
    validPerfRefs.length > 0 ? weightedMean(validPerfRefs, (ref) => ref.doc.metricsSummary!.perfScore!) : COHORT_AVG_PERF;
  const healthScore = clamp(Math.round(avgRefPerf * 100 + computeVisualHealthAdjustment(creative.features)), 10, 100);
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

function weightedMean(refs: Ref[], pick: (ref: Ref) => number): number {
  const totalWeight = refs.reduce((sum, ref) => sum + ref.similarity, 0);
  if (totalWeight === 0) {
    return pick(refs[0]);
  }

  return refs.reduce((sum, ref) => sum + pick(ref) * ref.similarity, 0) / totalWeight;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scoreToUrgency(health: number): FatigueProfile["urgency"] {
  if (health >= 70) return "HEALTHY";
  if (health >= 45) return "WATCH";
  if (health >= 25) return "INTERVENE";
  return "PAUSE";
}

function computeVisualLifespanMultiplier(features: CreativeFeatures): number {
  let multiplier = 1;
  const novelty = features.noveltyScore ?? 0.56;
  const motion = features.motionScore ?? 0.53;

  multiplier -= (novelty - 0.56) * 0.5;
  multiplier -= (motion - 0.53) * 0.35;

  if (features.hasGameplay) multiplier += 0.12;
  if (features.hasUgcStyle) multiplier += 0.08;
  if (features.hasReward) multiplier -= 0.1;

  return clamp(multiplier, 0.5, 1.7);
}

function computeVisualHealthAdjustment(features: CreativeFeatures): number {
  let adjustment = 0;
  const novelty = features.noveltyScore ?? 0.56;
  const motion = features.motionScore ?? 0.53;
  const readability = features.readabilityScore ?? 0.65;
  const clutter = features.visualClutter ?? 0.4;

  adjustment += (novelty - 0.5) * 25;
  adjustment += (motion - 0.5) * 12;
  adjustment += (readability - 0.5) * 15;
  adjustment -= Math.max(0, clutter - 0.5) * 20;

  if (features.hasGameplay) adjustment += 8;
  if (features.hasUgcStyle) adjustment += 5;
  if (features.hasPerson) adjustment += 3;

  return Math.round(adjustment);
}

function deriveVisualSignals(features: CreativeFeatures): { risks: string[]; strengths: string[] } {
  const risks: string[] = [];
  const strengths: string[] = [];

  const novelty = features.noveltyScore ?? 0.56;
  const motion = features.motionScore ?? 0.53;
  const textDensity = features.textDensity ?? 0.35;
  const clutter = features.visualClutter ?? 0.4;

  if (novelty > 0.7) {
    risks.push("High novelty: strong opener but fast-burn pattern in dataset; plan refresh by day 10");
  }
  if (motion > 0.7) {
    risks.push("High motion: engaging but audiences adapt quickly; expect sharp drop after day 12");
  }
  if (textDensity > 0.6) {
    risks.push("High text density: copy becomes invisible over repeated views");
  }
  if (clutter > 0.6) {
    risks.push("High visual clutter: irritation builds with each impression");
  }
  if (features.hasReward) {
    risks.push("Reward hook: high pull on first view, drops sharply once users learn the mechanic");
  }
  if (!features.hasGameplay && !features.hasUgcStyle && novelty < 0.5) {
    risks.push("No interactive or UGC element: limited reason to re-engage on repeat views");
  }

  if (novelty < 0.4) {
    strengths.push("Low novelty: more sustainable trajectory, less risk of a sharp performance cliff");
  }
  if (features.hasUgcStyle) {
    strengths.push("UGC-style framing: authenticity sustains engagement longer");
  }
  if (features.hasGameplay) {
    strengths.push("Gameplay element: interactive feel keeps curiosity high");
  }

  return { risks, strengths };
}
