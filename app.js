// ── Design tokens — MUST match CSS dark theme ──────────────────────────
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
  glass: "rgba(255,255,255,0.03)",
  glassHover: "rgba(255,255,255,0.06)",
};

const SIGNAL_META = {
  "STRONG BUY": { color: "#10B981", bg: "rgba(16,185,129,0.15)", icon: "⬆" },
  "BUY":        { color: "#34D399", bg: "rgba(52,211,153,0.12)", icon: "↑" },
  "HOLD":       { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", icon: "→" },
  "SELL":       { color: "#F87171", bg: "rgba(248,113,113,0.12)", icon: "↓" },
  "STRONG SELL":{ color: "#EF4444", bg: "rgba(239,68,68,0.15)", icon: "⬇" },
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
  ticker: "AAPL", stockName: "", currency: "USD",
  history: [], news: [], analysis: null,
  aiSource: "simulated", staged: null, timeframe: "1y",
};
let searchDebounce = null;

const TIMEFRAMES = [
  { label: "6M", range: "6mo", interval: "1wk" },
  { label: "1Y", range: "1y", interval: "1wk" },
  { label: "3Y", range: "3y", interval: "1mo" },
  { label: "5Y", range: "5y", interval: "1mo" },
  { label: "10Y", range: "10y", interval: "1mo" },
];

// ── Canvas charting — fixed expansion bug ─────────────────────────────
const lastDraw = new WeakMap();
const hoverState = new WeakMap();

function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  // Read target height from HTML attribute, width from PARENT (not canvas itself — prevents feedback loop)
  const cssHeight = parseInt(canvas.getAttribute("height"), 10) || 200;
  const parent = canvas.parentElement;
  const parentStyle = getComputedStyle(parent);
  const parentPadding = parseFloat(parentStyle.paddingLeft) + parseFloat(parentStyle.paddingRight);
  const cssWidth = parent.clientWidth - parentPadding;
  // Lock CSS dimensions BEFORE setting buffer size
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

  const padL = 52, padR = 8, padT = 10, padB = 18;
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

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 4; i++) {
    const v = niceMin + (niceRange * i) / 4;
    const y = yAt(v);
    ctx.beginPath(); ctx.moveTo(padL, Math.round(y) + 0.5); ctx.lineTo(W - padR, Math.round(y) + 0.5); ctx.stroke();
    if (opts.yFormat) ctx.fillText(opts.yFormat(v), padL - 8, y);
  }
  if (opts.refValue != null) {
    const y = yAt(opts.refValue);
    ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = COLORS.textMuted; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke(); ctx.restore();
  }
  if (opts.fillColor) {
    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, opts.fillColor + "33"); grad.addColorStop(1, opts.fillColor + "00");
    ctx.beginPath(); ctx.moveTo(xAt(0), yAt(values[0]));
    values.forEach((v, i) => ctx.lineTo(xAt(i), yAt(v)));
    ctx.lineTo(xAt(values.length - 1), padT + plotH); ctx.lineTo(xAt(0), padT + plotH);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
  }
  ctx.beginPath();
  values.forEach((v, i) => { if (i === 0) ctx.moveTo(xAt(i), yAt(v)); else ctx.lineTo(xAt(i), yAt(v)); });
  ctx.strokeStyle = opts.color || COLORS.blue; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
  if (opts.xLabels) {
    ctx.fillStyle = COLORS.textMuted; ctx.textAlign = "center"; ctx.textBaseline = "top";
    opts.xLabels.forEach((label, i) => { if (label) ctx.fillText(label, xAt(i), padT + plotH + 5); });
  }
  canvas._snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
  const max = values.reduce((a,b)=>Math.max(a,b), 1);
  const barGap = 1.5;
  const barW = Math.max(1, plotW / values.length - barGap);
  ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
  ctx.fillStyle = COLORS.textMuted; ctx.font = "10px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let i = 0; i <= 3; i++) {
    const v = (max * i) / 3; const y = padT + plotH - (v / max) * plotH;
    ctx.beginPath(); ctx.moveTo(padL, Math.round(y) + 0.5); ctx.lineTo(W - padR, Math.round(y) + 0.5); ctx.stroke();
    if (opts.yFormat) ctx.fillText(opts.yFormat(v), padL - 8, y);
  }
  values.forEach((v, i) => {
    const x = padL + i * (plotW / values.length) + barGap / 2;
    const h = (v / max) * plotH; const y = padT + plotH - h;
    ctx.fillStyle = colors[i] || COLORS.blue;
    const r = Math.min(2, barW / 2);
    if (h <= 0) return;
    r2 = Math.min(r, w2 = barW / 2, h);
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.lineTo(x + barW - r, y); ctx.arcTo(x + barW, y, x + barW, y + r, r); ctx.lineTo(x + barW, y + h); ctx.closePath(); ctx.fill();
  });
  canvas._snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  attachHover(canvas, {
    xAt: (i) => padL + i * (plotW / values.length) + (plotW / values.length) / 2,
    yAt: (v) => padT + plotH - (v / max) * plotH,
    values, padL, padT, plotW, plotH, tooltipFormat: opts.tooltipFormat, color: COLORS.blue, isBar: true,
  });
}

