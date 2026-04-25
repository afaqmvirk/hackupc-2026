"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bot,
  Check,
  ChevronRight,
  FileImage,
  FlaskConical,
  Layers3,
  Loader2,
  MessageSquareText,
  Search,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  defaultProjectedViews,
  type AgentReview,
  type AnalysisInputMode,
  type CampaignBrief,
  type CopilotAnswer,
  type CreativeDoc,
  type EvidencePack,
  type FatigueProfile,
  type FinalReport,
} from "@/lib/schemas";
import { cn, formatNumber, formatPct } from "@/lib/utils";

type Catalog = {
  filters: {
    categories: string[];
    countries: string[];
    languages: string[];
    operatingSystems: string[];
    objectives: string[];
    formats: string[];
  };
  creatives: CreativeDoc[];
};

type SwarmMessage =
  | { id: string; type: "status"; message: string }
  | { id: string; type: "agent"; review: AgentReview }
  | { id: string; type: "evidence"; pack: EvidencePack }
  | { id: string; type: "error"; message: string };

const defaultBrief: CampaignBrief = {
  category: "gaming",
  region: "global",
  language: "any",
  os: "any",
  objective: "installs",
  audienceStyle: "casual mobile users",
};

const forecastActionStates = ["skip", "click", "convert", "exit"] as const;

