# PDF Purification Worker

FastAPI microservice that rasterizes watermarked PDF sides and returns purified page PNGs.

## Run

```bash
cd python_worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

## Endpoint

- `POST /purify` (`multipart/form-data`)
  - `file`: PDF file
  - `dpi` (optional, default `300`)
  - `max_pages` (optional, default `10`)

Returns JSON:

```json
{
  "pages": [
    {
      "page": 1,
      "width": 2550,
      "height": 3300,
      "image_base64": "<png bytes base64>"
    }
  ]
}
```

## Notes

- Requires Poppler binaries for `pdf2image` (set `POPPLER_PATH` if needed).
- Designed to run as a separate service (Railway/Fly/Render/etc.).
