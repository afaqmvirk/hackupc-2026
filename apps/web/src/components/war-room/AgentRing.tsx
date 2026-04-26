"use client";

import { Check } from "lucide-react";
import {
  ALL_AGENTS,
  PERSONA_AGENTS,
  SPECIALIST_AGENTS,
  ringPosition,
  type AgentVisual,
  type AgentVisualState,
} from "./agent-config";

const AVATAR_PX = 56;
const RING_PADDING_PX = AVATAR_PX / 2 + 8;

export function AgentRing({
  states,
  speakingName,
}: {
  states: Map<string, AgentVisualState>;
  speakingName: string | null;
}) {
  return (
    <div
      className="relative mx-auto"
      style={{
        width: "min(560px, 80vw)",
        aspectRatio: "1 / 1",
      }}
    >
      {/* Faint constellation guides */}
      <div
        className="pointer-events-none absolute rounded-[44%] border border-pp-purple/10"
        style={{ inset: "1% 5% 4% 2%", transform: "rotate(-8deg)" }}
      />
      <div
        className="pointer-events-none absolute rounded-[42%] border border-pp-purple/8"
        style={{ inset: "22% 18% 17% 21%", transform: "rotate(13deg)" }}
      />

      {SPECIALIST_AGENTS.map((agent, i) => (
        <Avatar
          key={agent.name}
          agent={agent}
          state={resolveState(states, agent.name, speakingName)}
          {...positionStyle(agent, i, SPECIALIST_AGENTS.length)}
        />
      ))}
      {PERSONA_AGENTS.map((agent, i) => (
        <Avatar
          key={agent.name}
          agent={agent}
          state={resolveState(states, agent.name, speakingName)}
          {...positionStyle(agent, i, PERSONA_AGENTS.length)}
        />
      ))}
    </div>
  );
}

function resolveState(
  states: Map<string, AgentVisualState>,
  name: string,
  speakingName: string | null,
): AgentVisualState {
  if (speakingName === name) return "speaking";
  return states.get(name) ?? "dim";
}

function positionStyle(agent: AgentVisual, index: number, total: number) {
  const { x, y } = ringPosition(agent, index, total);
  // Map from unit-circle [-1,1] to CSS positioning, leaving room for the avatar.
  // 50% = center; offset by half radius% in the direction of (x, y).
  const cx = 50 + x * (50 - (RING_PADDING_PX / 560) * 100);
  const cy = 50 + y * (50 - (RING_PADDING_PX / 560) * 100);
  return { left: `${cx}%`, top: `${cy}%` };
}

function Avatar({
  agent,
  state,
  left,
  top,
}: {
  agent: AgentVisual;
  state: AgentVisualState;
  left: string;
  top: string;
}) {
  const Icon = agent.icon;
  const lit = state === "speaking";
  const done = state === "done";

  const ring = lit
    ? `hsla(${agent.hue}, 95%, 65%, 0.95)`
    : done
      ? `hsla(${agent.hue}, 35%, 45%, 0.40)`
      : `hsla(${agent.hue}, 18%, 28%, 0.30)`;

  const fill = lit
    ? `linear-gradient(135deg, hsla(${agent.hue}, 80%, 24%, 0.95), hsla(${agent.hue}, 90%, 14%, 0.95))`
    : done
      ? `hsla(${agent.hue}, 25%, 12%, 0.85)`
      : `hsla(${agent.hue}, 12%, 10%, 0.65)`;

  const glow = lit ? `0 0 32px hsla(${agent.hue}, 95%, 60%, 0.55), 0 0 8px hsla(${agent.hue}, 95%, 70%, 0.6)` : "none";

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-500"
      style={{ left, top, transform: `translate(-50%, -50%) scale(${lit ? 1.12 : done ? 0.96 : 1})` }}
      title={agent.name}
    >
      <div
        className="relative flex items-center justify-center rounded-full border-2 transition-all duration-500"
        style={{
          width: AVATAR_PX,
          height: AVATAR_PX,
          borderColor: ring,
          background: fill,
          boxShadow: glow,
          opacity: state === "dim" ? 0.55 : 1,
        }}
      >
        <Icon
          className="size-5 transition-colors duration-500"
          style={{
            color: lit ? `hsla(${agent.hue}, 100%, 88%, 1)` : `hsla(${agent.hue}, 30%, 78%, 0.85)`,
          }}
        />
        {done ? (
          <span
            className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full"
            style={{ background: `hsla(${agent.hue}, 70%, 45%, 0.95)` }}
          >
            <Check className="size-2.5 text-white" strokeWidth={3} />
          </span>
        ) : null}
      </div>
      <p
        className="mt-2 whitespace-nowrap text-center text-[10px] font-semibold uppercase tracking-[0.08em]"
        style={{
          color: lit ? `hsla(${agent.hue}, 90%, 80%, 1)` : "rgba(199,183,255,0.45)",
        }}
      >
        {agent.short}
      </p>
    </div>
  );
}

export const __agentRingTotal = ALL_AGENTS.length;
