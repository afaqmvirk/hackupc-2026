"use client";

import type React from "react";
import { useMemo, useState } from "react";
import Image from "next/image";
import {
  Activity,
  BarChart3,
  Bot,
  Check,
  ChevronRight,
  Eye,
  FlaskConical,
  Gauge,
  MessageSquareText,
  MousePointerClick,
  ShieldAlert,
  Target,
  Timer,
  Trophy,
  Users,
} from "lucide-react";
import { RevealStage } from "@/components/war-room/RevealStage";
import {
  type AgentReview,
  type CampaignBrief,
  type CopilotAnswer,
  type CreativeDoc,
  type FatigueProfile,
  type FinalReport,
  type PersonaActionForecast,
  type SimulatedDecayCurve,
  type VariantAnalysis,
} from "@/lib/schemas";
import { cn, formatNumber, formatPct } from "@/lib/utils";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ResultsDashboardProps = {
  report: FinalReport | null;
  creatives: CreativeDoc[];
  brief: CampaignBrief;
  agentReviews?: AgentReview[];
};

type TabId = "compare" | "personas" | "fatigue";

type ScoreSet = {
  attention: number | null;
  clarity: number | null;
  trust: number | null;
  conversionIntent: number | null;
};

type VariantView = {
  id: string;
  label: string;
  creative: CreativeDoc | null;
  analysis: VariantAnalysis;
  fatigue?: FatigueProfile;
  decayCurve?: SimulatedDecayCurve;
  reviews: AgentReview[];
  personaForecast?: PersonaActionForecast;
  scores: ScoreSet;
};

const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: "compare", label: "Compare", icon: <BarChart3 className="size-4" /> },
  { id: "personas", label: "Personas", icon: <Users className="size-4" /> },
  { id: "fatigue", label: "Fatigue", icon: <Activity className="size-4" /> },
];

const behaviorStates = ["skip", "click", "convert", "exit"] as const;
const variantColors = ["#7b3ff2", "#8fa2ff", "#58d68d", "#f5b041", "#ff9632", "#ff6b7a"] as const;
const scoreMetrics: Array<{ key: keyof ScoreSet; label: string }> = [
  { key: "attention", label: "Attention" },
  { key: "clarity", label: "Clarity" },
  { key: "trust", label: "Trust" },
  { key: "conversionIntent", label: "Intent" },
];

const actionStyles: Record<
  VariantAnalysis["action"],
  { label: string; text: string; border: string; bg: string; color: string }
> = {
  scale: {
    label: "Scale",
    text: "text-pp-success",
    border: "border-pp-success/35",
    bg: "bg-pp-success/12",
    color: "#58d68d",
  },
  test: {
    label: "Test",
    text: "text-pp-info",
    border: "border-pp-info/35",
    bg: "bg-pp-info/12",
    color: "#8fa2ff",
  },
  edit: {
    label: "Edit",
    text: "text-pp-warning",
    border: "border-pp-warning/35",
    bg: "bg-pp-warning/12",
    color: "#f5b041",
  },
  pivot: {
    label: "Pivot",
    text: "text-[#ff9632]",
    border: "border-[#ff9632]/35",
    bg: "bg-[#ff9632]/12",
    color: "#ff9632",
  },
  pause: {
    label: "Pause",
    text: "text-pp-error",
    border: "border-pp-error/35",
    bg: "bg-pp-error/12",
    color: "#ff6b7a",
  },
};

export function ResultsDashboard({
  report,
  creatives,
  brief,
  agentReviews = [],
}: ResultsDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("compare");
  const views = useMemo(() => (report ? buildVariantViews(report, creatives, agentReviews) : []), [agentReviews, creatives, report]);

  if (!report) {
    return (
      <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-pp-violet" />
          <h2 className="text-sm font-semibold text-pp-white">Results</h2>
        </div>
        <div className="mt-3 rounded-[10px] border border-dashed border-[var(--pp-border)] p-4 text-sm text-pp-muted">
          Ranking, comparison, and test plan appear after analysis.
        </div>
      </section>
    );
  }

  const champion = views.find((view) => view.id === report.winner) ?? views[0];

  return (
    <section className="grid gap-5">
      <RevealStage order={0}>
        <OverviewHero report={report} views={views} champion={champion} />
      </RevealStage>
      <RevealStage order={1}>
        <OverviewTab report={report} views={views} />
      </RevealStage>
      <RevealStage order={2}>
        <AbTestPlanPanel report={report} views={views} />
      </RevealStage>
      <RevealStage order={3}>
        <ActionDecisionStrip champion={champion} />
      </RevealStage>

      <nav className="sticky top-0 z-10 -mx-4 border-y border-[var(--pp-border)] bg-pp-bg/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-[16px] sm:border">
        <div className="grid grid-cols-3 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border px-3 text-sm font-medium transition",
                activeTab === tab.id
                  ? "border-pp-violet/45 bg-pp-purple/20 text-pp-white shadow-glow"
                  : "border-[var(--pp-border)] bg-pp-panel text-pp-muted hover:border-[var(--pp-border-strong)] hover:text-pp-white",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {activeTab === "compare" ? <CompareTab views={views} /> : null}
      {activeTab === "personas" ? <PersonasTab views={views} agentReviews={agentReviews} /> : null}
      {activeTab === "fatigue" ? <FatigueTab views={views} /> : null}

      <CopilotPanel report={report} creatives={creatives} brief={brief} />
    </section>
  );
}

