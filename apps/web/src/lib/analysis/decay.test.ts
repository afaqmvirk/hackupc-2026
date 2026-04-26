import { afterEach, describe, expect, it, vi } from "vitest";
import { simulateDecay } from "@/lib/analysis/decay";
import { simulatedDecayCurveSchema, type CreativeDoc } from "@/lib/schemas";

describe("decay simulation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to local 14-day curve when the CV service is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const curve = await simulateDecay(creative());

    expect(curve.variantId).toBe("creative_a");
    expect(curve.ctrCurve).toHaveLength(14);
    expect(curve.cvrCurve).toHaveLength(14);
    expect(curve.bandLow).toHaveLength(14);
    expect(curve.bandHigh).toHaveLength(14);
    expect(curve.fatiguePredictionDay).toBeGreaterThanOrEqual(1);
    expect(curve.fatiguePredictionDay).toBeLessThanOrEqual(14);
    expect(() => simulatedDecayCurveSchema.parse(curve)).not.toThrow();
  });

  it("uses a valid CV service response when available", async () => {
    const remoteCurve = {
      variantId: "creative_a",
      ctrCurve: Array.from({ length: 14 }, () => 0.01),
      cvrCurve: Array.from({ length: 14 }, () => 0.03),
      bandLow: Array.from({ length: 14 }, () => 0.008),
      bandHigh: Array.from({ length: 14 }, () => 0.012),
      fatiguePredictionDay: 7,
      fatigueConfidence: "high",
      modelParams: {
        weibullShape: 1.4,
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(remoteCurve),
      }),
    );

    const curve = await simulateDecay(creative());

    expect(curve.fatiguePredictionDay).toBe(7);
    expect(curve.fatigueConfidence).toBe("high");
  });
});

function creative(): CreativeDoc {
  return {
    id: "creative_a",
    source: "upload",
    assetUrl: "/creative.png",
    assetType: "uploaded_image",
    category: "gaming",
    language: "en",
    format: "static_image",
    durationSec: 0,
    createdAt: "2026-04-25T00:00:00.000Z",
    features: {
      textDensity: 0.4,
      visualClutter: 0.45,
      noveltyScore: 0.55,
    },
    metricsSummary: {
      ctr: 0.006,
      cvr: 0.08,
      fatigueDay: 11,
    },
  } as CreativeDoc;
}
