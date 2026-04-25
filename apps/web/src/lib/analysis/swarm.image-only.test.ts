import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreativeDoc } from "@/lib/schemas";

const mocks = vi.hoisted(() => ({
  buildEvidencePack: vi.fn(),
  loadCreativeImage: vi.fn(),
  generateJson: vi.fn(),
}));

vi.mock("@/lib/data/retrieval", () => ({
  buildEvidencePack: mocks.buildEvidencePack,
}));

vi.mock("@/lib/data/assets", () => ({
  loadCreativeImage: mocks.loadCreativeImage,
}));

vi.mock("@/lib/analysis/gemini", () => ({
  generateJson: mocks.generateJson,
}));

describe("image-only swarm orchestration", () => {
  beforeEach(() => {
    mocks.buildEvidencePack.mockReset();
    mocks.loadCreativeImage.mockReset();
    mocks.generateJson.mockReset();

    mocks.buildEvidencePack.mockImplementation(() => {
      throw new Error("buildEvidencePack must not be called in image-only mode.");
    });
    mocks.loadCreativeImage.mockResolvedValue({ base64: "ZmFrZQ==", mimeType: "image/png" });
    mocks.generateJson.mockImplementation(({ prompt }: { prompt: string }) => {
      if (prompt.includes("Agent reviews:")) {
        return Promise.resolve({
          winner: "variant_1",
          executiveSummary: "Variant 1 is the strongest visual pre-test candidate.",
          ranking: [
            rankingItem("variant_1", 1, "click"),
            rankingItem("variant_2", 2, "skip"),
          ],
          champion: "Variant 1",
          whyItWins: ["Clearer visible CTA"],
          risks: ["No campaign history was used"],
          whatToDoNext: ["Run a controlled pre-test"],
          abTestPlan: {
            primaryMetric: "CVR",
            secondaryMetric: "CTR",
            control: "variant_1",
            challenger: "variant_2",
            trafficSplit: "50/50",
            hypothesis: "Clearer visual action improves response.",
            stopCondition: "Stop after minimum spend.",
            actionIfWinner: "Scale",
            actionIfLoser: "Edit",
          },
        });
      }

      const variantId = prompt.match(/Variant ID: (variant_\d+)/)?.[1] ?? "variant_1";
      const agentName = prompt.match(/Agent: (.+)/)?.[1] ?? "Agent";
      return Promise.resolve({
        agentName,
        agentType: prompt.includes("Agent type: persona") ? "persona" : "specialist",
        variantId,
        attention: 7,
        clarity: 7,
        trust: 6,
        conversionIntent: 6,
        fatigueRisk: "medium",
        recommendation: "test",
        behavior: {
          primaryState: variantId === "variant_1" ? "click" : "skip",
          probabilities:
            variantId === "variant_1"
              ? { skip: 0.1, ignore: 0.15, inspect: 0.2, click: 0.35, convert: 0.15, exit: 0.05 }
              : { skip: 0.35, ignore: 0.2, inspect: 0.2, click: 0.1, convert: 0.05, exit: 0.1 },
          confidence: "medium",
          rationale: "This is based only on the attached image.",
        },
        topPositive: "Clear visible message.",
        topConcern: "No historical context used.",
        suggestedEdit: "Make the action clearer.",
        reasoning: "Image-only reasoning.",
        evidenceRefs: [],
      });
    });
  });

  it("does not build evidence packs and remaps public variant IDs back to app IDs", async () => {
    const { analyzeExperimentWithSwarm } = await import("@/lib/analysis/swarm");
    const events: Array<{ type: string }> = [];
    const result = await analyzeExperimentWithSwarm({
      analysisInputMode: "image_only",
      projectedViews: 1000,
      brief: {
        category: "gaming",
        region: "global",
        language: "any",
        os: "any",
        objective: "installs",
        audienceStyle: "casual mobile users",
      },
      variants: [creative("creative_a"), creative("creative_b")],
      onEvent: (event) => {
        events.push(event);
      },
    });

    const prompts = mocks.generateJson.mock.calls.map(([input]) => input.prompt).join("\n\n");
    expect(mocks.buildEvidencePack).not.toHaveBeenCalled();
    expect(mocks.loadCreativeImage).toHaveBeenCalledTimes(2);
    expect(events.some((event) => event.type === "evidence")).toBe(false);
    expect(prompts).toContain("variant_1");
    expect(prompts).not.toContain("creative_a");
    expect(prompts).not.toContain("creative_b");
    expect(prompts).not.toContain("Evidence pack");
    expect(prompts).not.toContain("behaviorPrior");
    expect(prompts).not.toContain("similarCreatives");
    expect(result.evidencePacks).toEqual([]);
    expect(result.reviews.every((review) => review.variantId === "creative_a" || review.variantId === "creative_b")).toBe(true);
    expect(result.report.winner).toBe("creative_a");
    expect(result.report.ranking.map((item) => item.variantId)).toEqual(["creative_a", "creative_b"]);
    expect(result.report.abTestPlan.control).toBe("creative_a");
    expect(result.report.abTestPlan.challenger).toBe("creative_b");
    expect(result.report.personaActionForecast.map((forecast) => forecast.variantId)).toEqual(["creative_a", "creative_b"]);
    expect(result.report.personaActionForecast[0].projectedViews).toBe(1000);
    expect(result.report.personaActionForecast[0].totals.click).toBeLessThan(20);
    expect(result.report.personaActionForecast[0].totals.convert).toBeLessThan(5);
    expect(result.report.personaActionForecast[1].totals.skip).toBeGreaterThan(300);
  });
});

function creative(id: string): CreativeDoc {
  return {
    id,
    source: "upload",
    assetUrl: `/${id}.png`,
    assetType: "uploaded_image",
    category: "gaming",
    language: "any",
    format: "uploaded_image",
    durationSec: 0,
    createdAt: "2026-04-25T00:00:00.000Z",
    features: {},
  } as CreativeDoc;
}

function rankingItem(variantId: string, rank: number, dominantBehaviorState: "click" | "skip") {
  return {
    variantId,
    rank,
    score: rank === 1 ? 72 : 48,
    predictedOutcome: rank === 1 ? "Likely stronger visual response." : "Likely weaker visual response.",
    creativeHealth: rank === 1 ? 74 : 50,
    swarmConfidence: "medium",
    action: rank === 1 ? "test" : "edit",
    dominantBehaviorState,
    behaviorProbabilities:
      dominantBehaviorState === "click"
        ? { skip: 0.1, ignore: 0.15, inspect: 0.2, click: 0.35, convert: 0.15, exit: 0.05 }
        : { skip: 0.35, ignore: 0.2, inspect: 0.2, click: 0.1, convert: 0.05, exit: 0.1 },
    behaviorSummary: "Image-only simulated behavior.",
    topReasons: ["Visible action"],
    risks: ["No history used"],
    recommendedEdits: ["Clarify the CTA"],
  };
}
