"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { SkipForward } from "lucide-react";
import type { AgentReview, CreativeDoc } from "@/lib/schemas";
import { AgentRing } from "./AgentRing";
import { TypewriterReasoning } from "./TypewriterReasoning";
import { useEventPresenter } from "./useEventPresenter";
import { visualForAgent, ALL_AGENTS } from "./agent-config";

export function WarRoomOverlay({
  reviews,
  variants,
  totalAgentsExpected,
  onSkip,
}: {
  reviews: AgentReview[];
  variants: CreativeDoc[];
  totalAgentsExpected: number;
  onSkip: () => void;
}) {
  const { current, agentStatesByVariant, currentVariantId, totalSeen } = useEventPresenter(reviews);

  const currentVariant = currentVariantId
    ? variants.find((v) => v.id === currentVariantId) ?? null
    : null;
  const currentVariantIndex = currentVariant
    ? variants.findIndex((v) => v.id === currentVariant.id)
    : -1;

  const visual = current ? visualForAgent(current.review.agentName) : null;
  const states =
    (currentVariantId ? agentStatesByVariant.get(currentVariantId) : null) ??
    new Map(ALL_AGENTS.map((a) => [a.name, "dim" as const]));

  const totalExpected = Math.max(totalAgentsExpected, 1);
  const progressPct = Math.min(100, Math.round((totalSeen / totalExpected) * 100));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 flex flex-col bg-[rgba(7,9,18,0.92)] backdrop-blur-xl"
    >
      <header className="flex items-center justify-between border-b border-pp-purple/15 px-6 py-4 sm:px-10">
        <div className="flex items-center gap-3">
          <span className="size-2 animate-pulse rounded-full bg-pp-violet shadow-[0_0_12px_rgba(123,63,242,0.8)]" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pp-lavender">
            Swarm War Room · live analysis
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-3 text-xs font-semibold text-pp-secondary sm:flex">
            <span className="text-pp-muted">Agents</span>
            <span className="font-mono text-pp-white">
              {totalSeen}/{totalExpected}
            </span>
            {currentVariantIndex >= 0 && (
              <>
                <span className="text-pp-muted">·</span>
                <span className="text-pp-muted">Variant</span>
                <span className="font-mono text-pp-white">
                  {currentVariantIndex + 1}/{variants.length}
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-pp-lavender/25 bg-pp-elevated px-4 text-xs font-semibold text-pp-white transition hover:bg-pp-purple/20"
          >
            <SkipForward className="size-3.5" />
            Skip to results
          </button>
        </div>
      </header>

      <div
        aria-hidden
        className="h-1 w-full bg-pp-elevated"
      >
        <div
          className="h-full bg-gradient-to-r from-pp-purple to-pp-violet transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-6">
        <div className="relative flex w-full max-w-5xl flex-col items-center gap-6">
          <div className="relative">
            <AgentRing states={states} speakingName={current?.review.agentName ?? null} />
            {/* Center stage: the creative under analysis */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <VariantStage variant={currentVariant} />
            </div>
          </div>

          {/* Reasoning panel */}
          <AnimatePresence mode="wait">
            <motion.div
              key={current ? `${current.review.variantId}::${current.review.agentName}` : "idle"}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-3xl rounded-[14px] border border-pp-purple/25 bg-pp-panel/90 p-5 shadow-[0_24px_60px_rgba(15,8,82,0.55)]"
            >
              {current && visual ? (
                <>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex size-7 items-center justify-center rounded-full"
                        style={{ background: `hsla(${visual.hue}, 70%, 25%, 0.9)` }}
                      >
                        <visual.icon
                          className="size-3.5"
                          style={{ color: `hsla(${visual.hue}, 100%, 88%, 1)` }}
                        />
                      </span>
                      <span className="text-sm font-semibold text-pp-white">
                        {current.review.agentName}
                      </span>
                      <span className="rounded-full bg-pp-elevated px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-pp-muted">
                        {visual.type}
                      </span>
                    </div>
                    <RiskBadge risk={current.review.fatigueRisk} />
                  </div>
                  <TypewriterReasoning
                    text={current.review.reasoning}
                    signature={`${current.review.variantId}::${current.review.agentName}`}
                  />
                  {current.review.suggestedEdit ? (
                    <p className="mt-3 border-t border-pp-purple/15 pt-3 text-xs text-pp-muted">
                      <span className="font-semibold text-pp-lavender">Suggests:</span>{" "}
                      {current.review.suggestedEdit}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-center text-sm text-pp-muted">
                  Agents are warming up. The first to finish will speak.
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </motion.div>
  );
}

function VariantStage({ variant }: { variant: CreativeDoc | null }) {
  if (!variant) {
    return (
      <div className="flex size-32 items-center justify-center rounded-2xl border border-pp-purple/20 bg-pp-elevated/60 text-xs text-pp-muted">
        Loading variant…
      </div>
    );
  }

  return (
    <motion.div
      key={variant.id}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="relative size-36 overflow-hidden rounded-2xl border-2 border-pp-purple/40 bg-pp-elevated shadow-[0_0_40px_rgba(123,63,242,0.4)]"
    >
      <Image
        src={variant.thumbnailUrl ?? variant.assetUrl}
        alt={variant.appName ?? variant.id}
        fill
        sizes="144px"
        className="object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(7,9,18,0.9)] to-transparent px-2 py-1.5">
        <p className="truncate text-[11px] font-semibold text-pp-white">
          {variant.appName ?? variant.label ?? variant.id}
        </p>
      </div>
    </motion.div>
  );
}

function RiskBadge({ risk }: { risk: "low" | "medium" | "high" }) {
  const palette =
    risk === "high"
      ? { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.4)", color: "#fca5a5" }
      : risk === "medium"
        ? { bg: "rgba(251,191,36,0.15)", border: "rgba(251,191,36,0.4)", color: "#fcd34d" }
        : { bg: "rgba(74,222,128,0.15)", border: "rgba(74,222,128,0.4)", color: "#86efac" };
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
      style={{ background: palette.bg, borderColor: palette.border, color: palette.color }}
    >
      {risk} fatigue
    </span>
  );
}
