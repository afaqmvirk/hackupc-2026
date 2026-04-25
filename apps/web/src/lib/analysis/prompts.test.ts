import { describe, expect, it } from "vitest";
import { agentPrompt, imageOnlyAgentPrompt, imageOnlyAggregatorPrompt, swarmAgents } from "@/lib/analysis/prompts";
import type { EvidencePack } from "@/lib/schemas";

const brief = {
  category: "gaming",
  region: "global",
  language: "any",
  os: "any",
  objective: "installs",
  audienceStyle: "casual mobile users",
};

const forbiddenPromptFragments = [
  "Evidence pack",
  "metricsSummary",
  "CTR",
  "CVR",
  "creativeStatus",
  "similarCreatives",
  "benchmark",
  "behaviorPrior",
  "appName",
  "advertiser",
  "campaignId",
  "hookType",
  "emotionalTone",
  "perfScore",
  "fatigueDay",
];

describe("image-only prompts", () => {
  it("does not include evidence-pack or database-derived field names in the agent prompt", () => {
    const prompt = imageOnlyAgentPrompt({
      agent: swarmAgents[0],
      variantId: "variant_1",
      variantLabel: "Variant 1",
      campaignContext: brief,
    });

    for (const fragment of forbiddenPromptFragments) {
      expect(prompt).not.toContain(fragment);
    }
    expect(prompt).toContain("Use only the attached creative image");
    expect(prompt).toContain("Variant ID: variant_1");
    expect(prompt).toContain('"category": "gaming"');
  });

  it("sends only sanitized agent reviews to the image-only aggregator prompt", () => {
    const prompt = imageOnlyAggregatorPrompt([
      {
        agentName: "Low-Attention Scroller",
        variantId: "variant_1",
        behavior: { primaryState: "click" },
      },
    ]);

    for (const fragment of forbiddenPromptFragments) {
      expect(prompt).not.toContain(fragment);
    }
    expect(prompt).toContain("Agent reviews");
    expect(prompt).toContain("variant_1");
  });
});

describe("evidence-mode behavior prompts", () => {
  it("tells agents to ground click and convert probabilities on dataset action rates", () => {
    const prompt = agentPrompt(swarmAgents.find((agent) => agent.name === "Reward-Seeking User")!, evidencePack());

    expect(prompt).toContain("impression-level action rates");
    expect(prompt).toContain("median click/view is about 0.5%");
    expect(prompt).toContain("A 0.10 click probability means 10,000 clicks per 100,000 views");
    expect(prompt).toContain("Reward-Seeking User may raise inspect and slightly raise click");
  });
});

function evidencePack(): EvidencePack {
  return {
    variantId: "creative_a",
    variantLabel: "Variant 1",
    campaignContext: brief,
    creative: {
      id: "creative_a",
      source: "dataset",
      assetUrl: "/api/assets/creative_a",
      assetType: "static_image",
      category: "gaming",
      language: "en",
      format: "interstitial",
      durationSec: 0,
      createdAt: "2026-04-25T00:00:00.000Z",
      features: {
        ocrText: "Level up today Claim reward",
        ctaText: "Claim reward",
        headline: "Level up today",
        subhead: "",
        dominantColors: ["blue"],
        facesCount: 0,
        productCount: 1,
        hasLogo: true,
        hasPerson: false,
        hasPrice: false,
        hasReward: true,
        hasGameplay: true,
        hasUgcStyle: false,
      },
      metricsSummary: {
        impressions: 100000,
        clicks: 500,
        conversions: 40,
        spendUsd: 0,
        revenueUsd: 0,
        ctr: 0.005,
        cvr: 0.08,
      },
    },
    benchmark: {
      contextLabel: "gaming / global",
      sampleSize: 100,
      avgCtr: 0.005,
      avgCvr: 0.09,
      avgPerfScore: 0.5,
      avgCtrDecayPct: -0.2,
      highPerformerCount: 10,
      fatiguedCount: 5,
      underperformerCount: 10,
      stableCount: 75,
      topPerformerRate: 0.1,
      underperformerRate: 0.1,
      fatiguedRate: 0.05,
      stableRate: 0.75,
    },
    similarCreatives: [],
    behaviorPrior: {
      source: "target_history",
      datasetSentiment: "neutral",
      probabilityHints: { skip: 0.52, ignore: 0.29, inspect: 0.164, click: 0.0054, convert: 0.00057, exit: 0.02003 },
      drivers: ["Action-rate anchor: click/view 0.50%, conversion/view 0.04%."],
    },
    facts: ["Dataset action-rate scale: benchmark click/view 0.50%, benchmark conversion/view 0.045%."],
    warnings: [],
  };
}
