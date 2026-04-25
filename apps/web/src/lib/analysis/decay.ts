import { config } from "@/lib/config";
import { simulatedDecayCurveSchema, type CreativeDoc, type SimulatedDecayCurve } from "@/lib/schemas";

const TIMEOUT_MS = 5_000;
const FALLBACK_CTR = 0.02;
const FALLBACK_CVR = 0.03;
const DAYS = 14;

// Weibull survival function: P(T > t) = exp(-(t/scale)^shape)
function weibullSurvival(day: number, shape: number, scale: number): number {
  return Math.exp(-Math.pow(day / scale, shape));
}

function computeLocalDecay(
  variantId: string,
  initialCtr: number,
  initialCvr: number,
  visualComplexity: number,
  noveltyScore: number,
  historicalFatigueDay: number | null,
): SimulatedDecayCurve {
  // Mirror the Python parameterization exactly
  const shape = 0.8 + (1.0 - noveltyScore) * 1.7; // [0.8, 2.5]
  let scale = 10.0 / (1.0 + visualComplexity); // [5.0, 10.0]

  if (historicalFatigueDay !== null) {
    const anchorScale = historicalFatigueDay / Math.pow(Math.LN2, 1 / shape);
    scale = 0.4 * anchorScale + 0.6 * scale;
  }

  const survivalDay1 = weibullSurvival(1, shape, scale);
  const days = Array.from({ length: DAYS }, (_, i) => i + 1);

  const survival = days.map((d) => {
    const sv = weibullSurvival(d, shape, scale);
    return survivalDay1 > 1e-9 ? sv / survivalDay1 : sv;
  });

  const ctrCurve = survival.map((s) => initialCtr * s);
  const cvrCurve = survival.map((s) => initialCvr * s);

  // Approximate ±12% bands (no MC, but visually honest about uncertainty)
  const bandLow = ctrCurve.map((v) => v * 0.88);
  const bandHigh = ctrCurve.map((v) => v * 1.12);

  const threshold = ctrCurve[0] * 0.7;
  const fatigueIdx = ctrCurve.findIndex((v) => v < threshold);
  const fatiguePredictionDay = fatigueIdx >= 0 ? fatigueIdx + 1 : DAYS;

  const confidence =
    historicalFatigueDay !== null && noveltyScore > 0
      ? ("medium" as const) // local fallback caps at medium — Python gives high
      : ("low" as const);

  return simulatedDecayCurveSchema.parse({
    variantId,
    ctrCurve,
    cvrCurve,
    bandLow,
    bandHigh,
    fatiguePredictionDay,
    fatigueConfidence: confidence,
    modelParams: {
      weibullShape: shape,
      weibullScale: scale,
      baselineCtr: initialCtr,
      complexityPenalty: visualComplexity,
    },
  });
}

export async function simulateDecay(creative: CreativeDoc): Promise<SimulatedDecayCurve> {
  const { features, metricsSummary, id } = creative;

  const initialCtr = metricsSummary?.ctr ?? metricsSummary?.first7dCtr ?? FALLBACK_CTR;
  const initialCvr = metricsSummary?.cvr ?? metricsSummary?.first7dCvr ?? FALLBACK_CVR;

  const textDensity = features.textDensity ?? 0.5;
  const visualClutter = features.visualClutter ?? 0.5;
  const visualComplexity = Math.min(1, (textDensity + visualClutter) / 2);
  const noveltyScore = features.noveltyScore ?? 0.5;

  const historicalFatigueDay =
    metricsSummary?.fatigueDay != null && Number.isFinite(metricsSummary.fatigueDay)
      ? metricsSummary.fatigueDay
      : null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${config.cvServiceUrl}/simulate_decay`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        variantId: id,
        initialCtr,
        initialCvr,
        visualComplexity,
        noveltyScore,
        historicalFatigueDay,
      }),
      signal: controller.signal,
    });

    if (response.ok) {
      const raw: unknown = await response.json();
      return simulatedDecayCurveSchema.parse(raw);
    }
  } catch {
    // Python service unavailable — fall through to local computation
  } finally {
    clearTimeout(timer);
  }

  return computeLocalDecay(id, initialCtr, initialCvr, visualComplexity, noveltyScore, historicalFatigueDay);
}
