"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Bot,
  Check,
  ChevronRight,
  FileImage,
  FlaskConical,
  Loader2,
  Maximize2,
  MessageSquareText,
  Search,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  defaultProjectedViews,
  type AnalysisInputMode,
  type CampaignBrief,
  type CreativeDoc,
} from "@/lib/schemas";
import { swarmAgents, type SwarmAgent } from "@/lib/analysis/prompts";
import { useSwarmStream } from "@/components/creative-swarm/useSwarmStream";
import { WarRoomOverlay } from "@/components/war-room/WarRoomOverlay";
import { cn } from "@/lib/utils";

type Catalog = {
  filters: {
    categories: string[];
    countries: string[];
    languages: string[];
    operatingSystems: string[];
    objectives: string[];
    formats: string[];
  };
  campaigns: CampaignOption[];
  creatives: CreativeDoc[];
};

type CampaignOption = {
  id: string;
  appName: string;
  advertiserName: string;
  category: string;
  objective: string;
  countries: string[];
  os: string;
  creativeCount: number;
};

const defaultBrief: CampaignBrief = {
  category: "gaming",
  region: "global",
  language: "any",
  os: "any",
  objective: "installs",
  audienceStyle: "casual mobile users",
};

export function CreativeSwarmApp() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedDatasetCreatives, setSelectedDatasetCreatives] = useState<CreativeDoc[]>([]);
  const [uploadedCreatives, setUploadedCreatives] = useState<CreativeDoc[]>([]);
  const [analysisInputMode, setAnalysisInputMode] = useState<AnalysisInputMode>("evidence");
  const [projectedViews, setProjectedViews] = useState(defaultProjectedViews);
  const [isUploading, setIsUploading] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [previewCreative, setPreviewCreative] = useState<CreativeDoc | null>(null);
  const [warRoomDismissed, setWarRoomDismissed] = useState(false);
  const {
    agentReviews,
    completedResultsUrl,
    phase,
    error: streamError,
    isAnalyzing,
    reset: resetSwarmStream,
    startAnalysis,
  } = useSwarmStream();
  const error = appError ?? streamError;

  useEffect(() => {
    const url = new URL("/api/catalog", window.location.origin);
    if (campaignFilter !== "all") url.searchParams.set("campaignId", campaignFilter);
    url.searchParams.set("limit", "120");

    fetch(url)
      .then((response) => response.json())
      .then((data) => setCatalog(data))
      .catch((err) => setAppError(err instanceof Error ? err.message : "Failed to load catalog."));
  }, [campaignFilter]);

  const selectedCampaign = useMemo(
    () => catalog?.campaigns.find((campaign) => campaign.id === campaignFilter) ?? null,
    [catalog?.campaigns, campaignFilter],
  );
  const brief = useMemo(() => campaignBriefFromOption(selectedCampaign), [selectedCampaign]);

  const selectedCreatives = useMemo(() => {
    const dataset = selectedDatasetCreatives.filter((creative) => selectedIds.includes(creative.id));
    return [...dataset, ...uploadedCreatives];
  }, [selectedDatasetCreatives, selectedIds, uploadedCreatives]);

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
          creative.campaignId,
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
      setAppError(null);

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
        setAppError(err instanceof Error ? err.message : "Upload failed.");
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
    disabled: !selectedCampaign || isUploading || selectedCreatives.length >= 6,
  });

  const toggleCreative = (creative: CreativeDoc) => {
    if (selectedIds.includes(creative.id)) {
      setSelectedIds((current) => current.filter((item) => item !== creative.id));
      setSelectedDatasetCreatives((current) => current.filter((item) => item.id !== creative.id));
      return;
    }

    if (selectedIds.length + uploadedCreatives.length >= 6) {
      return;
    }

    setSelectedIds((current) => [...current, creative.id]);
    setSelectedDatasetCreatives((current) => (current.some((item) => item.id === creative.id) ? current : [...current, creative]));
  };

  const updateCampaignFilter = (value: string) => {
    setCampaignFilter(value);
    setSelectedIds([]);
    setSelectedDatasetCreatives([]);
    resetSwarmStream();
    setWarRoomDismissed(false);
    setAppError(null);
  };

  const removeCreative = useCallback((creative: CreativeDoc) => {
    if (creative.source === "dataset") {
      setSelectedIds((current) => current.filter((id) => id !== creative.id));
      setSelectedDatasetCreatives((current) => current.filter((item) => item.id !== creative.id));
    } else {
      setUploadedCreatives((current) => current.filter((item) => item.id !== creative.id));
    }
  }, []);

  const analyze = () => {
    setAppError(null);
    setWarRoomDismissed(false);
    void startAnalysis({
      brief,
      analysisInputMode,
      projectedViews,
      selectedIds,
      uploadedCreatives,
    });
  };

  const canAnalyze = Boolean(selectedCampaign) && selectedCreatives.length >= 2 && selectedCreatives.length <= 6 && projectedViews > 0 && !isAnalyzing;

  return (
    <main className="min-h-screen bg-pp-bg pb-28 text-pp-white">
      <div className="mx-auto flex max-w-[1520px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-[var(--pp-border)] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-pp-muted">
              <Sparkles className="size-4 text-pp-violet" />
              Creative Swarm Copilot
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-pp-white">
              Creative Library
            </h1>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <AgentInputModeToggle value={analysisInputMode} onChange={setAnalysisInputMode} disabled={isAnalyzing} />
              <ProjectedViewsControl value={projectedViews} onChange={setProjectedViews} disabled={isAnalyzing} />
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
              <p className="max-w-[480px] text-xs text-pp-muted">
                Pre-launch creative read: uses only the image and campaign context, without KPI benchmarks or similar-ad history.
              </p>
            ) : selectedCampaign ? (
              <p className="max-w-[480px] text-xs text-pp-muted">
                Performance-grounded decision: combines creative review with historical KPIs, benchmarks, and similar ads.
              </p>
            ) : (
              <p className="max-w-[440px] text-xs text-pp-muted">Choose a campaign in the Creative Library to use its targeting and objective for analysis.</p>
            )}
          </div>
        </header>

        {error ? (
          <div className="flex items-start gap-3 rounded-[10px] border border-pp-error/30 bg-pp-error/10 px-4 py-3 text-sm text-pp-error">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4">
            <UploadPanel dropzone={dropzone} isUploading={isUploading} disabled={!selectedCampaign || selectedCreatives.length >= 6} />
            <SwarmPersonalitiesPanel agents={swarmAgents} />
          </aside>

          <div className="flex flex-col gap-5">
            <CreativeLibrary
              creatives={filteredCreatives}
              campaignOptions={catalog?.campaigns ?? []}
              selectedCampaign={selectedCampaign}
              campaignFilter={campaignFilter}
              setCampaignFilter={updateCampaignFilter}
              selectedIds={selectedIds}
              query={query}
              setQuery={setQuery}
              toggleCreative={toggleCreative}
              previewCreative={setPreviewCreative}
            />
            <CreativePreviewModal creative={previewCreative} onClose={() => setPreviewCreative(null)} />
            <AnalysisRedirectPanel resultsUrl={completedResultsUrl} isAnalyzing={isAnalyzing} />
          </div>
        </section>
      </div>

      <AnimatePresence>
        {phase === "analyzing" && !warRoomDismissed && !error && selectedCreatives.length > 0 ? (
          <WarRoomOverlay
            key="war-room"
            reviews={agentReviews}
            variants={selectedCreatives}
            totalAgentsExpected={swarmAgents.length * selectedCreatives.length}
            onSkip={() => setWarRoomDismissed(true)}
          />
        ) : null}
      </AnimatePresence>

      <StickyActionBar
        creatives={selectedCreatives}
        canAnalyze={canAnalyze}
        isAnalyzing={isAnalyzing}
        onAnalyze={analyze}
        onRemove={removeCreative}
      />
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
    { value: "evidence", label: "KPI-backed" },
    { value: "image_only", label: "Creative-only" },
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs font-semibold uppercase tracking-[0.12em] text-pp-muted sm:inline">Decision Lens</span>
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

function ProjectedViewsControl({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (projectedViews: number) => void;
  disabled: boolean;
}) {
  const updateProjectedViews = (nextValue: number) => {
    if (!Number.isFinite(nextValue)) return;
    onChange(Math.max(1, Math.round(nextValue)));
  };

  return (
    <label className="grid h-11 min-w-[164px] grid-cols-[1fr_86px] items-center overflow-hidden rounded-[10px] border border-[var(--pp-border-strong)] bg-pp-elevated">
      <span className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-pp-muted">Views</span>
      <input
        type="number"
        min={1}
        step={1000}
        value={value}
        onChange={(event) => updateProjectedViews(event.currentTarget.valueAsNumber)}
        disabled={disabled}
        className="h-full min-w-0 border-l border-[var(--pp-border)] bg-transparent px-2 text-right text-sm font-semibold text-pp-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Projected views"
      />
    </label>
  );
}

function campaignBriefFromOption(campaign: CampaignOption | null): CampaignBrief {
  if (!campaign) {
    return defaultBrief;
  }

  return {
    category: campaign.category,
    region: campaign.countries[0] ?? "global",
    language: "any",
    os: campaign.os || "any",
    objective: campaign.objective,
    audienceStyle: `${campaign.appName} audience`,
  };
}

function campaignContextSummary(campaign: CampaignOption) {
  return [
    campaign.category,
    campaign.countries[0] ?? "global",
    campaign.os || "any OS",
    campaign.objective,
    `${campaign.creativeCount} creatives`,
  ];
}

function StickyActionBar({
  creatives,
  canAnalyze,
  isAnalyzing,
  onAnalyze,
  onRemove,
}: {
  creatives: CreativeDoc[];
  canAnalyze: boolean;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  onRemove: (creative: CreativeDoc) => void;
}) {
  return (
    <section className="fixed inset-x-0 bottom-0 z-40 border-t border-pp-purple/20 bg-pp-bg/92 px-4 py-3 text-pp-white shadow-[0_-18px_60px_rgba(0,0,0,0.36)] backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1520px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-11 place-items-center rounded-[10px] border border-pp-lavender/20 bg-pp-elevated">
            <Check className="size-4 text-pp-violet" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-pp-white">Selected variants</p>
            <p className="text-xs text-pp-muted">
              {creatives.length}/6 ready - choose at least 2 creatives for a swarm run
            </p>
          </div>
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1">
            {creatives.length ? (
              creatives.map((creative, index) => (
                <div
                  key={creative.id}
                  className="group relative h-14 w-10 shrink-0 overflow-hidden rounded-[7px] border border-pp-lavender/20 bg-pp-elevated"
                  title={`Variant ${index + 1}`}
                >
                  <Image
                    src={creative.thumbnailUrl ?? creative.assetUrl}
                    alt=""
                    width={40}
                    height={56}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-1 top-1 rounded bg-pp-bg/80 px-1 text-[10px] font-semibold text-pp-white">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(creative)}
                    className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-pp-bg/85 text-pp-muted opacity-0 transition hover:text-pp-white group-hover:opacity-100 group-focus-within:opacity-100"
                    aria-label={`Remove variant ${index + 1}`}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))
            ) : (
              <div className="flex h-14 min-w-[220px] items-center rounded-[10px] border border-dashed border-[var(--pp-border)] px-3 text-sm text-pp-muted">
                Select 2-6 creatives from the library.
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onAnalyze}
          disabled={!canAnalyze}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-pp-lavender/25 bg-gradient-to-br from-pp-purple to-pp-violet px-5 text-sm font-medium text-pp-white shadow-glow transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isAnalyzing ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
          Run Gemini swarm
          <ChevronRight className="size-4" />
        </button>
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

function SwarmPersonalitiesPanel({ agents }: { agents: SwarmAgent[] }) {
  const [expanded, setExpanded] = useState(false);
  const specialists = agents.filter((agent) => agent.type === "specialist");
  const personas = agents.filter((agent) => agent.type === "persona");

  return (
    <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-pp-violet" />
          <h2 className="text-sm font-semibold text-pp-white">Swarm Personalities</h2>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex h-8 items-center gap-2 rounded-[8px] border border-[var(--pp-border-strong)] bg-pp-elevated px-2.5 text-xs font-medium text-pp-muted transition hover:text-pp-white"
          aria-expanded={expanded}
        >
          {agents.length}
          <ChevronRight className={cn("size-3.5 transition", expanded && "rotate-90 text-pp-violet")} />
        </button>
      </div>

      <p className="text-xs text-pp-muted">{personas.length} personas and {specialists.length} specialists review each selected variant.</p>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 grid gap-3">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-pp-muted">Persona lenses</p>
                <div className="grid gap-2">
                  {personas.map((agent) => (
                    <SwarmPersonalityRow key={agent.name} agent={agent} />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-pp-muted">Specialist reviewers</p>
                <div className="grid gap-2">
                  {specialists.map((agent) => (
                    <SwarmPersonalityRow key={agent.name} agent={agent} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function SwarmPersonalityRow({ agent }: { agent: SwarmAgent }) {
  const isPersona = agent.type === "persona";

  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-[10px] border border-[var(--pp-border)] bg-pp-elevated p-2">
      <div
        className={cn(
          "inline-flex size-10 items-center justify-center overflow-hidden rounded-[8px] border",
          isPersona ? "border-pp-violet/30 bg-pp-bg" : "border-[var(--pp-border-strong)] bg-pp-panel text-pp-lavender",
        )}
      >
        {isPersona ? (
          <Image src={personaIconFor(agent.name)} alt="" width={40} height={40} className="size-10 object-cover" />
        ) : (
          <MessageSquareText className="size-4" />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-pp-white">{agent.name}</p>
          <span className="shrink-0 rounded-[6px] bg-pp-purple/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-pp-lavender">
            {agent.type}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-pp-muted">{agent.role}</p>
      </div>
    </div>
  );
}

function CreativeLibrary({
  creatives,
  campaignOptions,
  selectedCampaign,
  campaignFilter,
  setCampaignFilter,
  selectedIds,
  query,
  setQuery,
  toggleCreative,
  previewCreative,
}: {
  creatives: CreativeDoc[];
  campaignOptions: CampaignOption[];
  selectedCampaign: CampaignOption | null;
  campaignFilter: string;
  setCampaignFilter: (value: string) => void;
  selectedIds: string[];
  query: string;
  setQuery: (value: string) => void;
  toggleCreative: (creative: CreativeDoc) => void;
  previewCreative: (creative: CreativeDoc) => void;
}) {
  return (
    <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <FileImage className="size-4 text-pp-violet" />
          <h2 className="text-sm font-semibold text-pp-white">Creative Library</h2>
          <span className="text-xs font-medium text-pp-muted">{creatives.length}</span>
        </div>
        <div className="grid w-full gap-2 md:w-auto md:grid-cols-[minmax(220px,300px)_minmax(240px,360px)]">
          <select
            value={campaignFilter}
            onChange={(event) => setCampaignFilter(event.target.value)}
            className="h-10 min-w-0 rounded-[10px] border border-[var(--pp-border-strong)] bg-pp-elevated px-3 text-sm text-pp-white outline-none focus:border-pp-violet"
            aria-label="Filter creatives by campaign"
          >
            <option value="all">All campaigns</option>
            {campaignOptions.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaignLabel(campaign)}
              </option>
            ))}
          </select>
          <label className="flex h-10 min-w-0 items-center gap-2 rounded-[10px] border border-[var(--pp-border-strong)] bg-pp-elevated px-3">
            <Search className="size-4 shrink-0 text-pp-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search creatives"
              className="min-w-0 flex-1 bg-transparent text-sm text-pp-white outline-none placeholder:text-pp-muted"
            />
          </label>
        </div>
      </div>
      {selectedCampaign ? (
        <div className="mb-4 flex flex-col gap-2 rounded-[10px] border border-pp-purple/20 bg-pp-purple/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-pp-white">{selectedCampaign.appName}</p>
            <p className="truncate text-xs text-pp-muted">{selectedCampaign.advertiserName}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {campaignContextSummary(selectedCampaign).map((item) => (
              <Badge key={item}>{item}</Badge>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid max-h-[520px] gap-3 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {creatives.length ? (
          creatives.map((creative, index) => {
            const selected = selectedIds.includes(creative.id);
            return (
              <article
                key={creative.id}
                className={cn(
                  "grid grid-cols-[86px_minmax(0,1fr)] gap-3 rounded-[10px] border p-2 text-left transition hover:-translate-y-0.5",
                  selected
                    ? "border-pp-purple bg-pp-purple/10"
                    : "border-[var(--pp-border)] hover:border-[var(--pp-border-strong)] hover:bg-pp-elevated",
                )}
              >
                <button
                  type="button"
                  onClick={() => previewCreative(creative)}
                  className="group relative h-32 w-[86px] overflow-hidden rounded-[6px] bg-pp-elevated text-left"
                  aria-label={`Preview ${creative.appName ?? "creative"}`}
                >
                  <Image
                    src={creative.thumbnailUrl ?? creative.assetUrl}
                    alt=""
                    width={86}
                    height={128}
                    loading={index < 6 ? "eager" : "lazy"}
                    className="h-32 w-[86px] object-cover transition group-hover:scale-105"
                  />
                  <span className="absolute inset-x-1 bottom-1 inline-flex h-7 items-center justify-center rounded-[6px] bg-pp-bg/80 text-pp-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Maximize2 className="size-3.5" />
                  </span>
                </button>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-pp-white">{creative.appName}</p>
                    <button
                      type="button"
                      onClick={() => toggleCreative(creative)}
                      className={cn(
                        "inline-flex h-7 shrink-0 items-center gap-1 rounded-[7px] border px-2 text-xs font-medium transition",
                        selected
                          ? "border-pp-purple/40 bg-pp-purple/20 text-pp-lavender"
                          : "border-[var(--pp-border-strong)] text-pp-muted hover:text-pp-white",
                      )}
                      aria-pressed={selected}
                    >
                      {selected ? <Check className="size-3.5" /> : null}
                      {selected ? "Selected" : "Select"}
                    </button>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-pp-secondary">{creative.features.headline || creative.label || creative.campaignId}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge>{creative.format}</Badge>
                    <Badge>{creative.metricsSummary?.creativeStatus ?? creative.source}</Badge>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-[10px] border border-dashed border-[var(--pp-border)] p-4 text-sm text-pp-muted sm:col-span-2 xl:col-span-3 2xl:col-span-4">
            No creatives match the current campaign and search filters.
          </div>
        )}
      </div>
    </section>
  );
}

function CreativePreviewModal({ creative, onClose }: { creative: CreativeDoc | null; onClose: () => void }) {
  useEffect(() => {
    if (!creative) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [creative, onClose]);

  return (
    <AnimatePresence>
      {creative ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-pp-bg/90 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.section
            className="grid max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-[16px] border border-[var(--pp-border)] bg-pp-panel shadow-panel lg:grid-cols-[minmax(0,1fr)_320px]"
            initial={{ scale: 0.98, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98, y: 12 }}
            onClick={(event) => event.stopPropagation()}
            aria-modal="true"
            role="dialog"
            aria-label="Creative preview"
          >
            <div className="flex min-h-[320px] items-center justify-center bg-pp-bg p-4">
              <Image
                src={creative.assetUrl}
                alt={creative.features.headline || creative.appName || "Creative preview"}
                width={Math.max(creative.features.width ?? 1200, 1)}
                height={Math.max(creative.features.height ?? 1600, 1)}
                sizes="(max-width: 768px) 96vw, 70vw"
                className="max-h-[78vh] w-auto max-w-full rounded-[8px] object-contain"
              />
            </div>
            <aside className="flex min-h-0 flex-col border-t border-[var(--pp-border)] p-4 lg:border-l lg:border-t-0">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-pp-violet">Full Preview</p>
                  <h2 className="mt-1 truncate text-lg font-semibold text-pp-white">{creative.appName ?? "Creative"}</h2>
                  <p className="mt-1 truncate text-sm text-pp-muted">{creative.advertiserName ?? creative.campaignId ?? "Dataset creative"}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-[var(--pp-border-strong)] text-pp-muted transition hover:text-pp-white"
                  aria-label="Close preview"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="grid gap-2 text-sm">
                <PreviewRow label="Campaign" value={creative.campaignId ?? "unknown"} />
                <PreviewRow label="Format" value={creative.format} />
                <PreviewRow label="CTA" value={creative.features.ctaText || "none detected"} />
                <PreviewRow label="Headline" value={creative.features.headline || "none detected"} />
                <PreviewRow label="Size" value={creative.features.width && creative.features.height ? `${creative.features.width} x ${creative.features.height}` : "unknown"} />
                <PreviewRow label="Status" value={creative.metricsSummary?.creativeStatus ?? "unknown"} />
              </div>
            </aside>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-[8px] bg-pp-elevated px-3 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-pp-muted">{label}</span>
      <span className="break-words text-pp-secondary">{value}</span>
    </div>
  );
}

function AnalysisRedirectPanel({ resultsUrl, isAnalyzing }: { resultsUrl: string | null; isAnalyzing: boolean }) {
  return (
    <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          {isAnalyzing ? <Loader2 className="size-4 animate-spin text-pp-violet" /> : <FlaskConical className="size-4 text-pp-violet" />}
          <h2 className="text-sm font-semibold text-pp-white">Results Redirect</h2>
        </div>
        {resultsUrl ? (
          <a
            href={resultsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-pp-lavender/25 bg-pp-elevated px-4 text-sm font-medium text-pp-white transition hover:border-pp-lavender/40 hover:bg-pp-purple/15"
          >
            Open results
            <ChevronRight className="size-4" />
          </a>
        ) : null}
      </div>
      <p className="mt-3 text-sm text-pp-secondary">
        {isAnalyzing
          ? "The War Room stays live while Gemini runs. This page will move to results after the final report is saved."
          : resultsUrl
            ? "The completed report is ready and this page is redirecting."
            : "Select 2-6 variants and run the Gemini swarm to analyze before opening results."}
      </p>
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-6 items-center rounded-[6px] bg-pp-purple/15 px-2 py-1 text-xs font-medium text-pp-lavender">
      {children}
    </span>
  );
}

function campaignLabel(campaign: CampaignOption) {
  return `${campaign.appName} - ${campaign.advertiserName} (${campaign.creativeCount})`;
}

function personaIconFor(agentName: string) {
  const icons: Record<string, string> = {
    "Low-Attention Scroller": "/icons/Artboard%207.png",
    "Skeptical User": "/icons/Artboard%207%20copy.png",
    "Reward-Seeking User": "/icons/Artboard%207%20copy%202.png",
    "Practical Converter": "/icons/Artboard%207%20copy%203.png",
    "Scam-Sensitive User": "/icons/Artboard%207%20copy%204.png",
    "Privacy-Conscious User": "/icons/Artboard%207%20copy%205.png",
  };

  return icons[agentName] ?? "/icons/Artboard%207.png";
}
