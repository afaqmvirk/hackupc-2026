import sharp from "sharp";
import { buildUploadedEmbedding } from "@/lib/data/embedding";
import { generateJson } from "@/lib/analysis/gemini";
import { visionFeaturesJsonSchema } from "@/lib/analysis/json-schemas";
import { visionPrompt } from "@/lib/analysis/prompts";
import { creativeFeaturesSchema, type CampaignBrief, type CreativeFeatures } from "@/lib/schemas";

export async function extractUploadedFeatures({
  buffer,
  mimeType,
  brief,
}: {
  buffer: Buffer;
  mimeType: string;
  brief: CampaignBrief;
}): Promise<CreativeFeatures> {
  const metadata = await sharp(buffer).metadata();
  const localStats = await extractLocalStats(buffer);

  const vision = await generateJson({
    prompt: visionPrompt(`${brief.category} / ${brief.region} / ${brief.language} / ${brief.os} / ${brief.objective}`),
    schema: visionFeaturesJsonSchema,
    validator: creativeFeaturesSchema.omit({ embedding: true, aspectRatio: true, width: true, height: true }).passthrough(),
    image: {
      base64: buffer.toString("base64"),
      mimeType,
    },
    temperature: 0.2,
  });

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const features: CreativeFeatures = {
    ...vision,
    dominantColors: vision.dominantColors.length ? vision.dominantColors : localStats.dominantColors,
    width,
    height,
    aspectRatio: width && height ? `${width}:${height}` : undefined,
  };

  features.embedding = buildUploadedEmbedding(features, `${brief.category} ${brief.region} ${brief.language} ${brief.os} ${brief.objective}`);
  return creativeFeaturesSchema.parse(features);
}

async function extractLocalStats(buffer: Buffer) {
  const stats = await sharp(buffer).resize(64, 64, { fit: "inside" }).stats();
  const channels = stats.channels.slice(0, 3).map((channel) => Math.round(channel.mean));

  return {
    dominantColors: [rgbToName(channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0)],
  };
}

function rgbToName(red: number, green: number, blue: number) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  if (max - min < 24) {
    if (max < 80) return "black";
    if (max > 200) return "white";
    return "gray";
  }
  if (red === max && green > 130) return "orange";
  if (red === max) return "red";
  if (green === max) return "green";
  if (blue === max && red > 120) return "purple";
  if (blue === max) return "blue";
  return "mixed";
}
