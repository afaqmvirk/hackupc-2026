import { config } from "@/lib/config";
import { cosineSimilarity } from "@/lib/data/embedding";
import { getDatasetCreatives, queryAtlasSimilarCreatives } from "@/lib/data/repository";
import {
  behaviorStates,
  dominantBehaviorState,
  normalizeBehaviorProbabilities,
  type BehaviorPrior,
  type BehaviorProbabilities,
  type Benchmark,
  type CampaignBrief,
  type CreativeDoc,
  type EvidencePack,
  type MetricsSummary,
  type SimilarCreative,
} from "@/lib/schemas";

function mean(values: Array<number | null | undefined>) {
  const clean = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!clean.length) {
    return null;
  }
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function rate(count: number, total: number) {
  return total > 0 ? count / total : 0;
}

function contextMatches(creative: CreativeDoc, brief: CampaignBrief) {
  const categoryMatches = !brief.category || creative.category === brief.category;
  const languageMatches = brief.language === "any" || creative.language === brief.language;
  const osMatches = brief.os === "any" || creative.os === brief.os || !creative.os;
  const countryMatches = brief.region === "global" || brief.region === "any" || creative.country === brief.region || !creative.country;
  return categoryMatches && languageMatches && osMatches && countryMatches;
}

function relaxedMatches(creative: CreativeDoc, brief: CampaignBrief) {
  return creative.category === brief.category || creative.language === brief.language || creative.os === brief.os;
}

export async function getSimilarCreatives(creative: CreativeDoc, brief: CampaignBrief, limit = 8): Promise<SimilarCreative[]> {
  const atlasResults = await queryAtlasSimilarCreatives(
    creative.features.embedding ?? [],
    {
      category: brief.category,
      ...(brief.language !== "any" ? { language: brief.language } : {}),
      ...(brief.os !== "any" ? { os: brief.os } : {}),
    },
    limit + 1,
  );

  if (atlasResults?.length) {
    return atlasResults
      .filter((candidate) => candidate.id !== creative.id)
      .slice(0, limit)
      .map((item) => ({
        id: item.id,
        assetUrl: item.assetUrl,
        appName: item.appName,
        category: item.category,
        format: item.format,
        ctaText: item.features.ctaText,
        headline: item.features.headline,
        creativeStatus: item.metricsSummary?.creativeStatus,
        perfScore: item.metricsSummary?.perfScore,
        ctr: item.metricsSummary?.ctr,
        cvr: item.metricsSummary?.cvr,
        similarity: Number(cosineSimilarity(creative.features.embedding, item.features.embedding).toFixed(4)),
      }));
  }

  const dataset = await getDatasetCreatives();
  const candidates = dataset
    .filter((candidate) => candidate.id !== creative.id)
    .filter((candidate) => contextMatches(candidate, brief) || relaxedMatches(candidate, brief));

  const source = candidates.length ? candidates : dataset.filter((candidate) => candidate.id !== creative.id);

  return source
    .map((candidate) => ({
      creative: candidate,
      similarity: cosineSimilarity(creative.features.embedding, candidate.features.embedding),
    }))
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, limit)
    .map(({ creative: item, similarity }) => ({
      id: item.id,
      assetUrl: item.assetUrl,
      appName: item.appName,
      category: item.category,
      format: item.format,
      ctaText: item.features.ctaText,
      headline: item.features.headline,
      creativeStatus: item.metricsSummary?.creativeStatus,
      perfScore: item.metricsSummary?.perfScore,
      ctr: item.metricsSummary?.ctr,
      cvr: item.metricsSummary?.cvr,
      similarity: Number(similarity.toFixed(4)),
    }));
}

