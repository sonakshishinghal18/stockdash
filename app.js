// ── Design tokens (match CSS) ───────────────────────────────────────
const COLORS = {
  blue: "#6366F1",
  cyan: "#06B6D4",
  green: "#10B981",
  greenDim: "rgba(16,185,129,0.15)",
  red: "#EF4444",
  redDim: "rgba(239,68,68,0.15)",
  amber: "#F59E0B",
  amberDim: "rgba(245,158,11,0.15)",
  textMuted: "#64748B",
  border: "rgba(255,255,255,0.08)",
  bg: "#0B0E14",
  surface: "#151A23",
  text: "#F1F5F9",
  textSec: "#94A3B8",
};

const SIGNAL_META = {
  "STRONG BUY": { color: "#10B981", bg: "rgba(16,185,129,0.10)", icon: "⬆" },
  "BUY":        { color: "#34D399", bg: "rgba(52,211,153,0.08)", icon: "↑" },
  "HOLD":       { color: "#F59E0B", bg: "rgba(245,158,11,0.08)", icon: "→" },
  "SELL":       { color: "#F87171", bg: "rgba(248,113,113,0.08)", icon: "↓" },
  "STRONG SELL":{ color: "#EF4444", bg: "rgba(239,68,68,0.08)", icon: "⬇" },
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

// ── Simulated AI fallback ─────────────────────────────────────────────
function tickerSeed(t) {
  let h = 0;
  for (let i = 0; i < t.length; i++) h = ((h << 5) - h + t.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
function generatePrediction(ticker, hist) {
  const price = hist.length ? hist[hist.length - 1].close : 100;
  const rng = seededRandom(tickerSeed(ticker));
  const SIGNALS = ["STRONG BUY", "BUY", "HOLD", "SELL", "STRONG SELL"];
  const signal = SIGNALS[Math.floor(rng() * SIGNALS.length)];
  const confidence = Math.round(55 + rng() * 40);
  const drift = signal.includes("BUY") ? 0.015 : signal.includes("SELL") ? -0.012 : 0.002;
  const curve = [price];
  for (let i = 1; i <= 12; i++) curve.push(Math.round(curve[i - 1] * (1 + drift + (rng() - 0.5) * 0.04) * 100) / 100);
  return { signal, confidence, forecastCurve: curve };
}
function generateFactors(ticker) {
  const rng = seededRandom(tickerSeed(ticker) + 99);
  return [...FACTOR_POOL].sort(() => rng() - 0.5).slice(0, 6).map((f) => ({
    ...f, desc: `Simulated factor analysis for ${ticker}.`, impact: Math.round((rng() - 0.4) * 16),
  }));
}
function getLaymanAdvice(pred, yrRet) {
  const { signal, confidence } = pred;
  if (signal.includes("BUY")) return {
    adviceHeadline: "Conditions favor accumulating this stock",
    adviceDetail: `With a ${confidence}% confidence ${signal} signal${yrRet != null ? ` and a ${yrRet > 0 ? "positive" : "negative"} 1-year return of ${yrRet}%` : ""}, the current setup looks constructive. Momentum and sentiment factors lean positive.`,
    adviceAction: "Consider building a position gradually on any near-term pullback.",
  };
  if (signal.includes("SELL")) return {
    adviceHeadline: "Risk-reward tilts against holding here",
    adviceDetail: `At ${confidence}% confidence, the model flags ${signal}. ${yrRet != null && yrRet < 0 ? `Already down ${Math.abs(yrRet)}% over 12 months.` : "Deteriorating factors suggest caution."} Downside pressure may persist.`,
    adviceAction: "Consider trimming exposure or tightening stop-losses.",
  };
  return {
    adviceHeadline: "Neutral stance — wait for clarity",
    adviceDetail: `The model reads HOLD at ${confidence}% confidence. Neither bulls nor bears hold a decisive edge. Key catalysts ahead could break the stalemate.`,
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
const currSym = (c) => c === "INR" ? "₹" : "$";
const escapeHtml = (s) => (s || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

// ── State ─────────────────────────────────────────────────────────────
let state = {
  ticker: "AAPL",
  stockName: "",
  currency: "USD",
  history: [],
  news: [],
  marketMovers: { india: [], us: [] },
  analysis: null,
  aiSource: "simulated",
  staged: null,
  timeframe: "1y",
};
let searchDebounce = null;

const TIMEFRAMES = [
  { label: "6M", range: "6mo", interval: "1wk" },
  { label: "1Y", range: "1y", interval: "1wk" },
  { label: "3Y", range: "3y", interval: "1mo" },
  { label: "5Y", range: "5y", interval: "1mo" },
  { label: "10Y", range: "10y", interval: "1mo" },
];

// ── Lightweight canvas charting (no external dependency) ───────────────
function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const parent = canvas.parentElement;
  parent.style.overflow = "hidden";
  const cssWidth = canvas.clientWidth || parent.clientWidth;
  const cssHeight = parseInt(canvas.getAttribute("height"), 10) || 200;
  canvas.width = Math.max(1, Math.round(cssWidth * dpr));
  canvas.height = Math.max(1, Math.round(cssHeight * dpr));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: cssWidth, height: cssHeight };
}

function drawLineChart(canvas, values, opts = {}) {
  lastDraw.set(canvas, () => drawLineChart(canvas, values, opts));
  const { ctx, width: W, height: H } = setupCanvas(canvas);
  ctx.clearRect(0, 0, W, H);
  if (!values.length) return;

  const padL = 58, padR = 8, padT = 10, padB = 22;
  const plotW = Math.max(1, W - padL - padR);
  const plotH = Math.max(1, H - padT - padB);

  const min = values.reduce((a,b)=>Math.min(a,b), Infinity);
  const max = values.reduce((a,b)=>Math.max(a,b), -Infinity);
  const range = (max - min) || Math.abs(max) || 1;
  const niceMin = min - range * 0.08;
  const niceMax = max + range * 0.08;
  const niceRange = niceMax - niceMin || 1;

  const xAt = (i) => padL + (values.length > 1 ? (i / (values.length - 1)) * plotW : plotW / 2);
  const yAt = (v) => padT + plotH - ((v - niceMin) / niceRange) * plotH;

  // Grid + y labels
  ctx.strokeStyle = "rgba(0,0,0,0.06)";
  ctx.lineWidth = 1;
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = "12px \'JetBrains Mono\', monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const v = niceMin + (niceRange * i) / gridLines;
    const y = yAt(v);
    ctx.beginPath();
    ctx.moveTo(padL, Math.round(y) + 0.5);
    ctx.lineTo(W - padR, Math.round(y) + 0.5);
    ctx.stroke();
    if (opts.yFormat) ctx.fillText(opts.yFormat(v), padL - 8, y);
  }

  // Reference line (e.g. current price on forecast chart)
  if (opts.refValue != null) {
    const y = yAt(opts.refValue);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLORS.textMuted;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    ctx.restore();
  }

  // Area fill
  if (opts.fillColor) {
    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, opts.fillColor + "33");
    grad.addColorStop(1, opts.fillColor + "00");
    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(values[0]));
    values.forEach((v, i) => ctx.lineTo(xAt(i), yAt(v)));
    ctx.lineTo(xAt(values.length - 1), padT + plotH);
    ctx.lineTo(xAt(0), padT + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Line
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = xAt(i), y = yAt(v);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = opts.color || COLORS.blue;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  // X labels (sparse)
  if (opts.xLabels) {
    ctx.fillStyle = COLORS.textMuted;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    opts.xLabels.forEach((label, i) => {
      if (label) ctx.fillText(label, xAt(i), padT + plotH + 5);
    });
  }
  

  // Hover interaction
  attachHover(canvas, { xAt, yAt, values, padL, padT, plotW, plotH, tooltipFormat: opts.tooltipFormat, color: opts.color || COLORS.blue });
}

function drawBarChart(canvas, values, colors, opts = {}) {
  lastDraw.set(canvas, () => drawBarChart(canvas, values, colors, opts));
  const { ctx, width: W, height: H } = setupCanvas(canvas);
  ctx.clearRect(0, 0, W, H);
  if (!values.length) return;

  const padL = 58, padR = 8, padT = 10, padB = 10;
  const plotW = Math.max(1, W - padL - padR);
  const plotH = Math.max(1, H - padT - padB);

  const max = values.reduce((a,b)=>Math.max(a,b), 1);
  const barGap = 1.5;
  const barW = Math.max(1, plotW / values.length - barGap);

  ctx.strokeStyle = "rgba(0,0,0,0.06)";
  ctx.lineWidth = 1;
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = "12px \'JetBrains Mono\', monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const gridLines = 3;
  for (let i = 0; i <= gridLines; i++) {
    const v = (max * i) / gridLines;
    const y = padT + plotH - (v / max) * plotH;
    ctx.beginPath();
    ctx.moveTo(padL, Math.round(y) + 0.5);
    ctx.lineTo(W - padR, Math.round(y) + 0.5);
    ctx.stroke();
    if (opts.yFormat) ctx.fillText(opts.yFormat(v), padL - 8, y);
  }

  values.forEach((v, i) => {
    const x = padL + i * (plotW / values.length) + barGap / 2;
    const h = (v / max) * plotH;
    const y = padT + plotH - h;
    ctx.fillStyle = colors[i] || COLORS.blue;
    const r = Math.min(2, barW / 2);
    roundRectTop(ctx, x, y, barW, h, r);
    ctx.fill();
  });
  

  attachHover(canvas, {
    xAt: (i) => padL + i * (plotW / values.length) + (plotW / values.length) / 2,
    yAt: (v) => padT + plotH - (v / max) * plotH,
    values, padL, padT, plotW, plotH,
    tooltipFormat: opts.tooltipFormat, color: COLORS.blue, isBar: true,
  });
}

function roundRectTop(ctx, x, y, w, h, r) {
  if (h <= 0) { ctx.beginPath(); return; }
  r = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

const hoverState = new WeakMap();
function attachHover(canvas, cfg) {
  // Remove any previous listener for this canvas
  const prev = hoverState.get(canvas);
  if (prev) {
    canvas.removeEventListener("mousemove", prev.move);
    canvas.removeEventListener("mouseleave", prev.leave);
    if (prev.touchMove) {
      canvas.removeEventListener("touchmove", prev.touchMove);
      canvas.removeEventListener("touchend", prev.leave);
    }
  }

  const tooltip = getOrCreateTooltip(canvas);

  const move = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const n = cfg.values.length;
    if (n === 0) return;
    // Find nearest index
    let idx = 0, best = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(cfg.xAt(i) - mx);
      if (d < best) { best = d; idx = i; }
    }
    const v = cfg.values[idx];
    const px = cfg.xAt(idx), py = cfg.yAt(v);

    tooltip.style.display = "block";
    tooltip.style.left = Math.min(Math.max(px, 40), canvas.clientWidth - 40) + "px";
    tooltip.style.top = "2px";
    tooltip.textContent = cfg.tooltipFormat ? cfg.tooltipFormat(v, idx) : String(v);

    drawCrosshair(canvas, cfg, px, py);
  };
  const leave = () => {
    tooltip.style.opacity = "0";
    drawCrosshair(canvas, cfg, -1, -1);
  };
  
  const touchMove = (e) => {
    if (e.touches.length > 0) move(e.touches[0]);
  };
  
  hoverState.set(canvas, { move, leave, touchMove });
  canvas.addEventListener("mousemove", move);
  canvas.addEventListener("mouseleave", leave);
  canvas.addEventListener("touchmove", touchMove, { passive: true });
  canvas.addEventListener("touchend", leave);
  hoverState.set(canvas, { move, leave, cfg });
}

function getOrCreateTooltip(canvas) {
  let wrap = canvas.parentElement;
  if (getComputedStyle(wrap).position === "static") wrap.style.position = "relative";
  let tip = wrap.querySelector(".chart-tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "chart-tooltip";
    wrap.appendChild(tip);
  }
  return tip;
}

function drawCrosshair(canvas, cfg, px, py) {
  let line = canvas._crosshair;
  if (!line) {
    line = document.createElement("div");
    line.style.position = "absolute";
    line.style.borderLeft = "1px dashed var(--border-hover, rgba(255,255,255,0.2))";
    line.style.pointerEvents = "none";
    line.style.display = "none";
    line.style.zIndex = "10";
    
    let dot = document.createElement("div");
    dot.style.position = "absolute";
    dot.style.width = "6px";
    dot.style.height = "6px";
    dot.style.borderRadius = "50%";
    dot.style.background = cfg.color || "#FFF";
    dot.style.transform = "translate(-50%, -50%)";
    dot.style.display = "none";
    dot.style.pointerEvents = "none";
    dot.style.zIndex = "11";
    
    canvas.parentElement.style.position = "relative";
    canvas.parentElement.appendChild(line);
    canvas.parentElement.appendChild(dot);
    canvas._crosshair = line;
    canvas._crosshairDot = dot;
  }
  
  if (px < 0 || py < 0) {
    line.style.display = "none";
    canvas._crosshairDot.style.display = "none";
    return;
  }
  
  line.style.display = "block";
  line.style.left = px + "px";
  line.style.top = cfg.padT + "px";
  line.style.height = cfg.plotH + "px";
  
  if (!cfg.isBar) {
    canvas._crosshairDot.style.display = "block";
    canvas._crosshairDot.style.left = px + "px";
    canvas._crosshairDot.style.top = py + "px";
    canvas._crosshairDot.style.background = cfg.color || "#FFF";
  } else {
    canvas._crosshairDot.style.display = "none";
  }
}

// ── AI analysis ───────────────────────────────────────────────────────
async function runAiAnalysis() {
  if (el("aiLoading")) el("aiLoading").style.display = "flex";
  if (el("verdictCard")) el("verdictCard").innerHTML = "";
  const stats = state._stats;

  let analysis = null;
  let source = "simulated";

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: state.ticker,
        currentPrice: stats.lastClose,
        oneYearReturn: stats.yrReturn,
        monthlyChange: stats.monthlyChange,
        avgVolume: stats.avgVol,
        newsHeadlines: state.news.slice(0, 15).map((n) => n.title),
        currency: state.currency,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.signal && d.forecastCurve) { analysis = d; source = "gemini"; }
    }
  } catch {}

  if (!analysis) {
    const pred = generatePrediction(state.ticker, state.history);
    const factors = generateFactors(state.ticker);
    const advice = getLaymanAdvice(pred, stats.yrReturn);
    analysis = { ...pred, ...advice, factors };
    source = "simulated";
  }

  state.analysis = analysis;
  state.aiSource = source;
  if (el("aiLoading")) el("aiLoading").style.display = "none";
  renderVerdict();
  updateSignalStat();
  renderForecastChart();
  renderFactors();
}