function attachHover(canvas, cfg) {
  const prev = hoverState.get(canvas);
  if (prev) {
    canvas.removeEventListener("mousemove", prev.move);
    canvas.removeEventListener("mouseleave", prev.leave);
    canvas.removeEventListener("touchmove", prev.touchMove);
    canvas.removeEventListener("touchend", prev.leave);
  }
  const tooltip = getOrCreateTooltip(canvas);
  const move = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const n = cfg.values.length;
    if (n === 0) return;
    let idx = 0, best = Infinity;
    for (let i = 0; i < n; i++) { const d = Math.abs(cfg.xAt(i) - mx); if (d < best) { best = d; idx = i; } }
    const v = cfg.values[idx], px = cfg.xAt(idx), py = cfg.yAt(v);
    tooltip.style.display = "block"; tooltip.style.opacity = "1";
    tooltip.style.left = Math.min(Math.max(px, 40), canvas.clientWidth - 40) + "px";
    tooltip.style.top = "2px";
    tooltip.textContent = cfg.tooltipFormat ? cfg.tooltipFormat(v, idx) : String(v);
    drawCrosshair(canvas, cfg, px, py);
  };
  const leave = () => {
    tooltip.style.display = "none"; tooltip.style.opacity = "0";
    if (canvas._snapshot) { canvas.getContext("2d").putImageData(canvas._snapshot, 0, 0); }
  };
  const touchMove = (e) => { if (e.touches.length > 0) move(e.touches[0]); };
  // Store ALL handlers in one set call
  hoverState.set(canvas, { move, leave, touchMove, cfg });
  canvas.addEventListener("mousemove", move);
  canvas.addEventListener("mouseleave", leave);
  canvas.addEventListener("touchmove", touchMove, { passive: true });
  canvas.addEventListener("touchend", leave);
}

function getOrCreateTooltip(canvas) {
  let wrap = canvas.parentElement;
  if (getComputedStyle(wrap).position === "static") wrap.style.position = "relative";
  let tip = wrap.querySelector(".chart-tooltip");
  if (!tip) { tip = document.createElement("div"); tip.className = "chart-tooltip"; wrap.appendChild(tip); }
  return tip;
}