export async function getBenchmark(brief: CampaignBrief, similarCreatives: SimilarCreative[]): Promise<Benchmark> {
  const dataset = await getDatasetCreatives();
  let benchmarkSet = dataset.filter((creative) => contextMatches(creative, brief));
  let contextLabel = `${brief.category} / ${brief.region} / ${brief.os} / ${brief.language}`;

  if (benchmarkSet.length < 12) {
    benchmarkSet = dataset.filter((creative) => creative.category === brief.category);
    contextLabel = `${brief.category} category fallback`;
  }

  if (benchmarkSet.length < 12 && similarCreatives.length) {
    const similarIds = new Set(similarCreatives.map((creative) => creative.id));
    benchmarkSet = dataset.filter((creative) => similarIds.has(creative.id));
    contextLabel = "nearest similar creatives";
  }

  if (!benchmarkSet.length) {
    benchmarkSet = dataset.slice(0, 80);
    contextLabel = "dataset fallback";
  }

  const sampleSize = benchmarkSet.length;
  const highPerformerCount = benchmarkSet.filter((creative) => creative.metricsSummary?.creativeStatus === "top_performer").length;
  const fatiguedCount = benchmarkSet.filter((creative) => creative.metricsSummary?.creativeStatus === "fatigued").length;
  const underperformerCount = benchmarkSet.filter((creative) => creative.metricsSummary?.creativeStatus === "underperformer").length;
  const stableCount = benchmarkSet.filter((creative) => creative.metricsSummary?.creativeStatus === "stable").length;

  return {
    contextLabel,
    sampleSize,
    avgCtr: mean(benchmarkSet.map((creative) => creative.metricsSummary?.ctr)),
    avgCvr: mean(benchmarkSet.map((creative) => creative.metricsSummary?.cvr)),
    avgPerfScore: mean(benchmarkSet.map((creative) => creative.metricsSummary?.perfScore)),
    avgCtrDecayPct: mean(benchmarkSet.map((creative) => creative.metricsSummary?.ctrDecayPct)),
    highPerformerCount,
    fatiguedCount,
    underperformerCount,
    stableCount,
    topPerformerRate: rate(highPerformerCount, sampleSize),
    underperformerRate: rate(underperformerCount, sampleSize),
    fatiguedRate: rate(fatiguedCount, sampleSize),
    stableRate: rate(stableCount, sampleSize),
  };
}

export function buildBehaviorPrior(variant: CreativeDoc, similarCreatives: SimilarCreative[], benchmark: Benchmark): BehaviorPrior {
  if (variant.source === "dataset" && variant.metricsSummary) {
    return priorFromTargetHistory(variant, benchmark);
  }

  const similarWithMetrics = similarCreatives.filter(
    (creative) =>
      typeof creative.perfScore === "number" ||
      typeof creative.ctr === "number" ||
      typeof creative.cvr === "number" ||
      Boolean(creative.creativeStatus),
  );

  if (similarWithMetrics.length) {
    return priorFromSimilarCreatives(variant, similarWithMetrics, benchmark);
  }

  return priorFromBenchmark(variant, benchmark);
}

function priorFromTargetHistory(variant: CreativeDoc, benchmark: Benchmark): BehaviorPrior {
  const metrics = variant.metricsSummary;
  const sentiment = sentimentFromMetrics(metrics, benchmark);
  const drivers = [`Target creative historical status is ${metrics?.creativeStatus ?? "unknown"}.`];
  let probabilityHints = probabilitiesForSentiment(sentiment);
  const useRecentFatigueRates = metrics?.creativeStatus === "fatigued" || (metrics?.ctrDecayPct ?? 0) <= -0.82;
  const clickRate = useRecentFatigueRates ? blendedFatigueRate(metrics?.ctr, metrics?.last7dCtr) : metrics?.ctr;
  const conversionRate = useRecentFatigueRates
    ? blendedFatigueRate(viewConversionRate(metrics?.ctr, metrics?.cvr), viewConversionRate(metrics?.last7dCtr, metrics?.last7dCvr))
    : viewConversionRate(metrics?.ctr, metrics?.cvr);

  probabilityHints = adjustForMetricContext(probabilityHints, {
    benchmark,
    clickRate,
    conversionRate,
    perfScore: metrics?.perfScore,
    creativeStatus: metrics?.creativeStatus,
    ctrDecayPct: metrics?.ctrDecayPct,
    drivers,
  });
  probabilityHints = adjustForCreativeFeatures(probabilityHints, variant, drivers);

  return {
    source: "target_history",
    datasetSentiment: sentiment,
    probabilityHints,
    drivers,
  };
}

