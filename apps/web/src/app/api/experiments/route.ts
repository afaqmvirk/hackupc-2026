import { createExperiment, getCreativeById } from "@/lib/data/repository";
import { campaignBriefSchema, creativeDocSchema, type CreativeDoc } from "@/lib/schemas";
import { z } from "zod";

const createExperimentSchema = z.object({
  brief: campaignBriefSchema,
  creativeIds: z.array(z.string()).default([]),
  uploadedCreatives: z.array(creativeDocSchema).default([]),
});

export async function POST(request: Request) {
  const body = createExperimentSchema.parse(await request.json());
  const selected = await Promise.all(body.creativeIds.map((id) => getCreativeById(id)));
  const variants = [...selected.filter((creative): creative is CreativeDoc => Boolean(creative)), ...body.uploadedCreatives];

  if (variants.length < 2 || variants.length > 6) {
    return Response.json({ error: "Select or upload 2-6 variants." }, { status: 400 });
  }

  const experiment = await createExperiment({
    brief: body.brief,
    variants,
  });

  return Response.json({ experiment });
}
