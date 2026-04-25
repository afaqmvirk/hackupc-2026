import { describe, expect, it } from "vitest";
import { computeFatigueProfile } from "@/lib/analysis/fatigue";
import type { CreativeDoc, EvidencePack } from "@/lib/schemas";

const validUrgencies = ["HEALTHY", "WATCH", "INTERVENE", "PAUSE"];
type MetricsInput = Partial<NonNullable<CreativeDoc["metricsSummary"]>>;

describe("fatigue profiles", () => {
  it("uses historical decay data for dataset creatives", () => {
    const creative = creativeDoc("500001", "dataset", {
      creativeStatus: "fatigued",
      ctrDecayPct: -0.72,
      cvrDecayPct: -0.43,
      fatigueDay: 11,
      perfScore: 0.62,
    });
    const profile = computeFatigueProfile(creative, evidencePack(creative), new Map([[creative.id, creative]]));

    expect(profile.dataSource).toBe("historical");
    expect(profile.creativeId).toBe("500001");
    expect(profile.ctrDecayPct).toBe(-0.72);
    expect(profile.cvrDecayPct).toBe(-0.43);
    expect(profile.estimatedLifespanDays).toBe(11);
    expect(profile.currentStatus).toBe("fatigued");
    expect(profile.healthScore).toBeGreaterThanOrEqual(0);
    expect(profile.healthScore).toBeLessThanOrEqual(100);
    expect(validUrgencies).toContain(profile.urgency);
  });

  it("uses similar creative decay data for uploaded creatives in evidence mode", () => {
    const upload = creativeDoc("upload_1", "upload", undefined, {
      noveltyScore: 0.75,
      motionScore: 0.72,
      hasReward: true,
    });
    const similar = creativeDoc("500002", "dataset", {
      creativeStatus: "stable",
      ctrDecayPct: -0.58,
      cvrDecayPct: -0.24,
      fatigueDay: 14,
      perfScore: 0.7,
    });
    const profile = computeFatigueProfile(
      upload,
      evidencePack(upload, [{ id: similar.id, similarity: 0.88 }]),
      new Map([[similar.id, similar]]),
    );

    expect(profile.dataSource).toBe("similarity-predicted");
    expect(profile.creativeId).toBe("upload_1");
    expect(profile.ctrDecayPct).toBeCloseTo(-0.58);
    expect(profile.estimatedLifespanDays).toBeGreaterThan(0);
    expect(profile.healthScore).toBeGreaterThanOrEqual(0);
    expect(profile.healthScore).toBeLessThanOrEqual(100);
    expect(validUrgencies).toContain(profile.urgency);
    expect(profile.visualRiskFactors.length).toBeGreaterThan(0);
  });
});

function creativeDoc(
  id: string,
  source: CreativeDoc["source"],
  metricsSummary?: MetricsInput,
  featureOverrides: Partial<CreativeDoc["features"]> = {},
): CreativeDoc {
  return {
    id,
    source,
    assetUrl: `/api/assets/${id}`,
    assetType: source === "dataset" ? "image" : "uploaded_image",
    category: "gaming",
    language: "en",
    format: "static_image",
    durationSec: 0,
    createdAt: "2026-04-25T00:00:00.000Z",
    features: {
      aspectRatio: "9:16",
      textDensity: 0.3,
      visualClutter: 0.35,
      noveltyScore: 0.55,
      motionScore: 0.5,
      readabilityScore: 0.7,
      hasReward: false,
      hasGameplay: false,
      hasUgcStyle: false,
      hasPerson: false,
      ...featureOverrides,
    },
    metricsSummary: metricsSummary as CreativeDoc["metricsSummary"],
  } as CreativeDoc;
}

function evidencePack(
  creative: CreativeDoc,
  similarCreatives: Array<{ id: string; similarity: number }> = [],
): EvidencePack {
  return {
    variantId: creative.id,
    variantLabel: creative.id,
    campaignContext: {
      category: "gaming",
      region: "global",
      language: "en",
      os: "any",
      objective: "installs",
      audienceStyle: "casual mobile users",
    },
    creative,
    benchmark: {
      contextLabel: "gaming benchmark",
      sampleSize: 20,
      avgCtr: 0.006,
      avgCvr: 0.08,
      avgPerfScore: 0.5,
      avgCtrDecayPct: -0.58,
      highPerformerCount: 3,
      fatiguedCount: 4,
      underperformerCount: 5,
      stableCount: 8,
      topPerformerRate: 0.15,
      underperformerRate: 0.25,
      fatiguedRate: 0.2,
      stableRate: 0.4,
    },
    similarCreatives: similarCreatives.map((similar) => ({
      id: similar.id,
      assetUrl: `/api/assets/${similar.id}`,
      category: "gaming",
      format: "static_image",
      similarity: similar.similarity,
    })),
    behaviorPrior: {
      source: "similar_creatives",
      datasetSentiment: "neutral",
      probabilityHints: {
        skip: 0.45,
        ignore: 0.25,
        inspect: 0.25,
        click: 0.004,
        convert: 0.001,
        exit: 0.045,
      },
      drivers: [],
    },
    facts: [],
    warnings: [],
  };
}
