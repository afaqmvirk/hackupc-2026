import { config } from "@/lib/config";
import { simulatedDecayCurveSchema, type CreativeDoc, type SimulatedDecayCurve } from "@/lib/schemas";

const TIMEOUT_MS = 5_000;
const FALLBACK_CTR = 0.02;
const FALLBACK_CVR = 0.03;
const DAYS = 14;

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
  const shape = 0.8 + (1 - noveltyScore) * 1.7;
  let scale = 10 / (1 + visualComplexity);

  if (historicalFatigueDay !== null) {
    const anchorScale = historicalFatigueDay / Math.pow(Math.LN2, 1 / shape);
    scale = 0.4 * anchorScale + 0.6 * scale;
  }

  const survivalDay1 = weibullSurvival(1, shape, scale);
  const days = Array.from({ length: DAYS }, (_, index) => index + 1);
  const survival = days.map((day) => {
    const value = weibullSurvival(day, shape, scale);
    return survivalDay1 > 1e-9 ? value / survivalDay1 : value;
  });

  const ctrCurve = survival.map((value) => initialCtr * value);
  const cvrCurve = survival.map((value) => initialCvr * value);
  const bandLow = ctrCurve.map((value) => value * 0.88);
  const bandHigh = ctrCurve.map((value) => value * 1.12);
  const threshold = ctrCurve[0] * 0.7;
  const fatigueIndex = ctrCurve.findIndex((value) => value < threshold);
  const fatiguePredictionDay = fatigueIndex >= 0 ? fatigueIndex + 1 : DAYS;
  const fatigueConfidence = historicalFatigueDay !== null && noveltyScore > 0 ? "medium" : "low";

  return simulatedDecayCurveSchema.parse({
    variantId,
    ctrCurve,
    cvrCurve,
    bandLow,
    bandHigh,
    fatiguePredictionDay,
    fatigueConfidence,
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
    // CV service is optional. The local curve keeps analysis and demos working.
  } finally {
    clearTimeout(timer);
  }

  return computeLocalDecay(id, initialCtr, initialCvr, visualComplexity, noveltyScore, historicalFatigueDay);
}
