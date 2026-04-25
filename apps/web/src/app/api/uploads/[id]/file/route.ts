import fs from "node:fs/promises";
import path from "node:path";
import { uploadsDir } from "@/lib/paths";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const directory = uploadsDir();
  const candidates = ["png", "jpg", "webp", "jpeg"].map((extension) =>
    path.join(/* turbopackIgnore: true */ directory, `${id}.${extension}`),
  );

  for (const candidate of candidates) {
    try {
      const file = await fs.readFile(candidate);
      return new Response(file, {
        headers: {
          "content-type": contentType(candidate),
          "cache-control": "public, max-age=86400",
        },
      });
    } catch {
      // Try next candidate extension.
    }
  }

  return Response.json({ error: "Uploaded file not found." }, { status: 404 });
}

function contentType(filePath: string) {
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}
