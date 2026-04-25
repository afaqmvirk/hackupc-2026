import { describe, expect, it } from "vitest";
import { buildBehaviorPrior, buildEvidencePack, getBenchmark, getSimilarCreatives } from "@/lib/data/retrieval";
import { loadCreatives } from "@/lib/data/csv";
import type { CreativeDoc } from "@/lib/schemas";

const brief = {
  category: "gaming",
  region: "global",
  language: "any",
  os: "any",
  objective: "installs",
  audienceStyle: "casual mobile users",
};

describe("retrieval", () => {
  it("returns similar creatives for a dataset variant", async () => {
    const creative = loadCreatives()[0];
    const similar = await getSimilarCreatives(creative, brief, 5);

    expect(similar.length).toBeGreaterThan(0);
    expect(similar[0].id).not.toBe(creative.id);
  });

  it("builds evidence packs with benchmark facts", async () => {
    const creative = loadCreatives()[0];
    const pack = await buildEvidencePack(creative, brief, 0);

    expect(pack.facts.length).toBeGreaterThan(3);
    expect(pack.benchmark.sampleSize).toBeGreaterThan(0);
    expect(pack.similarCreatives.length).toBeGreaterThan(0);
    expect(pack.behaviorPrior.drivers.length).toBeGreaterThan(0);
    expect(Object.values(pack.behaviorPrior.probabilityHints).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 3);
  });

  it("uses similar or benchmark behavior priors for uploaded creatives", async () => {
    const datasetCreative = loadCreatives()[0];
    const upload: CreativeDoc = {
      ...datasetCreative,
      id: "upload_test",
      source: "upload",
      metricsSummary: undefined,
    };

    const pack = await buildEvidencePack(upload, brief, 0);

    expect(pack.behaviorPrior.source).not.toBe("target_history");
    expect(["similar_creatives", "benchmark"]).toContain(pack.behaviorPrior.source);
  });

  it("aligns behavior priors with dataset sentiment", async () => {
    const creatives = loadCreatives();
    const benchmark = await getBenchmark(brief, []);
    const topPerformer = creatives.find(
      (creative) => creative.metricsSummary?.creativeStatus === "top_performer" && (creative.metricsSummary.ctrDecayPct ?? 0) > -0.82,
    );
    const underperformer = creatives.find((creative) => creative.metricsSummary?.creativeStatus === "underperformer");
    const fatigued = creatives.find((creative) => creative.metricsSummary?.creativeStatus === "fatigued");

    expect(topPerformer).toBeTruthy();
    expect(underperformer).toBeTruthy();
    expect(fatigued).toBeTruthy();

    const topPrior = buildBehaviorPrior(topPerformer!, [], benchmark);
    const underPrior = buildBehaviorPrior(underperformer!, [], benchmark);
    const fatiguedPrior = buildBehaviorPrior(fatigued!, [], benchmark);

    expect(topPrior.probabilityHints.click).toBeGreaterThan(underPrior.probabilityHints.click);
    expect(topPrior.probabilityHints.convert).toBeGreaterThan(underPrior.probabilityHints.convert);
    expect(topPrior.probabilityHints.click).toBeLessThan(0.03);
    expect(topPrior.probabilityHints.convert).toBeLessThan(0.007);
    expect(underPrior.probabilityHints.skip + underPrior.probabilityHints.ignore + underPrior.probabilityHints.exit).toBeGreaterThan(
      underPrior.probabilityHints.click + underPrior.probabilityHints.convert,
    );
    expect(fatiguedPrior.probabilityHints.skip + fatiguedPrior.probabilityHints.exit).toBeGreaterThan(
      fatiguedPrior.probabilityHints.click + fatiguedPrior.probabilityHints.convert,
    );
  });
});
