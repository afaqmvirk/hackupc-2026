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
    shape = 0.8 + (1.0 - novelty_score) * 1.7
    base_scale = 10.0 / (1.0 + visual_complexity)

    if historical_fatigue_day is not None and 1 <= historical_fatigue_day <= DAYS:
        anchor_scale = historical_fatigue_day / (math.log(2) ** (1.0 / shape))
        scale = 0.4 * anchor_scale + 0.6 * base_scale
    else:
        scale = base_scale

    return shape, scale


def _survival_curve(shape: float, scale: float) -> np.ndarray:
    survival = weibull_min.sf(_DAYS_ARR, c=shape, scale=scale)
    survival_day_1 = weibull_min.sf(1.0, c=shape, scale=scale)
    return survival / survival_day_1 if survival_day_1 > 1e-9 else survival


def simulate_decay(
    initial_ctr: float,
    initial_cvr: float,
    visual_complexity: float,
    novelty_score: float,
    historical_fatigue_day: Optional[int] = None,
) -> dict:
    shape, scale = _weibull_params(visual_complexity, novelty_score, historical_fatigue_day)
    survival = _survival_curve(shape, scale)
    ctr_curve = (initial_ctr * survival).tolist()
    cvr_curve = (initial_cvr * survival).tolist()

    shape_samples = RNG.normal(shape, 0.15 * shape, N_MC).clip(0.3, 5.0)
    scale_samples = RNG.normal(scale, 0.15 * scale, N_MC).clip(1.0, 30.0)
    mc_curves = np.array(
        [initial_ctr * _survival_curve(sample_shape, sample_scale) for sample_shape, sample_scale in zip(shape_samples, scale_samples)]
    )

    band_low = np.percentile(mc_curves, 10, axis=0).tolist()
    band_high = np.percentile(mc_curves, 90, axis=0).tolist()
    threshold = ctr_curve[0] * 0.70
    fatigue_day = DAYS

    for index, ctr in enumerate(ctr_curve):
        if ctr < threshold:
            fatigue_day = index + 1
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
            "weibullShape": round(shape, 4),
            "weibullScale": round(scale, 4),
            "baselineCtr": round(initial_ctr, 6),
            "complexityPenalty": round(visual_complexity, 4),
        },
    }
