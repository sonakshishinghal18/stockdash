import os
import json
import httpx
import asyncio
import yfinance as yf
from yahooquery import search
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="StockDash")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-3.8-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

# ── Yahoo Finance wrapper endpoints ────────────────────────────────────
# We use yahooquery for search and yfinance for data to bypass 403/429 blocks on Render.

@app.get("/api/search")
async def search_stocks(q: str = Query(..., min_length=1)):
    def _search():
        try:
            return search(q)
        except Exception:
            return {"quotes": []}
            
    data = await asyncio.to_thread(_search)
    results = []
    for q_item in data.get("quotes", []):
        if q_item.get("quoteType") in ("EQUITY", "ETF"):
            results.append({
                "symbol": q_item.get("symbol", ""),
                "name": q_item.get("shortname") or q_item.get("longname", ""),
                "exchange": q_item.get("exchange", ""),
                "type": q_item.get("quoteType", ""),
            })
    return {"results": results}


@app.get("/api/chart/{ticker}")
async def get_chart(ticker: str, interval: str = "1mo", range: str = "20y"):
    def _get_history():
        tkr = yf.Ticker(ticker)
        # We need the currency; info is blocked on Render, so use fast_info fallback
        try:
            currency = tkr.fast_info.get("currency", "USD")
        except Exception:
            currency = "USD"
        
        hist = tkr.history(period=range, interval=interval)
        return hist, currency

    try:
        hist, currency = await asyncio.to_thread(_get_history)
    except Exception as e:
        raise HTTPException(502, f"Failed to fetch chart: {str(e)}")

    if hist.empty:
        raise HTTPException(404, f"No chart data for {ticker}")

    history = []
    import pandas as pd
    for index, row in hist.iterrows():
        history.append({
            "date": index.strftime("%Y-%m-%d"),
            "open": round(row["Open"], 2) if pd.notna(row.get("Open")) else None,
            "close": round(row["Close"], 2),
            "volume": int(row["Volume"]) if "Volume" in row and pd.notna(row["Volume"]) else 0,
        })

    return {"ticker": ticker, "name": ticker, "currency": currency, "history": history}


@app.get("/api/news/{ticker}")
async def get_news(ticker: str):
    def _get_news():
        return yf.Ticker(ticker).news

    try:
        news_items = await asyncio.to_thread(_get_news)
    except Exception:
        return {"articles": []}

    cutoff_ts = (datetime.utcnow() - timedelta(days=90)).timestamp()
    
    impact_keywords = [
        "earnings", "revenue", "profit", "loss", "merger", "acquisition",
        "buyback", "dividend", "surge", "plunge", "crash", "rally", "upgrade",
        "downgrade", "layoff", "restructur", "fda", "approval", "lawsuit",
        "regulation", "tariff", "ban", "recall", "bankrupt", "ipo", "split",
    ]

    articles = []
    for item in news_items:
        pub_ts = item.get("providerPublishTime", 0)
        if pub_ts < cutoff_ts:
            continue

        title = item.get("title", "")
        
        combined = title.lower()
        is_impactful = any(kw in combined for kw in impact_keywords)
        
        pub_date = datetime.utcfromtimestamp(pub_ts).strftime("%a, %d %b %Y %H:%M:%S GMT")

        articles.append({
            "title": title,
            "link": item.get("link", ""),
            "pubDate": pub_date,
            "publisher": item.get("publisher", ""),
            "description": title, # fallback to title since yfinance news dict doesn't expose description
            "isImpactful": is_impactful,
        })

    return {"articles": articles[:20]}


# ── Gemini AI analysis endpoint ────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    ticker: str
    currentPrice: float
    oneYearReturn: Optional[float] = None
    monthlyChange: Optional[float] = None
    avgVolume: Optional[float] = None
    newsHeadlines: list[str] = []
    currency: str = "USD"


@app.post("/api/analyze")
async def analyze_stock(req: AnalyzeRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(503, "Gemini API key not configured")

    news_block = "\n".join(f"- {h}" for h in req.newsHeadlines[:15]) or "No recent headlines."

    prompt = f"""You are a senior equity research analyst. Analyze the stock {req.ticker} and return ONLY valid JSON (no markdown, no backticks).

Current data:
- Price: {req.currency} {req.currentPrice}
- 1-Year Return: {req.oneYearReturn if req.oneYearReturn is not None else 'N/A'}%
- Monthly Change: {req.monthlyChange if req.monthlyChange is not None else 'N/A'}%
- Avg Monthly Volume: {req.avgVolume if req.avgVolume is not None else 'N/A'}

Recent headlines:
{news_block}

Return this exact JSON schema:
{{
  "signal": "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL",
  "confidence": <number 0-100>,
  "forecastCurve": [<12 numbers: predicted monthly closing prices for the next 12 months>],
  "adviceHeadline": "<short bold verdict, 6-10 words>",
  "adviceDetail": "<2-3 sentence plain-English explanation for a retail investor>",
  "adviceAction": "<1 sentence concrete action step>",
  "factors": [
    {{"name": "<factor name>", "desc": "<1 sentence>", "type": "macro" | "sentiment" | "financial", "impact": <integer -10 to 10>}}
  ]
}}

Include 5-7 factors. Be realistic — use the headlines for sentiment and the numbers for financial context. The forecastCurve should start near the current price and reflect your signal direction."""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.4, 
            "maxOutputTokens": 2048,
            "responseMimeType": "application/json"
        },
    }

    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(f"{GEMINI_URL}?key={GEMINI_API_KEY}", json=payload, timeout=30)
        
        if r.status_code == 404:
            raise HTTPException(502, f"Gemini Model not found. Check if {GEMINI_MODEL} is correct.")
        if r.status_code == 403 or r.status_code == 400:
            raise HTTPException(502, f"Gemini API key is invalid or lacks access. Code: {r.status_code}")
        if r.status_code != 200:
            raise HTTPException(502, f"Gemini API error: {r.status_code} - {r.text}")

        data = r.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        
        return json.loads(text)

    except json.JSONDecodeError:
        raise HTTPException(502, "Gemini returned invalid JSON")
    except (KeyError, IndexError):
        raise HTTPException(502, "Unexpected Gemini response format")
    except httpx.TimeoutException:
        raise HTTPException(504, "Gemini request timed out")


@app.get("/health")
async def health():
    return {"status": "ok", "gemini_configured": bool(GEMINI_API_KEY)}


# ── Serve the frontend ───────────────────────────────────────────────
# Explicit file routes — no static/ subfolder needed, works with a flat repo.

@app.get("/")
async def serve_index():
    return FileResponse("index.html")

@app.get("/style.css")
async def serve_css():
    return FileResponse("style.css", media_type="text/css")

@app.get("/app.js")
async def serve_js():
    return FileResponse("app.js", media_type="application/javascript")
