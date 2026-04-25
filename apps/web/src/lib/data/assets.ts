import fs from "node:fs/promises";
import path from "node:path";
import { datasetAssetPath } from "@/lib/data/csv";
import { uploadsDir } from "@/lib/paths";
import type { CreativeDoc } from "@/lib/schemas";

export type GeminiImageInput = {
  base64: string;
  mimeType: string;
};

export async function loadCreativeImage(creative: CreativeDoc): Promise<GeminiImageInput> {
  if (creative.source === "dataset") {
    const assetPath = datasetAssetPath(creative.id);
    if (!assetPath) {
      throw new Error(`Dataset image not found for creative ${creative.id}.`);
    }

    const buffer = await fs.readFile(assetPath);
    return {
      base64: buffer.toString("base64"),
      mimeType: "image/png",
    };
  }

  const uploadPath = await findUploadedAssetPath(creative.id);
  const buffer = await fs.readFile(uploadPath);
  return {
    base64: buffer.toString("base64"),
    mimeType: mimeTypeForPath(uploadPath),
  };
}

async function findUploadedAssetPath(id: string) {
  const candidates = ["png", "jpg", "jpeg", "webp"].map((extension) =>
    path.join(/* turbopackIgnore: true */ uploadsDir(), `${id}.${extension}`),
  );

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next extension.
    }
  }

  throw new Error(`Uploaded image not found for creative ${id}.`);
}

function mimeTypeForPath(filePath: string) {
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}
