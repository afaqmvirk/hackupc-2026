import { analyzeExperimentWithSwarm } from "@/lib/analysis/swarm";
import { getExperiment, saveExperiment } from "@/lib/data/repository";
import { experimentSchema } from "@/lib/schemas";
import { z } from "zod";

export const maxDuration = 300;

const analyzeRequestSchema = z.object({
  experiment: experimentSchema.optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let experiment = await getExperiment(id);

  if (!experiment) {
    const body = await request
      .json()
      .then((payload) => analyzeRequestSchema.parse(payload))
      .catch(() => ({ experiment: undefined }));

    if (body.experiment?.id === id) {
      experiment = body.experiment;
    }
  }

  if (!experiment) {
    return Response.json({ error: "Experiment not found." }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        await saveExperiment({ ...experiment, status: "analyzing" });
        const result = await analyzeExperimentWithSwarm({
          brief: experiment.brief,
          analysisInputMode: experiment.analysisInputMode ?? "evidence",
          variants: experiment.variants,
          onEvent: send,
        });

        const complete = {
          ...experiment,
          status: "complete" as const,
          report: result.report,
          agentReviews: result.reviews,
        };
        await saveExperiment(complete);
      } catch (error) {
        await saveExperiment({ ...experiment, status: "failed" });
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Analysis failed.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}
