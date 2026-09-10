# StockDash v2.0

A real-time stock analysis dashboard with AI-powered insights. Built with React + FastAPI.

**Live data** from Yahoo Finance · **AI analysis** via Gemini (with simulated fallback) · **Charts** via Recharts

---

## Architecture

```
GitHub Pages (React)  ──→  Render (FastAPI)  ──→  Yahoo Finance + Gemini API
     frontend                  backend              data sources
```

## Quick Start (Local Dev)

### 1. Backend

```bash
cd backend
pip install -r requirements.txt

# Optional: set Gemini API key for real AI analysis
export GEMINI_API_KEY="your-key-here"

uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
# From project root
npm install
npm run dev
```

Open `http://localhost:5173` — the Vite proxy forwards `/api` calls to the backend.

---

## Deploy

### Backend → Render

1. Create a new **Web Service** on [render.com](https://render.com)
2. Connect your GitHub repo
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Environment variables:
   - `GEMINI_API_KEY` — your Google Gemini API key (optional — app works without it using simulated AI)
   - `FRONTEND_URL` — your GitHub Pages URL, e.g. `https://yourusername.github.io`

### Frontend → GitHub Pages

1. In `vite.config.js`, set `base` to your repo name: `"/stockdash/"` (or `"/"` for user-site)
2. Create a `.env.production` file:
   ```
   VITE_API_URL=https://your-render-service.onrender.com
   ```
3. Deploy:
   ```bash
   npm run deploy
   ```
   This builds and pushes to the `gh-pages` branch.

4. In GitHub repo settings → Pages → set source to `gh-pages` branch.

---

## Features

- **Search** — real-time stock search across global markets
- **Price chart** — 20-year monthly price history
- **Volume chart** — color-coded by up/down months
- **AI verdict** — buy/sell/hold signal with plain-English explanation
- **12-month forecast** — predicted price curve with confidence band
- **Affecting parameters** — macro, sentiment, and financial factors with impact scores
- **Market alerts** — flagged headlines with price-impacting keywords
- **News feed** — recent articles from Yahoo Finance RSS

## Without Gemini

If no `GEMINI_API_KEY` is set, the app falls back to a deterministic simulated AI that generates consistent (but fake) predictions per ticker. This is useful for development and demos.
