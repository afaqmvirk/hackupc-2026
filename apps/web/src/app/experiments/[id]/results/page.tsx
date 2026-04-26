import Link from "next/link";
import { notFound } from "next/navigation";
import { ResultsDashboard } from "@/components/results/ResultsDashboard";
import { getExperiment } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export default async function ExperimentResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const experiment = await getExperiment(id);

  if (!experiment) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-pp-bg text-pp-white">
      <div className="mx-auto flex max-w-[1520px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-[var(--pp-border)] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-pp-muted">
              Creative Swarm Copilot
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-pp-white">
              Results
            </h1>
            <p className="mt-2 text-sm text-pp-muted">
              Experiment {experiment.id} - {experiment.status}
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[var(--pp-border-strong)] bg-pp-elevated px-4 text-sm font-medium text-pp-white transition hover:border-pp-lavender/40 hover:bg-pp-purple/15"
          >
            Back to library
          </Link>
        </header>

        {experiment.status !== "complete" ? (
          <section className="rounded-[16px] border border-[var(--pp-border)] bg-pp-panel p-4 shadow-panel">
            <h2 className="text-sm font-semibold text-pp-white">Report not complete</h2>
            <p className="mt-2 text-sm text-pp-secondary">
              This page loads the final dashboard after the Gemini swarm saves a completed report.
            </p>
          </section>
        ) : null}

        <ResultsDashboard
          report={experiment.report ?? null}
          creatives={experiment.variants}
          brief={experiment.brief}
          agentReviews={experiment.agentReviews ?? []}
        />
      </div>
    </main>
  );
}
