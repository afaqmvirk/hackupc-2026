import math
from typing import Optional

import numpy as np
from scipy.stats import weibull_min

DAYS = 14
N_MC = 1_000
RNG = np.random.default_rng(42)
_DAYS_ARR = np.arange(1, DAYS + 1, dtype=float)


def _weibull_params(
    visual_complexity: float,
    novelty_score: float,
    historical_fatigue_day: Optional[int],
) -> tuple[float, float]:
    # k drives curve shape: low novelty → steep uniform drop (k→2.5), high novelty → long tail (k→0.8)
    k = 0.8 + (1.0 - novelty_score) * 1.7  # [0.8, 2.5]

    # λ drives lifetime: complex ads burn out faster
    base_scale = 10.0 / (1.0 + visual_complexity)  # [5.0, 10.0]

    if historical_fatigue_day is not None and 1 <= historical_fatigue_day <= DAYS:
        # Anchor λ so Weibull median ≈ historical_fatigue_day
        # Weibull median = λ * ln(2)^(1/k)
        anchor_scale = historical_fatigue_day / (math.log(2) ** (1.0 / k))
        scale = 0.4 * anchor_scale + 0.6 * base_scale
    else:
        scale = base_scale

    return k, scale


def _survival_curve(k: float, scale: float) -> np.ndarray:
    sv = weibull_min.sf(_DAYS_ARR, c=k, scale=scale)
    sv_d1 = weibull_min.sf(1.0, c=k, scale=scale)
    # Normalize so Day 1 = 1.0 (100% of baseline)
    return sv / sv_d1 if sv_d1 > 1e-9 else sv


def simulate_decay(
    initial_ctr: float,
    initial_cvr: float,
    visual_complexity: float,
    novelty_score: float,
    historical_fatigue_day: Optional[int] = None,
) -> dict:
    k, scale = _weibull_params(visual_complexity, novelty_score, historical_fatigue_day)
    survival = _survival_curve(k, scale)

    ctr_curve = (initial_ctr * survival).tolist()
    cvr_curve = (initial_cvr * survival).tolist()

    # Monte Carlo confidence bands: perturb k and λ by ±15%
    k_samples = RNG.normal(k, 0.15 * k, N_MC).clip(0.3, 5.0)
    scale_samples = RNG.normal(scale, 0.15 * scale, N_MC).clip(1.0, 30.0)

    mc_curves = np.array([
        initial_ctr * _survival_curve(ks, ss)
        for ks, ss in zip(k_samples, scale_samples)
    ])

    band_low = np.percentile(mc_curves, 10, axis=0).tolist()
    band_high = np.percentile(mc_curves, 90, axis=0).tolist()

    # Fatigue point: first day where CTR drops >30% from Day 1 baseline
    threshold = ctr_curve[0] * 0.70
    fatigue_day = DAYS
    for idx, ctr in enumerate(ctr_curve):
        if ctr < threshold:
            fatigue_day = idx + 1  # 1-indexed
            break

    if historical_fatigue_day is not None and novelty_score > 0:
        confidence = "high"
    elif historical_fatigue_day is not None or novelty_score > 0:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "ctrCurve": ctr_curve,
        "cvrCurve": cvr_curve,
        "bandLow": band_low,
        "bandHigh": band_high,
        "fatiguePredictionDay": fatigue_day,
        "fatigueConfidence": confidence,
        "modelParams": {
            "weibullShape": round(k, 4),
            "weibullScale": round(scale, 4),
            "baselineCtr": round(initial_ctr, 6),
            "complexityPenalty": round(visual_complexity, 4),
        },
    }
