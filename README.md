# StockDash v2.0

Real-time stock analysis dashboard with AI-powered insights. One FastAPI service serves both the API and the frontend — no separate frontend host, no CORS setup.

**Data:** Yahoo Finance · **AI:** Gemini (with simulated fallback) · **Charts:** Chart.js

## Structure

```
stockdash/
├── main.py              ← FastAPI: API routes + serves static/ as the frontend
├── requirements.txt
├── .python-version      ← pins Python 3.11.9 on Render
└── static/
    ├── index.html
    ├── style.css
    └── app.js
```

## Local dev

```bash
pip install -r requirements.txt
export GEMINI_API_KEY="your-key-here"   # optional — falls back to simulated AI without it
uvicorn main:app --reload
```

Open `http://localhost:8000` — everything (API + frontend) is served from that one address.

## Deploy to Render

1. New **Web Service** → connect your GitHub repo
2. **Root Directory:** leave blank (repo root)
3. **Build Command:** `pip install -r requirements.txt`
4. **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Environment variable: `GEMINI_API_KEY` (optional)

That's it — one service, one URL, done. No GitHub Pages, no `VITE_API_URL`, no CORS configuration.

## Without Gemini

If `GEMINI_API_KEY` isn't set, the app falls back to a deterministic simulated AI — same signal every time for a given ticker. Useful for development and demos.
