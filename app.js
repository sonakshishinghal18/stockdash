// ── Design tokens (match CSS) ───────────────────────────────────────
const COLORS = {
  blue: "#6384ff",
  cyan: "#38bdf8",
  green: "#34d399",
  greenDim: "rgba(52,211,153,0.12)",
  red: "#f87171",
  redDim: "rgba(248,113,113,0.12)",
  amber: "#fbbf24",
  amberDim: "rgba(251,191,36,0.10)",
  textMuted: "#5c6478",
  border: "rgba(255,255,255,0.06)",
  bg: "#06080d",
};

const SIGNAL_META = {
  "STRONG BUY": { color: "#34d399", bg: "rgba(52,211,153,0.12)", icon: "⬆" },
  "BUY":        { color: "#6ee7b7", bg: "rgba(110,231,183,0.10)", icon: "↑" },
  "HOLD":       { color: "#fbbf24", bg: "rgba(251,191,36,0.10)", icon: "→" },
  "SELL":       { color: "#fca5a5", bg: "rgba(252,165,165,0.10)", icon: "↓" },
  "STRONG SELL":{ color: "#f87171", bg: "rgba(248,113,113,0.12)", icon: "⬇" },
};

const FACTOR_POOL = [
  { name: "Fed Interest Rate Policy", type: "macro" },
  { name: "Sector Rotation Trends", type: "macro" },
  { name: "Inflation Trajectory", type: "macro" },
  { name: "Global Trade Outlook", type: "macro" },
  { name: "Currency Strength", type: "macro" },
  { name: "Social Media Sentiment", type: "sentiment" },
  { name: "Retail Investor Momentum", type: "sentiment" },
  { name: "News Polarity", type: "sentiment" },
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
  const r = seededRandom(tickerSeed(ticker));
  const current = hist.length ? hist[hist.length - 1].close : 100;
  
  let endPrice = current;
  let signal = "HOLD";
  let conf = 50 + Math.floor(r() * 40);
  
  const rand = r();
  if (rand > 0.8) { endPrice *= (1 + 0.15 + r() * 0.2); signal = "STRONG BUY"; conf += 5; }
  else if (rand > 0.55) { endPrice *= (1 + 0.05 + r() * 0.1); signal = "BUY"; }
  else if (rand > 0.35) { endPrice *= (1 - 0.05 + r() * 0.1); signal = "HOLD"; }
  else if (rand > 0.15) { endPrice *= (1 - 0.15 + r() * 0.1); signal = "SELL"; }
  else { endPrice *= (1 - 0.3 + r() * 0.15); signal = "STRONG SELL"; conf += 5; }
  
  const curve = [current];
  const step = (endPrice - current) / 12;
  for (let i = 1; i <= 12; i++) {
    const noise = current * (r() * 0.06 - 0.03);
    curve.push(current + step * i + noise);
  }
  curve[12] = endPrice; // force end
  
  return { signal, confidence: Math.min(99, conf), forecastCurve: curve };
}
function generateFactors(ticker) {
  const r = seededRandom(tickerSeed(ticker) + 123);
  const shuffled = [...FACTOR_POOL].sort(() => r() - 0.5);
  return shuffled.slice(0, 6).map(f => ({ ...f, impact: Math.floor(r() * 21) - 10 }));
}
function getLaymanAdvice(pred, yrReturn) {
  const s = pred.signal;
  if (s === "STRONG BUY") return { adviceHeadline: "Exceptional Growth Setup", adviceDetail: "Metrics indicate a severe undervaluation combined with strong catalysts. The stock is positioned to significantly outperform the market.", adviceAction: "Consider building a heavy position at current levels." };
  if (s === "BUY") return { adviceHeadline: "Favorable Risk/Reward", adviceDetail: "The company shows steady fundamentals and positive sentiment. Downside appears limited compared to potential upside.", adviceAction: "Accumulate shares on minor pullbacks." };
  if (s === "SELL") return { adviceHeadline: "Headwinds Increasing", adviceDetail: "Macro conditions and recent performance suggest the stock may struggle to maintain its valuation. Risk outweighs reward.", adviceAction: "Reduce exposure and wait for better entry points." };
  if (s === "STRONG SELL") return { adviceHeadline: "Critical Deterioration", adviceDetail: "Fundamental deterioration and extremely negative catalysts point to further downside. It is highly overvalued.", adviceAction: "Liquidate position immediately to avoid further losses." };
  return { adviceHeadline: "Neutral Market Churn", adviceDetail: "The stock is fairly valued. There are no immediate catalysts to drive it significantly in either direction right now.", adviceAction: "Hold existing positions, but do not add new capital yet." };
}