function priorFromSimilarCreatives(
  variant: CreativeDoc,
  similarCreatives: SimilarCreative[],
  benchmark: Benchmark,
): BehaviorPrior {
  const avgPerfScore = weightedMean(similarCreatives.map((creative) => [creative.perfScore, creative.similarity]));
  const avgCtr = weightedMean(similarCreatives.map((creative) => [creative.ctr, creative.similarity]));
  const avgConversionRate = weightedMean(
    similarCreatives.map((creative) => [viewConversionRate(creative.ctr, creative.cvr), creative.similarity]),
  );
  const topRate = rate(similarCreatives.filter((creative) => creative.creativeStatus === "top_performer").length, similarCreatives.length);
  const fatiguedRate = rate(similarCreatives.filter((creative) => creative.creativeStatus === "fatigued").length, similarCreatives.length);
  const underperformerRate = rate(
    similarCreatives.filter((creative) => creative.creativeStatus === "underperformer").length,
    similarCreatives.length,
  );
  const sentiment = sentimentFromAggregate({
    avgPerfScore,
    topRate,
    fatiguedRate,
    underperformerRate,
    avgCtrDecayPct: null,
  });
  const drivers = [
    `Uploaded or unmeasured creative uses ${similarCreatives.length} nearest historical creatives for behavior priors.`,
    `Similar creative mix: top ${formatPct(topRate)}, fatigued ${formatPct(fatiguedRate)}, underperformer ${formatPct(underperformerRate)}.`,
  ];
  let probabilityHints = probabilitiesForSentiment(sentiment);

  probabilityHints = adjustForMetricContext(probabilityHints, {
    benchmark,
    clickRate: avgCtr,
    conversionRate: avgConversionRate,
    perfScore: avgPerfScore,
    creativeStatus: fatiguedRate >= 0.35 ? "fatigued" : underperformerRate >= 0.35 ? "underperformer" : undefined,
    ctrDecayPct: null,
    drivers,
  });
  probabilityHints = adjustForCreativeFeatures(probabilityHints, variant, drivers);

  return {
    source: "similar_creatives",
    datasetSentiment: sentiment,
    probabilityHints,
    drivers,
  };
}

function priorFromBenchmark(variant: CreativeDoc, benchmark: Benchmark): BehaviorPrior {
  const sentiment = sentimentFromAggregate({
    avgPerfScore: benchmark.avgPerfScore,
    topRate: benchmark.topPerformerRate,
    fatiguedRate: benchmark.fatiguedRate,
    underperformerRate: benchmark.underperformerRate,
    avgCtrDecayPct: benchmark.avgCtrDecayPct,
  });
  const drivers = [
    `Behavior prior falls back to ${benchmark.contextLabel}.`,
    `Benchmark mix: top ${formatPct(benchmark.topPerformerRate)}, fatigued ${formatPct(benchmark.fatiguedRate)}, underperformer ${formatPct(
      benchmark.underperformerRate,
    )}.`,
  ];
  let probabilityHints = probabilitiesForSentiment(sentiment);

  probabilityHints = adjustForMetricContext(probabilityHints, {
    benchmark,
    clickRate: benchmark.avgCtr,
    conversionRate: viewConversionRate(benchmark.avgCtr, benchmark.avgCvr),
    perfScore: benchmark.avgPerfScore,
    creativeStatus: benchmark.fatiguedRate >= 0.35 ? "fatigued" : benchmark.underperformerRate >= 0.25 ? "underperformer" : undefined,
    ctrDecayPct: benchmark.avgCtrDecayPct,
    drivers,
  });
  probabilityHints = adjustForCreativeFeatures(probabilityHints, variant, drivers);

  return {
    source: "benchmark",
    datasetSentiment: sentiment,
    probabilityHints,
    drivers,
  };
}