function drawCrosshair(canvas, cfg, px, py) {
  const ctx = canvas.getContext("2d");
  if (canvas._snapshot) ctx.putImageData(canvas._snapshot, 0, 0);
  const dpr = window.devicePixelRatio || 1;
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.beginPath(); ctx.setLineDash([3, 3]); ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1;
  ctx.moveTo(px, cfg.padT); ctx.lineTo(px, cfg.padT + cfg.plotH); ctx.stroke(); ctx.setLineDash([]);
  if (!cfg.isBar) { ctx.beginPath(); ctx.fillStyle = cfg.color; ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// ── DOM refs ──────────────────────────────────────────────────────────
const el = (id) => document.getElementById(id);
const searchInput = el("searchInput");
const searchDropdown = el("searchDropdown");
const searchInputWrap = document.querySelector(".search-input-wrap");
const stagedDot = el("stagedDot");
const applyBtn = el("applyBtn");

// ── Search ────────────────────────────────────────────────────────────
searchInput.addEventListener("input", (e) => {
  const val = e.target.value;
  clearTimeout(searchDebounce);
  state.staged = null; stagedDot.classList.remove("show"); applyBtn.classList.remove("active"); applyBtn.disabled = true;
  if (val.length < 1) { searchDropdown.classList.remove("show"); return; }
  searchDebounce = setTimeout(async () => {
    try { const r = await fetch(`/api/search?q=${encodeURIComponent(val)}`); const d = await r.json(); renderSearchResults(d.results || []); }
    catch { renderSearchResults([]); }
  }, 280);
});
searchInput.addEventListener("focus", () => { searchInputWrap.classList.add("focused"); if (searchDropdown.children.length) searchDropdown.classList.add("show"); });
searchInput.addEventListener("blur", () => searchInputWrap.classList.remove("focused"));
document.addEventListener("mousedown", (e) => { if (!el("searchWrap").contains(e.target)) searchDropdown.classList.remove("show"); });

function renderSearchResults(results) {
  searchDropdown.innerHTML = results.map((r) => `
    <div class="search-result" data-symbol="${escapeHtml(r.symbol)}" data-name="${escapeHtml(r.name)}">
      <div class="search-result-left">
        <span class="search-result-symbol">${escapeHtml(r.symbol)}</span>
        <span class="search-result-name">${escapeHtml(r.name)}</span>
      </div>
      <span class="search-result-exchange">${escapeHtml(r.exchange)}</span>
    </div>`).join("");
  searchDropdown.classList.toggle("show", results.length > 0);
  searchDropdown.querySelectorAll(".search-result").forEach((node) => {
    node.addEventListener("mousedown", (e) => {
      e.preventDefault(); state.staged = node.dataset.symbol; searchInput.value = node.dataset.symbol;
      searchDropdown.classList.remove("show"); stagedDot.classList.add("show"); applyBtn.classList.add("active"); applyBtn.disabled = false;
    });
  });
}

applyBtn.addEventListener("click", () => {
  if (!state.staged) return;
  loadTicker(state.staged); state.staged = null; searchInput.value = "";
  stagedDot.classList.remove("show"); applyBtn.classList.remove("active"); applyBtn.disabled = true;
});

// ── Timeframe buttons ──────────────────────────────────────────────────
function initTimeframeButtons() {
  const buttons = document.querySelectorAll(".tf-btn");
  if (!buttons.length) return;
  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      buttons.forEach(b => b.classList.remove("active")); btn.classList.add("active");
      const label = btn.textContent.trim();
      const tf = TIMEFRAMES.find(t => t.label === label) || TIMEFRAMES[1];
      state.timeframe = tf.range;
      try {
        const res = await fetch(`/api/chart/${state.ticker}?range=${tf.range}&interval=${tf.interval}`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        state.history = data.history || [];
        renderStats(); renderPriceChart(); updatePriceChangeBadge(); renderVolumeChart();
      } catch (err) { console.error("Timeframe fetch error", err); }
    });
  });
}

function updatePriceChangeBadge() {
  const badge = el("priceChangeBadge");
  if (!badge || state.history.length < 2) return;
  const first = state.history[0].close, last = state.history[state.history.length - 1].close;
  const diff = (last - first) / first * 100;
  badge.textContent = `${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff).toFixed(1)}%`;
  badge.style.color = diff >= 0 ? COLORS.green : COLORS.red;
  badge.style.background = diff >= 0 ? COLORS.greenDim : COLORS.redDim;
}

function getMonthlyData(history) {
  const map = new Map();
  for (const d of history) {
    const month = d.date.substring(0, 7);
    if (!map.has(month)) map.set(month, { date: month, open: d.open, close: d.close, volume: 0 });
    const m = map.get(month); m.close = d.close; m.volume += d.volume || 0;
  }
  return Array.from(map.values());
}

function computeStats() {
  const h = state.history, mh = getMonthlyData(h);
  if (!h.length || !mh.length) return {};
  const last = h[h.length - 1], mlast = mh[mh.length - 1], mprev = mh.length > 1 ? mh[mh.length - 2] : mlast;
  const myr = mh.length > 12 ? mh[mh.length - 13] : mh[0];
  const monthlyChange = mprev.close ? parseFloat(((last.close - mprev.close) / mprev.close * 100).toFixed(2)) : null;
  const yrReturn = myr.close ? parseFloat(((last.close - myr.close) / myr.close * 100).toFixed(2)) : null;
  const avgVol = Math.round(mh.slice(-12).reduce((s, d) => s + d.volume, 0) / Math.min(mh.length, 12));
  return { lastClose: last.close, lastDate: last.date.substring(0, 7), monthlyChange, yrReturn, avgVol };
}

