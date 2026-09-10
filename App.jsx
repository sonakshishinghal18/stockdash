import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, Cell, ResponsiveContainer,
} from "recharts";

// ── Config ────────────────────────────────────────────────────────────
// In dev, Vite proxy sends /api → localhost:8000.
// In production (GitHub Pages), hit the Render backend directly.
const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || "")
  : "";

// ── Design tokens ─────────────────────────────────────────────────────
const P = {
  bg: "#0a0e17",
  surface: "#111827",
  surfaceAlt: "#1a2234",
  border: "#1e2a3e",
  borderLight: "#2a3a52",
  text: "#e2e8f0",
  textDim: "#8494a7",
  textMuted: "#5a6a7e",
  accent: "#3b82f6",
  accentDim: "#2563eb",
  green: "#22c55e",
  greenDim: "#166534",
  red: "#ef4444",
  redDim: "#991b1b",
  amber: "#f59e0b",
  font: "'Inter', -apple-system, sans-serif",
  mono: "'JetBrains Mono', monospace",
  radius: 10,
  radiusSm: 6,
};

// ── Global styles ─────────────────────────────────────────────────────
function GlobalStyles() {
  return (
    <style>{`
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background: ${P.bg};
        color: ${P.text};
        font-family: ${P.font};
        -webkit-font-smoothing: antialiased;
        line-height: 1.5;
      }
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-track { background: ${P.bg}; }
      ::-webkit-scrollbar-thumb { background: ${P.borderLight}; border-radius: 3px; }
      input, button { font-family: inherit; }
      a { color: ${P.accent}; text-decoration: none; }
      a:hover { text-decoration: underline; }
    `}</style>
  );
}

