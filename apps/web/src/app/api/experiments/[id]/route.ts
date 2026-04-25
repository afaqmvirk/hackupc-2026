import { getExperiment } from "@/lib/data/repository";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const experiment = await getExperiment(id);

  if (!experiment) {
    return Response.json({ error: "Experiment not found." }, { status: 404 });
  }

  return Response.json({ experiment });
}