function renderVerdict() {
  const card = el("verdictCard");
  if (!card) return;
  const a = state.analysis;
  const sig = SIGNAL_META[a.signal] || SIGNAL_META.HOLD;
  const impactfulNews = state.news.filter((n) => n.isImpactful);

  let alertHtml = "";
  if (impactfulNews.length) {
    alertHtml = `
      <div class="market-alert">
        <div class="market-alert-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${COLORS.amber}" stroke-width="2.5" stroke-linecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Market Alert
        </div>
        ${impactfulNews.slice(0, 3).map((n) => `<div class="market-alert-item">• ${escapeHtml(n.title)}</div>`).join("")}
      </div>
    `;
  }

  card.innerHTML = `
    <div class="card verdict-card glow" style="background: ${COLORS.surface}; color: ${COLORS.text};">
      <div class="verdict-accent" style="background: linear-gradient(90deg, ${sig.color}66 0%, transparent 100%)"></div>
      <div class="verdict-body">
        <div class="verdict-top">
          <div>
            <div class="verdict-label" style="color: ${COLORS.textSec}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${COLORS.blue}" stroke-width="2" stroke-linecap="round">
                <path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/>
                <line x1="10" y1="22" x2="14" y2="22"/>
              </svg>
              AI Verdict
            </div>
            <div class="verdict-headline" style="color: ${COLORS.text}">${escapeHtml(a.adviceHeadline)}</div>
          </div>
          <div class="verdict-signal-col">
            <span class="signal-pill" style="background:${sig.bg}; color:${sig.color}; box-shadow: 0 0 12px ${sig.color}22;">${sig.icon} ${a.signal}</span>
            <div class="conf-bar-row">
              <div class="conf-bar-track"><div class="conf-bar-fill" style="width:${a.confidence}%; background:${sig.color}"></div></div>
              <span class="conf-bar-text" style="color: ${COLORS.textSec}">${a.confidence}%</span>
            </div>
          </div>
        </div>
        <p class="verdict-detail" style="color: ${COLORS.textSec}">${escapeHtml(a.adviceDetail)}</p>
        <div class="verdict-action" style="color: ${COLORS.text}">${escapeHtml(a.adviceAction)}</div>
        ${alertHtml}
        <div class="ai-source-line" style="color: ${COLORS.textSec}">
          <span class="ai-source-dot" style="background:${state.aiSource === "gemini" ? COLORS.green : COLORS.amber}"></span>
          ${state.aiSource === "gemini" ? "Gemini AI" : "Simulated model"} · Not financial advice
        </div>
      </div>
    </div>
  `;
}

