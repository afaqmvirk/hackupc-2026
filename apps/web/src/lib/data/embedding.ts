import type { CreativeDoc, CreativeFeatures } from "@/lib/schemas";

const DIMENSIONS = 64;

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalize(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) {
    return vector;
  }
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

export function buildEmbeddingFromFields(fields: Array<string | number | boolean | null | undefined>) {
  const vector = Array.from({ length: DIMENSIONS }, () => 0);
  const text = fields
    .filter((value) => value !== undefined && value !== null && value !== "")
    .join(" ")
    .toLowerCase();

  for (const token of text.match(/[a-z0-9._-]+/g) ?? []) {
    const hash = hashToken(token);
    const index = hash % DIMENSIONS;
    vector[index] += 1;
    vector[(index + 17) % DIMENSIONS] += token.length / 18;
  }

  return normalize(vector);
}

export function buildCreativeEmbedding(creative: Pick<CreativeDoc, "category" | "format" | "language" | "theme" | "hookType" | "emotionalTone" | "features">) {
  const features = creative.features;
  return buildEmbeddingFromFields([
    creative.category,
    creative.format,
    creative.language,
    creative.theme,
    creative.hookType,
    creative.emotionalTone,
    features.ctaText,
    features.headline,
    features.subhead,
    features.dominantColors.join(" "),
    features.hasPrice ? "price" : "",
    features.hasReward ? "reward" : "",
    features.hasGameplay ? "gameplay" : "",
    features.hasUgcStyle ? "ugc creator" : "",
    features.facesCount > 0 ? "faces people" : "",
    bucket("text_density", features.textDensity),
    bucket("clutter", features.visualClutter),
    bucket("novelty", features.noveltyScore),
    bucket("brand", features.brandVisibilityScore),
  ]);
}

export function buildUploadedEmbedding(features: CreativeFeatures, briefText: string) {
  return buildEmbeddingFromFields([
    briefText,
    features.ocrText,
    features.ctaText,
    features.headline,
    features.subhead,
    features.dominantColors.join(" "),
    features.hasPrice ? "price" : "",
    features.hasReward ? "reward" : "",
    features.hasGameplay ? "gameplay" : "",
    features.hasUgcStyle ? "ugc creator" : "",
    features.hasPerson ? "faces people" : "",
    bucket("text_density", features.textDensity),
    bucket("clutter", features.visualClutter),
    bucket("novelty", features.noveltyScore),
  ]);
}

export function cosineSimilarity(left?: number[], right?: number[]) {
  if (!left?.length || !right?.length || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function bucket(label: string, value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "";
  }
  if (value >= 0.66) {
    return `${label}_high`;
  }
  if (value >= 0.33) {
    return `${label}_medium`;
  }
  return `${label}_low`;
}