function sentimentFromMetrics(metrics: MetricsSummary | undefined, benchmark: Benchmark): BehaviorPrior["datasetSentiment"] {
  const status = metrics?.creativeStatus;
  if (status === "fatigued" || (metrics?.ctrDecayPct ?? 0) <= -0.82) {
    return "fatigue_risk";
  }
  if (status === "top_performer" || (metrics?.perfScore ?? 0) >= 0.75 || relative(metrics?.ctr, benchmark.avgCtr) >= 1.35) {
    return "positive";
  }
  if (status === "underperformer" || (metrics?.perfScore ?? 1) <= 0.25 || relative(metrics?.ctr, benchmark.avgCtr) <= 0.72) {
    return "negative";
  }
  return "neutral";
}

function sentimentFromAggregate({
  avgPerfScore,
  topRate,
  fatiguedRate,
  underperformerRate,
  avgCtrDecayPct,
}: {
  avgPerfScore: number | null;
  topRate: number;
  fatiguedRate: number;
  underperformerRate: number;
  avgCtrDecayPct: number | null;
}): BehaviorPrior["datasetSentiment"] {
  if (fatiguedRate >= 0.28 || (avgCtrDecayPct ?? 0) <= -0.82) {
    return "fatigue_risk";
  }
  if (topRate >= 0.12 || (avgPerfScore ?? 0) >= 0.65) {
    return "positive";
  }
  if (underperformerRate >= 0.22 || (avgPerfScore ?? 1) <= 0.32) {
    return "negative";
  }
  return "neutral";
}

function probabilitiesForSentiment(sentiment: BehaviorPrior["datasetSentiment"]): BehaviorProbabilities {
  switch (sentiment) {
    case "positive":
      return normalizeBehaviorProbabilities({ skip: 0.46, ignore: 0.305, inspect: 0.212, click: 0.009, convert: 0.001, exit: 0.013 });
    case "negative":
      return normalizeBehaviorProbabilities({ skip: 0.62, ignore: 0.25, inspect: 0.096, click: 0.003, convert: 0.00025, exit: 0.03075 });
    case "fatigue_risk":
      return normalizeBehaviorProbabilities({ skip: 0.6, ignore: 0.22, inspect: 0.154, click: 0.0045, convert: 0.00045, exit: 0.02105 });
    default:
      return normalizeBehaviorProbabilities({ skip: 0.52, ignore: 0.29, inspect: 0.164, click: 0.0054, convert: 0.00057, exit: 0.02003 });
  }
}

