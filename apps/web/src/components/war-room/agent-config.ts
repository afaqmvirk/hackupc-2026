import {
  Activity,
  Brain,
  Briefcase,
  Eye,
  Flame,
  Gem,
  Globe,
  Layers,
  ScanLine,
  ShieldAlert,
  Sparkles,
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
  { name: "Visual Trend Seeker", short: "Trend", type: "persona", icon: Sparkles, hue: 295 },
  { name: "Category-Matched User", short: "Match", type: "persona", icon: Layers, hue: 178 },
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

// Even radial spacing. Each agent sits on its own slot regardless of order of arrival.
// Specialists outer ring, Personas inner ring.
export function ringPosition(
  agent: AgentVisual,
  index: number,
  total: number,
): { x: number; y: number } {
  const radius = agent.type === "specialist" ? 1.0 : 0.62; // unit-circle scale
  const angleOffset = agent.type === "specialist" ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / total;
  const theta = angleOffset + (index / total) * Math.PI * 2;
  return { x: Math.cos(theta) * radius, y: Math.sin(theta) * radius };
}
