import { config } from "@/lib/config";
import { agentReviewJsonSchema, finalReportJsonSchema } from "@/lib/analysis/json-schemas";
import { generateJson } from "@/lib/analysis/gemini";
import { agentPrompt, aggregatorPrompt, swarmAgents } from "@/lib/analysis/prompts";
import { buildEvidencePack } from "@/lib/data/retrieval";
import { simulateDecay } from "@/lib/analysis/decay";
import {
  agentReviewSchema,
  finalReportSchema,
  type AgentReview,
  type CampaignBrief,
  type CreativeDoc,
  type EvidencePack,
  type FinalReport,
  type SimulatedDecayCurve,
} from "@/lib/schemas";

export type SwarmEvent =
  | { type: "status"; message: string }
  | { type: "evidence"; pack: EvidencePack }
  | { type: "agent"; review: AgentReview }
  | { type: "decay"; curves: SimulatedDecayCurve[] }
  | { type: "report"; report: FinalReport };

export async function analyzeExperimentWithSwarm({
  brief,
  variants,
  onEvent,
}: {
  brief: CampaignBrief;
  variants: CreativeDoc[];
  onEvent?: (event: SwarmEvent) => void | Promise<void>;
}) {
  const evidencePacks: EvidencePack[] = [];
  const reviews: AgentReview[] = [];
  const decayCurves: SimulatedDecayCurve[] = [];

  onEvent?.({ type: "status", message: "Building evidence packs and running stochastic decay simulations." });

  for (let index = 0; index < variants.length; index += 1) {
    // Run RAG evidence build and Python decay simulation in parallel per variant
    const [pack, curve] = await Promise.all([
      buildEvidencePack(variants[index], brief, index),
      simulateDecay(variants[index]),
    ]);

    const enrichedPack: EvidencePack = { ...pack, decayCurve: curve };
    decayCurves.push(curve);

    evidencePacks.push(enrichedPack);
    await onEvent?.({ type: "evidence", pack: enrichedPack });
  }

  onEvent?.({
    type: "status",
    message: `Decay simulation complete. Earliest raw fatigue predicted on Day ${Math.min(...decayCurves.map((c) => c.fatiguePredictionDay))}.`,
  });

  onEvent?.({ type: "status", message: "Gemini swarm agents are reviewing each variant." });

  for (const pack of evidencePacks) {
    for (const agent of swarmAgents) {
      const review = await generateJson({
        model: config.swarmModel,
        prompt: agentPrompt(agent, pack),
        schema: agentReviewJsonSchema,
        validator: agentReviewSchema,
      });
      reviews.push(review);
      await onEvent?.({ type: "agent", review });
    }
  }

  // Marketer Multiplier: scale the raw simulation by the Performance Marketer's
  // conversionIntent (0.0–1.0). A blank sky (no CTA, no product) gets ~0.0 and
  // collapses the projected attention curve to near-zero, defeating the "sky
  // loophole" where qualitative-only agents would otherwise rate clarity highly.
  // Defaults to 1.0 if the marketer review is missing for any reason.
  const multipliedCurves: SimulatedDecayCurve[] = decayCurves.map((curve) => {
    const marketerReview = reviews.find(
      (r) => r.variantId === curve.variantId && r.agentName === "Performance Marketer",
    );
    const intent = marketerReview?.conversionIntent ?? 1.0;
    return {
      ...curve,
      ctrCurve: curve.ctrCurve.map((v) => v * intent),
      cvrCurve: curve.cvrCurve.map((v) => v * intent),
      bandLow: curve.bandLow.map((v) => v * intent),
      bandHigh: curve.bandHigh.map((v) => v * intent),
    };
  });

  await onEvent?.({ type: "decay", curves: multipliedCurves });

  onEvent?.({ type: "status", message: "Aggregator is ranking variants and writing the A/B test plan." });

  const rawReport = await generateJson({
    model: config.aggregatorModel,
    prompt: aggregatorPrompt(evidencePacks, reviews),
    schema: finalReportJsonSchema,
    validator: finalReportSchema,
    temperature: 0.25,
  });

  // Deterministically merge Python-computed fatiguePredictionDay into ranking.
  // We never ask Gemini to re-derive numeric simulation outputs.
  const report: FinalReport = {
    ...rawReport,
    ranking: rawReport.ranking.map((item) => {
      const curve = decayCurves.find((c) => c.variantId === item.variantId);
      return curve ? { ...item, fatiguePredictionDay: curve.fatiguePredictionDay } : item;
    }),
  };

  await onEvent?.({ type: "report", report });

  return { evidencePacks, reviews, report, decayCurves: multipliedCurves };
}
