import {
  Activity,
  Brain,
  Briefcase,
  Eye,
  Flame,
  Gem,
  Globe,
  ScanLine,
  ShieldAlert,
  Target,
  Wand2,
  type LucideIcon,
} from "lucide-react";

export type AgentVisualState = "dim" | "thinking" | "speaking" | "done";

export type AgentVisual = {
  name: string;
  short: string; // 1-2 word label that fits inside the avatar
  type: "specialist" | "persona";
  icon: LucideIcon;
  hue: number; // 0-360, drives the lit-state glow
};

const SPECIALISTS: AgentVisual[] = [
  { name: "Performance Analyst", short: "Perf", type: "specialist", icon: Activity, hue: 263 },
  { name: "Performance Marketer", short: "Mktr", type: "specialist", icon: Target, hue: 286 },
  { name: "Creative Director", short: "Creative", type: "specialist", icon: Wand2, hue: 310 },
  { name: "Fatigue Analyst", short: "Fatigue", type: "specialist", icon: Flame, hue: 14 },
  { name: "Localization Agent", short: "Local", type: "specialist", icon: Globe, hue: 192 },
  { name: "Risk / Compliance Agent", short: "Risk", type: "specialist", icon: ShieldAlert, hue: 350 },
];

const PERSONAS: AgentVisual[] = [
  { name: "Low-Attention Scroller", short: "Scroller", type: "persona", icon: ScanLine, hue: 38 },
  { name: "Skeptical User", short: "Skeptic", type: "persona", icon: Eye, hue: 220 },
  { name: "Reward-Seeking User", short: "Reward", type: "persona", icon: Gem, hue: 158 },
  { name: "Practical Converter", short: "Practical", type: "persona", icon: Briefcase, hue: 24 },
  { name: "Scam-Sensitive User", short: "Scam", type: "persona", icon: ShieldAlert, hue: 350 },
  { name: "Privacy-Conscious User", short: "Privacy", type: "persona", icon: Eye, hue: 192 },
];

export const ALL_AGENTS = [...SPECIALISTS, ...PERSONAS];

export const SPECIALIST_AGENTS = SPECIALISTS;
export const PERSONA_AGENTS = PERSONAS;

const VISUAL_BY_NAME: Map<string, AgentVisual> = new Map(ALL_AGENTS.map((a) => [a.name, a]));

export function visualForAgent(name: string): AgentVisual {
  return (
    VISUAL_BY_NAME.get(name) ?? {
      name,
      short: name.split(" ")[0],
      type: "specialist",
      icon: Brain,
      hue: 263,
    }
  );
}

const ORGANIC_SLOTS: Record<AgentVisual["type"], Array<{ x: number; y: number }>> = {
  specialist: [
    { x: -0.08, y: -0.96 },
    { x: 0.68, y: -0.7 },
    { x: 0.96, y: -0.02 },
    { x: 0.5, y: 0.84 },
    { x: -0.4, y: 0.88 },
    { x: -0.92, y: 0.2 },
  ],
  persona: [
    { x: -0.5, y: -0.44 },
    { x: 0.18, y: -0.58 },
    { x: 0.62, y: -0.14 },
    { x: 0.38, y: 0.5 },
    { x: -0.18, y: 0.6 },
    { x: -0.64, y: 0.1 },
  ],
};

// Stable constellation slots. They look more organic than equal radial spacing
// while staying deterministic, so avatars do not jump between renders.
export function ringPosition(
  agent: AgentVisual,
  index: number,
  total: number,
): { x: number; y: number } {
  const slots = ORGANIC_SLOTS[agent.type];
  const slot = slots[index % slots.length];

  if (total <= slots.length) {
    return slot;
  }

  const theta = seededAngle(agent.name);
  const jitter = agent.type === "specialist" ? 0.08 : 0.06;
  return {
    x: clamp(slot.x + Math.cos(theta) * jitter, -1, 1),
    y: clamp(slot.y + Math.sin(theta) * jitter, -1, 1),
  };
}

function seededAngle(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return (hash / 0xffffffff) * Math.PI * 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
