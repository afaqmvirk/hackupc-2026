import { GoogleGenAI } from "@google/genai";
import { z, type ZodType } from "zod";
import { config, requireGeminiKeys } from "@/lib/config";

type GenerateContentRequest = Parameters<GoogleGenAI["models"]["generateContent"]>[0];
type GenerateContentResponse = Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>;
type GeminiClientSlot = {
  client: GoogleGenAI;
  index: number;
  key: string;
  label: string;
};

const clients = new Map<string, GoogleGenAI>();
let nextClientIndex = 0;

function getClientSlot(): GeminiClientSlot {
  const keys = requireGeminiKeys();
  const index = nextClientIndex % keys.length;
  const key = keys[index];
  nextClientIndex = (nextClientIndex + 1) % keys.length;

  let client = clients.get(key);
  if (!client) {
    client = new GoogleGenAI({ apiKey: key });
    clients.set(key, client);
  }

  return {
    client,
    index,
    key,
    label: `#${index + 1} ${maskGeminiApiKey(key)}`,
  };
}

export async function generateJson<T>({
  model = config.swarmModel,
  prompt,
  schema,
  validator,
  image,
  temperature = 0.35,
}: {
  model?: string;
  prompt: string;
  schema: unknown;
  validator: ZodType<T>;
  image?: { base64: string; mimeType: string };
  temperature?: number;
}): Promise<T> {
  const contents = image
    ? [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { data: image.base64, mimeType: image.mimeType } },
          ],
        },
      ]
    : prompt;

  const response = await generateContentWithTokenFallback({
    model,
    contents,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      temperature,
    },
  });

  const parsed = parseJson(response.text);
  const result = validator.safeParse(parsed);
  if (result.success) {
    return result.data;
  }

  const repairResponse = await generateContentWithTokenFallback({
    model,
    contents: [
      "Repair the following JSON so it exactly matches the requested schema. Return JSON only.",
      `Schema: ${JSON.stringify(schema)}`,
      `Invalid JSON: ${response.text}`,
      `Validation errors: ${z.prettifyError(result.error)}`,
    ].join("\n\n"),
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      temperature: 0,
    },
  });

  const repaired = validator.safeParse(parseJson(repairResponse.text));
  if (!repaired.success) {
    throw new Error(`Gemini returned invalid JSON after repair: ${z.prettifyError(repaired.error)}`);
  }

  return repaired.data;
}

async function generateContentWithTokenFallback(request: GenerateContentRequest): Promise<GenerateContentResponse> {
  const tokenCount = requireGeminiKeys().length;
  const failures: string[] = [];

  for (let attempt = 0; attempt < tokenCount; attempt += 1) {
    const slot = getClientSlot();

    try {
      return await slot.client.models.generateContent(request);
    } catch (error) {
      failures.push(formatGeminiFailure(error, slot));

      if (!isQuotaError(error) || attempt === tokenCount - 1) {
        throw new Error(`Gemini request failed: ${failures.join(" | ")}`);
      }

      console.warn(`${failures.at(-1)}. Retrying with another configured Gemini token.`);
    }
  }

  throw new Error("Gemini request failed before reaching the API.");
}

function parseJson(text?: string) {
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(trimmed);
}

function formatGeminiFailure(error: unknown, slot: GeminiClientSlot) {
  return `token ${slot.label} returned ${sanitizeGeminiError(error, slot.key)}`;
}

function sanitizeGeminiError(error: unknown, key: string) {
  const text = errorToText(error).replaceAll(key, "<redacted-api-key>");
  return text.length > 320 ? `${text.slice(0, 320)}...` : text;
}

function errorToText(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isQuotaError(error: unknown) {
  const text = errorToText(error).toLowerCase();
  return text.includes("429") || text.includes("resource_exhausted") || text.includes("quota");
}

function maskGeminiApiKey(key: string) {
  return `****${key.slice(-4)}`;
}