export function CreativeSwarmApp() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [brief, setBrief] = useState<CampaignBrief>(defaultBrief);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [uploadedCreatives, setUploadedCreatives] = useState<CreativeDoc[]>([]);
  const [analysisInputMode, setAnalysisInputMode] = useState<AnalysisInputMode>("evidence");
  const [projectedViews, setProjectedViews] = useState(defaultProjectedViews);
  const [messages, setMessages] = useState<SwarmMessage[]>([]);
  const [report, setReport] = useState<FinalReport | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const url = new URL("/api/catalog", window.location.origin);
    url.searchParams.set("category", brief.category);
    if (brief.language !== "any") url.searchParams.set("language", brief.language);
    url.searchParams.set("limit", "120");

    fetch(url)
      .then((response) => response.json())
      .then((data) => setCatalog(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load catalog."));
  }, [brief.category, brief.language]);

  const selectedCreatives = useMemo(() => {
    const dataset = catalog?.creatives.filter((creative) => selectedIds.includes(creative.id)) ?? [];
    return [...dataset, ...uploadedCreatives];
  }, [catalog?.creatives, selectedIds, uploadedCreatives]);

  const filteredCreatives = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return catalog?.creatives ?? [];
    }

    return (
      catalog?.creatives.filter((creative) =>
        [
          creative.appName,
          creative.advertiserName,
          creative.features.headline,
          creative.features.ctaText,
          creative.format,
          creative.theme,
          creative.hookType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalized),
      ) ?? []
    );
  }, [catalog?.creatives, query]);

  const onDrop = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setIsUploading(true);
      setError(null);

      try {
        for (const file of files.slice(0, Math.max(0, 6 - selectedCreatives.length))) {
          const form = new FormData();
          form.append("file", file);
          form.append("brief", JSON.stringify(brief));

          const response = await fetch("/api/uploads", {
            method: "POST",
            body: form,
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload.error ?? "Upload failed.");
          }
          setUploadedCreatives((current) => [...current, payload.creative]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setIsUploading(false);
      }
    },
    [brief, selectedCreatives.length],
  );

  const dropzone = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
    },
    maxFiles: 6,
    disabled: isUploading || selectedCreatives.length >= 6,
  });

  const toggleCreative = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      if (current.length + uploadedCreatives.length >= 6) {
        return current;
      }
      return [...current, id];
    });
  };

  const analyze = async () => {
    setError(null);
    setReport(null);
    setMessages([]);
    setIsAnalyzing(true);

    try {
      const createResponse = await fetch("/api/experiments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brief,
          analysisInputMode,
          projectedViews,
          creativeIds: selectedIds,
          uploadedCreatives,
        }),
      });
      const createPayload = await createResponse.json();
      if (!createResponse.ok) {
        throw new Error(createPayload.error ?? "Could not create experiment.");
      }

      const analyzeResponse = await fetch(`/api/experiments/${createPayload.experiment.id}/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ experiment: createPayload.experiment }),
      });

      if (!analyzeResponse.ok) {
        const payload = await analyzeResponse.json().catch(() => null);
        throw new Error(payload?.error ?? "Analysis request failed.");
      }

      if (!analyzeResponse.body) {
        throw new Error("Analysis stream did not start.");
      }

      const reader = analyzeResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffered = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffered += decoder.decode(value, { stream: true });
        const lines = buffered.split("\n");
        buffered = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "report") {
            setReport(event.report);
          } else if (event.type === "error") {
            setError(event.message);
            setMessages((current) => [...current, { id: crypto.randomUUID(), type: "error", message: event.message }]);
          } else {
            setMessages((current) => [...current, { id: crypto.randomUUID(), ...event }]);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const canAnalyze = selectedCreatives.length >= 2 && selectedCreatives.length <= 6 && projectedViews > 0 && !isAnalyzing;

  return (
    <main className="min-h-screen bg-pp-bg text-pp-white">
      <div className="mx-auto flex max-w-[1520px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-[var(--pp-border)] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-pp-muted">
              <Sparkles className="size-4 text-pp-violet" />
              Creative Swarm Copilot
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-pp-white">
              Campaign Brief
            </h1>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <AgentInputModeToggle value={analysisInputMode} onChange={setAnalysisInputMode} disabled={isAnalyzing} />
              <button
                type="button"
                onClick={analyze}
                disabled={!canAnalyze}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-pp-lavender/25 bg-gradient-to-br from-pp-purple to-pp-violet px-5 text-sm font-medium text-pp-white shadow-glow transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isAnalyzing ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
                Run Gemini swarm
                <ChevronRight className="size-4" />
              </button>
            </div>
            {analysisInputMode === "image_only" ? (
              <p className="max-w-[440px] text-xs text-pp-muted">
                Agents see only image + brief. No historical metrics, benchmarks, or similar creatives are sent.
              </p>
            ) : null}
          </div>
        </header>

        {error ? (
          <div className="flex items-start gap-3 rounded-[10px] border border-pp-error/30 bg-pp-error/10 px-4 py-3 text-sm text-pp-error">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4">
            <BriefPanel catalog={catalog} brief={brief} setBrief={setBrief} projectedViews={projectedViews} setProjectedViews={setProjectedViews} />
            <SelectedPanel
              creatives={selectedCreatives}
              onRemove={(creative) => {
                if (creative.source === "dataset") {
                  setSelectedIds((current) => current.filter((id) => id !== creative.id));
                } else {
                  setUploadedCreatives((current) => current.filter((item) => item.id !== creative.id));
                }
              }}
            />
            <UploadPanel dropzone={dropzone} isUploading={isUploading} disabled={selectedCreatives.length >= 6} />
          </aside>

          <div className="flex flex-col gap-5">
            <CreativeLibrary
              creatives={filteredCreatives}
              selectedIds={selectedIds}
              query={query}
              setQuery={setQuery}
              toggleCreative={toggleCreative}
            />
            <SwarmRoom messages={messages} isAnalyzing={isAnalyzing} />
            <ResultsDashboard report={report} creatives={selectedCreatives} brief={brief} />
          </div>
        </section>
      </div>
    </main>
  );
}

function AgentInputModeToggle({
  value,
  onChange,
  disabled,
}: {
  value: AnalysisInputMode;
  onChange: (value: AnalysisInputMode) => void;
  disabled: boolean;
}) {
  const options: Array<{ value: AnalysisInputMode; label: string }> = [
    { value: "evidence", label: "Evidence" },
    { value: "image_only", label: "Image only" },
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs font-semibold uppercase tracking-[0.12em] text-pp-muted sm:inline">Agent Input</span>
      <div className="inline-flex h-11 items-center rounded-[10px] border border-[var(--pp-border-strong)] bg-pp-elevated p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={cn(
              "h-9 rounded-[8px] px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
              value === option.value ? "bg-pp-purple text-pp-white shadow-glow" : "text-pp-muted hover:text-pp-white",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BriefPanel({
  catalog,
  brief,
  setBrief,
  projectedViews,
  setProjectedViews,
}: {
  catalog: Catalog | null;
  brief: CampaignBrief;
  setBrief: (brief: CampaignBrief) => void;
  projectedViews: number;
  setProjectedViews: (projectedViews: number) => void;
}) {
  const update = (key: keyof CampaignBrief, value: string) => setBrief({ ...brief, [key]: value });
  const updateProjectedViews = (value: number) => {
    if (!Number.isFinite(value)) return;
    setProjectedViews(Math.max(1, Math.round(value)));
  };

  return (
    <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
      <div className="mb-4 flex items-center gap-2">
        <Layers3 className="size-4 text-pp-violet" />
        <h2 className="text-sm font-semibold text-pp-white">Brief</h2>
      </div>
      <div className="grid gap-3">
        <Field label="Category">
          <Select value={brief.category} onChange={(value) => update("category", value)} options={catalog?.filters.categories ?? ["gaming"]} />
        </Field>
        <Field label="Region">
          <Select value={brief.region} onChange={(value) => update("region", value)} options={catalog?.filters.countries ?? ["global"]} />
        </Field>
        <Field label="Language">
          <Select value={brief.language} onChange={(value) => update("language", value)} options={catalog?.filters.languages ?? ["any"]} />
        </Field>
        <Field label="OS">
          <Select value={brief.os} onChange={(value) => update("os", value)} options={catalog?.filters.operatingSystems ?? ["any"]} />
        </Field>
        <Field label="Objective">
          <Select value={brief.objective} onChange={(value) => update("objective", value)} options={catalog?.filters.objectives ?? ["installs"]} />
        </Field>
        <Field label="Audience">
          <input
            value={brief.audienceStyle ?? ""}
            onChange={(event) => update("audienceStyle", event.target.value)}
            className="h-10 rounded-[10px] border border-[var(--pp-border-strong)] bg-[rgba(7,9,18,0.72)] px-3 text-sm text-pp-white outline-none placeholder:text-pp-muted focus:border-pp-violet focus:shadow-[0_0_0_3px_rgba(123,63,242,0.16)]"
          />
        </Field>
        <Field label="Projected views">
          <input
            type="number"
            min={1}
            step={1000}
            value={projectedViews}
            onChange={(event) => updateProjectedViews(event.currentTarget.valueAsNumber)}
            className="h-10 rounded-[10px] border border-[var(--pp-border-strong)] bg-[rgba(7,9,18,0.72)] px-3 text-sm text-pp-white outline-none placeholder:text-pp-muted focus:border-pp-violet focus:shadow-[0_0_0_3px_rgba(123,63,242,0.16)]"
          />
        </Field>
      </div>
    </section>
  );
}

function SelectedPanel({ creatives, onRemove }: { creatives: CreativeDoc[]; onRemove: (creative: CreativeDoc) => void }) {
  return (
    <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Check className="size-4 text-pp-violet" />
          <h2 className="text-sm font-semibold text-pp-white">Variants</h2>
        </div>
        <span className="text-xs font-medium text-pp-muted">{creatives.length}/6</span>
      </div>
      <div className="grid gap-2">
        {creatives.length ? (
          creatives.map((creative, index) => (
            <div key={creative.id} className="flex items-center gap-3 rounded-[10px] border border-[var(--pp-border)] bg-pp-elevated p-2">
              <Image
                src={creative.thumbnailUrl ?? creative.assetUrl}
                alt=""
                width={40}
                height={56}
                className="h-14 w-10 shrink-0 rounded-[6px] object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-pp-white">Variant {index + 1}</p>
                <p className="truncate text-xs text-pp-muted">{creative.features.headline || creative.label || creative.appName}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(creative)}
                className="inline-flex size-8 items-center justify-center rounded-[8px] text-pp-muted transition hover:bg-pp-elevated hover:text-pp-white"
                aria-label="Remove variant"
              >
                <X className="size-4" />
              </button>
            </div>
          ))
        ) : (
          <div className="rounded-[10px] border border-dashed border-[var(--pp-border)] p-3 text-sm text-pp-muted">Select 2-6 creatives.</div>
        )}
      </div>
    </section>
  );
}

function UploadPanel({
  dropzone,
  isUploading,
  disabled,
}: {
  dropzone: ReturnType<typeof useDropzone>;
  isUploading: boolean;
  disabled: boolean;
}) {
  return (
    <section
      {...dropzone.getRootProps()}
      className={cn(
        "cursor-pointer rounded-[16px] border border-dashed border-[var(--pp-border-strong)] bg-pp-panel p-4 shadow-panel transition",
        dropzone.isDragActive && "border-pp-purple bg-pp-purple/10",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input {...dropzone.getInputProps()} />
      <div className="flex items-center gap-3">
        <div className="inline-flex size-10 items-center justify-center rounded-[10px] bg-pp-elevated text-pp-lavender">
          {isUploading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-pp-white">Upload</h2>
          <p className="text-xs text-pp-muted">PNG, JPG, WEBP screenshots</p>
        </div>
      </div>
    </section>
  );
}

function CreativeLibrary({
  creatives,
  selectedIds,
  query,
  setQuery,
  toggleCreative,
}: {
  creatives: CreativeDoc[];
  selectedIds: string[];
  query: string;
  setQuery: (value: string) => void;
  toggleCreative: (id: string) => void;
}) {
  return (
    <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <FileImage className="size-4 text-pp-violet" />
          <h2 className="text-sm font-semibold text-pp-white">Creative Library</h2>
        </div>
        <label className="flex h-10 w-full items-center gap-2 rounded-[10px] border border-[var(--pp-border-strong)] bg-pp-elevated px-3 md:w-80">
          <Search className="size-4 text-pp-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search creatives"
            className="min-w-0 flex-1 bg-transparent text-sm text-pp-white outline-none placeholder:text-pp-muted"
          />
        </label>
      </div>
      <div className="grid max-h-[520px] gap-3 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {creatives.map((creative, index) => {
          const selected = selectedIds.includes(creative.id);
          return (
            <button
              type="button"
              key={creative.id}
              onClick={() => toggleCreative(creative.id)}
              className={cn(
                "grid grid-cols-[74px_minmax(0,1fr)] gap-3 rounded-[10px] border p-2 text-left transition hover:-translate-y-0.5",
                selected
                  ? "border-pp-purple bg-pp-purple/10"
                  : "border-[var(--pp-border)] hover:border-[var(--pp-border-strong)] hover:bg-pp-elevated",
              )}
            >
              <Image
                src={creative.thumbnailUrl ?? creative.assetUrl}
                alt=""
                width={74}
                height={112}
                loading={index < 6 ? "eager" : "lazy"}
                className="h-28 w-[74px] rounded-[6px] object-cover"
              />
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-pp-white">{creative.appName}</p>
                  {selected ? <Check className="size-4 shrink-0 text-pp-violet" /> : null}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-pp-secondary">{creative.features.headline}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge>{creative.format}</Badge>
                  <Badge>{creative.features.ctaText || "no CTA"}</Badge>
                  <Badge>{creative.metricsSummary?.creativeStatus ?? "unknown"}</Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-pp-muted">
                  <span>CTR {formatPct(creative.metricsSummary?.ctr, 2)}</span>
                  <span>CVR {formatPct(creative.metricsSummary?.cvr, 1)}</span>
                  <span>Clutter {metric(creative.features.visualClutter)}</span>
                  <span>Novelty {metric(creative.features.noveltyScore)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SwarmRoom({ messages, isAnalyzing }: { messages: SwarmMessage[]; isAnalyzing: boolean }) {
  const visible = messages.slice(-18);
  return (
    <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-elevated p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-pp-lavender" />
          <h2 className="text-sm font-semibold text-pp-white">Swarm Room</h2>
        </div>
        {isAnalyzing ? <Loader2 className="size-4 animate-spin text-pp-violet" /> : null}
      </div>
      <div className="grid max-h-80 gap-2 overflow-auto pr-1 lg:grid-cols-2">
        <AnimatePresence initial={false}>
          {visible.length ? (
            visible.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-[10px] border border-[var(--pp-border)] bg-pp-panel/80 p-3"
              >
                {message.type === "agent" ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-pp-lavender">
                      <span className="inline-flex items-center gap-2">
                        <MessageSquareText className="size-3.5" />
                        {message.review.agentName}
                      </span>
                      <BehaviorBadge state={message.review.behavior.primaryState} />
                    </div>
                    <p className="mt-2 text-sm text-pp-white">{message.review.reasoning}</p>
                    <p className="mt-2 text-xs text-pp-secondary">{message.review.behavior.rationale}</p>
                    <p className="mt-2 text-xs text-pp-muted">{behaviorMix(message.review.behavior.probabilities)}</p>
                    <p className="mt-2 text-xs text-pp-muted">{message.review.suggestedEdit}</p>
                  </>
                ) : message.type === "evidence" ? (
                  <>
                    <div className="flex items-center gap-2 text-xs font-semibold text-pp-info">
                      <BarChart3 className="size-3.5" />
                      {message.pack.variantLabel}
                    </div>
                    <p className="mt-2 text-sm text-pp-white">{message.pack.facts[1]}</p>
                    <p className="mt-2 text-xs text-pp-muted">{message.pack.benchmark.contextLabel}</p>
                  </>
                ) : message.type === "error" ? (
                  <p className="text-sm text-pp-error">{message.message}</p>
                ) : (
                  <p className="text-sm text-pp-secondary">{message.message}</p>
                )}
              </motion.div>
            ))
          ) : (
            <div className="rounded-[10px] border border-[var(--pp-border)] bg-pp-panel/80 p-3 text-sm text-pp-secondary">Awaiting analysis.</div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function ResultsDashboard({ report, creatives, brief }: { report: FinalReport | null; creatives: CreativeDoc[]; brief: CampaignBrief }) {
  if (!report) {
    return (
      <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-pp-violet" />
          <h2 className="text-sm font-semibold text-pp-white">Results</h2>
        </div>
        <div className="mt-3 rounded-[10px] border border-dashed border-[var(--pp-border)] p-4 text-sm text-pp-muted">
          Ranking, X-ray, and test plan appear after analysis.
        </div>
      </section>
    );
  }

  const chartData = report.ranking.map((item) => ({
    name: labelFor(item.variantId, creatives),
    score: item.score,
    health: item.creativeHealth,
  }));

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
      <div className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="size-4 text-pp-violet" />
          <h2 className="text-sm font-semibold text-pp-white">Ranking Dashboard</h2>
        </div>
        <div className="mb-4 rounded-[10px] border border-pp-purple/20 bg-pp-purple/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-pp-violet">Champion</p>
          <h3 className="mt-1 text-lg font-semibold text-pp-white">{report.champion}</h3>
          <p className="mt-2 text-sm text-pp-secondary">{report.executiveSummary}</p>
        </div>
        <div className="h-64 min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(199,183,255,0.08)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#8e87a6" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#8e87a6" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "#111626", borderColor: "rgba(199,183,255,0.14)", borderRadius: "10px", color: "#f6f6fb" }}
                labelStyle={{ color: "#c7b7ff", fontWeight: 600 }}
                itemStyle={{ color: "#c9c3dd" }}
                cursor={{ fill: "rgba(123,63,242,0.08)" }}
              />
              <Bar dataKey="score" fill="#7b3ff2" radius={[4, 4, 0, 0]} />
              <Bar dataKey="health" fill="#9d64f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 overflow-hidden rounded-[10px] border border-[var(--pp-border)]">
          {report.ranking.map((item) => (
            <div
              key={item.variantId}
              className="grid gap-3 border-b border-[var(--pp-border)] p-3 last:border-b-0 md:grid-cols-[56px_minmax(0,1fr)_120px_120px_120px] md:items-center"
            >
              <div className="text-lg font-semibold text-pp-white">#{item.rank}</div>
              <div>
                <p className="font-medium text-pp-white">{labelFor(item.variantId, creatives)}</p>
                <p className="text-sm text-pp-muted">{item.predictedOutcome}</p>
                <p className="mt-1 text-xs text-pp-secondary">{item.behaviorSummary}</p>
                <p className="mt-1 text-xs text-pp-muted">{behaviorMix(item.behaviorProbabilities)}</p>
              </div>
              <Badge>{item.swarmConfidence} confidence</Badge>
              <BehaviorBadge state={item.dominantBehaviorState} />
              <Badge>{item.action}</Badge>
            </div>
          ))}
        </div>
        <PersonaActionForecastPanel report={report} creatives={creatives} />
      </div>

      <div className="grid gap-5">
        {report.fatigueProfiles?.length ? (
          <FatiguePanel profiles={report.fatigueProfiles} creatives={creatives} />
        ) : null}
        <InfoPanel icon={<Check className="size-4" />} title="Why It Wins" items={report.whyItWins} />
        <InfoPanel icon={<ShieldAlert className="size-4" />} title="Risks" items={report.risks} />
        <InfoPanel icon={<ChevronRight className="size-4" />} title="Next Actions" items={report.whatToDoNext} />
        <CopilotPanel report={report} creatives={creatives} brief={brief} />
        <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
          <div className="mb-3 flex items-center gap-2">
            <FlaskConical className="size-4 text-pp-violet" />
            <h2 className="text-sm font-semibold text-pp-white">A/B Test Plan</h2>
          </div>
          <div className="grid gap-2 text-sm">
            {Object.entries(report.abTestPlan).map(([key, value]) => (
              <div key={key} className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 rounded-[8px] bg-pp-elevated px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-pp-muted">{humanize(key)}</span>
                <span className="text-pp-secondary">{value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function PersonaActionForecastPanel({ report, creatives }: { report: FinalReport; creatives: CreativeDoc[] }) {
  const forecasts = report.ranking
    .map((item) => report.personaActionForecast.find((forecast) => forecast.variantId === item.variantId))
    .filter((forecast): forecast is NonNullable<typeof forecast> => Boolean(forecast));

  if (!forecasts.length) {
    return null;
  }

  return (
    <section className="mt-5 rounded-[12px] border border-[var(--pp-border)] bg-pp-elevated p-4">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-pp-white">Persona Action Forecast</h2>
          <p className="mt-1 text-xs text-pp-muted">Expected actions from projected views and persona-weighted behavior probabilities.</p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-pp-muted">
          {formatNumber(forecasts[0]?.projectedViews)} views
        </span>
      </div>
      <div className="grid gap-4">
        {forecasts.map((forecast) => (
          <div key={forecast.variantId} className="rounded-[10px] border border-[var(--pp-border)] bg-pp-panel/70 p-3">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-medium text-pp-white">{labelFor(forecast.variantId, creatives)}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {forecastActionStates.map((action) => (
                  <div key={action} className="rounded-[8px] bg-pp-elevated px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-pp-muted">{humanizeBehavior(action)}</p>
                    <p className="text-sm font-semibold text-pp-white">{formatNumber(forecast.totals[action])}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left text-xs">
                <thead className="text-pp-muted">
                  <tr className="border-b border-[var(--pp-border)]">
                    <th className="py-2 pr-3 font-semibold">Persona</th>
                    <th className="px-3 py-2 font-semibold">Weight</th>
                    {forecastActionStates.map((action) => (
                      <th key={action} className="px-3 py-2 font-semibold">
                        {humanizeBehavior(action)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-pp-secondary">
                  {forecast.personas.map((persona) => (
                    <tr key={persona.agentName} className="border-b border-[var(--pp-border)] last:border-b-0">
                      <td className="py-2 pr-3 font-medium text-pp-white">{persona.agentName}</td>
                      <td className="px-3 py-2">{formatPct(persona.weight, 1)}</td>
                      {forecastActionStates.map((action) => (
                        <td key={action} className="px-3 py-2">
                          {formatNumber(persona.expectedActions[action])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
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
    <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
      <div className="mb-3 flex items-center gap-2">
        <MessageSquareText className="size-4 text-pp-violet" />
        <h2 className="text-sm font-semibold text-pp-white">Copilot Q&A</h2>
      </div>
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="min-w-0 flex-1 rounded-[10px] border border-[var(--pp-border-strong)] bg-[rgba(7,9,18,0.72)] px-3 text-sm text-pp-white outline-none placeholder:text-pp-muted focus:border-pp-violet focus:shadow-[0_0_0_3px_rgba(123,63,242,0.16)]"
        />
        <button
          type="button"
          onClick={ask}
          disabled={loading || !question.trim()}
          className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-pp-lavender/25 bg-gradient-to-br from-pp-purple to-pp-violet px-3 text-sm font-medium text-pp-white shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
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
    </section>
  );
}

function InfoPanel({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
      <div className="mb-3 flex items-center gap-2 text-pp-violet">
        {icon}
        <h2 className="text-sm font-semibold text-pp-white">{title}</h2>
      </div>
      <ul className="grid gap-2 text-sm text-pp-secondary">
        {items.map((item) => (
          <li key={item} className="rounded-[8px] bg-pp-elevated px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function FatiguePanel({ profiles, creatives }: { profiles: FatigueProfile[]; creatives: CreativeDoc[] }) {
  return (
    <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="size-4 text-pp-violet" />
        <h2 className="text-sm font-semibold text-pp-white">Fatigue Forecast</h2>
      </div>
      <div className="grid gap-3">
        {profiles.map((profile, index) => {
          const label = labelFor(profile.creativeId, creatives) || `Variant ${index + 1}`;
          return (
            <div key={profile.creativeId} className="rounded-[10px] border border-[var(--pp-border)] bg-pp-elevated p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-pp-white">{label}</span>
                <UrgencyBadge urgency={profile.urgency} />
              </div>

              {/* Health score bar */}
              <div className="mb-2">
                <div className="mb-1 flex items-center justify-between text-xs text-pp-muted">
                  <span>Fatigue Health</span>
                  <span className="font-semibold text-pp-white">{profile.healthScore}/100</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-pp-panel">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${profile.healthScore}%`,
                      background: healthGradient(profile.healthScore),
                    }}
                  />
                </div>
              </div>

              {/* Key metrics row */}
              <div className="mb-2 flex flex-wrap gap-3 text-xs text-pp-muted">
                {profile.estimatedLifespanDays !== null && (
                  <span>
                    Expected lifespan:{" "}
                    <span className="font-medium text-pp-secondary">{profile.estimatedLifespanDays}d</span>
                  </span>
                )}
                {profile.ctrDecayPct !== null && (
                  <span>
                    CTR decay:{" "}
                    <span className={cn("font-medium", Math.abs(profile.ctrDecayPct) > 0.5 ? "text-pp-error" : "text-pp-warning")}>
                      {Math.round(Math.abs(profile.ctrDecayPct) * 100)}%
                    </span>
                  </span>
                )}
                <span className="capitalize text-pp-disabled">
                  {profile.dataSource === "historical" ? "historical data" : profile.dataSource === "similarity-predicted" ? "similarity-predicted" : "visual estimate"}
                </span>
              </div>

              {profile.visualRiskFactors.length > 0 && (
                <ul className="mb-1 grid gap-1">
                  {profile.visualRiskFactors.map((factor) => (
                    <li key={factor} className="flex items-start gap-1.5 text-xs text-pp-muted">
                      <span className="mt-0.5 shrink-0 text-pp-warning">&gt;</span>
                      {factor}
                    </li>
                  ))}
                </ul>
              )}

              {profile.visualStrengths.length > 0 && (
                <ul className="grid gap-1">
                  {profile.visualStrengths.map((factor) => (
                    <li key={factor} className="flex items-start gap-1.5 text-xs text-pp-muted">
                      <span className="mt-0.5 shrink-0 text-pp-success">+</span>
                      {factor}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function UrgencyBadge({ urgency }: { urgency: FatigueProfile["urgency"] }) {
  const styles: Record<FatigueProfile["urgency"], string> = {
    HEALTHY: "bg-pp-success/15 text-pp-success border-pp-success/30",
    WATCH: "bg-pp-warning/15 text-pp-warning border-pp-warning/30",
    INTERVENE: "bg-[rgba(255,150,50,0.15)] text-[#ff9632] border-[rgba(255,150,50,0.3)]",
    PAUSE: "bg-pp-error/15 text-pp-error border-pp-error/30",
  };
  return (
    <span className={cn("inline-flex items-center rounded-[6px] border px-2 py-0.5 text-xs font-semibold", styles[urgency])}>
      {urgency}
    </span>
  );
}

// Thresholds match scoreToUrgency() in lib/analysis/fatigue.ts
function healthGradient(score: number): string {
  if (score >= 70) return "linear-gradient(90deg, #58d68d, #58d68d)"; // HEALTHY
  if (score >= 45) return "linear-gradient(90deg, #f5b041, #f5b041)"; // WATCH
  if (score >= 25) return "linear-gradient(90deg, #ff9632, #ff9632)"; // INTERVENE
  return "linear-gradient(90deg, #ff6b7a, #ff6b7a)";                   // PAUSE
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-pp-muted">{label}</span>
      {children}
    </label>
  );
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 rounded-[10px] border border-[var(--pp-border-strong)] bg-pp-elevated px-3 text-sm capitalize text-pp-white outline-none focus:border-pp-violet"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-6 items-center rounded-[6px] bg-pp-purple/15 px-2 py-1 text-xs font-medium text-pp-lavender">
      {children}
    </span>
  );
}

function BehaviorBadge({ state }: { state: string }) {
  return (
    <span className="inline-flex min-h-6 items-center rounded-[6px] bg-pp-info/10 px-2 py-1 text-xs font-medium text-pp-info">
      {humanizeBehavior(state)}
    </span>
  );
}

function behaviorMix(probabilities: {
  skip: number;
  ignore: number;
  inspect: number;
  click: number;
  convert: number;
  exit: number;
}) {
  return [
    `Click ${formatBehaviorPct(probabilities.click)}`,
    `Convert ${formatBehaviorPct(probabilities.convert)}`,
    `Skip ${formatBehaviorPct(probabilities.skip)}`,
    `Exit ${formatBehaviorPct(probabilities.exit)}`,
  ].join(" | ");
}

function metric(value?: number | null) {
  if (value === undefined || value === null) return "n/a";
  return formatNumber(value, 2);
}

function labelFor(variantId: string, creatives: CreativeDoc[]) {
  const index = creatives.findIndex((creative) => creative.id === variantId);
  return index >= 0 ? `Variant ${index + 1}` : variantId;
}

function humanize(value: string) {
  return value.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`);
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

function formatBehaviorPct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}