function renderFactors() {
  const a = state.analysis;
  const flist = el("factorsList");
  if (!a || !a.factors || !flist) return;
  const typeStyle = {
    macro: { color: COLORS.blue, bg: "rgba(79,106,255,0.15)" },
    sentiment: { color: COLORS.amber, bg: COLORS.amberDim },
    financial: { color: COLORS.green, bg: COLORS.greenDim },
  };
  flist.innerHTML = a.factors.map((f, i) => {
    const ts = typeStyle[f.type] || typeStyle.macro;
    const pct = Math.min(Math.abs(f.impact) * 10, 100);
    const pos = f.impact >= 0;
    return `
      <div class="factor-item" style="animation-delay:${i * 0.05}s">
        <div class="factor-top">
          <div class="factor-left">
            <span class="factor-type-badge" style="background:${ts.bg}; color:${ts.color}">${f.type}</span>
            <span class="factor-name">${escapeHtml(f.name)}</span>
          </div>
          <span class="factor-impact" style="color:${pos ? COLORS.green : COLORS.red}">${pos ? "+" : ""}${f.impact}</span>
        </div>
        <div class="factor-desc">${escapeHtml(f.desc)}</div>
        <div class="factor-bar-track">
          <div class="factor-bar-fill" style="width:${pct}%; background:linear-gradient(90deg, ${pos ? COLORS.green : COLORS.red}88, ${pos ? COLORS.green : COLORS.red})"></div>
        </div>
      </div>
    `;
  }).join("");
}