function renderTickerBar() {
  if (el("tickerBar")) el("tickerBar").style.display = "flex";
  if (el("tickerSymbol")) el("tickerSymbol").textContent = state.ticker;
  if (el("tickerName")) el("tickerName").textContent = state.stockName;
  if (el("tickerCurrency")) el("tickerCurrency").textContent = state.currency;
}

function renderStats() {
  const stats = computeStats(); state._stats = stats;
  const items = [
    { label: "Last Close", value: `${currSym(state.currency)}${fmt(stats.lastClose)}`, color: COLORS.text, sub: stats.lastDate },
    { label: "Monthly", value: stats.monthlyChange != null ? `${stats.monthlyChange >= 0 ? "+" : ""}${stats.monthlyChange}%` : "—", color: stats.monthlyChange >= 0 ? COLORS.green : COLORS.red },
    { label: "1Y Return", value: stats.yrReturn != null ? `${stats.yrReturn >= 0 ? "+" : ""}${stats.yrReturn}%` : "—", color: stats.yrReturn >= 0 ? COLORS.green : COLORS.red },
    { label: "Monthly Vol", value: fmtBig(stats.avgVol), color: COLORS.text },
  ];
  let html = items.map((it) => `
    <div class="card stat-card">
      <div class="stat-label">${it.label}</div>
      <div class="stat-value" style="color:${it.color}">${it.value}</div>
      ${it.sub ? `<div style="font-size:12px;color:${COLORS.textSec};margin-top:2px;font-family:var(--mono)">${it.sub}</div>` : ""}
    </div>`).join("");
  html += `<div class="card signal-card" id="signalCard"><div class="stat-label">Signal</div><div class="signal-value-row"><span class="stat-value" id="signalValue" style="color:${COLORS.textMuted}">—</span></div></div>`;
  if (el("statRow")) el("statRow").innerHTML = html;
}

function updateSignalStat() {
  const a = state.analysis, card = el("signalCard"), valueEl = el("signalValue");
  if (!a || !card || !valueEl) return;
  const sig = SIGNAL_META[a.signal] || SIGNAL_META.HOLD;
  card.style.borderColor = sig.color + "33"; card.classList.add("glow");
  valueEl.style.color = sig.color;
  valueEl.innerHTML = `${a.signal} <span class="signal-conf-badge">${a.confidence}%</span>`;
}

function renderPriceChart() {
  const canvas = el("priceChart");
  if (!canvas) return;
  const data = state.history.map(d => d.close), dates = state.history.map(d => d.date);
  const isUp = data[data.length - 1] >= data[0];
  const chartColor = isUp ? COLORS.green : COLORS.red;
  let lastYear = null, lastMonth = null;
  const xLabels = state.history.map((d) => {
    const dt = new Date(d.date), y = dt.getFullYear(), m = dt.getMonth();
    if (state.timeframe === "6mo" || state.timeframe === "1y") {
      if (m % 2 === 0 && m !== lastMonth) { lastMonth = m; return `${dt.toLocaleString('default',{month:'short'})} '${String(y).slice(-2)}`; }
    } else { if (y % 2 === 0 && y !== lastYear) { lastYear = y; return String(y); } }
    return "";
  });
  drawLineChart(canvas, data, { color: chartColor, fillColor: chartColor, yFormat: (v) => currSym(state.currency) + fmtBig(v), xLabels, tooltipFormat: (v, i) => `${dates[i]}  ${currSym(state.currency)}${fmt(v)}` });
}

function renderVolumeChart() {
  const canvas = el("volumeChart");
  if (!canvas || !state.history.length) return;
  const mh = getMonthlyData(state.history);
  drawBarChart(canvas, mh.map(d => d.volume), mh.map(d => d.close >= (d.open || d.close) ? COLORS.green + "aa" : COLORS.red + "88"),
    { yFormat: (v) => fmtBig(v), tooltipFormat: (v, i) => `${mh[i].date}  Vol ${fmtBig(v)}` });
}

