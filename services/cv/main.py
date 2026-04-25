from io import BytesIO
from typing import Any

import numpy as np
from fastapi import FastAPI, File, UploadFile
from PIL import Image

app = FastAPI(title="Creative Swarm CV helper")


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


def rgb_to_name(red: float, green: float, blue: float) -> str:
    values = {"red": red, "green": green, "blue": blue}
    if max(values.values()) - min(values.values()) < 24:
        return "gray"
    return max(values, key=values.get)