// ── Globals ───────────────────────────────────────────────────────────
const el = (id) => document.getElementById(id);
const fmt = (n, d = 2) => Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtBig = (n) => {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString();
};
const currSym = (c) => c === "USD" ? "$" : c === "INR" ? "₹" : c + " ";
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);

let lastDraw = new WeakMap();
const state = {
  ticker: "AAPL",
  name: "Apple Inc.",
  currency: "USD",
  history: [],
  news: [],
  analysis: null,
  aiSource: "simulated",
  _stats: {},
  staged: null,
};
let searchDebounce = null;

// ── Lightweight canvas charting (no external dependency) ───────────────
function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  
  // Temporarily remove inline width to allow parent to shrink natively
  canvas.style.width = "100%"; 
  const cssWidth = canvas.parentElement.clientWidth;
  const cssHeight = parseInt(canvas.getAttribute("height"), 10) || 200;
  
  canvas.style.width = cssWidth + "px";
  canvas.style.height = cssHeight + "px";
  
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

  const padL = 50, padR = 20, padT = 10, padB = opts.xLabels ? 30 : 10;
  const plotW = Math.max(1, W - padL - padR);
  const plotH = Math.max(1, H - padT - padB);

  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min *= 0.9; max *= 1.1; }
  const range = max - min;
  
  // Nice numbers for Y axis grid
  const tickCount = 4;
  const niceRange = Math.pow(10, Math.floor(Math.log10(range))) * Math.ceil(range / Math.pow(10, Math.floor(Math.log10(range))));
  const niceMin = Math.floor(min / (niceRange/tickCount)) * (niceRange/tickCount);

  const xAt = (i) => padL + (i / Math.max(1, values.length - 1)) * plotW;
  const yAt = (v) => padT + plotH - ((v - niceMin) / niceRange) * plotH;

  // Grid & Y labels
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = "10px 'JetBrains Mono', monospace";
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

  const padL = 46, padR = 8, padT = 10, padB = 10;
  const plotW = Math.max(1, W - padL - padR);
  const plotH = Math.max(1, H - padT - padB);

  const max = Math.max(...values, 1);
  
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT); ctx.lineTo(W - padR, padT);
  ctx.moveTo(padL, padT + plotH/2); ctx.lineTo(W - padR, padT + plotH/2);
  ctx.moveTo(padL, padT + plotH); ctx.lineTo(W - padR, padT + plotH);
  ctx.stroke();

  if (opts.yFormat) {
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(opts.yFormat(max), padL - 8, padT);
    ctx.fillText(opts.yFormat(max/2), padL - 8, padT + plotH/2);
    ctx.fillText("0", padL - 8, padT + plotH);
  }

  const barW = Math.max(1, (plotW / values.length) * 0.7);
  const xAt = (i) => padL + (i / Math.max(1, values.length - 1)) * plotW;
  const yAt = (v) => padT + plotH - (v / max) * plotH;

  values.forEach((v, i) => {
    const h = (v / max) * plotH;
    const x = xAt(i) - barW / 2;
    const y = padT + plotH - h;
    ctx.fillStyle = colors[i] || COLORS.blue;
    ctx.fillRect(x, y, barW, h);
  });

  attachHover(canvas, { xAt, yAt, values, padL, padT, plotW, plotH, tooltipFormat: opts.tooltipFormat, isBar: true });
}