function renderForecastChart() {
  const a = state.analysis; if (!a || !a.forecastCurve) return;
  const stats = state._stats;
  const months = ["Now","M1","M2","M3","M4","M5","M6","M7","M8","M9","M10","M11","M12"];
  const endPrice = a.forecastCurve[a.forecastCurve.length - 1];
  const isUp = endPrice >= stats.lastClose;
  const diff = ((endPrice - stats.lastClose) / stats.lastClose * 100).toFixed(1);
  const lineColor = isUp ? COLORS.green : COLORS.red;
  const deltaEl = el("forecastDelta");
  if (deltaEl) { deltaEl.textContent = `${isUp ? "▲" : "▼"} ${diff}%`; deltaEl.style.color = lineColor; deltaEl.style.background = isUp ? COLORS.greenDim : COLORS.redDim; }
  const canvas = el("forecastChart");
  if (canvas) drawLineChart(canvas, a.forecastCurve, { color: lineColor, fillColor: lineColor, refValue: stats.lastClose, yFormat: (v) => currSym(state.currency) + fmt(v, 0), xLabels: months, tooltipFormat: (v, i) => `${months[i]}  ${currSym(state.currency)}${fmt(v)}` });
}

// ── AI analysis ───────────────────────────────────────────────────────
async function runAiAnalysis() {
  if (el("aiLoading")) el("aiLoading").style.display = "flex";
  if (el("verdictCard")) el("verdictCard").innerHTML = "";
  const stats = state._stats;
  let analysis = null, source = "simulated";
  try {
    const res = await fetch("/api/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: state.ticker, currentPrice: stats.lastClose, oneYearReturn: stats.yrReturn, monthlyChange: stats.monthlyChange, avgVolume: stats.avgVol, newsHeadlines: state.news.slice(0, 15).map(n => n.title), currency: state.currency }),
    });
    if (res.ok) { const d = await res.json(); if (d.signal && d.forecastCurve) { analysis = d; source = "gemini"; } }
  } catch {}
  if (!analysis) {
    const pred = generatePrediction(state.ticker, state.history);
    const factors = generateFactors(state.ticker);
    const advice = getLaymanAdvice(pred, stats.yrReturn);
    analysis = { ...pred, ...advice, factors }; source = "simulated";
  }
  state.analysis = analysis; state.aiSource = source;
  if (el("aiLoading")) el("aiLoading").style.display = "none";
  renderVerdict(); updateSignalStat(); renderForecastChart(); renderFactors();
}

function renderVerdict() {
  const card = el("verdictCard"); if (!card) return;
  const a = state.analysis;
  const sig = SIGNAL_META[a.signal] || SIGNAL_META.HOLD;
  const impactfulNews = state.news.filter(n => n.isImpactful);
  const isGemini = state.aiSource === "gemini";

  // Prominent AI source banner
  const sourceBanner = `
    <div class="ai-source-banner ${isGemini ? "gemini" : "simulated"}">
      <span class="ai-source-dot"></span>
      <span class="ai-source-text">${isGemini ? "Powered by Gemini 3.1 Pro" : "⚠ Simulated model (Gemini unavailable)"}</span>
    </div>`;

  let alertHtml = "";
  if (impactfulNews.length) {
    alertHtml = `<div class="market-alert"><div class="market-alert-title">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${COLORS.amber}" stroke-width="2.5" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      Market Alert</div>${impactfulNews.slice(0, 3).map(n => `<div class="market-alert-item">• ${escapeHtml(n.title)}</div>`).join("")}</div>`;
  }

  card.innerHTML = `
    <div class="card verdict-card glow">
      <div class="verdict-accent" style="background:linear-gradient(90deg, ${sig.color}66 0%, transparent 100%)"></div>
      ${sourceBanner}
      <div class="verdict-body">
        <div class="verdict-top">
          <div>
            <div class="verdict-label">AI Verdict</div>
            <div class="verdict-headline">${escapeHtml(a.adviceHeadline)}</div>
          </div>
          <div class="verdict-signal-col">
            <span class="signal-pill" style="background:${sig.bg};color:${sig.color};">${sig.icon} ${a.signal}</span>
            <div class="conf-bar-row"><div class="conf-bar-track"><div class="conf-bar-fill" style="width:${a.confidence}%;background:${sig.color}"></div></div><span class="conf-bar-text">${a.confidence}%</span></div>
          </div>
        </div>
        <p class="verdict-detail">${escapeHtml(a.adviceDetail)}</p>
        <div class="verdict-action">${escapeHtml(a.adviceAction)}</div>
        ${alertHtml}
        <div class="ai-source-line">Not financial advice</div>
      </div>
    </div>`;
}