function adjustForMetricContext(
  probabilities: BehaviorProbabilities,
  {
    benchmark,
    clickRate,
    conversionRate,
    perfScore,
    creativeStatus,
    ctrDecayPct,
    drivers,
  }: {
    benchmark: Benchmark;
    clickRate?: number | null;
    conversionRate?: number | null;
    perfScore?: number | null;
    creativeStatus?: string;
    ctrDecayPct?: number | null;
    drivers: string[];
  },
): BehaviorProbabilities {
  let next = probabilities;
  const benchmarkConversionRate = viewConversionRate(benchmark.avgCtr, benchmark.avgCvr);

  if (typeof clickRate === "number" && Number.isFinite(clickRate)) {
    next = withActionRateAnchors(next, {
      click: clickRate,
      convert: typeof conversionRate === "number" && Number.isFinite(conversionRate) ? conversionRate : undefined,
    });
    drivers.push(
      `Action-rate anchor: click/view ${formatRatePct(clickRate, 2)}${
        typeof conversionRate === "number" && Number.isFinite(conversionRate)
          ? `, conversion/view ${formatRatePct(conversionRate, 3)}`
          : ""
      }.`,
    );
  }

  if ((perfScore ?? 0) >= 0.75) {
    next = withRelativeActionLift(next, { click: 1.12, convert: 1.12 });
    next = withBehaviorDeltas(next, { inspect: 0.02, skip: -0.015, ignore: -0.005 });
    drivers.push("High performance score raises action-rate anchors modestly and shifts more users into inspect.");
  } else if ((perfScore ?? 1) <= 0.25) {
    next = withRelativeActionLift(next, { click: 0.82, convert: 0.82 });
    next = withBehaviorDeltas(next, { skip: 0.04, ignore: 0.025, inspect: -0.03 });
    drivers.push("Low performance score lowers action-rate anchors and raises skip/ignore likelihood.");
  }

  if (relative(clickRate, benchmark.avgCtr) >= 1.25) {
    next = withRelativeActionLift(next, { click: 1.08 });
    next = withBehaviorDeltas(next, { inspect: 0.015, skip: -0.012 });
    drivers.push("Click/view rate is above benchmark, so click probability is lifted within dataset-scale bounds.");
  } else if (relative(clickRate, benchmark.avgCtr) <= 0.75) {
    next = withRelativeActionLift(next, { click: 0.86 });
    next = withBehaviorDeltas(next, { skip: 0.03, ignore: 0.02, inspect: -0.02 });
    drivers.push("Click/view rate is below benchmark, so skip and ignore probabilities are lifted.");
  }

  if (relative(conversionRate, benchmarkConversionRate) >= 1.25) {
    next = withRelativeActionLift(next, { convert: 1.1 });
    next = withBehaviorDeltas(next, { exit: -0.008, inspect: 0.008 });
    drivers.push("Conversion/view rate is above benchmark, so conversion probability is lifted within dataset-scale bounds.");
  } else if (relative(conversionRate, benchmarkConversionRate) <= 0.75) {
    next = withRelativeActionLift(next, { convert: 0.84 });
    next = withBehaviorDeltas(next, { exit: 0.018, ignore: 0.012 });
    drivers.push("Conversion/view rate is below benchmark, so post-click exit risk is lifted.");
  }

  if (creativeStatus === "fatigued" || (ctrDecayPct ?? 0) <= -0.82) {
    next = withRelativeActionLift(next, { click: 0.9, convert: 0.9 });
    next = withBehaviorDeltas(next, { skip: 0.08, exit: 0.035, inspect: -0.04, ignore: -0.015 });
    drivers.push("Fatigue or CTR decay raises skip/exit and lowers action-rate anchors.");
  }

  return next;
}

function adjustForCreativeFeatures(
  probabilities: BehaviorProbabilities,
  variant: CreativeDoc,
  drivers: string[],
): BehaviorProbabilities {
  const features = variant.features;
  let next = probabilities;

  if ((features.visualClutter ?? 0) >= 0.7) {
    next = withRelativeActionLift(next, { click: 0.86, convert: 0.9 });
    next = withBehaviorDeltas(next, { skip: 0.05, ignore: 0.03, inspect: -0.02 });
    drivers.push("High visual clutter increases fast-skip risk.");
  }
  if ((features.textDensity ?? 0) >= 0.65) {
    next = withRelativeActionLift(next, { click: 0.9 });
    next = withBehaviorDeltas(next, { skip: 0.03, ignore: 0.03 });
    drivers.push("Dense text increases ignore risk on mobile.");
  }
  if ((features.readabilityScore ?? 1) <= 0.45) {
    next = withRelativeActionLift(next, { convert: 0.84 });
    next = withBehaviorDeltas(next, { skip: 0.03, exit: 0.04 });
    drivers.push("Low readability increases confusion or exit risk.");
  }
  if ((features.brandVisibilityScore ?? 1) <= 0.35) {
    next = withRelativeActionLift(next, { convert: 0.88 });
    next = withBehaviorDeltas(next, { ignore: 0.04 });
    drivers.push("Weak brand visibility lowers conversion confidence.");
  }
  if ((features.noveltyScore ?? 0) >= 0.75) {
    next = withRelativeActionLift(next, { click: 1.08 });
    next = withBehaviorDeltas(next, { inspect: 0.04, skip: -0.02 });
    drivers.push("High novelty increases inspection and click curiosity.");
  }
  if (features.hasReward || features.hasPrice) {
    next = withRelativeActionLift(next, { click: 1.08 });
    next = withBehaviorDeltas(next, { inspect: 0.02 });
    drivers.push("Offer/reward framing increases inspection and click pull.");
  }

  return next;
}

