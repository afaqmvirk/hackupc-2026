import fs from "node:fs/promises";
import { datasetAssetPath } from "@/lib/data/csv";

export async function GET(_request: Request, context: { params: Promise<{ creativeId: string }> }) {
  const { creativeId } = await context.params;
  const assetPath = datasetAssetPath(creativeId);

  if (!assetPath) {
    return Response.json({ error: "Creative asset not found." }, { status: 404 });
  }

  const file = await fs.readFile(assetPath);
  return new Response(file, {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400",
    },
  });
}