function renderFactors() {
  const a = state.analysis, flist = el("factorsList");
  if (!a || !a.factors || !flist) return;
  const typeStyle = { macro: { color: COLORS.blue, bg: "rgba(99,102,241,0.2)" }, sentiment: { color: COLORS.amber, bg: COLORS.amberDim }, financial: { color: COLORS.green, bg: COLORS.greenDim } };
  flist.innerHTML = a.factors.map((f, i) => {
    const ts = typeStyle[f.type] || typeStyle.macro;
    const pct = Math.min(Math.abs(f.impact) * 10, 100), pos = f.impact >= 0;
    return `<div class="factor-item" style="animation-delay:${i * 0.05}s"><div class="factor-top"><div class="factor-left"><span class="factor-type-badge" style="background:${ts.bg};color:${ts.color}">${f.type}</span><span class="factor-name">${escapeHtml(f.name)}</span></div><span class="factor-impact" style="color:${pos ? COLORS.green : COLORS.red}">${pos ? "+" : ""}${f.impact}</span></div><div class="factor-desc">${escapeHtml(f.desc)}</div><div class="factor-bar-track"><div class="factor-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${pos ? COLORS.green : COLORS.red}88,${pos ? COLORS.green : COLORS.red})"></div></div></div>`;
  }).join("");
}

function renderNews() {
  const card = el("newsCard"), list = el("newsList");
  if (!card || !list) return;
  if (!state.news.length) { card.style.display = "none"; return; }
  card.style.display = "block";
  list.innerHTML = state.news.map(a => `
    <a href="${escapeHtml(a.link)}" target="_blank" rel="noopener noreferrer" class="news-item ${a.isImpactful ? "impactful" : ""}">
      <div class="news-title">${escapeHtml(a.title)}</div>
      <div class="news-meta">
        ${a.publisher ? `<span>${escapeHtml(a.publisher)}</span>` : ""}
        ${a.publisher && a.pubDate ? '<span style="opacity:0.4">·</span>' : ""}
        ${a.pubDate ? `<span>${new Date(a.pubDate).toLocaleDateString()}</span>` : ""}
        ${a.isImpactful ? '<span class="news-impact-badge">IMPACT</span>' : ""}
      </div></a>`).join("");
}

// ── Resize ────────────────────────────────────────────────────────────
let resizeDebounce = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeDebounce);
  resizeDebounce = setTimeout(() => {
    ["priceChart", "volumeChart", "forecastChart"].forEach(id => { const c = el(id); if (c) { const fn = lastDraw.get(c); if (fn) fn(); } });
  }, 150);
});

async function loadTicker(ticker) {
  state.ticker = ticker;
  el("content").style.display = "none"; el("errorBox").style.display = "none";
  el("loadingMain").style.display = "flex"; el("loadingMainText").textContent = `Fetching ${ticker} data…`;
  try {
    const [cRes, nRes] = await Promise.all([fetch(`/api/chart/${ticker}`), fetch(`/api/news/${ticker}`)]);
    if (!cRes.ok) throw new Error("Failed to load chart data");
    const cData = await cRes.json(), nData = nRes.ok ? await nRes.json() : { articles: [] };
    state.history = cData.history || []; state.stockName = cData.name || ticker; state.currency = cData.currency || "USD"; state.news = nData.articles || [];
    el("loadingMain").style.display = "none";
    renderTickerBar();
    if (!state.history.length) throw new Error("No price history available");
    el("content").style.display = "flex";
    initTimeframeButtons(); renderStats(); renderPriceChart(); updatePriceChangeBadge(); renderVolumeChart(); renderNews();
    runAiAnalysis();
  } catch (err) { el("loadingMain").style.display = "none"; el("errorBox").style.display = "block"; el("errorBox").textContent = err.message || "Error loading stock"; }
}

loadTicker(state.ticker);