function OverviewHero({
  report,
  views,
  champion,
}: {
  report: FinalReport;
  views: VariantView[];
  champion?: VariantView;
}) {
  const runnerUp = views.find((view) => view.id !== champion?.id);
  const scoreDelta = champion && runnerUp ? champion.analysis.score - runnerUp.analysis.score : null;

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(300px,430px)_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-[16px] border border-pp-violet/25 bg-pp-panel shadow-panel">
        <div className="relative aspect-[9/13] min-h-[360px] bg-pp-elevated">
          <VariantImage view={champion} priority className="h-full w-full object-cover" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <Pill className="border-pp-success/35 bg-pp-success/15 text-pp-success">
              <Trophy className="size-3.5" />
              Winner
            </Pill>
            {champion ? <ActionPill action={champion.analysis.action} /> : null}
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-pp-bg via-pp-bg/80 to-transparent p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-pp-lavender">{champion?.label ?? "Champion"}</p>
            <h2 className="mt-1 text-xl font-semibold text-pp-white">{report.champion}</h2>
            <p className="mt-2 line-clamp-2 text-sm text-pp-secondary">{report.executiveSummary}</p>
          </div>
        </div>
      </div>

      <div className="grid content-start gap-4">
        <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
          <div className="grid gap-4 lg:grid-cols-[132px_minmax(0,1fr)] lg:items-center">
            <div className="flex items-center gap-4 lg:block">
              <ScoreRing
                value={champion?.analysis.score ?? 0}
                label="Score"
                color={champion ? actionStyles[champion.analysis.action].color : "#9d64f6"}
              />
              <div className="lg:mt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-pp-muted">Decision</p>
                <p className="mt-1 text-lg font-semibold text-pp-white">
                  {champion ? `${actionStyles[champion.analysis.action].label} ${champion.label}` : "Awaiting ranking"}
                </p>
                {scoreDelta !== null ? <p className="text-sm text-pp-muted">+{formatNumber(scoreDelta, 0)} pts over runner-up</p> : null}
              </div>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricTile icon={<Gauge className="size-4" />} label="Creative health" value={`${champion?.analysis.creativeHealth ?? 0}/100`} />
                <MetricTile icon={<Activity className="size-4" />} label="Fatigue" value={fatigueLabel(champion)} />
                <MetricTile icon={<Eye className="size-4" />} label="Behavior" value={humanizeBehavior(champion?.analysis.dominantBehaviorState ?? "inspect")} />
              </div>
              <BehaviorStack probabilities={champion?.analysis.behaviorProbabilities} />
            </div>
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {views.map((view) => (
            <RankedVariantCard key={view.id} view={view} compact />
          ))}
        </div>
      </div>
    </section>
  );
}

function ActionDecisionStrip({ champion }: { champion?: VariantView }) {
  return (
    <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-3 shadow-panel">
      <div className="rounded-[10px] border border-[var(--pp-border)] bg-pp-elevated px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-pp-muted">Expected winner behavior</p>
        <div className="mt-2">
          <BehaviorStack probabilities={champion?.analysis.behaviorProbabilities} />
        </div>
      </div>
    </section>
  );
}

function AbTestPlanPanel({ report, views }: { report: FinalReport; views: VariantView[] }) {
  const plan = report.abTestPlan;

  return (
    <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <SectionHeader icon={<FlaskConical className="size-4" />} title="A/B test plan" />
          <p className="mt-2 max-w-3xl text-sm text-pp-muted">
            Pre-test simulation based on historical creative performance, visual similarity, and persona-agent evaluation.
          </p>
        </div>
        <Pill className="border-pp-violet/35 bg-pp-purple/15 text-pp-lavender">{plan.trafficSplit}</Pill>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <MetricTile icon={<Target className="size-4" />} label="Primary" value={plan.primaryMetric} />
        <MetricTile icon={<MousePointerClick className="size-4" />} label="Secondary" value={plan.secondaryMetric} />
        <MetricTile icon={<Trophy className="size-4" />} label="Control" value={planVariantLabel(plan.control, views)} />
        <MetricTile icon={<FlaskConical className="size-4" />} label="Challenger" value={planVariantLabel(plan.challenger, views)} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <PlanCopyBlock title="Hypothesis" value={plan.hypothesis} />
        <PlanCopyBlock title="Stop condition" value={plan.stopCondition} />
        <PlanCopyBlock title="Action if winner" value={plan.actionIfWinner} />
        <PlanCopyBlock title="Action if loser" value={plan.actionIfLoser} />
      </div>
    </section>
  );
}

function PlanCopyBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--pp-border)] bg-pp-elevated px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-pp-muted">{title}</p>
      <p className="mt-2 text-sm text-pp-secondary">{value}</p>
    </div>
  );
}

function OverviewTab({
  report,
  views,
}: {
  report: FinalReport;
  views: VariantView[];
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <div className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
        <SectionHeader icon={<BarChart3 className="size-4" />} title="Scoreboard" />
        <div className="mt-4 grid gap-3">
          {views.map((view) => (
            <ScoreboardRow key={view.id} view={view} maxScore={100} />
          ))}
        </div>
      </div>

      <div className="grid gap-5">
        <VisualListPanel icon={<Check className="size-4" />} title="Why it wins" items={report.whyItWins.slice(0, 4)} tone="success" />
        <VisualListPanel icon={<ShieldAlert className="size-4" />} title="Top risks" items={report.risks.slice(0, 4)} tone="warning" />
        <VisualListPanel icon={<ChevronRight className="size-4" />} title="Next moves" items={report.whatToDoNext.slice(0, 4)} tone="info" />
      </div>
    </section>
  );
}

function CompareTab({ views }: { views: VariantView[] }) {
  return (
    <section className="grid gap-5">
      <div className="grid gap-4 xl:grid-cols-2">
        {views.map((view) => (
          <CompareVariantCard key={view.id} view={view} />
        ))}
      </div>
      <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
        <SectionHeader icon={<Target className="size-4" />} title="Metric matrix" />
        <div className="mt-4 overflow-x-auto">
          <div className="grid min-w-[740px] gap-2">
            <MatrixRow label="Score" values={views.map((view) => ({ label: view.label, value: view.analysis.score, max: 100 }))} />
            <MatrixRow label="Health" values={views.map((view) => ({ label: view.label, value: view.analysis.creativeHealth, max: 100 }))} />
            <MatrixRow label="Fatigue" values={views.map((view) => ({ label: view.label, value: view.fatigue?.healthScore ?? null, max: 100 }))} />
            {scoreMetrics.map((metricItem) => (
              <MatrixRow
                key={metricItem.key}
                label={metricItem.label}
                values={views.map((view) => ({ label: view.label, value: view.scores[metricItem.key], max: 10 }))}
              />
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

function PersonasTab({ views, agentReviews }: { views: VariantView[]; agentReviews: AgentReview[] }) {
  const personaNames = [...new Set(agentReviews.filter((review) => review.agentType === "persona").map((review) => review.agentName))];

  return (
    <section className="grid gap-5">
      <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
        <SectionHeader icon={<Users className="size-4" />} title="Persona heatmap" />
        {personaNames.length ? (
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[680px]">
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `180px repeat(${views.length}, minmax(110px, 1fr))` }}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-pp-muted">Persona</div>
                {views.map((view) => (
                  <div key={view.id} className="text-xs font-semibold uppercase tracking-[0.12em] text-pp-muted">
                    {view.label}
                  </div>
                ))}
                {personaNames.map((personaName) => (
                  <PersonaHeatmapRow key={personaName} personaName={personaName} views={views} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <EmptyPanel message="Persona reviews were not saved for this experiment." />
        )}
      </section>

      <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
        <SectionHeader icon={<MousePointerClick className="size-4" />} title="Projected actions" />
        <div className="mt-4 grid gap-3">
          {views.map((view) => (
            <ActionForecastCard key={view.id} view={view} />
          ))}
        </div>
      </section>
    </section>
  );
}

function FatigueTab({ views }: { views: VariantView[] }) {
  const hasFatigue = views.some((view) => view.fatigue);
  const decayViews = views.filter((view) => view.decayCurve);

  if (!hasFatigue && !decayViews.length) {
    return (
      <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
        <SectionHeader icon={<Activity className="size-4" />} title="Fatigue forecast" />
        <EmptyPanel message="No fatigue profiles were returned for this run." />
      </section>
    );
  }

  return (
    <section className="grid gap-5">
      {decayViews.length ? <DecayCurveChart views={decayViews} /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {views.map((view) => (
          <FatigueVisualCard key={view.id} view={view} />
        ))}
      </div>
    </section>
  );
}

function RankedVariantCard({ view, compact = false }: { view: VariantView; compact?: boolean }) {
  return (
    <article className="rounded-[14px] border border-[var(--pp-border)] bg-pp-panel p-3 shadow-panel">
      <div className="flex gap-3">
        <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-[8px] bg-pp-elevated">
          <VariantImage view={view} className="h-full w-full object-cover" />
          <span className="absolute left-1 top-1 rounded-[6px] bg-pp-bg/80 px-1.5 py-0.5 text-xs font-semibold text-pp-white">
            #{view.analysis.rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-pp-white">{view.label}</p>
              <p className="mt-0.5 truncate text-xs text-pp-muted">{view.creative?.appName ?? view.creative?.label ?? view.id}</p>
            </div>
            <ActionPill action={view.analysis.action} />
          </div>
          <MetricBar label="Score" value={view.analysis.score} max={100} color={actionStyles[view.analysis.action].color} />
          {!compact ? <MetricBar label="Health" value={view.analysis.creativeHealth} max={100} color="#8fa2ff" /> : null}
          <div className="mt-2 flex flex-wrap gap-1">
            <SmallChip>{view.analysis.swarmConfidence} confidence</SmallChip>
            <SmallChip>{humanizeBehavior(view.analysis.dominantBehaviorState)}</SmallChip>
          </div>
        </div>
      </div>
    </article>
  );
}

function CompareVariantCard({ view }: { view: VariantView }) {
  return (
    <article className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
      <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
        <div className="relative aspect-[9/13] overflow-hidden rounded-[10px] bg-pp-elevated">
          <VariantImage view={view} className="h-full w-full object-cover" />
          <span className="absolute left-2 top-2 rounded-[6px] bg-pp-bg/80 px-2 py-1 text-xs font-semibold text-pp-white">
            #{view.analysis.rank}
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-pp-white">{view.label}</h3>
            <ActionPill action={view.analysis.action} />
            <UrgencyBadge urgency={view.fatigue?.urgency} />
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-pp-secondary">{view.analysis.predictedOutcome}</p>
          <div className="mt-3 grid gap-2">
            <MetricBar label="Score" value={view.analysis.score} max={100} color={actionStyles[view.analysis.action].color} />
            <MetricBar label="Creative health" value={view.analysis.creativeHealth} max={100} color="#8fa2ff" />
            <MetricBar label="Fatigue health" value={view.fatigue?.healthScore ?? null} max={100} color={fatigueColor(view.fatigue)} />
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricCluster title="Swarm scores" view={view} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-pp-muted">Behavior</p>
          <div className="mt-2">
            <BehaviorStack probabilities={view.analysis.behaviorProbabilities} />
          </div>
        </div>
      </div>
    </article>
  );
}

function PersonaHeatmapRow({ personaName, views }: { personaName: string; views: VariantView[] }) {
  return (
    <>
      <div className="rounded-[8px] bg-pp-elevated px-3 py-2 text-sm font-medium text-pp-white">{personaName}</div>
      {views.map((view) => {
        const review = view.reviews.find((item) => item.agentName === personaName);
        const value = review?.conversionIntent ?? null;
        return <HeatmapCell key={`${personaName}-${view.id}`} value={value} detail={review?.recommendation} />;
      })}
    </>
  );
}

function ActionForecastCard({ view }: { view: VariantView }) {
  const totals = view.personaForecast?.totals;
  return (
    <article className="rounded-[12px] border border-[var(--pp-border)] bg-pp-elevated p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-10 overflow-hidden rounded-[6px] bg-pp-panel">
            <VariantImage view={view} className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="font-medium text-pp-white">{view.label}</p>
            <p className="text-xs text-pp-muted">{formatNumber(view.personaForecast?.projectedViews)} projected views</p>
          </div>
        </div>
        <div className="min-w-0 flex-1 md:max-w-xl">
          <BehaviorCountStack totals={totals} />
        </div>
      </div>
    </article>
  );
}

function FatigueVisualCard({ view }: { view: VariantView }) {
  const profile = view.fatigue;
  const curve = view.decayCurve;
  const lifespanDays = resolveLifespanDays(view);

  return (
    <article className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
      <div className="flex items-start gap-3">
        <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-[8px] bg-pp-elevated">
          <VariantImage view={view} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-pp-white">{view.label}</h3>
            <UrgencyBadge urgency={profile?.urgency} />
          </div>
          <MetricBar label="Fatigue health" value={profile?.healthScore ?? null} max={100} color={fatigueColor(profile)} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MetricTile icon={<Timer className="size-4" />} label="Lifespan" value={lifespanDays ? `${lifespanDays}d` : "n/a"} />
            <MetricTile icon={<Activity className="size-4" />} label="CTR decay" value={profile?.ctrDecayPct !== null && profile?.ctrDecayPct !== undefined ? formatPct(Math.abs(profile.ctrDecayPct), 0) : "n/a"} />
            <MetricTile icon={<FlaskConical className="size-4" />} label="Sim day" value={curve ? `Day ${curve.fatiguePredictionDay}` : "n/a"} />
            <MetricTile icon={<Gauge className="size-4" />} label="Confidence" value={curve?.fatigueConfidence ?? "n/a"} />
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SignalChips title="Strengths" items={profile?.visualStrengths ?? []} tone="success" />
        <SignalChips title="Risks" items={profile?.visualRiskFactors ?? []} tone="warning" />
      </div>
    </article>
  );
}

type DecayChartRow = {
  day: number;
  [key: string]: number;
};

function DecayCurveChart({ views }: { views: VariantView[] }) {
  const chartData: DecayChartRow[] = Array.from({ length: 14 }, (_, index) => {
    const row: DecayChartRow = { day: index + 1 };

    views.forEach((view, viewIndex) => {
      const curve = view.decayCurve;
      if (!curve) return;
      const directResponseScale = directResponseIntentFor(view) ?? 1;
      row[`v${viewIndex}Ctr`] = Number((curve.ctrCurve[index] * directResponseScale * 100).toFixed(4));
      row[`v${viewIndex}Low`] = Number((curve.bandLow[index] * directResponseScale * 100).toFixed(4));
      row[`v${viewIndex}High`] = Number((curve.bandHigh[index] * directResponseScale * 100).toFixed(4));
    });

    return row;
  });
  const earliestDay = Math.min(...views.map((view) => view.decayCurve?.fatiguePredictionDay ?? 14));

  return (
    <section className="rounded-[16px] border border-pp-purple/25 bg-pp-panel p-4 shadow-panel">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader icon={<FlaskConical className="size-4" />} title="14-day attention-weighted decay" />
        <Pill className="border-pp-error/30 bg-pp-error/10 text-pp-error">
          <ShieldAlert className="size-3.5" />
          Earliest drop day {earliestDay}
        </Pill>
      </div>

      <div className="mb-3 flex flex-wrap gap-3">
        {views.map((view, index) => {
          const curve = view.decayCurve!;
          const color = variantColors[index % variantColors.length];
          return (
            <div key={view.id} className="flex items-center gap-2 text-xs text-pp-secondary">
              <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span>{view.label}</span>
              <SmallChip>Day {curve.fatiguePredictionDay}</SmallChip>
              <SmallChip>Intent {formatPct(directResponseIntentFor(view) ?? 1, 0)}</SmallChip>
              <span className="capitalize text-pp-muted">{curve.fatigueConfidence} confidence</span>
            </div>
          );
        })}
      </div>

      <div className="h-72 min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(199,183,255,0.08)" />
            <XAxis
              dataKey="day"
              tickFormatter={(value: number) => `D${value}`}
              tick={{ fontSize: 11, fill: "#8e87a6" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(value: number) => `${formatNumber(value, 2)}%`}
              tick={{ fontSize: 11, fill: "#8e87a6" }}
              axisLine={false}
              tickLine={false}
              width={72}
              label={{
                value: "Audience attention index",
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle", fill: "#c7b7ff", fontSize: 11 },
              }}
            />
            <Tooltip
              formatter={(value, name) => [
                typeof value === "number" ? `${formatNumber(value, 3)}%` : String(value),
                String(name),
              ]}
              contentStyle={{ backgroundColor: "#111626", borderColor: "rgba(199,183,255,0.14)", borderRadius: "10px", color: "#f6f6fb" }}
              labelFormatter={(label) => `Day ${label}`}
              labelStyle={{ color: "#c7b7ff", fontWeight: 600 }}
              itemStyle={{ color: "#c9c3dd" }}
            />

            {views.map((view, index) => {
              const color = variantColors[index % variantColors.length];
              return [
                <Area
                  key={`${view.id}-band`}
                  dataKey={`v${index}High`}
                  fill={color}
                  fillOpacity={0.06}
                  stroke="none"
                  legendType="none"
                  tooltipType="none"
                  activeDot={false}
                  isAnimationActive={false}
                />,
                <Line
                  key={`${view.id}-low`}
                  dataKey={`v${index}Low`}
                  stroke={color}
                  strokeDasharray="2 3"
                  strokeOpacity={0.25}
                  strokeWidth={1}
                  dot={false}
                  activeDot={false}
                  legendType="none"
                  tooltipType="none"
                />,
                <Line
                  key={`${view.id}-high`}
                  dataKey={`v${index}High`}
                  stroke={color}
                  strokeDasharray="2 3"
                  strokeOpacity={0.25}
                  strokeWidth={1}
                  dot={false}
                  activeDot={false}
                  legendType="none"
                  tooltipType="none"
                />,
              ];
            })}

            {views.map((view, index) => {
              const color = variantColors[index % variantColors.length];
              return (
                <Line
                  key={`${view.id}-ctr`}
                  dataKey={`v${index}Ctr`}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: color }}
                  name={`${view.label} attention index`}
                />
              );
            })}

            {views.map((view) => (
              <ReferenceLine
                key={`${view.id}-fatigue-line`}
                x={view.decayCurve!.fatiguePredictionDay}
                stroke="#ff6b7a"
                strokeDasharray="4 3"
                strokeWidth={1.5}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-xs text-pp-muted">
        Lines show projected CTR weighted by direct-response intent from the Performance Marketer. Dashed lines mark the raw simulated day of a 30% CTR drop.
      </p>
    </section>
  );
}

function CopilotPanel({ report, creatives, brief }: { report: FinalReport; creatives: CreativeDoc[]; brief: CampaignBrief }) {
  const [question, setQuestion] = useState("Why did the losing variant lose?");
  const [answer, setAnswer] = useState<CopilotAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, report, creatives, brief }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Copilot answer failed.");
      }
      setAnswer(payload.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copilot answer failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <details className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-pp-white">
          <MessageSquareText className="size-4 text-pp-violet" />
          Copilot Q&A
        </span>
        <span className="text-xs text-pp-muted">Ask follow-up</span>
      </summary>
      <div className="mt-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="min-w-0 flex-1 rounded-[10px] border border-[var(--pp-border-strong)] bg-[rgba(7,9,18,0.72)] px-3 py-2 text-sm text-pp-white outline-none placeholder:text-pp-muted focus:border-pp-violet focus:shadow-[0_0_0_3px_rgba(123,63,242,0.16)]"
          />
          <button
            type="button"
            onClick={ask}
            disabled={loading || !question.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-pp-lavender/25 bg-pp-elevated px-4 text-sm font-medium text-pp-white transition hover:border-pp-lavender/40 hover:bg-pp-purple/15 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loading ? <span className="size-4 animate-spin rounded-full border-2 border-pp-violet border-t-transparent" /> : <Bot className="size-4" />}
            Ask
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-pp-error">{error}</p> : null}
        {answer ? (
          <div className="mt-3 rounded-[10px] bg-pp-elevated p-3 text-sm text-pp-secondary">
            <p>{answer.answer}</p>
            <p className="mt-2 font-medium text-pp-white">{answer.nextAction}</p>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function ScoreboardRow({ view, maxScore }: { view: VariantView; maxScore: number }) {
  return (
    <div className="grid gap-3 rounded-[10px] border border-[var(--pp-border)] bg-pp-elevated p-3 md:grid-cols-[52px_96px_minmax(0,1fr)_100px] md:items-center">
      <div className="text-lg font-semibold text-pp-white">#{view.analysis.rank}</div>
      <div className="relative h-24 w-16 overflow-hidden rounded-[8px] bg-pp-panel md:h-20 md:w-14">
        <VariantImage view={view} className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-pp-white">{view.label}</p>
          <ActionPill action={view.analysis.action} />
          <UrgencyBadge urgency={view.fatigue?.urgency} />
        </div>
        <p className="mt-1 line-clamp-1 text-sm text-pp-muted">{view.analysis.predictedOutcome}</p>
        <MetricBar label="Score" value={view.analysis.score} max={maxScore} color={actionStyles[view.analysis.action].color} />
      </div>
      <div className="text-left md:text-right">
        <p className="text-2xl font-semibold text-pp-white">{Math.round(view.analysis.score)}</p>
        <p className="text-xs text-pp-muted">{view.analysis.swarmConfidence} confidence</p>
      </div>
    </div>
  );
}

function MatrixRow({ label, values }: { label: string; values: Array<{ label: string; value: number | null; max: number }> }) {
  return (
    <div className="grid items-center gap-2 rounded-[10px] bg-pp-elevated p-2" style={{ gridTemplateColumns: `120px repeat(${values.length}, minmax(110px, 1fr))` }}>
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-pp-muted">{label}</div>
      {values.map((item) => (
        <div key={`${label}-${item.label}`} className="rounded-[8px] bg-pp-panel px-2 py-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-pp-muted">{item.label}</span>
            <span className="font-semibold text-pp-white">{item.value === null ? "n/a" : formatNumber(item.value, item.max === 10 ? 1 : 0)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-pp-elevated">
            <div className="h-full rounded-full bg-pp-violet" style={{ width: `${percentOf(item.value, item.max)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricCluster({ title, view }: { title: string; view: VariantView }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-pp-muted">{title}</p>
      <div className="mt-2 grid gap-2">
        {scoreMetrics.map((metricItem) => (
          <MetricBar
            key={metricItem.key}
            label={metricItem.label}
            value={view.scores[metricItem.key]}
            max={10}
            color={metricItem.key === "trust" ? "#58d68d" : metricItem.key === "conversionIntent" ? "#9d64f6" : "#8fa2ff"}
          />
        ))}
      </div>
    </div>
  );
}

function MetricBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number | null;
  max: number;
  color: string;
}) {
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="text-pp-muted">{label}</span>
        <span className="font-semibold text-pp-white">{value === null ? "n/a" : formatNumber(value, max === 10 ? 1 : 0)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-pp-elevated">
        <div className="h-full rounded-full" style={{ width: `${percentOf(value, max)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function BehaviorStack({ probabilities }: { probabilities?: VariantAnalysis["behaviorProbabilities"] }) {
  if (!probabilities) {
    return <div className="h-8 rounded-[8px] bg-pp-elevated" />;
  }

  const colors = {
    skip: "bg-pp-disabled",
    click: "bg-pp-info",
    convert: "bg-pp-success",
    exit: "bg-pp-error",
  };

  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-pp-elevated">
        {behaviorStates.map((state) => (
          <div key={state} className={colors[state]} style={{ width: `${probabilities[state] * 100}%` }} />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1 text-[11px] text-pp-muted">
        {behaviorStates.map((state) => (
          <span key={state} className="truncate">
            {humanizeBehavior(state)} {formatPct(probabilities[state], 2)}
          </span>
        ))}
      </div>
    </div>
  );
}

function BehaviorCountStack({ totals }: { totals?: PersonaActionForecast["totals"] }) {
  if (!totals) {
    return <EmptyPanel message="No persona forecast was generated." compact />;
  }

  const total = behaviorStates.reduce((sum, state) => sum + totals[state], 0);
  const colors = {
    skip: "bg-pp-disabled",
    click: "bg-pp-info",
    convert: "bg-pp-success",
    exit: "bg-pp-error",
  };

  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-pp-panel">
        {behaviorStates.map((state) => (
          <div key={state} className={colors[state]} style={{ width: `${total ? (totals[state] / total) * 100 : 0}%` }} />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {behaviorStates.map((state) => (
          <div key={state} className="rounded-[8px] bg-pp-panel px-2 py-1">
            <p className="text-[11px] text-pp-muted">{humanizeBehavior(state)}</p>
            <p className="text-sm font-semibold text-pp-white">{formatNumber(totals[state])}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeatmapCell({ value, detail }: { value: number | null; detail?: string }) {
  const pct = percentOf(value, 10);
  return (
    <div
      className="rounded-[8px] border px-3 py-2 text-sm font-semibold text-pp-white"
      style={{
        borderColor: heatColor(pct, 0.34),
        backgroundColor: heatColor(pct, 0.16),
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span>{value === null ? "n/a" : formatNumber(value, 1)}</span>
        {detail ? <span className="text-xs font-medium capitalize text-pp-muted">{detail}</span> : null}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-pp-panel">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: heatColor(pct, 0.9) }} />
      </div>
    </div>
  );
}

function MetricTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--pp-border)] bg-pp-elevated px-3 py-2">
      <div className="flex items-center gap-2 text-pp-muted">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-[0.12em]">{label}</span>
      </div>
      <p className="mt-2 text-lg font-semibold text-pp-white">{value}</p>
    </div>
  );
}

function VisualListPanel({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone: "success" | "warning" | "info";
}) {
  const toneClass = {
    success: "border-pp-success/25 bg-pp-success/10 text-pp-success",
    warning: "border-pp-warning/25 bg-pp-warning/10 text-pp-warning",
    info: "border-pp-info/25 bg-pp-info/10 text-pp-info",
  }[tone];

  return (
    <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
      <SectionHeader icon={icon} title={title} />
      <div className="mt-3 grid gap-2">
        {items.length ? (
          items.map((item) => (
            <div key={item} className={cn("rounded-[10px] border px-3 py-2 text-sm", toneClass)}>
              {item}
            </div>
          ))
        ) : (
          <EmptyPanel message="No items were returned." compact />
        )}
      </div>
    </section>
  );
}

function SignalChips({ title, items, tone }: { title: string; items: string[]; tone: "success" | "warning" }) {
  const className =
    tone === "success"
      ? "border-pp-success/25 bg-pp-success/10 text-pp-success"
      : "border-pp-warning/25 bg-pp-warning/10 text-pp-warning";

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-pp-muted">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.length ? (
          items.slice(0, 4).map((item) => (
            <span key={item} className={cn("rounded-[8px] border px-2 py-1 text-xs", className)}>
              {item}
            </span>
          ))
        ) : (
          <span className="text-xs text-pp-muted">No signals</span>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-pp-violet">
      {icon}
      <h2 className="text-sm font-semibold text-pp-white">{title}</h2>
    </div>
  );
}

function ScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="relative grid size-28 place-items-center rounded-full" style={{ background: `conic-gradient(${color} ${clamped * 3.6}deg, rgba(199,183,255,0.12) 0deg)` }}>
      <div className="grid size-[86px] place-items-center rounded-full bg-pp-panel text-center">
        <div>
          <p className="text-2xl font-semibold text-pp-white">{Math.round(value)}</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-pp-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}

function VariantImage({ view, priority = false, className }: { view?: VariantView; priority?: boolean; className?: string }) {
  const src = view?.creative?.thumbnailUrl ?? view?.creative?.assetUrl;

  if (!src) {
    return (
      <div className={cn("grid place-items-center bg-pp-elevated text-xs text-pp-muted", className)}>
        No image
      </div>
    );
  }

  return <Image src={src} alt="" fill priority={priority} sizes="(max-width: 768px) 80vw, 420px" className={className} />;
}

function ActionPill({ action }: { action: VariantAnalysis["action"] }) {
  const styles = actionStyles[action];
  return <Pill className={cn(styles.border, styles.bg, styles.text)}>{styles.label}</Pill>;
}

function UrgencyBadge({ urgency }: { urgency?: FatigueProfile["urgency"] }) {
  if (!urgency) {
    return <Pill className="border-[var(--pp-border)] bg-pp-elevated text-pp-muted">Fatigue n/a</Pill>;
  }

  const styles: Record<FatigueProfile["urgency"], string> = {
    HEALTHY: "border-pp-success/30 bg-pp-success/15 text-pp-success",
    WATCH: "border-pp-warning/30 bg-pp-warning/15 text-pp-warning",
    INTERVENE: "border-[#ff9632]/30 bg-[#ff9632]/15 text-[#ff9632]",
    PAUSE: "border-pp-error/30 bg-pp-error/15 text-pp-error",
  };

  return <Pill className={styles[urgency]}>{urgency}</Pill>;
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-[7px] border px-2.5 py-1 text-xs font-semibold", className)}>
      {children}
    </span>
  );
}

function SmallChip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex min-h-6 items-center rounded-[6px] bg-pp-purple/15 px-2 py-1 text-xs font-medium text-pp-lavender">{children}</span>;
}

function EmptyPanel({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-[10px] border border-dashed border-[var(--pp-border)] text-sm text-pp-muted", compact ? "px-3 py-2" : "mt-4 p-4")}>
      {message}
    </div>
  );
}

function buildVariantViews(report: FinalReport, creatives: CreativeDoc[], reviews: AgentReview[]): VariantView[] {
  const fatigueById = new Map((report.fatigueProfiles ?? []).map((profile) => [profile.creativeId, profile]));
  const decayById = new Map((report.decayCurves ?? []).map((curve) => [curve.variantId, curve]));
  const forecastById = new Map((report.personaActionForecast ?? []).map((forecast) => [forecast.variantId, forecast]));
  const reviewsById = new Map<string, AgentReview[]>();

  for (const review of reviews) {
    const existing = reviewsById.get(review.variantId) ?? [];
    existing.push(review);
    reviewsById.set(review.variantId, existing);
  }

  return [...report.ranking]
    .sort((a, b) => a.rank - b.rank)
    .map((analysis) => {
      const creative = creatives.find((item) => item.id === analysis.variantId) ?? null;
      const variantReviews = reviewsById.get(analysis.variantId) ?? [];
      return {
        id: analysis.variantId,
        label: labelFor(analysis.variantId, creatives),
        creative,
        analysis,
        fatigue: fatigueById.get(analysis.variantId) ?? (creative ? fatigueById.get(creative.id) : undefined),
        decayCurve: decayById.get(analysis.variantId) ?? (creative ? decayById.get(creative.id) : undefined),
        reviews: variantReviews,
        personaForecast: forecastById.get(analysis.variantId),
        scores: averageScores(variantReviews),
      };
    });
}

function averageScores(reviews: AgentReview[]): ScoreSet {
  if (!reviews.length) {
    return { attention: null, clarity: null, trust: null, conversionIntent: null };
  }

  return {
    attention: average(reviews.map((review) => review.attention)),
    clarity: average(reviews.map((review) => review.clarity)),
    trust: average(reviews.map((review) => review.trust)),
    conversionIntent: average(reviews.map((review) => review.conversionIntent)),
  };
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentOf(value: number | null | undefined, max: number) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function resolveLifespanDays(view: VariantView) {
  const candidates = [
    view.fatigue?.estimatedLifespanDays,
    view.analysis.fatiguePredictionDay,
    view.decayCurve?.fatiguePredictionDay,
  ];
  const value = candidates.find((candidate) => typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0);
  return value ? Math.round(value) : null;
}

function directResponseIntentFor(view: VariantView) {
  const marketerIntent = view.reviews.find((review) => review.agentName === "Performance Marketer")?.directResponseIntent;
  if (typeof marketerIntent === "number" && Number.isFinite(marketerIntent)) {
    return clamp01(marketerIntent);
  }

  const scored = view.reviews
    .map((review) => review.directResponseIntent)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (!scored.length) {
    return null;
  }

  return clamp01(average(scored) ?? 1);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function heatColor(percent: number, alpha: number) {
  if (percent >= 72) return `rgba(88, 214, 141, ${alpha})`;
  if (percent >= 48) return `rgba(245, 176, 65, ${alpha})`;
  return `rgba(255, 107, 122, ${alpha})`;
}

function fatigueColor(profile?: FatigueProfile) {
  if (!profile) return "#5d5870";
  if (profile.healthScore >= 70) return "#58d68d";
  if (profile.healthScore >= 45) return "#f5b041";
  if (profile.healthScore >= 25) return "#ff9632";
  return "#ff6b7a";
}

function fatigueLabel(view?: VariantView) {
  if (!view?.fatigue) return "n/a";
  return `${view.fatigue.healthScore}/100`;
}

function labelFor(variantId: string, creatives: CreativeDoc[]) {
  const index = creatives.findIndex((creative) => creative.id === variantId);
  return index >= 0 ? `Variant ${index + 1}` : variantId;
}

function planVariantLabel(value: string, views: VariantView[]) {
  const match = views.find((view) => view.id === value || view.label === value || view.creative?.id === value);
  return match?.label ?? value;
}

function humanizeBehavior(value: string) {
  switch (value) {
    case "skip":
      return "Skip";
    case "ignore":
      return "Ignore";
    case "inspect":
      return "Inspect";
    case "click":
      return "Click";
    case "convert":
      return "Convert";
    case "exit":
      return "Exit";
    default:
      return value;
  }
}
