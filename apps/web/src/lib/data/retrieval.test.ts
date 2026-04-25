import { describe, expect, it } from "vitest";
import { buildEvidencePack, getSimilarCreatives } from "@/lib/data/retrieval";
import { loadCreatives } from "@/lib/data/csv";

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
  });
});
