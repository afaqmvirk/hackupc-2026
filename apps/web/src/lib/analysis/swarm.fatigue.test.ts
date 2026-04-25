import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreativeDoc, EvidencePack } from "@/lib/schemas";

const mocks = vi.hoisted(() => ({
  buildEvidencePack: vi.fn(),
  generateJson: vi.fn(),
  getDatasetCreatives: vi.fn(),
}));
type MetricsInput = Partial<NonNullable<CreativeDoc["metricsSummary"]>>;

vi.mock("@/lib/data/retrieval", () => ({
  buildEvidencePack: mocks.buildEvidencePack,
}));

vi.mock("@/lib/data/repository", () => ({
  getDatasetCreatives: mocks.getDatasetCreatives,
}));

vi.mock("@/lib/analysis/gemini", () => ({
  generateJson: mocks.generateJson,
}));

describe("evidence-mode fatigue orchestration", () => {
  beforeEach(() => {
    mocks.buildEvidencePack.mockReset();
    mocks.generateJson.mockReset();
    mocks.getDatasetCreatives.mockReset();

    const datasetVariant = creative("creative_a", "dataset", {
      creativeStatus: "fatigued",
      ctrDecayPct: -0.72,
      cvrDecayPct: -0.31,
      fatigueDay: 11,
      perfScore: 0.58,
    });
    const uploadVariant = creative("upload_b", "upload");
    const similar = creative("similar_1", "dataset", {
      creativeStatus: "stable",
      ctrDecayPct: -0.54,
      cvrDecayPct: -0.2,
      fatigueDay: 14,
      perfScore: 0.72,
    });

    mocks.buildEvidencePack.mockImplementation((variant: CreativeDoc) => {
      if (variant.id === uploadVariant.id) {
        return Promise.resolve(evidencePack(uploadVariant, [{ id: similar.id, similarity: 0.9 }]));
      }
      return Promise.resolve(evidencePack(datasetVariant));
    });
    mocks.getDatasetCreatives.mockResolvedValue([datasetVariant, similar]);
    mocks.generateJson.mockImplementation(({ prompt }: { prompt: string }) => {
      if (prompt.includes("Evidence packs:")) {
        return Promise.resolve({
          winner: "creative_a",
          executiveSummary: "Dataset creative is the stronger evidence-mode candidate.",
          ranking: [rankingItem("creative_a", 1), rankingItem("upload_b", 2)],
          champion: "Variant A",
          whyItWins: ["Stronger evidence"],
          risks: ["Watch fatigue"],
          whatToDoNext: ["Run a controlled test"],
          abTestPlan: {
            primaryMetric: "CVR",
            secondaryMetric: "CTR",
            control: "creative_a",
            challenger: "upload_b",
            trafficSplit: "50/50",
            hypothesis: "Clearer evidence improves confidence.",
            stopCondition: "Stop after minimum spend.",
            actionIfWinner: "Scale",
            actionIfLoser: "Edit",
          },
        });
      }

      const variantId = prompt.match(/"variantId": "([^"]+)"/)?.[1] ?? "creative_a";
      const agentName = prompt.match(/Agent: (.+)/)?.[1] ?? "Performance Analyst";
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
          primaryState: "inspect",
          probabilities: { skip: 0.35, ignore: 0.25, inspect: 0.35, click: 0.004, convert: 0.001, exit: 0.045 },
          confidence: "medium",
          rationale: "Evidence-mode simulated behavior.",
        },
        topPositive: "Clear enough.",
        topConcern: "Some fatigue risk.",
        suggestedEdit: "Refresh copy if decay appears.",
        reasoning: "Grounded in evidence.",
        evidenceRefs: ["benchmark"],
      });
    });
  });

  it("attaches one fatigue profile per variant in evidence mode", async () => {
    const { analyzeExperimentWithSwarm } = await import("@/lib/analysis/swarm");
    const events: Array<{ type: string; message?: string }> = [];
    const result = await analyzeExperimentWithSwarm({
      analysisInputMode: "evidence",
      projectedViews: 1000,
      brief: {
        category: "gaming",
        region: "global",
        language: "any",
        os: "any",
        objective: "installs",
        audienceStyle: "casual mobile users",
      },
      variants: [
        creative("creative_a", "dataset", {
          creativeStatus: "fatigued",
          ctrDecayPct: -0.72,
          cvrDecayPct: -0.31,
          fatigueDay: 11,
          perfScore: 0.58,
        }),
        creative("upload_b", "upload"),
      ],
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(result.report.fatigueProfiles).toHaveLength(2);
    expect(result.report.fatigueProfiles.map((profile) => profile.creativeId)).toEqual(["creative_a", "upload_b"]);
    expect(result.report.fatigueProfiles[0].dataSource).toBe("historical");
    expect(result.report.fatigueProfiles[1].dataSource).toBe("similarity-predicted");
    expect(events.some((event) => event.message === "Computing fatigue forecasts from historical decay signals.")).toBe(true);
  });
});

function creative(
  id: string,
  source: CreativeDoc["source"],
  metricsSummary?: MetricsInput,
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
    },
    metricsSummary: metricsSummary as CreativeDoc["metricsSummary"],
  } as CreativeDoc;
}

function evidencePack(
  creativeDoc: CreativeDoc,
  similarCreatives: Array<{ id: string; similarity: number }> = [],
): EvidencePack {
  return {
    variantId: creativeDoc.id,
    variantLabel: creativeDoc.id,
    campaignContext: {
      category: "gaming",
      region: "global",
      language: "en",
      os: "any",
      objective: "installs",
      audienceStyle: "casual mobile users",
    },
    creative: creativeDoc,
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
      source: creativeDoc.source === "dataset" ? "target_history" : "similar_creatives",
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

function rankingItem(variantId: string, rank: number) {
  return {
    variantId,
    rank,
    score: rank === 1 ? 72 : 52,
    predictedOutcome: rank === 1 ? "Likely stronger." : "Likely weaker.",
    creativeHealth: rank === 1 ? 74 : 55,
    swarmConfidence: "medium",
    action: "test",
    dominantBehaviorState: "inspect",
    behaviorProbabilities: { skip: 0.35, ignore: 0.25, inspect: 0.35, click: 0.004, convert: 0.001, exit: 0.045 },
    behaviorSummary: "Evidence-mode simulated behavior.",
    topReasons: ["Visible action"],
    risks: ["Fatigue risk"],
    recommendedEdits: ["Refresh copy"],
  };
}