let activeTooltip = null;
function attachHover(canvas, cfg) {
  if (canvas._hoverHandler) canvas.removeEventListener("mousemove", canvas._hoverHandler);
  if (canvas._leaveHandler) canvas.removeEventListener("mouseleave", canvas._leaveHandler);
  
  if (!activeTooltip) {
    activeTooltip = document.createElement("div");
    activeTooltip.className = "chart-tooltip";
    document.body.appendChild(activeTooltip);
  }

  const tt = activeTooltip;
  const { xAt, yAt, values, padL, padT, plotW, plotH, tooltipFormat, isBar, color } = cfg;

  canvas._hoverHandler = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < padL || x > padL + plotW) { tt.style.display = "none"; return; }
    
    const idx = Math.max(0, Math.min(values.length - 1, Math.round(((x - padL) / plotW) * (values.length - 1))));
    const vx = xAt(idx);
    const vy = isBar ? yAt(values[idx]) : yAt(values[idx]);
    
    // Draw crosshair overlay
    const fn = lastDraw.get(canvas);
    if (fn) fn(); // redraw base
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    ctx.strokeStyle = COLORS.textMuted;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(vx, padT); ctx.lineTo(vx, padT + plotH);
    ctx.stroke();
    if (!isBar) {
      ctx.beginPath();
      ctx.arc(vx, vy, 4, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.bg;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    tt.style.display = "block";
    tt.textContent = tooltipFormat(values[idx], idx);
    const ttX = rect.left + vx + window.scrollX;
    const ttY = rect.top + padT - 10 + window.scrollY;
    tt.style.left = ttX + "px";
    tt.style.top = (ttY - 20) + "px";
  };

  canvas._leaveHandler = () => {
    tt.style.display = "none";
    const fn = lastDraw.get(canvas);
    if (fn) fn();
  };

  canvas.addEventListener("mousemove", canvas._hoverHandler);
  canvas.addEventListener("mouseleave", canvas._leaveHandler);
}


// ── UI Interactions ───────────────────────────────────────────────────