function renderNews() {
  const card = el("newsCard");
  const list = el("newsList");
  if (!card || !list) return;
  if (!state.news.length) { card.style.display = "none"; return; }
  card.style.display = "block";
  list.innerHTML = state.news.map((a) => `
    <a href="${escapeHtml(a.link)}" target="_blank" rel="noopener noreferrer" class="news-item ${a.isImpactful ? "impactful" : ""}">
      <div class="news-title">${escapeHtml(a.title)}</div>
      <div class="news-meta">
        ${a.publisher ? `<span>${escapeHtml(a.publisher)}</span>` : ""}
        ${a.publisher && a.pubDate ? `<span style="opacity:0.4">·</span>` : ""}
        ${a.pubDate ? `<span>${new Date(a.pubDate).toLocaleDateString()}</span>` : ""}
        ${a.isImpactful ? `<span class="news-impact-badge">IMPACT</span>` : ""}
      </div>
    </a>
  `).join("");
}

// ── Resize handling ──────────────────────────────────────────────────
let resizeDebounce = null;
let lastWidth = window.innerWidth;
window.addEventListener("resize", () => {
  if (window.innerWidth === lastWidth) return;
  lastWidth = window.innerWidth;
  
  clearTimeout(resizeDebounce);
  resizeDebounce = setTimeout(() => {
    ["priceChart", "volumeChart", "forecastChart"].forEach((id) => {
      const canvas = el(id);
      if (!canvas) return;
      const fn = lastDraw.get(canvas);
      if (fn) fn();
    });
  }, 150);
});

