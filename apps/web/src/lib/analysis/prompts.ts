import type { EvidencePack } from "@/lib/schemas";

export type SwarmAgent = {
  name: string;
  type: "specialist" | "persona";
  role: string;
};

export const swarmAgents: SwarmAgent[] = [
  {
    name: "Performance Analyst",
    type: "specialist",
    role: "Compare the creative to historical KPI evidence and similar creatives. Focus on likely test outcome.",
  },
  {
    name: "Creative Director",
    type: "specialist",
    role: "Review visual hierarchy, CTA clarity, composition, copy, and message focus.",
  },
  {
    name: "Fatigue Analyst",
    type: "specialist",
    role: "Estimate whether the creative will decay quickly, using novelty, similarity, and historical fatigue signs.",
  },
  {
    name: "Localization Agent",
    type: "specialist",
    role: "Check whether language, tone, offer, and visual framing fit the selected region and platform.",
  },
  {
    name: "Risk / Compliance Agent",
    type: "specialist",
    role: "Flag unreadable terms, risky claims, misleading reward or price framing, and trust issues.",
  },
  {
    name: "Low-Attention Scroller",
    type: "persona",
    role: "React as a user who decides in under two seconds and needs the action to be obvious.",
  },
  {
    name: "Skeptical User",
    type: "persona",
    role: "React as a cautious user who worries about scams, unclear terms, and exaggerated claims.",
  },
];

export function agentPrompt(agent: SwarmAgent, evidence: EvidencePack) {
  return [
    "You are part of Creative Swarm Copilot for mobile advertisers.",
    "Your output must be grounded only in the evidence pack. Do not invent KPI values.",
    `Agent: ${agent.name}`,
    `Agent type: ${agent.type}`,
    `Role: ${agent.role}`,
    "",
    "Score the variant from your perspective. Make the recommendation useful to a marketer deciding scale, test, edit, pivot, or pause.",
    "When you reference evidence, use short labels like fact:CTA, benchmark, similar:500001, fatigue, upload-warning.",
    "",
    `Evidence pack:\n${JSON.stringify(evidence, null, 2)}`,
  ].join("\n");
}

export function aggregatorPrompt(packs: EvidencePack[], reviews: unknown[]) {
  return [
    "You are the final aggregator for Creative Swarm Copilot.",
    "Rank the variants for a mobile advertiser. Gemini agents have already reviewed the variants.",
    "Use the AGENTS.md guidance as prioritization: historical KPI evidence, similar creative benchmarks, persona reactions, creative quality, and fatigue/risk. These are guidance signals, not a fixed formula.",
    "Do not claim a real A/B test happened. This is a pre-test simulation based on dataset evidence, visual similarity, and LLM swarm review.",
    "Pick one winner. Every ranking item must map to an actual variantId from the evidence packs.",
    "Actions must be one of: scale, test, edit, pivot, pause.",
    "Return practical, concrete recommendations.",
    "",
    `Evidence packs:\n${JSON.stringify(packs, null, 2)}`,
    "",
    `Agent reviews:\n${JSON.stringify(reviews, null, 2)}`,
  ].join("\n");
}

export function visionPrompt(context: string) {
  return [
    "Extract factual visual features from this uploaded mobile ad creative or screenshot.",
    "Return only what is visible or strongly implied. Keep scores from 0 to 1.",
    "If no CTA is visible, set ctaText to an empty string.",
    "layoutJson should briefly describe detected CTA/logo/product/text positions.",
    "",
    `Campaign context: ${context}`,
  ].join("\n");
}
