import { analyzeExperimentWithSwarm } from "@/lib/analysis/swarm";
import { getExperiment, saveExperiment } from "@/lib/data/repository";

export const maxDuration = 300;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const experiment = await getExperiment(id);

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
