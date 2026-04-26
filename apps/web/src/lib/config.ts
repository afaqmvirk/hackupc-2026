const geminiApiKeys = parseGeminiApiKeys({
  apiKeys: process.env.GEMINI_API_KEYS ?? process.env.GOOGLE_API_KEYS,
  apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
});

export const config = {
  geminiApiKey: geminiApiKeys[0],
  geminiApiKeys,
  swarmModel: process.env.GEMINI_SWARM_MODEL ?? "gemini-2.5-flash",
  aggregatorModel: process.env.GEMINI_AGGREGATOR_MODEL ?? "gemini-2.5-flash",
  geminiRequestStartIntervalMs: parseNonNegativeInteger(process.env.GEMINI_REQUEST_START_INTERVAL_MS, 5000),
  mongodbUri: process.env.MONGODB_URI,
  mongodbDb: process.env.MONGODB_DB ?? "creative_swarm_copilot",
  atlasVectorIndex: process.env.ATLAS_VECTOR_INDEX ?? "creative_embedding_index",
  cvServiceUrl: process.env.CV_SERVICE_URL ?? "http://127.0.0.1:8001",
};

export function requireGeminiKeys() {
  if (config.geminiApiKeys.length === 0) {
    throw new Error(
      "GEMINI_API_KEY, GOOGLE_API_KEY, GEMINI_API_KEYS, or GOOGLE_API_KEYS is required for LLM-based swarm analysis.",
    );
  }

  return config.geminiApiKeys;
}

export function requireGeminiKey() {
  return requireGeminiKeys()[0];
}

export function parseGeminiApiKeys({
  apiKeys,
  apiKey,
}: {
  apiKeys?: string;
  apiKey?: string;
}) {
  const tokens = [apiKeys, apiKey]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(/[\n,;]+/))
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(tokens)];
}

function parseNonNegativeInteger(value: string | undefined, fallback: number) {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback;
}