el("searchInput").addEventListener("input", (e) => {
  const val = e.target.value.trim();
  el("stagedDot").style.display = "none";
  if (val.length === 0) { el("searchDropdown").style.display = "none"; return; }
  
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(async () => {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(val)}`);
      if (!res.ok) return;
      const data = await res.json();
      renderSearchDropdown(data.results);
    } catch {}
  }, 300);
});

el("searchInput").addEventListener("focus", () => {
  if (el("searchDropdown").innerHTML.trim()) el("searchDropdown").style.display = "block";
});

document.addEventListener("click", (e) => {
  if (!el("searchWrap").contains(e.target)) el("searchDropdown").style.display = "none";
});

function renderSearchDropdown(results) {
  const drop = el("searchDropdown");
  if (!results.length) {
    drop.innerHTML = `<div class="search-item" style="opacity:0.5; cursor:default">No results found</div>`;
  } else {
    drop.innerHTML = results.map(r => `
      <div class="search-item" data-sym="${r.symbol}" data-name="${escapeHtml(r.name)}" data-exch="${r.exchange}">
        <div>
          <div class="sym">${r.symbol}</div>
          <div class="name">${escapeHtml(r.name)}</div>
        </div>
        <div class="exch">${r.exchange}</div>
      </div>
    `).join("");
    drop.querySelectorAll(".search-item").forEach(item => {
      item.addEventListener("click", () => {
        state.staged = { symbol: item.dataset.sym, name: item.dataset.name };
        el("searchInput").value = item.dataset.sym;
        drop.style.display = "none";
        el("stagedDot").style.display = "block";
        el("applyBtn").disabled = false;
        el("applyBtn").classList.add("pulse-glow");
      });
    });
  }
  drop.style.display = "block";
}

el("applyBtn").addEventListener("click", () => {
  if (state.staged) {
    loadTicker(state.staged.symbol);
    el("applyBtn").disabled = true;
    el("applyBtn").classList.remove("pulse-glow");
    el("stagedDot").style.display = "none";
    state.staged = null;
  }
});

// ── Main Data Fetching ────────────────────────────────────────────────

async function loadTicker(ticker) {
  el("content").style.display = "none";
  el("errorBox").style.display = "none";
  el("tickerBar").style.display = "none";
  el("loadingMainText").textContent = `Loading ${ticker} data…`;
  el("loadingMain").style.display = "flex";

  try {
    const [chartRes, newsRes] = await Promise.all([
      fetch(`/api/chart/${ticker}`),
      fetch(`/api/news/${ticker}`)
    ]);

    if (!chartRes.ok) throw new Error(chartRes.status === 404 ? `Ticker ${ticker} not found.` : `Data error for ${ticker}`);
    
    const chartData = await chartRes.json();
    const newsData = newsRes.ok ? await newsRes.json() : { articles: [] };

    state.ticker = chartData.ticker;
    state.name = chartData.name || chartData.ticker;
    state.currency = chartData.currency || "USD";
    state.history = chartData.history;
    state.news = newsData.articles;
    state._stats = computeStats();

    el("loadingMain").style.display = "none";
    el("tickerSymbol").textContent = state.ticker;
    el("tickerName").textContent = state.name;
    el("tickerCurrency").textContent = state.currency;
    el("tickerBar").style.display = "flex";
    el("content").style.display = "block";

    renderStatRow();
    renderPriceChart();
    renderVolumeChart();
    renderNews();

    await runAiAnalysis();
  } catch (err) {
    el("loadingMain").style.display = "none";
    el("errorBox").textContent = err.message;
    el("errorBox").style.display = "block";
  }
}

function computeStats() {
  const h = state.history;
  if (!h.length) return {};
  const last = h[h.length - 1];
  const prev = h.length > 1 ? h[h.length - 2] : last;
  const yr = h.length > 12 ? h[h.length - 13] : h[0];
  const monthlyChange = prev.close ? parseFloat(((last.close - prev.close) / prev.close * 100).toFixed(2)) : null;
  const yrReturn = yr.close ? parseFloat(((last.close - yr.close) / yr.close * 100).toFixed(2)) : null;
  const avgVol = Math.round(h.slice(-12).reduce((s, d) => s + (d.volume || 0), 0) / Math.min(h.length, 12));
  return { lastClose: last.close, monthlyChange, yrReturn, avgVol };
}

function renderStatRow() {
  const s = state._stats;
  const mcColor = s.monthlyChange >= 0 ? COLORS.green : COLORS.red;
  const yrColor = s.yrReturn >= 0 ? COLORS.green : COLORS.red;
  
  el("statRow").innerHTML = `
    <div class="stat-card">
      <div class="stat-title">Current Price</div>
      <div class="stat-value">${currSym(state.currency)}${fmt(s.lastClose)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">Monthly Change</div>
      <div class="stat-value" style="color:${mcColor}">${s.monthlyChange >= 0 ? "+" : ""}${s.monthlyChange}%</div>
    </div>
    <div class="stat-card" id="signalStatCard">
      <div class="stat-title">AI Signal</div>
      <div class="stat-value" id="signalValue">--</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">1Y Return</div>
      <div class="stat-value" style="color:${yrColor}">${s.yrReturn >= 0 ? "+" : ""}${s.yrReturn}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">Avg Volume</div>
      <div class="stat-value">${fmtBig(s.avgVol)}</div>
    </div>
  `;
}

function updateSignalStat() {
  const a = state.analysis;
  const card = el("signalStatCard");
  const valueEl = el("signalValue");
  if (!a) return;
  const sig = SIGNAL_META[a.signal] || SIGNAL_META.HOLD;
  card.style.borderColor = sig.color + "33";
  card.classList.add("glow");
  valueEl.style.color = sig.color;
  valueEl.innerHTML = `${a.signal} <span class="signal-conf-badge">${a.confidence}%</span>`;
}

function renderPriceChart() {
  const canvas = el("priceChart");
  const data = state.history.map((d) => d.close);
  const dates = state.history.map((d) => d.date);

  let lastYear = null;
  const xLabels = state.history.map((d) => {
    const y = new Date(d.date).getFullYear();
    // Only print the year once, and only every ~5 years
    if (y % 5 === 0 && y !== lastYear) {
      lastYear = y;
      return String(y);
    }
    return "";
  });

  drawLineChart(canvas, data, {
    color: COLORS.blue,
    fillColor: COLORS.blue,
    yFormat: (v) => currSym(state.currency) + fmtBig(v),
    xLabels,
    tooltipFormat: (v, i) => `${dates[i]}  ${currSym(state.currency)}${fmt(v)}`,
  });
}

function renderVolumeChart() {
  const canvas = el("volumeChart");
  const data = state.history.map((d) => d.volume);
  const dates = state.history.map((d) => d.date);
  const colors = state.history.map((d) => d.close >= (d.open || d.close) ? COLORS.green + "aa" : COLORS.red + "88");

  drawBarChart(canvas, data, colors, {
    yFormat: (v) => fmtBig(v),
    tooltipFormat: (v, i) => `${dates[i]}  Vol ${fmtBig(v)}`,
  });
}

function renderForecastChart() {
  const a = state.analysis;
  if (!a || !a.forecastCurve) return;
  const stats = state._stats;
  const months = ["Now", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12"];
  const endPrice = a.forecastCurve[a.forecastCurve.length - 1];
  const isUp = endPrice >= stats.lastClose;
  const diff = ((endPrice - stats.lastClose) / stats.lastClose * 100).toFixed(1);
  const lineColor = isUp ? COLORS.green : COLORS.red;

  const deltaEl = el("forecastDelta");
  deltaEl.textContent = `${isUp ? "▲" : "▼"} ${diff}%`;
  deltaEl.style.color = lineColor;
  deltaEl.style.background = isUp ? COLORS.greenDim : COLORS.redDim;

  const canvas = el("forecastChart");
  drawLineChart(canvas, a.forecastCurve, {
    color: lineColor,
    fillColor: lineColor,
    refValue: stats.lastClose,
    yFormat: (v) => currSym(state.currency) + fmt(v, 0),
    xLabels: months,
    tooltipFormat: (v, i) => `${months[i]}  ${currSym(state.currency)}${fmt(v)}`,
  });
}

// ── AI analysis ───────────────────────────────────────────────────────
async function runAiAnalysis() {
  el("aiLoading").style.display = "flex";
  el("verdictCard").innerHTML = "";
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
  el("aiLoading").style.display = "none";
  renderVerdict();
  updateSignalStat();
  renderForecastChart();
  renderFactors();
}

function renderVerdict() {
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

  el("verdictCard").innerHTML = `
    <div class="card verdict-card glow">
      <div class="verdict-accent" style="background: linear-gradient(90deg, ${sig.color}66 0%, transparent 100%)"></div>
      <div class="verdict-body">
        <div class="verdict-top">
          <div>
            <div class="verdict-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${COLORS.blue}" stroke-width="2" stroke-linecap="round">
                <path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/>
                <line x1="10" y1="22" x2="14" y2="22"/>
              </svg>
              AI Verdict
            </div>
            <div class="verdict-headline">${escapeHtml(a.adviceHeadline)}</div>
          </div>
          <div class="verdict-signal-col">
            <span class="signal-pill" style="background:${sig.bg}; color:${sig.color}; box-shadow: 0 0 12px ${sig.color}22;">${sig.icon} ${a.signal}</span>
            <div class="conf-bar-row">
              <div class="conf-bar-track"><div class="conf-bar-fill" style="width:${a.confidence}%; background:${sig.color}"></div></div>
              <span class="conf-bar-text">${a.confidence}%</span>
            </div>
          </div>
        </div>
        <p class="verdict-detail">${escapeHtml(a.adviceDetail)}</p>
        <div class="verdict-action">${escapeHtml(a.adviceAction)}</div>
        ${alertHtml}
        <div class="ai-source-line">
          <span class="ai-source-dot" style="background:${state.aiSource === "gemini" ? COLORS.green : COLORS.amber}"></span>
          ${state.aiSource === "gemini" ? "Gemini AI" : "Simulated model"} · Not financial advice
        </div>
      </div>
    </div>
  `;
}

function renderFactors() {
  const a = state.analysis;
  if (!a || !a.factors) return;
  const typeStyle = {
    macro: { color: COLORS.blue, bg: "rgba(99,132,255,0.15)" },
    sentiment: { color: COLORS.amber, bg: COLORS.amberDim },
    financial: { color: COLORS.green, bg: COLORS.greenDim },
  };
  el("factorsList").innerHTML = a.factors.map((f, i) => {
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
window.addEventListener("resize", () => {
  clearTimeout(resizeDebounce);
  resizeDebounce = setTimeout(() => {
    ["priceChart", "volumeChart", "forecastChart"].forEach((id) => {
      const canvas = el(id);
      const fn = lastDraw.get(canvas);
      if (fn) fn();
    });
  }, 150);
});

// ── Init ──────────────────────────────────────────────────────────────
loadTicker(state.ticker);
