import base64
import os
from typing import List

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from pdf2image import convert_from_bytes


class PurifiedPage(BaseModel):
    page: int
    width: int
    height: int
    image_base64: str
    raw_image_base64: str


class PurifyResponse(BaseModel):
    pages: List[PurifiedPage]


app = FastAPI(title="prep101-pdf-purifier", version="1.0.0")


def _purify_page(bgr_image: np.ndarray) -> np.ndarray:
    # 1) Convert to grayscale
    gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)

    # 2) Morphological close/open to isolate diagonal watermark texture
    kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    kernel_open = cv2.getStructuringElement(cv2.MORPH_RECT, (17, 3))
    closed = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel_close)
    opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel_open)

    # 3) Subtract estimated background/noise
    subtracted = cv2.subtract(gray, opened)

    # 4) Otsu threshold: black text, white background
    _, thresh_inv = cv2.threshold(
        subtracted, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU
    )
    purified = 255 - thresh_inv
    return purified


def _encode_png(image: np.ndarray) -> str:
    ok, encoded = cv2.imencode(".png", image)
    if not ok:
        raise RuntimeError("Failed to encode PNG")
    return base64.b64encode(encoded.tobytes()).decode("utf-8")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/purify", response_model=PurifyResponse)
async def purify_pdf(
    file: UploadFile = File(...),
    dpi: int = Form(300),
    max_pages: int = Form(10),
) -> PurifyResponse:
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF.")

    raw_pdf = await file.read()
    if not raw_pdf:
        raise HTTPException(status_code=400, detail="Uploaded PDF is empty.")

    poppler_path = os.getenv("POPPLER_PATH")
    kwargs = {"dpi": dpi, "fmt": "png", "thread_count": 2}
    if poppler_path:
        kwargs["poppler_path"] = poppler_path

    try:
        pil_pages = convert_from_bytes(raw_pdf, **kwargs)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Rasterization failed: {exc}")

    pages: List[PurifiedPage] = []
    for idx, pil_img in enumerate(pil_pages[: max_pages if max_pages > 0 else 10], start=1):
        rgb = np.array(pil_img)
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        purified = _purify_page(bgr)
        png_b64 = _encode_png(purified)
        raw_png_b64 = _encode_png(bgr)
        h, w = purified.shape[:2]
        pages.append(
            PurifiedPage(
                page=idx,
                width=int(w),
                height=int(h),
                image_base64=png_b64,
                raw_image_base64=raw_png_b64,
            )
        )

    if not pages:
        raise HTTPException(status_code=422, detail="No pages could be rasterized.")

    return PurifyResponse(pages=pages)
