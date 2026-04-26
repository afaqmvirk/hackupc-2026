from io import BytesIO
from typing import Any, Optional

import numpy as np
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel, Field

from .simulation import simulate_decay as _simulate_decay

app = FastAPI(title="Creative Swarm CV helper")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class DecaySimulationRequest(BaseModel):
    variantId: str
    initialCtr: float = Field(ge=0.0, le=1.0)
    initialCvr: float = Field(ge=0.0, le=1.0)
    visualComplexity: float = Field(ge=0.0, le=1.0)
    noveltyScore: float = Field(ge=0.0, le=1.0)
    historicalFatigueDay: Optional[int] = Field(default=None, ge=1, le=14)


@app.post("/extract")
async def extract(file: UploadFile = File(...)) -> dict[str, Any]:
    image = Image.open(BytesIO(await file.read())).convert("RGB")
    width, height = image.size
    sample = image.resize((64, 64))
    pixels = np.asarray(sample).reshape(-1, 3)
    mean = pixels.mean(axis=0)

    return {
        "width": width,
        "height": height,
        "aspectRatio": f"{width}:{height}",
        "dominantColors": [rgb_to_name(*mean)],
    }


@app.post("/simulate_decay")
async def simulate_decay_endpoint(body: DecaySimulationRequest) -> dict[str, Any]:
    result = _simulate_decay(
        initial_ctr=body.initialCtr,
        initial_cvr=body.initialCvr,
        visual_complexity=body.visualComplexity,
        novelty_score=body.noveltyScore,
        historical_fatigue_day=body.historicalFatigueDay,
    )
    return {"variantId": body.variantId, **result}


def rgb_to_name(red: float, green: float, blue: float) -> str:
    values = {"red": red, "green": green, "blue": blue}
    if max(values.values()) - min(values.values()) < 24:
        return "gray"
    return max(values, key=values.get)
