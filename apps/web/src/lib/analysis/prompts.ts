import type { CampaignBrief, EvidencePack } from "@/lib/schemas";

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
  {
    name: "Reward-Seeking User",
    type: "persona",
    role: "React as a user motivated by bonuses, discounts, rewards, prizes, and strong offers.",
  },
  {
    name: "Practical Converter",
    type: "persona",
    role: "React as a user who wants to understand exactly what happens after tapping and whether the action is worth the effort.",
  },
  {
    name: "Visual Trend Seeker",
    type: "persona",
    role: "React as a user who notices polish, novelty, premium feel, and whether the creative looks modern or stale.",
  },
  {
    name: "Category-Matched User",
    type: "persona",
    role: "React as the audience implied by the campaign brief, adapting your motivation to category, region, platform, and objective.",
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
    "Also simulate the likely user behavior state from your perspective.",
    "Behavior primaryState must be one of: skip, ignore, inspect, click, convert, exit.",
    "Behavior probabilities must be decimals from 0 to 1 for all six states. They should approximately sum to 1; the app will normalize small drift.",
    "Treat behavior.click and behavior.convert as impression-level action rates, not broad interest or intent scores.",
    "Ground click probability on click/view evidence: creative metrics when present, otherwise behaviorPrior, similar creatives, and benchmark facts.",
    "Ground convert probability on conversion/view evidence, which is click/view multiplied by click-to-conversion rate when both are present.",
    "Dataset scale check: median click/view is about 0.5%, p95 is about 0.9%, and max is about 1.4%; median conversion/view is about 0.04%, p95 is about 0.17%, and max is about 0.31%.",
    "A 0.10 click probability means 10,000 clicks per 100,000 views; do not output values like 0.10 unless the evidence explicitly shows action rates at that scale.",
    "Use the evidence pack's behaviorPrior as calibration, but adapt it to your agent role without breaking the action-rate scale.",
    "Most probability mass should usually be in skip, ignore, inspect, and exit. Small visual differences should move inspect/skip/ignore more than click/convert.",
    "Do not copy the same click/convert probabilities across personas. Role should create small but visible differences around the evidence anchor: low-attention and skeptical users are lower action-rate profiles, reward-seeking users inspect and tap more when the offer is concrete, practical converters convert more only when the next step is clear, and visual trend seekers mostly shift inspect/ignore unless novelty is strong.",
    "Keep those persona differences logical and bounded: usually about 0.5x to 1.8x of the evidence action-rate anchor, not arbitrary large percentages.",
    personaBehaviorGuidance(agent),
    "Do not strongly contradict behaviorPrior unless the evidence pack contains a concrete reason. Role-specific risk should usually appear as probability shifts and rationale, not an unsupported reversal of the primary state.",
    "Explain behavior.rationale in user terms, for example why someone would skip, inspect, click, convert, or exit.",
    "When you reference evidence, use short labels like fact:CTA, benchmark, similar:500001, fatigue, upload-warning.",
    "Do not claim real users actually behaved this way. This is simulated behavior grounded in historical creative evidence.",
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
    "Each ranking item must include simulated behavior fields: dominantBehaviorState, behaviorProbabilities, and behaviorSummary.",
    "Use agent behavior as a soft signal: higher click/convert helps, higher skip/exit hurts. Historical KPI evidence and similar-creative benchmarks remain more important than LLM opinion.",
    "The behavior summary must describe simulated user rationale, not observed real behavior.",
    "Return practical, concrete recommendations.",
    "",
    `Evidence packs:\n${JSON.stringify(packs, null, 2)}`,
    "",
    `Agent reviews:\n${JSON.stringify(reviews, null, 2)}`,
  ].join("\n");
}

