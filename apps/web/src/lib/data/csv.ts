import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { datasetDir } from "@/lib/paths";
import type { CreativeDoc, MetricsSummary } from "@/lib/schemas";
import { buildCreativeEmbedding } from "@/lib/data/embedding";

type CsvRow = Record<string, string>;

export type CampaignRecord = {
  campaignId: string;
  advertiserId: string;
  advertiserName: string;
  appName: string;
  vertical: string;
  objective: string;
  primaryTheme: string;
  targetAgeSegment: string;
  targetOs: string;
  countries: string[];
  kpiGoal: string;
};

export type DailyMetricRecord = {
  date: string;
  campaignId: string;
  creativeId: string;
  country: string;
  os: string;
  daysSinceLaunch: number;
  spendUsd: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenueUsd: number;
  videoCompletions: number;
};

let creativeCache: CreativeDoc[] | undefined;
let campaignCache: CampaignRecord[] | undefined;
let dailyMetricCache: DailyMetricRecord[] | undefined;

function readCsv(fileName: string): CsvRow[] {
  const fullPath = path.join(datasetDir(), fileName);
  const raw = fs.readFileSync(fullPath, "utf8");
  const parsed = Papa.parse<CsvRow>(raw, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    throw new Error(`Failed to parse ${fileName}: ${parsed.errors[0].message}`);
  }

  return parsed.data;
}

function asNumber(value: string | undefined, fallback = 0) {
  if (value === undefined || value === "") {
    return fallback;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asNullableNumber(value: string | undefined) {
  if (value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function asBoolean(value: string | undefined) {
  return value === "1" || value?.toLowerCase() === "true";
}

export function loadCampaigns() {
  if (campaignCache) {
    return campaignCache;
  }

  campaignCache = readCsv("campaigns.csv").map((row) => ({
    campaignId: row.campaign_id,
    advertiserId: row.advertiser_id,
    advertiserName: row.advertiser_name,
    appName: row.app_name,
    vertical: row.vertical,
    objective: row.objective,
    primaryTheme: row.primary_theme,
    targetAgeSegment: row.target_age_segment,
    targetOs: row.target_os,
    countries: (row.countries ?? "").split("|").filter(Boolean),
    kpiGoal: row.kpi_goal,
  }));

  return campaignCache;
}

export function loadCreatives() {
  if (creativeCache) {
    return creativeCache;
  }

  const summaries = new Map(readCsv("creative_summary.csv").map((row) => [row.creative_id, row]));
  const campaigns = new Map(loadCampaigns().map((campaign) => [campaign.campaignId, campaign]));

  creativeCache = readCsv("creatives.csv").map((row) => {
    const summary = summaries.get(row.creative_id);
    const campaign = campaigns.get(row.campaign_id);
    const metricsSummary: MetricsSummary = {
      impressions: asNumber(summary?.total_impressions),
      clicks: asNumber(summary?.total_clicks),
      conversions: asNumber(summary?.total_conversions),
      spendUsd: asNumber(summary?.total_spend_usd),
      revenueUsd: asNumber(summary?.total_revenue_usd),
      ctr: asNullableNumber(summary?.overall_ctr),
      cvr: asNullableNumber(summary?.overall_cvr),
      ipm: asNullableNumber(summary?.overall_ipm),
      roas: asNullableNumber(summary?.overall_roas),
      perfScore: asNullableNumber(summary?.perf_score),
      first7dCtr: asNullableNumber(summary?.first_7d_ctr),
      last7dCtr: asNullableNumber(summary?.last_7d_ctr),
      ctrDecayPct: asNullableNumber(summary?.ctr_decay_pct),
      first7dCvr: asNullableNumber(summary?.first_7d_cvr),
      last7dCvr: asNullableNumber(summary?.last_7d_cvr),
      cvrDecayPct: asNullableNumber(summary?.cvr_decay_pct),
      creativeStatus: summary?.creative_status,
      fatigueDay: asNullableNumber(summary?.fatigue_day),
    };

    const creative: CreativeDoc = {
      id: row.creative_id,
      source: "dataset",
      assetUrl: `/api/assets/${row.creative_id}`,
      thumbnailUrl: `/api/assets/${row.creative_id}`,
      assetType: row.duration_sec === "0" ? "static_image" : "dataset_video_frame",
      advertiserId: campaign?.advertiserId,
      advertiserName: row.advertiser_name,
      campaignId: row.campaign_id,
      appName: row.app_name,
      category: row.vertical,
      country: campaign?.countries[0],
      language: row.language,
      os: campaign?.targetOs,
      format: row.format,
      theme: row.theme,
      hookType: row.hook_type,
      emotionalTone: row.emotional_tone,
      durationSec: asNumber(row.duration_sec),
      createdAt: row.creative_launch_date,
      features: {
        ocrText: [row.headline, row.subhead, row.cta_text].filter(Boolean).join(" "),
        ctaText: row.cta_text,
        headline: row.headline,
        subhead: row.subhead,
        dominantColors: row.dominant_color ? [row.dominant_color] : [],
        textDensity: asNullableNumber(row.text_density),
        visualClutter: asNullableNumber(row.clutter_score),
        readabilityScore: asNullableNumber(row.readability_score),
        brandVisibilityScore: asNullableNumber(row.brand_visibility_score),
        noveltyScore: asNullableNumber(row.novelty_score),
        motionScore: asNullableNumber(row.motion_score),
        facesCount: asNumber(row.faces_count),
        productCount: asNumber(row.product_count),
        hasLogo: asNumber(row.brand_visibility_score) > 0.55,
        hasPerson: asNumber(row.faces_count) > 0,
        hasPrice: asBoolean(row.has_price),
        hasReward: asBoolean(row.has_discount_badge) || /reward|bonus|free|claim/i.test(row.cta_text + row.hook_type),
        hasGameplay: asBoolean(row.has_gameplay),
        hasUgcStyle: asBoolean(row.has_ugc_style),
        aspectRatio: `${row.width}:${row.height}`,
        width: asNumber(row.width),
        height: asNumber(row.height),
      },
      metricsSummary,
    };

    creative.features.embedding = buildCreativeEmbedding(creative);
    return creative;
  });

  return creativeCache;
}

export function loadDailyMetrics() {
  if (dailyMetricCache) {
    return dailyMetricCache;
  }

  dailyMetricCache = readCsv("creative_daily_country_os_stats.csv").map((row) => ({
    date: row.date,
    campaignId: row.campaign_id,
    creativeId: row.creative_id,
    country: row.country,
    os: row.os,
    daysSinceLaunch: asNumber(row.days_since_launch),
    spendUsd: asNumber(row.spend_usd),
    impressions: asNumber(row.impressions),
    clicks: asNumber(row.clicks),
    conversions: asNumber(row.conversions),
    revenueUsd: asNumber(row.revenue_usd),
    videoCompletions: asNumber(row.video_completions),
  }));

  return dailyMetricCache;
}

export function datasetAssetPath(creativeId: string) {
  const creative = loadCreatives().find((item) => item.id === creativeId);
  if (!creative) {
    return null;
  }

  return path.join(datasetDir(), "assets", `creative_${creative.id}.png`);
}

export function resetCsvCachesForTests() {
  creativeCache = undefined;
  campaignCache = undefined;
  dailyMetricCache = undefined;
}
