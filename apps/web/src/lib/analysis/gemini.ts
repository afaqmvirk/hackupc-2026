import { GoogleGenAI } from "@google/genai";
import { z, type ZodType } from "zod";
import { config, requireGeminiKey } from "@/lib/config";

let client: GoogleGenAI | undefined;

function getClient() {
  if (!client) {
    client = new GoogleGenAI({ apiKey: requireGeminiKey() });
  }

  return client;
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
  const ai = getClient();
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

  const response = await ai.models.generateContent({
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

  const repairResponse = await ai.models.generateContent({
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

function parseJson(text?: string) {
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(trimmed);
}
