import { config } from "@/lib/config";
import { agentReviewJsonSchema, finalReportJsonSchema } from "@/lib/analysis/json-schemas";
import { generateJson } from "@/lib/analysis/gemini";
import { agentPrompt, aggregatorPrompt, swarmAgents } from "@/lib/analysis/prompts";
import { buildEvidencePack } from "@/lib/data/retrieval";
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

  await onEvent?.({ type: "report", report });

  return {
    evidencePacks,
    reviews,
    report,
  };
}
