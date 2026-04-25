import { describe, expect, it } from "vitest";
import { imageOnlyAgentPrompt, imageOnlyAggregatorPrompt, swarmAgents } from "@/lib/analysis/prompts";

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
