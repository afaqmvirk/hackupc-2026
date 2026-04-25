import { config } from "@/lib/config";
import { agentReviewJsonSchema, finalReportJsonSchema } from "@/lib/analysis/json-schemas";
import { generateJson } from "@/lib/analysis/gemini";
import { agentPrompt, aggregatorPrompt, swarmAgents } from "@/lib/analysis/prompts";
import { computeFatigueProfile } from "@/lib/analysis/fatigue";
import { buildEvidencePack } from "@/lib/data/retrieval";
import { getDatasetCreatives } from "@/lib/data/repository";
import {
  agentReviewSchema,
  finalReportSchema,
  type AgentReview,
  type CampaignBrief,
  type CreativeDoc,
  type EvidencePack,
  type FinalReport,
} from "@/lib/schemas";

export type SwarmEvent =
  | { type: "status"; message: string }
  | { type: "evidence"; pack: EvidencePack }
  | { type: "agent"; review: AgentReview }
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

  onEvent?.({ type: "status", message: "Building evidence packs from creative metadata, benchmarks, and similar ads." });

  for (let index = 0; index < variants.length; index += 1) {
    const pack = await buildEvidencePack(variants[index], brief, index);
    evidencePacks.push(pack);
    await onEvent?.({ type: "evidence", pack });
  }

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

  onEvent?.({ type: "status", message: "Aggregator is ranking variants and writing the A/B test plan." });

  const report = await generateJson({
    model: config.aggregatorModel,
    prompt: aggregatorPrompt(evidencePacks, reviews),
    schema: finalReportJsonSchema,
    validator: finalReportSchema,
    temperature: 0.25,
  });

  // Compute deterministic fatigue profiles from dataset signals + visual features.
  // This runs after Gemini so it never blocks the LLM pipeline.
  onEvent?.({ type: "status", message: "Computing fatigue forecasts from historical decay signals." });

  const dataset = await getDatasetCreatives();
  const datasetLookup = new Map(dataset.map((c) => [c.id, c]));

  const fatigueProfiles = variants.map((variant, index) =>
    computeFatigueProfile(variant, evidencePacks[index], datasetLookup),
  );

  const enrichedReport: FinalReport = { ...report, fatigueProfiles };

  await onEvent?.({ type: "report", report: enrichedReport });

  return {
    evidencePacks,
    reviews,
    report: enrichedReport,
  };
}
