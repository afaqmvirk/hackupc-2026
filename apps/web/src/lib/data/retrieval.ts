import { config } from "@/lib/config";
import { cosineSimilarity } from "@/lib/data/embedding";
import { getDatasetCreatives, queryAtlasSimilarCreatives } from "@/lib/data/repository";
import type { Benchmark, CampaignBrief, CreativeDoc, EvidencePack, SimilarCreative } from "@/lib/schemas";

function mean(values: Array<number | null | undefined>) {
  const clean = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!clean.length) {
    return null;
  }
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
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

  return {
    contextLabel,
    sampleSize: benchmarkSet.length,
    avgCtr: mean(benchmarkSet.map((creative) => creative.metricsSummary?.ctr)),
    avgCvr: mean(benchmarkSet.map((creative) => creative.metricsSummary?.cvr)),
    avgPerfScore: mean(benchmarkSet.map((creative) => creative.metricsSummary?.perfScore)),
    highPerformerCount: benchmarkSet.filter((creative) => creative.metricsSummary?.creativeStatus === "top_performer").length,
    fatiguedCount: benchmarkSet.filter((creative) => creative.metricsSummary?.creativeStatus === "fatigued").length,
  };
}

export async function buildEvidencePack(variant: CreativeDoc, brief: CampaignBrief, index: number): Promise<EvidencePack> {
  const similarCreatives = await getSimilarCreatives(variant, brief);
  const benchmark = await getBenchmark(brief, similarCreatives);
  const metrics = variant.metricsSummary;
  const features = variant.features;

  const facts = [
    `Variant ${index + 1} format is ${variant.format} with ${features.aspectRatio ?? "unknown"} aspect ratio.`,
    `CTA text: ${features.ctaText || "not detected"}. Headline: ${features.headline || "not detected"}.`,
    `Visual signals: text density ${formatMetric(features.textDensity)}, clutter ${formatMetric(features.visualClutter)}, novelty ${formatMetric(features.noveltyScore)}.`,
    `Creative flags: reward=${features.hasReward}, gameplay=${features.hasGameplay}, price=${features.hasPrice}, person=${features.hasPerson}.`,
    `Benchmark context: ${benchmark.contextLabel} with ${benchmark.sampleSize} historical creatives.`,
    `Nearest historical creatives returned ${similarCreatives.length} evidence examples.`,
  ];

  if (metrics) {
    facts.push(
      `Historical summary for this dataset creative: CTR ${formatMetric(metrics.ctr)}, CVR ${formatMetric(metrics.cvr)}, status ${metrics.creativeStatus ?? "unknown"}.`,
    );
    if (metrics.ctrDecayPct !== undefined && metrics.ctrDecayPct !== null) {
      const decayPct = Math.round(Math.abs(metrics.ctrDecayPct) * 100);
      facts.push(
        `Fatigue signals: CTR decayed ${decayPct}% from launch week to last week (first7dCTR ${formatMetric(metrics.first7dCtr)} → last7dCTR ${formatMetric(metrics.last7dCtr)}).${metrics.fatigueDay ? ` Fatigued on day ${metrics.fatigueDay}.` : " Still classified as stable."}`,
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