function withActionRateAnchors(
  probabilities: BehaviorProbabilities,
  anchors: { click?: number | null; convert?: number | null },
): BehaviorProbabilities {
  const click = clampRate(anchors.click ?? probabilities.click, 0, 0.025);
  const convert = clampRate(anchors.convert ?? probabilities.convert, 0, 0.006);
  const remaining = Math.max(1 - click - convert, 0.001);
  const nonActionStates = behaviorStates.filter((state) => state !== "click" && state !== "convert");
  const nonActionTotal = nonActionStates.reduce((sum, state) => sum + probabilities[state], 0);

  return normalizeBehaviorProbabilities(
    Object.fromEntries(
      behaviorStates.map((state) => {
        if (state === "click") return [state, click];
        if (state === "convert") return [state, convert];
        const share = nonActionTotal > 0 ? probabilities[state] / nonActionTotal : 1 / nonActionStates.length;
        return [state, remaining * share];
      }),
    ) as BehaviorProbabilities,
  );
}

function withRelativeActionLift(
  probabilities: BehaviorProbabilities,
  multipliers: Partial<Record<"click" | "convert", number>>,
): BehaviorProbabilities {
  return withActionRateAnchors(probabilities, {
    click: probabilities.click * (multipliers.click ?? 1),
    convert: probabilities.convert * (multipliers.convert ?? 1),
  });
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

function weightedMean(values: Array<[number | null | undefined, number | null | undefined]>) {
  const clean = values.filter((item): item is [number, number] => typeof item[0] === "number" && Number.isFinite(item[0]));
  if (!clean.length) {
    return null;
  }
  const totalWeight = clean.reduce((sum, [, weight]) => sum + Math.max(weight ?? 0.1, 0.1), 0);
  return clean.reduce((sum, [value, weight]) => sum + value * Math.max(weight ?? 0.1, 0.1), 0) / totalWeight;
}

function relative(value?: number | null, baseline?: number | null) {
  if (typeof value !== "number" || typeof baseline !== "number" || baseline <= 0) {
    return 1;
  }
  return value / baseline;
}

function viewConversionRate(clickRate?: number | null, clickToConversionRate?: number | null) {
  if (typeof clickRate !== "number" || typeof clickToConversionRate !== "number") {
    return null;
  }
  if (!Number.isFinite(clickRate) || !Number.isFinite(clickToConversionRate)) {
    return null;
  }
  return clickRate * clickToConversionRate;
}

function blendedFatigueRate(overall?: number | null, recent?: number | null) {
  if (typeof overall !== "number" || !Number.isFinite(overall)) {
    return typeof recent === "number" && Number.isFinite(recent) ? recent : null;
  }
  if (typeof recent !== "number" || !Number.isFinite(recent)) {
    return overall;
  }
  return overall * 0.65 + recent * 0.35;
}

function clampRate(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export async function buildEvidencePack(variant: CreativeDoc, brief: CampaignBrief, index: number): Promise<EvidencePack> {
  const similarCreatives = await getSimilarCreatives(variant, brief);
  const benchmark = await getBenchmark(brief, similarCreatives);
  const behaviorPrior = buildBehaviorPrior(variant, similarCreatives, benchmark);
  const metrics = variant.metricsSummary;
  const features = variant.features;

  const facts = [
    `Variant ${index + 1} format is ${variant.format} with ${features.aspectRatio ?? "unknown"} aspect ratio.`,
    `CTA text: ${features.ctaText || "not detected"}. Headline: ${features.headline || "not detected"}.`,
    `Visual signals: text density ${formatMetric(features.textDensity)}, clutter ${formatMetric(features.visualClutter)}, novelty ${formatMetric(features.noveltyScore)}.`,
    `Creative flags: reward=${features.hasReward}, gameplay=${features.hasGameplay}, price=${features.hasPrice}, person=${features.hasPerson}.`,
    `Benchmark context: ${benchmark.contextLabel} with ${benchmark.sampleSize} historical creatives.`,
    `Dataset action-rate scale: benchmark click/view ${formatRatePct(benchmark.avgCtr, 2)}, benchmark conversion/view ${formatRatePct(
      viewConversionRate(benchmark.avgCtr, benchmark.avgCvr),
      3,
    )}. Treat behavior.click and behavior.convert as impression-level rates, not broad intent scores.`,
    `Nearest historical creatives returned ${similarCreatives.length} evidence examples.`,
    `Simulated behavior prior is ${behaviorPrior.datasetSentiment} from ${behaviorPrior.source}; highest hinted state is ${dominantBehaviorState(
      behaviorPrior.probabilityHints,
    )}.`,
  ];

  if (metrics) {
    const actualClickRate = metrics.creativeStatus === "fatigued" ? blendedFatigueRate(metrics.ctr, metrics.last7dCtr) : metrics.ctr;
    const actualConversionRate =
      metrics.creativeStatus === "fatigued"
        ? blendedFatigueRate(viewConversionRate(metrics.ctr, metrics.cvr), viewConversionRate(metrics.last7dCtr, metrics.last7dCvr))
        : viewConversionRate(metrics.ctr, metrics.cvr);
    facts.push(
      `Historical summary for this dataset creative: click/view ${formatRatePct(metrics.ctr, 2)}, click-to-conversion ${formatRatePct(
        metrics.cvr,
        1,
      )}, conversion/view ${formatRatePct(viewConversionRate(metrics.ctr, metrics.cvr), 3)}, status ${metrics.creativeStatus ?? "unknown"}.`,
      `Behavior action-rate anchor for this creative: click/view ${formatRatePct(actualClickRate, 2)}, conversion/view ${formatRatePct(
        actualConversionRate,
        3,
      )}${metrics.creativeStatus === "fatigued" ? " using recent fatigue-window rates where available" : ""}.`,
    );
    if (metrics.ctrDecayPct !== undefined && metrics.ctrDecayPct !== null) {
      const decayPct = Math.round(Math.abs(metrics.ctrDecayPct) * 100);
      facts.push(
        `Fatigue signals: CTR decayed ${decayPct}% from launch week to last week (first7dCTR ${formatMetric(metrics.first7dCtr)} to last7dCTR ${formatMetric(metrics.last7dCtr)}).${metrics.fatigueDay ? ` Fatigued on day ${metrics.fatigueDay}.` : " Still classified as stable."}`,
      );
    }
  }

  const warnings = [
    ...(variant.source === "upload" ? ["Uploaded creative has no direct historical KPI history; compare it through nearest dataset creatives."] : []),
    ...(config.mongodbUri ? [] : ["MongoDB Atlas is not configured; using local CSV memory and cosine retrieval fallback."]),
    ...((metrics?.creativeStatus === "fatigued" || (metrics?.ctrDecayPct ?? 0) < -0.45)
      ? ["Historical pattern includes material fatigue/CTR decay."]
      : []),
  ];

  return {
    variantId: variant.id,
    variantLabel: variant.label ?? `Variant ${index + 1}`,
    campaignContext: brief,
    creative: variant,
    benchmark,
    similarCreatives,
    behaviorPrior,
    facts,
    warnings,
  };
}

function formatMetric(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "n/a";
  }
  return value.toFixed(3);
}

function formatRatePct(value?: number | null, digits = 2) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "n/a";
  }
  return `${(value * 100).toFixed(digits)}%`;
}

function formatPct(value: number) {
  return `${Math.round(value * 100)}%`;
}