async function loadTicker(ticker) {
  state.ticker = ticker;
  el("content").style.display = "none";
  el("errorBox").style.display = "none";
  el("loadingMain").style.display = "flex";
  el("loadingMainText").textContent = `Fetching ${ticker} data…`;

  try {
    const [cRes, nRes] = await Promise.all([
      fetch(`/api/chart/${ticker}`),
      fetch(`/api/news/${ticker}`),
    ]);
    if (!cRes.ok) throw new Error("Failed to load chart data");
    const cData = await cRes.json();
    const nData = nRes.ok ? await nRes.json() : { articles: [] };

    state.history = cData.history || [];
    state.stockName = cData.name || ticker;
    state.currency = cData.currency || "USD";
    state.news = nData.articles || [];

    el("loadingMain").style.display = "none";
    renderTickerBar();
    if (!state.history.length) throw new Error("No price history available");

    el("content").style.display = "flex";
    initTimeframeButtons(); // Re-bind if necessary
    renderStats();
    renderPriceChart();
    renderVolumeChart();
    renderNews();

    runAiAnalysis();
  } catch (err) {
    el("loadingMain").style.display = "none";
    el("errorBox").style.display = "block";
    el("errorBox").textContent = err.message || "Error loading stock";
  }
}

// ── Init ──────────────────────────────────────────────────────────────
if (typeof loadTicker === "function") {
  loadTicker(state.ticker);
}
