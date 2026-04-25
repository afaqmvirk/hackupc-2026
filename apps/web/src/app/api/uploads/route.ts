import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { uploadsDir } from "@/lib/paths";
import { extractUploadedFeatures } from "@/lib/analysis/vision";
import { saveUploadedCreative } from "@/lib/data/repository";
import { campaignBriefSchema, type CreativeDoc } from "@/lib/schemas";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const briefRaw = form.get("brief");

  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file." }, { status: 400 });
  }

  const brief = campaignBriefSchema.parse(JSON.parse(String(briefRaw ?? "{}")));
  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "V1 accepts image uploads and screenshots only." }, { status: 400 });
  }

  const id = `upload_${nanoid(8)}`;
  const extension = extensionForMime(file.type);
  const directory = uploadsDir();
  await fs.mkdir(directory, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const diskPath = path.join(directory, `${id}.${extension}`);
  await fs.writeFile(diskPath, buffer);

  const features = await extractUploadedFeatures({ buffer, mimeType: file.type, brief });
  const creative: CreativeDoc = {
    id,
    source: "upload",
    label: file.name.replace(/\.[^.]+$/, ""),
    assetUrl: `/api/uploads/${id}/file`,
    thumbnailUrl: `/api/uploads/${id}/file`,
    assetType: "uploaded_image",
    category: brief.category,
    country: brief.region,
    language: brief.language,
    os: brief.os,
    format: "uploaded_image",
    durationSec: 0,
    createdAt: new Date().toISOString(),
    features,
  };

  await saveUploadedCreative(creative);
  return Response.json({ creative });
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  return "jpg";
}