// ── Simulated AI (deterministic PRNG fallback) ────────────────────────
function tickerSeed(ticker) {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) {
    h = ((h << 5) - h + ticker.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const SIGNALS = ["STRONG BUY", "BUY", "HOLD", "SELL", "STRONG SELL"];
const SIGNAL_COLORS = {
  "STRONG BUY": P.green,
  "BUY": "#4ade80",
  "HOLD": P.amber,
  "SELL": "#f87171",
  "STRONG SELL": P.red,
};

const FACTOR_POOL = [
  { name: "Fed Interest Rate Policy", type: "macro" },
  { name: "Sector Rotation Trends", type: "macro" },
  { name: "Inflation Trajectory", type: "macro" },
  { name: "Global Trade Outlook", type: "macro" },
  { name: "Currency Strength", type: "macro" },
  { name: "Social Media Sentiment", type: "sentiment" },
  { name: "Institutional Buying", type: "sentiment" },
  { name: "Retail Investor Interest", type: "sentiment" },
  { name: "Analyst Consensus", type: "sentiment" },
  { name: "Short Interest Ratio", type: "sentiment" },
  { name: "Revenue Growth Rate", type: "financial" },
  { name: "Debt-to-Equity Ratio", type: "financial" },
  { name: "Profit Margin Trend", type: "financial" },
  { name: "Free Cash Flow", type: "financial" },
  { name: "P/E Relative to Sector", type: "financial" },
  { name: "Insider Transaction Activity", type: "financial" },
];

function generatePrediction(ticker, hist) {
  const price = hist.length ? hist[hist.length - 1].close : 100;
  const rng = seededRandom(tickerSeed(ticker));
  const sigIdx = Math.floor(rng() * SIGNALS.length);
  const signal = SIGNALS[sigIdx];
  const confidence = Math.round(55 + rng() * 40);
  const drift = signal.includes("BUY") ? 0.015 : signal.includes("SELL") ? -0.012 : 0.002;
  const curve = [price];
  for (let i = 1; i <= 12; i++) {
    const prev = curve[i - 1];
    curve.push(Math.round((prev * (1 + drift + (rng() - 0.5) * 0.04)) * 100) / 100);
  }
  return { signal, confidence, forecastCurve: curve };
}

function generateFactors(ticker) {
  const rng = seededRandom(tickerSeed(ticker) + 99);
  const shuffled = [...FACTOR_POOL].sort(() => rng() - 0.5);
  return shuffled.slice(0, 6).map((f) => ({
    ...f,
    desc: `Simulated factor based on ${ticker} market data.`,
    impact: Math.round((rng() - 0.4) * 16),
  }));
}

function getLaymanAdvice(pred, factors, yrRet) {
  const { signal, confidence } = pred;
  if (signal.includes("BUY")) {
    return {
      adviceHeadline: "Conditions favor accumulating this stock",
      adviceDetail: `With a ${confidence}% confidence ${signal} signal and ${yrRet !== null ? `a ${yrRet > 0 ? "positive" : "negative"} 1-year return of ${yrRet}%` : "limited return data"}, the current setup looks constructive for buyers. Momentum and sentiment factors lean positive.`,
      adviceAction: "Consider building a position gradually on any near-term pullback.",
    };
  } else if (signal.includes("SELL")) {
    return {
      adviceHeadline: "Risk-reward tilts against holding here",
      adviceDetail: `At ${confidence}% confidence, the model flags a ${signal} condition. ${yrRet !== null && yrRet < 0 ? `The stock is already down ${Math.abs(yrRet)}% over 12 months.` : "Deteriorating factors suggest caution."} Downside pressure may persist.`,
      adviceAction: "Consider trimming exposure or tightening stop-losses.",
    };
  }
  return {
    adviceHeadline: "Neutral stance — wait for a clearer setup",
    adviceDetail: `The model reads this as a HOLD at ${confidence}% confidence. Neither bulls nor bears have a decisive edge right now. Key catalysts ahead could break the stalemate.`,
    adviceAction: "Hold current positions; avoid adding until direction clarifies.",
  };
}

// ── Utility ───────────────────────────────────────────────────────────
const fmt = (n, d = 2) => n != null ? Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";
const fmtBig = (n) => {
  if (n == null) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString();
};

// ── Sub-components ────────────────────────────────────────────────────

function SearchBar({ onApply, currentTicker }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [staged, setStaged] = useState(null);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInput = (val) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (val.length < 1) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(val)}`);
        const d = await r.json();
        setResults(d.results || []);
        setOpen(true);
      } catch { setResults([]); }
    }, 300);
  };

  const select = (item) => {
    setStaged(item);
    setQuery(item.symbol);
    setOpen(false);
  };

  const apply = () => {
    if (staged) {
      onApply(staged.symbol);
      setStaged(null);
      setQuery("");
    }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "flex", gap: 8, alignItems: "center" }}>
      <div style={{ position: "relative", flex: 1 }}>
        <input
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search stocks…"
          style={{
            width: "100%", padding: "10px 14px", background: P.surfaceAlt,
            border: `1px solid ${P.border}`, borderRadius: P.radiusSm,
            color: P.text, fontSize: 14, outline: "none",
          }}
        />
        {staged && (
          <span style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            width: 8, height: 8, borderRadius: "50%", background: P.green,
          }} />
        )}
        {open && results.length > 0 && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            background: P.surface, border: `1px solid ${P.border}`,
            borderRadius: P.radiusSm, maxHeight: 260, overflowY: "auto", zIndex: 50,
          }}>
            {results.map((r) => (
              <div
                key={r.symbol}
                onClick={() => select(r)}
                style={{
                  padding: "10px 14px", cursor: "pointer",
                  borderBottom: `1px solid ${P.border}`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = P.surfaceAlt)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.symbol}</span>
                  <span style={{ color: P.textDim, fontSize: 13, marginLeft: 8 }}>{r.name}</span>
                </div>
                <span style={{ color: P.textMuted, fontSize: 12, fontFamily: P.mono }}>{r.exchange}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={apply}
        disabled={!staged}
        style={{
          padding: "10px 20px", borderRadius: P.radiusSm, border: "none",
          background: staged ? P.accent : P.border, color: staged ? "#fff" : P.textMuted,
          fontWeight: 600, fontSize: 14, cursor: staged ? "pointer" : "default",
          transition: "background 0.15s",
        }}
      >
        Apply
      </button>
    </div>
  );
}

function Stat({ label, value, sub, color }) {
  return (
    <div style={{
      background: P.surface, border: `1px solid ${P.border}`,
      borderRadius: P.radius, padding: "16px 20px", flex: "1 1 0",
      minWidth: 140,
    }}>
      <div style={{ fontSize: 12, color: P.textMuted, marginBottom: 4, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || P.text, fontFamily: P.mono }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: P.textDim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function VerdictCard({ analysis, impactfulNews, aiSource }) {
  if (!analysis) return null;
  const { signal, confidence, adviceHeadline, adviceDetail, adviceAction } = analysis;
  const sigColor = SIGNAL_COLORS[signal] || P.text;

  return (
    <div style={{
      background: P.surface, border: `1px solid ${P.border}`,
      borderRadius: P.radius, padding: 24,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: P.textMuted, marginBottom: 4 }}>AI Verdict</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{adviceHeadline}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{
            display: "inline-block", padding: "4px 12px", borderRadius: 20,
            background: sigColor + "22", color: sigColor, fontWeight: 700, fontSize: 13,
          }}>{signal}</span>
          <div style={{ fontSize: 12, color: P.textDim, marginTop: 4 }}>{confidence}% confidence</div>
        </div>
      </div>
      <p style={{ color: P.textDim, fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{adviceDetail}</p>
      <p style={{
        fontSize: 14, fontWeight: 600, color: P.accent,
        padding: "10px 14px", background: P.accent + "11",
        borderRadius: P.radiusSm, borderLeft: `3px solid ${P.accent}`,
      }}>
        {adviceAction}
      </p>
      {impactfulNews.length > 0 && (
        <div style={{
          marginTop: 16, padding: "12px 14px", borderRadius: P.radiusSm,
          background: P.amber + "15", borderLeft: `3px solid ${P.amber}`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: P.amber, marginBottom: 6 }}>Market Alert</div>
          {impactfulNews.slice(0, 3).map((n, i) => (
            <div key={i} style={{ fontSize: 13, color: P.textDim, marginBottom: 2 }}>• {n.title}</div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 11, color: P.textMuted, marginTop: 12, fontStyle: "italic" }}>
        Powered by {aiSource === "gemini" ? "Gemini AI" : "simulated model"} · Not financial advice
      </div>
    </div>
  );
}

function PriceChart({ data, currency }) {
  if (!data.length) return null;
  return (
    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: P.radius, padding: "20px 20px 12px" }}>
      <div style={{ fontSize: 13, color: P.textMuted, marginBottom: 12 }}>Price History ({currency})</div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={P.accent} stopOpacity={0.3} />
              <stop offset="100%" stopColor={P.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={P.border} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: P.textMuted }} tickLine={false} axisLine={false}
            tickFormatter={(d) => { const dt = new Date(d); return dt.getFullYear() % 5 === 0 ? dt.getFullYear() : ""; }}
          />
          <YAxis tick={{ fontSize: 11, fill: P.textMuted }} tickLine={false} axisLine={false} width={60}
            tickFormatter={(v) => currency === "INR" ? "₹" + fmtBig(v) : "$" + fmtBig(v)}
          />
          <Tooltip
            contentStyle={{ background: P.surfaceAlt, border: `1px solid ${P.border}`, borderRadius: P.radiusSm, fontSize: 13 }}
            labelStyle={{ color: P.textDim }}
            formatter={(v) => [fmt(v), "Close"]}
          />
          <Area type="monotone" dataKey="close" stroke={P.accent} fill="url(#priceGrad)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function VolumeChart({ data }) {
  if (!data.length) return null;
  return (
    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: P.radius, padding: "20px 20px 12px" }}>
      <div style={{ fontSize: 13, color: P.textMuted, marginBottom: 12 }}>Monthly Volume</div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={P.border} />
          <XAxis dataKey="date" tick={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: P.textMuted }} tickLine={false} axisLine={false} width={50}
            tickFormatter={fmtBig}
          />
          <Tooltip
            contentStyle={{ background: P.surfaceAlt, border: `1px solid ${P.border}`, borderRadius: P.radiusSm, fontSize: 13 }}
            formatter={(v) => [fmtBig(v), "Volume"]}
          />
          <Bar dataKey="volume" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.close >= (d.open || d.close) ? P.green + "aa" : P.red + "aa"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PredictionChart({ forecastCurve, currentPrice, currency }) {
  if (!forecastCurve || !forecastCurve.length) return null;

  const months = ["Now", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12"];
  const data = forecastCurve.map((p, i) => ({
    month: months[i] || `M${i}`,
    price: p,
    upper: Math.round(p * 1.08 * 100) / 100,
    lower: Math.round(p * 0.92 * 100) / 100,
  }));

  const endPrice = forecastCurve[forecastCurve.length - 1];
  const diff = ((endPrice - currentPrice) / currentPrice * 100).toFixed(1);
  const isUp = endPrice >= currentPrice;

  return (
    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: P.radius, padding: "20px 20px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: P.textMuted }}>12-Month Forecast</div>
        <span style={{
          fontSize: 13, fontWeight: 600, fontFamily: P.mono,
          color: isUp ? P.green : P.red,
        }}>
          {isUp ? "▲" : "▼"} {diff}%
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isUp ? P.green : P.red} stopOpacity={0.15} />
              <stop offset="100%" stopColor={isUp ? P.green : P.red} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={P.border} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: P.textMuted }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: P.textMuted }} tickLine={false} axisLine={false} width={60}
            domain={["auto", "auto"]}
            tickFormatter={(v) => currency === "INR" ? "₹" + fmt(v, 0) : "$" + fmt(v, 0)}
          />
          <Tooltip
            contentStyle={{ background: P.surfaceAlt, border: `1px solid ${P.border}`, borderRadius: P.radiusSm, fontSize: 13 }}
            formatter={(v) => [fmt(v), ""]}
          />
          <Area type="monotone" dataKey="upper" stroke="none" fill="url(#bandGrad)" />
          <Area type="monotone" dataKey="lower" stroke="none" fill={P.bg} />
          <Area type="monotone" dataKey="price" stroke={isUp ? P.green : P.red} fill="none" strokeWidth={2} dot={false} />
          <ReferenceLine y={currentPrice} stroke={P.textMuted} strokeDasharray="4 4" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Factors({ factors }) {
  if (!factors || !factors.length) return null;
  const typeColors = { macro: P.accent, sentiment: P.amber, financial: P.green };

  return (
    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: P.radius, padding: 20 }}>
      <div style={{ fontSize: 13, color: P.textMuted, marginBottom: 16 }}>Affecting Parameters</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {factors.map((f, i) => {
          const color = typeColors[f.type] || P.textDim;
          const pct = Math.min(Math.abs(f.impact) * 10, 100);
          const isPositive = f.impact >= 0;
          return (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontSize: 10, padding: "2px 6px", borderRadius: 4,
                    background: color + "22", color: color, fontWeight: 600,
                  }}>{f.type}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</span>
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 600, fontFamily: P.mono,
                  color: isPositive ? P.green : P.red,
                }}>
                  {isPositive ? "+" : ""}{f.impact}
                </span>
              </div>
              <div style={{ fontSize: 12, color: P.textDim, marginBottom: 4 }}>{f.desc}</div>
              <div style={{ height: 4, background: P.bg, borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${pct}%`,
                  background: isPositive ? P.green : P.red,
                  borderRadius: 2, transition: "width 0.4s ease",
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewsSection({ articles }) {
  if (!articles.length) return null;
  return (
    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: P.radius, padding: 20 }}>
      <div style={{ fontSize: 13, color: P.textMuted, marginBottom: 16 }}>Recent News</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {articles.map((a, i) => (
          <div key={i} style={{
            padding: "12px 14px", background: P.surfaceAlt, borderRadius: P.radiusSm,
            borderLeft: a.isImpactful ? `3px solid ${P.amber}` : `3px solid ${P.border}`,
          }}>
            <a href={a.link} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 14, fontWeight: 500, color: P.text, lineHeight: 1.4 }}
            >{a.title}</a>
            <div style={{ fontSize: 12, color: P.textMuted, marginTop: 4 }}>
              {a.publisher && <span>{a.publisher} · </span>}
              {a.pubDate && <span>{new Date(a.pubDate).toLocaleDateString()}</span>}
              {a.isImpactful && (
                <span style={{
                  marginLeft: 8, fontSize: 10, padding: "2px 6px", borderRadius: 4,
                  background: P.amber + "22", color: P.amber, fontWeight: 600,
                }}>IMPACT</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingPulse({ text }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: 16, color: P.textDim, fontSize: 14,
    }}>
      <div style={{
        width: 16, height: 16, border: `2px solid ${P.border}`,
        borderTopColor: P.accent, borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      {text || "Loading…"}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────

export default function App() {
  const [ticker, setTicker] = useState("AAPL");
  const [stockName, setStockName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [history, setHistory] = useState([]);
  const [news, setNews] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [aiSource, setAiSource] = useState("simulated");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState(null);

  // Derived stats
  const stats = useMemo(() => {
    if (!history.length) return {};
    const last = history[history.length - 1];
    const prev = history.length > 1 ? history[history.length - 2] : last;
    const yr = history.length > 12 ? history[history.length - 13] : history[0];
    const monthlyChange = prev.close ? ((last.close - prev.close) / prev.close * 100).toFixed(2) : null;
    const yrReturn = yr.close ? ((last.close - yr.close) / yr.close * 100).toFixed(2) : null;
    const avgVol = Math.round(history.slice(-12).reduce((s, d) => s + (d.volume || 0), 0) / Math.min(history.length, 12));
    return {
      lastClose: last.close,
      monthlyChange: parseFloat(monthlyChange),
      yrReturn: parseFloat(yrReturn),
      avgVol,
    };
  }, [history]);

  const impactfulNews = useMemo(() => news.filter((n) => n.isImpactful), [news]);

  // Fetch data on ticker change
  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setAnalysis(null);
      try {
        const [chartRes, newsRes] = await Promise.all([
          fetch(`${API_BASE}/api/chart/${ticker}`),
          fetch(`${API_BASE}/api/news/${ticker}`),
        ]);

        if (!chartRes.ok) throw new Error("Failed to load chart data");
        const chartData = await chartRes.json();
        const newsData = newsRes.ok ? await newsRes.json() : { articles: [] };

        if (cancelled) return;
        setHistory(chartData.history || []);
        setStockName(chartData.name || ticker);
        setCurrency(chartData.currency || "USD");
        setNews(newsData.articles || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [ticker]);

  // AI analysis — try Gemini, fall back to simulated
  useEffect(() => {
    if (!history.length || loading) return;
    let cancelled = false;

    const runAI = async () => {
      setAiLoading(true);
      // Try Gemini first
      try {
        const headlines = news.slice(0, 15).map((n) => n.title);
        const res = await fetch(`${API_BASE}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticker,
            currentPrice: stats.lastClose,
            oneYearReturn: stats.yrReturn,
            monthlyChange: stats.monthlyChange,
            avgVolume: stats.avgVol,
            newsHeadlines: headlines,
            currency,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.signal && data.forecastCurve) {
            setAnalysis(data);
            setAiSource("gemini");
            setAiLoading(false);
            return;
          }
        }
      } catch {
        // Gemini unavailable — fall through to simulated
      }

      // Simulated fallback
      if (!cancelled) {
        const pred = generatePrediction(ticker, history);
        const factors = generateFactors(ticker);
        const advice = getLaymanAdvice(pred, factors, stats.yrReturn);
        setAnalysis({ ...pred, ...advice, factors });
        setAiSource("simulated");
        setAiLoading(false);
      }
    };
    runAI();
    return () => { cancelled = true; };
  }, [history, loading, ticker, stats, news, currency]);

  return (
    <>
      <GlobalStyles />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>StockDash</h1>
            <span style={{ fontSize: 13, color: P.textMuted, fontFamily: P.mono }}>v2.0</span>
          </div>
          <SearchBar onApply={setTicker} currentTicker={ticker} />
        </div>

        {/* Ticker name bar */}
        <div style={{
          display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20,
          paddingBottom: 16, borderBottom: `1px solid ${P.border}`,
        }}>
          <span style={{ fontSize: 22, fontWeight: 700, fontFamily: P.mono }}>{ticker}</span>
          {stockName && <span style={{ fontSize: 15, color: P.textDim }}>{stockName}</span>}
          {currency && <span style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 4,
            background: P.surfaceAlt, color: P.textMuted, fontFamily: P.mono,
          }}>{currency}</span>}
        </div>

        {loading && <LoadingPulse text={`Fetching ${ticker} data…`} />}
        {error && (
          <div style={{ padding: 16, background: P.red + "15", borderRadius: P.radiusSm, color: P.red, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {!loading && history.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Stat row */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Stat label="Last Close" value={`${currency === "INR" ? "₹" : "$"}${fmt(stats.lastClose)}`} />
              <Stat
                label="Monthly Change"
                value={`${stats.monthlyChange >= 0 ? "+" : ""}${stats.monthlyChange}%`}
                color={stats.monthlyChange >= 0 ? P.green : P.red}
              />
              <Stat
                label="1Y Return"
                value={`${stats.yrReturn >= 0 ? "+" : ""}${stats.yrReturn}%`}
                color={stats.yrReturn >= 0 ? P.green : P.red}
              />
              <Stat label="Avg Volume" value={fmtBig(stats.avgVol)} />
              <Stat
                label="AI Signal"
                value={analysis ? analysis.signal : "…"}
                color={analysis ? SIGNAL_COLORS[analysis.signal] : P.textMuted}
                sub={analysis ? `${analysis.confidence}% conf` : ""}
              />
            </div>

            {/* Verdict */}
            {aiLoading ? (
              <LoadingPulse text="Running AI analysis…" />
            ) : (
              <VerdictCard analysis={analysis} impactfulNews={impactfulNews} aiSource={aiSource} />
            )}

            {/* Charts row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
              <PriceChart data={history} currency={currency} />
              <VolumeChart data={history} />
            </div>

            {/* Prediction + Factors */}
            {analysis && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <PredictionChart
                  forecastCurve={analysis.forecastCurve}
                  currentPrice={stats.lastClose}
                  currency={currency}
                />
                <Factors factors={analysis.factors} />
              </div>
            )}

            {/* News */}
            <NewsSection articles={news} />
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 40, paddingTop: 16, borderTop: `1px solid ${P.border}`,
          fontSize: 12, color: P.textMuted, textAlign: "center",
        }}>
          StockDash v2.0 · Data from Yahoo Finance · AI via Gemini with simulated fallback · Not financial advice
        </div>
      </div>
    </>
  );
}
