import { describe, expect, it } from "vitest";
import { parseGeminiApiKeys } from "@/lib/config";

describe("Gemini API key config", () => {
  it("uses the legacy single-key env value", () => {
    expect(parseGeminiApiKeys({ apiKey: "single-token" })).toEqual(["single-token"]);
  });

  it("parses and deduplicates multiple Gemini tokens", () => {
    expect(
      parseGeminiApiKeys({
        apiKeys: "token-a, token-b\ntoken-c; token-a",
        apiKey: "token-d",
      }),
    ).toEqual(["token-a", "token-b", "token-c", "token-d"]);
  });

  it("ignores blank separators", () => {
    expect(parseGeminiApiKeys({ apiKeys: " , ; \n token-a \n\n token-b " })).toEqual(["token-a", "token-b"]);
  });
});
