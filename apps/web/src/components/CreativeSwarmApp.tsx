"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  BarChart3,
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
  type AgentReview,
  type AnalysisInputMode,
  type CampaignBrief,
  type CreativeDoc,
  type EvidencePack,
  type SimulatedDecayCurve,
} from "@/lib/schemas";
import { swarmAgents, type SwarmAgent } from "@/lib/analysis/prompts";
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

type SwarmMessage =
  | { id: string; type: "status"; message: string }
  | { id: string; type: "agent"; review: AgentReview }
  | { id: string; type: "evidence"; pack: EvidencePack }
  | { id: string; type: "decay"; curves: SimulatedDecayCurve[] }
  | { id: string; type: "error"; message: string };

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
  const [messages, setMessages] = useState<SwarmMessage[]>([]);
  const [completedResultsUrl, setCompletedResultsUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [previewCreative, setPreviewCreative] = useState<CreativeDoc | null>(null);

  useEffect(() => {
    const url = new URL("/api/catalog", window.location.origin);
    if (campaignFilter !== "all") url.searchParams.set("campaignId", campaignFilter);
    url.searchParams.set("limit", "120");

    fetch(url)
      .then((response) => response.json())
      .then((data) => setCatalog(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load catalog."));
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
    setCompletedResultsUrl(null);
    setMessages([]);
  };

  const analyze = async () => {
    setError(null);
    setCompletedResultsUrl(null);
    setMessages([]);
    setIsAnalyzing(true);
    let resultsWindow = openWaitingResultsWindow();

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

      const experimentId = createPayload.experiment.id;
      writeResultsWindowStatus(
        resultsWindow,
        "Gemini swarm is analyzing",
        "Keep this tab open. Results will load here when the swarm completes.",
      );

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
      let reportReceived = false;

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
            reportReceived = true;
          } else if (event.type === "error") {
            setError(event.message);
            setMessages((current) => [...current, { id: crypto.randomUUID(), type: "error", message: event.message }]);
          } else {
            setMessages((current) => [...current, { id: crypto.randomUUID(), ...event }]);
          }
        }
      }

      if (!reportReceived) {
        throw new Error("Analysis finished without a results report.");
      }

      const resultsUrl = `/experiments/${experimentId}/results`;
      setCompletedResultsUrl(resultsUrl);

      if (resultsWindow && !resultsWindow.closed) {
        resultsWindow.location.href = resultsUrl;
      } else {
        resultsWindow = window.open(resultsUrl, "_blank", "noopener,noreferrer");
        if (!resultsWindow) {
          window.location.href = resultsUrl;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed.";
      setError(message);
      writeResultsWindowStatus(resultsWindow, "Analysis failed", message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const canAnalyze = Boolean(selectedCampaign) && selectedCreatives.length >= 2 && selectedCreatives.length <= 6 && projectedViews > 0 && !isAnalyzing;

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

        <section className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4">
            <SelectedPanel
              creatives={selectedCreatives}
              onRemove={(creative) => {
                if (creative.source === "dataset") {
                  setSelectedIds((current) => current.filter((id) => id !== creative.id));
                  setSelectedDatasetCreatives((current) => current.filter((item) => item.id !== creative.id));
                } else {
                  setUploadedCreatives((current) => current.filter((item) => item.id !== creative.id));
                }
              }}
            />
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
            <SwarmRoom messages={messages} creatives={selectedCreatives} isAnalyzing={isAnalyzing} />
            <AnalysisRedirectPanel resultsUrl={completedResultsUrl} isAnalyzing={isAnalyzing} />
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
                  "grid grid-cols-[74px_minmax(0,1fr)] gap-3 rounded-[10px] border p-2 text-left transition hover:-translate-y-0.5",
                  selected
                    ? "border-pp-purple bg-pp-purple/10"
                    : "border-[var(--pp-border)] hover:border-[var(--pp-border-strong)] hover:bg-pp-elevated",
                )}
              >
                <button
                  type="button"
                  onClick={() => previewCreative(creative)}
                  className="group relative h-28 w-[74px] overflow-hidden rounded-[6px] bg-pp-elevated text-left"
                  aria-label={`Preview ${creative.appName ?? "creative"}`}
                >
                  <Image
                    src={creative.thumbnailUrl ?? creative.assetUrl}
                    alt=""
                    width={74}
                    height={112}
                    loading={index < 6 ? "eager" : "lazy"}
                    className="h-28 w-[74px] object-cover transition group-hover:scale-105"
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
                  <p className="mt-1 line-clamp-2 text-xs text-pp-secondary">{creative.features.headline}</p>
                  <p className="mt-1 truncate text-[11px] text-pp-muted">{creative.campaignId}</p>
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

function SwarmRoom({ messages, creatives, isAnalyzing }: { messages: SwarmMessage[]; creatives: CreativeDoc[]; isAnalyzing: boolean }) {
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
      <div className="grid max-h-[440px] gap-3 overflow-auto pr-1 xl:grid-cols-2">
        <AnimatePresence initial={false}>
          {visible.length ? (
            visible.map((message) => {
              if (message.type === "agent") {
                return <AgentSwarmCard key={message.id} review={message.review} creatives={creatives} />;
              }

              if (message.type === "evidence") {
                return <EvidenceSwarmCard key={message.id} pack={message.pack} creatives={creatives} />;
              }

              if (message.type === "decay") {
                return <DecaySwarmCard key={message.id} curves={message.curves} />;
              }

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={cn(
                    "rounded-[10px] border p-3",
                    message.type === "error" ? "border-pp-error/30 bg-pp-error/10 text-pp-error" : "border-[var(--pp-border)] bg-pp-panel/80 text-pp-secondary",
                  )}
                >
                  <p className="text-sm">{message.message}</p>
                </motion.div>
              );
            })
          ) : (
            <div className="rounded-[10px] border border-[var(--pp-border)] bg-pp-panel/80 p-3 text-sm text-pp-secondary">Awaiting analysis.</div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function AgentSwarmCard({ review, creatives }: { review: AgentReview; creatives: CreativeDoc[] }) {
  const isPersona = review.agentType === "persona";
  const variantLabel = labelFor(review.variantId, creatives);
  const iconSrc = isPersona ? personaIconFor(review.agentName) : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        "rounded-[12px] border p-3",
        isPersona ? "border-pp-violet/30 bg-pp-purple/10" : "border-[var(--pp-border)] bg-pp-panel/80",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border",
            isPersona ? "border-pp-violet/30 bg-pp-bg" : "border-[var(--pp-border-strong)] bg-pp-elevated text-pp-lavender",
          )}
        >
          {iconSrc ? (
            <Image src={iconSrc} alt="" width={44} height={44} className="size-11 object-cover" />
          ) : (
            <MessageSquareText className="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-[6px] bg-pp-bg px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-pp-violet">
              {variantLabel}
            </span>
            <span className="rounded-[6px] bg-pp-elevated px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-pp-muted">
              {isPersona ? "Persona" : "Specialist"}
            </span>
            <BehaviorBadge state={review.behavior.primaryState} />
          </div>
          <h3 className="mt-2 truncate text-sm font-semibold text-pp-white">{review.agentName}</h3>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <SwarmCardSection label="Observation" value={review.reasoning} strong />
        <SwarmCardSection label="Behavior" value={review.behavior.rationale} />
        <div className="grid gap-2 rounded-[8px] bg-pp-elevated px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-pp-muted">Action Mix</span>
          <span className="text-xs text-pp-secondary">{behaviorMix(review.behavior.probabilities)}</span>
        </div>
        <SwarmCardSection label="Suggested Edit" value={review.suggestedEdit} />
      </div>
    </motion.article>
  );
}

function EvidenceSwarmCard({ pack, creatives }: { pack: EvidencePack; creatives: CreativeDoc[] }) {
  const variantLabel = labelFor(pack.variantId, creatives);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-[12px] border border-pp-info/25 bg-pp-info/10 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-[6px] bg-pp-bg px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-pp-info">
          <BarChart3 className="size-3.5" />
          {variantLabel}
        </span>
        <span className="rounded-[6px] bg-pp-elevated px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-pp-muted">Evidence</span>
      </div>
      <h3 className="mt-2 text-sm font-semibold text-pp-white">{pack.variantLabel}</h3>
      <p className="mt-2 text-sm text-pp-secondary">{pack.facts[1] ?? pack.facts[0] ?? "Evidence pack prepared."}</p>
      <p className="mt-2 text-xs text-pp-muted">{pack.benchmark.contextLabel}</p>
    </motion.article>
  );
}

function DecaySwarmCard({ curves }: { curves: SimulatedDecayCurve[] }) {
  const earliestDay = curves.length ? Math.min(...curves.map((curve) => curve.fatiguePredictionDay)) : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-[12px] border border-pp-violet/25 bg-pp-purple/10 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-[6px] bg-pp-bg px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-pp-violet">
          <FlaskConical className="size-3.5" />
          Fatigue Simulation
        </span>
        <span className="rounded-[6px] bg-pp-elevated px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-pp-muted">
          14 days
        </span>
      </div>
      <p className="mt-2 text-sm text-pp-white">
        {curves.length} variant{curves.length === 1 ? "" : "s"} projected with CTR decay bands.
      </p>
      <p className="mt-2 text-xs text-pp-muted">
        Earliest predicted 30% CTR drop: {earliestDay ? `day ${earliestDay}` : "n/a"}.
      </p>
    </motion.article>
  );
}

function SwarmCardSection({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid gap-1 rounded-[8px] bg-pp-elevated px-3 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-pp-muted">{label}</span>
      <span className={cn("text-sm", strong ? "text-pp-white" : "text-pp-secondary")}>{value}</span>
    </div>
  );
}

function AnalysisRedirectPanel({ resultsUrl, isAnalyzing }: { resultsUrl: string | null; isAnalyzing: boolean }) {
  return (
    <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          {isAnalyzing ? <Loader2 className="size-4 animate-spin text-pp-violet" /> : <FlaskConical className="size-4 text-pp-violet" />}
          <h2 className="text-sm font-semibold text-pp-white">Results Handoff</h2>
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
          ? "The swarm room stays here while Gemini runs. The separate results tab will load after the final report is saved."
          : resultsUrl
            ? "The completed report is available on its own page."
            : "Select 2-6 variants and run the Gemini swarm to open a separate results page."}
      </p>
    </section>
  );
}

function openWaitingResultsWindow() {
  const popup = window.open("about:blank", "_blank");
  writeResultsWindowStatus(
    popup,
    "Preparing Gemini swarm",
    "The results page will appear here when analysis completes.",
  );
  return popup;
}

function writeResultsWindowStatus(target: Window | null, title: string, message: string) {
  if (!target || target.closed) return;

  try {
    target.document.title = title;
    target.document.body.innerHTML = `
      <main style="min-height:100vh;margin:0;display:grid;place-items:center;background:#070912;color:#f6f6fb;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <section style="width:min(520px,calc(100vw - 48px));border:1px solid rgba(199,183,255,.16);border-radius:16px;background:#111626;padding:24px;box-shadow:0 24px 80px rgba(0,0,0,.32);">
          <p style="margin:0 0 8px;color:#9d64f6;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">Creative Swarm Copilot</p>
          <h1 style="margin:0;color:#f6f6fb;font-size:22px;line-height:1.25;">${escapeHtml(title)}</h1>
          <p style="margin:12px 0 0;color:#c9c3dd;font-size:14px;line-height:1.6;">${escapeHtml(message)}</p>
        </section>
      </main>
    `;
  } catch {
    // Some browsers restrict writes to newly opened windows; navigation fallback still works.
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function campaignLabel(campaign: CampaignOption) {
  return `${campaign.appName} - ${campaign.advertiserName} (${campaign.creativeCount})`;
}

function personaIconFor(agentName: string) {
  const icons: Record<string, string> = {
    "Low-Attention Scroller": "/icons/Artboard%207.png",
    "Skeptical User": "/icons/Artboard%207%20copy.png",
    "Reward-Seeking User": "/icons/Artboard%207%20copy%202.png",
    "Practical Converter": "/icons/Artboard%207%20copy%203.png",
    "Visual Trend Seeker": "/icons/Artboard%207%20copy%204.png",
    "Category-Matched User": "/icons/Artboard%207%20copy%205.png",
  };

  return icons[agentName] ?? "/icons/Artboard%207.png";
}

function labelFor(variantId: string, creatives: CreativeDoc[]) {
  const index = creatives.findIndex((creative) => creative.id === variantId);
  return index >= 0 ? `Variant ${index + 1}` : variantId;
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