export function imageOnlyAgentPrompt({
  agent,
  variantId,
  variantLabel,
  campaignContext,
}: {
  agent: SwarmAgent;
  variantId: string;
  variantLabel: string;
  campaignContext: CampaignBrief;
}) {
  return [
    "You are part of Creative Swarm Copilot for mobile growth teams.",
    "Use only the attached creative image and the user-entered campaign brief below.",
    "Infer visible text, CTA, visual hierarchy, trust cues, and likely user behavior directly from the pixels.",
    "Do not rely on outside records, prior campaign results, saved metadata, retrieved examples, or extracted feature tables.",
    `Agent: ${agent.name}`,
    `Agent type: ${agent.type}`,
    `Role: ${imageOnlyRole(agent)}`,
    `Variant ID: ${variantId}`,
    `Variant label: ${variantLabel}`,
    "",
    "Return variantId exactly as provided above.",
    "Score the variant from your perspective. Make the recommendation useful to a marketer deciding scale, test, edit, pivot, or pause.",
    "Also simulate the likely user behavior state from your perspective.",
    "Behavior primaryState must be one of: skip, ignore, inspect, click, convert, exit.",
    "Behavior probabilities must be decimals from 0 to 1 for all six states. They should approximately sum to 1; the app will normalize small drift.",
    "Treat behavior.click and behavior.convert as rare impression-level action rates, not broad interest or intent scores.",
    "In image-only mode there is no campaign history, so keep tap/click probability conservative and conversion probability much smaller than click probability.",
    "Do not use 0.10 as a default click probability. That would mean 10,000 clicks per 100,000 views, which is not a conservative visual pre-test estimate.",
    "Most probability mass should usually be in skip, ignore, inspect, and exit. Reward, novelty, and clarity may raise inspect first; only very strong visible evidence should modestly raise click or convert.",
    "Do not copy the same click/convert probabilities across personas. Let the role create realistic differences: low-attention and skeptical profiles are lower action-rate profiles; reward-seeking users inspect and tap more when the offer is visible; practical converters convert more only if the post-tap value is clear; visual trend seekers mostly shift inspect/ignore unless the creative feels fresh.",
    personaBehaviorGuidance(agent),
    "Explain behavior.rationale in user terms, for example why someone would skip, inspect, click, convert, or exit.",
    "Do not claim real users actually behaved this way. This is a visual pre-test simulation from the attached image.",
    "",
    `User-entered campaign brief:\n${JSON.stringify(campaignContext, null, 2)}`,
  ].join("\n");
}

function imageOnlyRole(agent: SwarmAgent) {
  switch (agent.name) {
    case "Performance Analyst":
      return "Judge likely visual response and test-readiness from the attached image only.";
    case "Creative Director":
      return "Review visual hierarchy, CTA clarity, composition, copy, and message focus from the attached image only.";
    case "Fatigue Analyst":
      return "Estimate whether the creative feels visually fresh or easy to ignore, using only what is visible.";
    case "Localization Agent":
      return "Check whether visible language, tone, offer, and visual framing fit the user-entered region and platform.";
    case "Risk / Compliance Agent":
      return "Flag unreadable terms, risky claims, misleading reward or price framing, and trust issues visible in the image.";
    default:
      return agent.role;
  }
}

function personaBehaviorGuidance(agent: SwarmAgent) {
  switch (agent.name) {
    case "Low-Attention Scroller":
      return "Persona calibration: Low-Attention Scroller should usually have high skip/ignore and only a tiny click lift when the CTA is instantly legible.";
    case "Skeptical User":
      return "Persona calibration: Skeptical User should push unclear claims into skip/exit and should not raise click/convert unless trust cues and terms are clear.";
    case "Reward-Seeking User":
      return "Persona calibration: Reward-Seeking User may raise inspect and slightly raise click when the reward is concrete, but conversion still needs trust and low friction.";
    case "Practical Converter":
      return "Persona calibration: Practical Converter may raise convert only when the post-tap value and next step are explicit; otherwise shift probability into inspect or exit.";
    case "Visual Trend Seeker":
      return "Persona calibration: Visual Trend Seeker should mostly shift inspect/ignore based on polish and novelty; visual appeal alone is not a high click rate.";
    case "Category-Matched User":
      return "Persona calibration: Category-Matched User should stay close to the campaign and evidence baseline, adjusting modestly for category fit.";
    default:
      return "Specialist calibration: specialists should use evidence to adjust rationale and risk, not inflate click or convert probabilities beyond observed action-rate scale.";
  }
}

export function imageOnlyAggregatorPrompt(reviews: unknown[]) {
  return [
    "You are the final aggregator for Creative Swarm Copilot.",
    "Rank the variants using only the agent reviews below. Those reviews came from attached-image-only agent analysis.",
    "Do not assume outside records, prior campaign results, saved metadata, retrieved examples, or extracted feature tables.",
    "Pick one winner. Every ranking item must map to a variantId present in the reviews.",
    "Actions must be one of: scale, test, edit, pivot, pause.",
    "Each ranking item must include simulated behavior fields: dominantBehaviorState, behaviorProbabilities, and behaviorSummary.",
    "The behavior summary must describe simulated user rationale, not observed real behavior.",
    "Return practical, concrete recommendations and a pre-test plan.",
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
