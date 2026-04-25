import { config } from "@/lib/config";
import { copilotAnswerJsonSchema } from "@/lib/analysis/json-schemas";
import { generateJson } from "@/lib/analysis/gemini";
import { campaignBriefSchema, copilotAnswerSchema, finalReportSchema, creativeDocSchema } from "@/lib/schemas";
import { z } from "zod";

const copilotRequestSchema = z.object({
  question: z.string().min(1),
  brief: campaignBriefSchema,
  report: finalReportSchema,
  creatives: z.array(creativeDocSchema),
});

export async function POST(request: Request) {
  const body = copilotRequestSchema.parse(await request.json());
  const answer = await generateJson({
    model: config.swarmModel,
    schema: copilotAnswerJsonSchema,
    validator: copilotAnswerSchema,
    prompt: [
      "You are the Creative Swarm Copilot answering a marketer's follow-up question.",
      "Use only the provided report and creative metadata. Do not invent unseen KPI values.",
      "Keep the answer concise and action-oriented.",
      "",
      `Question: ${body.question}`,
      `Campaign brief: ${JSON.stringify(body.brief, null, 2)}`,
      `Creatives: ${JSON.stringify(body.creatives, null, 2)}`,
      `Report: ${JSON.stringify(body.report, null, 2)}`,
    ].join("\n"),
  });

  return Response.json({ answer });
}
