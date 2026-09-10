import os
import json
import httpx
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="StockDash")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

YF_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

# ── Yahoo Finance proxy endpoints ──────────────────────────────────────
# No CORS needed — frontend and API are served from the same origin.

@app.get("/api/search")
async def search_stocks(q: str = Query(..., min_length=1)):
    url = f"https://query2.finance.yahoo.com/v1/finance/search?q={q}&quotesCount=8&newsCount=0"
    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers=YF_HEADERS, timeout=10)
    if r.status_code != 200:
        raise HTTPException(502, "Yahoo Finance search unavailable")
    data = r.json()
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
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval={interval}&range={range}"
    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers=YF_HEADERS, timeout=15)
    if r.status_code != 200:
        raise HTTPException(502, "Yahoo Finance chart unavailable")
    raw = r.json()
    result = raw.get("chart", {}).get("result", [])
    if not result:
        raise HTTPException(404, f"No chart data for {ticker}")

    item = result[0]
    timestamps = item.get("timestamp", [])
    indicators = item.get("indicators", {}).get("quote", [{}])[0]
    opens = indicators.get("open", [])
    closes = indicators.get("close", [])
    volumes = indicators.get("volume", [])

    meta = item.get("meta", {})
    currency = meta.get("currency", "USD")
    name = meta.get("shortName") or meta.get("longName") or ticker

    history = []
    for i, ts in enumerate(timestamps):
        if i < len(closes) and closes[i] is not None:
            history.append({
                "date": datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d"),
                "open": round(opens[i], 2) if opens[i] else None,
                "close": round(closes[i], 2),
                "volume": volumes[i] if i < len(volumes) else 0,
            })

    return {"ticker": ticker, "name": name, "currency": currency, "history": history}


@app.get("/api/news/{ticker}")
async def get_news(ticker: str):
    url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"
    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers=YF_HEADERS, timeout=10)
    if r.status_code != 200:
        return {"articles": []}

    try:
        root = ET.fromstring(r.text)
    except ET.ParseError:
        return {"articles": []}

    cutoff = datetime.utcnow() - timedelta(days=90)
    impact_keywords = [
        "earnings", "revenue", "profit", "loss", "merger", "acquisition",
        "buyback", "dividend", "surge", "plunge", "crash", "rally", "upgrade",
        "downgrade", "layoff", "restructur", "FDA", "approval", "lawsuit",
        "regulation", "tariff", "ban", "recall", "bankrupt", "IPO", "split",
    ]

    articles = []
    for item in root.iter("item"):
        title = item.findtext("title", "")
        link = item.findtext("link", "")
        pub_date_str = item.findtext("pubDate", "")
        description = item.findtext("description", "")
        publisher = ""
        source_el = item.find("source")
        if source_el is not None:
            publisher = source_el.text or source_el.get("url", "")

        pub_date = None
        if pub_date_str:
            for fmt in ["%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S GMT"]:
                try:
                    pub_date = datetime.strptime(pub_date_str.strip(), fmt)
                    if pub_date.tzinfo:
                        pub_date = pub_date.replace(tzinfo=None)
                    break
                except ValueError:
                    continue

        if pub_date and pub_date < cutoff:
            continue

        combined = (title + " " + description).lower()
        is_impactful = any(kw in combined for kw in impact_keywords)

        articles.append({
            "title": title,
            "link": link,
            "pubDate": pub_date_str,
            "publisher": publisher,
            "description": description[:200],
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
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 2048},
    }

    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(f"{GEMINI_URL}?key={GEMINI_API_KEY}", json=payload, timeout=30)
        if r.status_code != 200:
            raise HTTPException(502, f"Gemini API error: {r.status_code}")

        data = r.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

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
# Mounted last so it doesn't shadow the /api/* and /health routes above.
app.mount("/", StaticFiles(directory="static", html=True), name="static")
