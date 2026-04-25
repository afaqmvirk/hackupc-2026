export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
  swarmModel: process.env.GEMINI_SWARM_MODEL ?? "gemini-2.5-flash",
  aggregatorModel: process.env.GEMINI_AGGREGATOR_MODEL ?? "gemini-2.5-flash",
  geminiRequestStartIntervalMs: parseNonNegativeInteger(process.env.GEMINI_REQUEST_START_INTERVAL_MS, 5000),
  mongodbUri: process.env.MONGODB_URI,
  mongodbDb: process.env.MONGODB_DB ?? "creative_swarm_copilot",
  atlasVectorIndex: process.env.ATLAS_VECTOR_INDEX ?? "creative_embedding_index",
  cvServiceUrl: process.env.CV_SERVICE_URL ?? "http://127.0.0.1:8001",
};

export function requireGeminiKey() {
  if (!config.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is required for LLM-based swarm analysis.");
  }

  return config.geminiApiKey;
}

function parseNonNegativeInteger(value: string | undefined, fallback: number) {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback;
}
