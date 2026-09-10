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
  analysis: null,
  aiSource: "simulated",
  staged: null,
};
let charts = { price: null, volume: null, forecast: null };
let searchDebounce = null;

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
  state.staged = null;
  stagedDot.classList.remove("show");
  applyBtn.classList.remove("active");
  applyBtn.disabled = true;
  if (val.length < 1) { searchDropdown.classList.remove("show"); return; }
  searchDebounce = setTimeout(async () => {
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(val)}`);
      const d = await r.json();
      renderSearchResults(d.results || []);
    } catch { renderSearchResults([]); }
  }, 280);
});
searchInput.addEventListener("focus", () => {
  searchInputWrap.classList.add("focused");
  if (searchDropdown.children.length) searchDropdown.classList.add("show");
});
searchInput.addEventListener("blur", () => searchInputWrap.classList.remove("focused"));
document.addEventListener("mousedown", (e) => {
  if (!el("searchWrap").contains(e.target)) searchDropdown.classList.remove("show");
});

function renderSearchResults(results) {
  searchDropdown.innerHTML = results.map((r) => `
    <div class="search-result" data-symbol="${escapeHtml(r.symbol)}" data-name="${escapeHtml(r.name)}">
      <div class="search-result-left">
        <span class="search-result-symbol">${escapeHtml(r.symbol)}</span>
        <span class="search-result-name">${escapeHtml(r.name)}</span>
      </div>
      <span class="search-result-exchange">${escapeHtml(r.exchange)}</span>
    </div>
  `).join("");
  searchDropdown.classList.toggle("show", results.length > 0);
  searchDropdown.querySelectorAll(".search-result").forEach((node) => {
    node.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const symbol = node.dataset.symbol;
      state.staged = symbol;
      searchInput.value = symbol;
      searchDropdown.classList.remove("show");
      stagedDot.classList.add("show");
      applyBtn.classList.add("active");
      applyBtn.disabled = false;
    });
  });
}

applyBtn.addEventListener("click", () => {
  if (!state.staged) return;
  loadTicker(state.staged);
  state.staged = null;
  searchInput.value = "";
  stagedDot.classList.remove("show");
  applyBtn.classList.remove("active");
  applyBtn.disabled = true;
});

// ── Data loading ──────────────────────────────────────────────────────
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
    renderStats();
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

function renderTickerBar() {
  el("tickerBar").style.display = "flex";
  el("tickerSymbol").textContent = state.ticker;
  el("tickerName").textContent = state.stockName;
  el("tickerCurrency").textContent = state.currency;
}

function renderStats() {
  const stats = computeStats();
  state._stats = stats;
  const items = [
    { label: "Last Close", value: `${currSym(state.currency)}${fmt(stats.lastClose)}`, color: "var(--text)" },
    { label: "Monthly", value: stats.monthlyChange != null ? `${stats.monthlyChange >= 0 ? "+" : ""}${stats.monthlyChange}%` : "—", color: stats.monthlyChange >= 0 ? "var(--green)" : "var(--red)" },
    { label: "1Y Return", value: stats.yrReturn != null ? `${stats.yrReturn >= 0 ? "+" : ""}${stats.yrReturn}%` : "—", color: stats.yrReturn >= 0 ? "var(--green)" : "var(--red)" },
    { label: "Avg Vol", value: fmtBig(stats.avgVol), color: "var(--text)" },
  ];
  let html = items.map((it) => `
    <div class="card stat-card">
      <div class="stat-label">${it.label}</div>
      <div class="stat-value" style="color:${it.color}">${it.value}</div>
    </div>
  `).join("");
  html += `
    <div class="card signal-card" id="signalCard">
      <div class="stat-label">Signal</div>
      <div class="signal-value-row">
        <span class="stat-value" id="signalValue" style="color:var(--text-muted)">—</span>
      </div>
    </div>
  `;
  el("statRow").innerHTML = html;
}

function updateSignalStat() {
  const a = state.analysis;
  const card = el("signalCard");
  const valueEl = el("signalValue");
  if (!a) return;
  const sig = SIGNAL_META[a.signal] || SIGNAL_META.HOLD;
  card.style.borderColor = sig.color + "33";
  card.classList.add("glow");
  valueEl.style.color = sig.color;
  valueEl.innerHTML = `${a.signal} <span class="signal-conf-badge">${a.confidence}%</span>`;
}

function renderPriceChart() {
  const ctx = el("priceChart").getContext("2d");
  const labels = state.history.map((d) => d.date);
  const data = state.history.map((d) => d.close);
  if (charts.price) charts.price.destroy();

  const grad = ctx.createLinearGradient(0, 0, 0, 260);
  grad.addColorStop(0, "rgba(99,132,255,0.2)");
  grad.addColorStop(1, "rgba(99,132,255,0)");

  charts.price = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ data, borderColor: COLORS.blue, backgroundColor: grad, fill: true, borderWidth: 1.8, pointRadius: 0, tension: 0.25 }] },
    options: chartOptions({
      yTick: (v) => currSym(state.currency) + fmtBig(v),
      xTick: (val, idx, ticks) => {
        const d = new Date(labels[val.index] || labels[val]);
        return d.getFullYear() % 5 === 0 ? d.getFullYear() : "";
      },
      tooltipLabel: (ctx) => `Close: ${currSym(state.currency)}${fmt(ctx.parsed.y)}`,
    }),
  });
}

function renderVolumeChart() {
  const ctx = el("volumeChart").getContext("2d");
  const labels = state.history.map((d) => d.date);
  const data = state.history.map((d) => d.volume);
  const colors = state.history.map((d) => d.close >= (d.open || d.close) ? COLORS.green + "88" : COLORS.red + "66");
  if (charts.volume) charts.volume.destroy();

  charts.volume = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 3 }] },
    options: chartOptions({
      yTick: (v) => fmtBig(v),
      xTick: () => "",
      tooltipLabel: (ctx) => `Volume: ${fmtBig(ctx.parsed.y)}`,
      hideXLabels: true,
    }),
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

  const ctx = el("forecastChart").getContext("2d");
  if (charts.forecast) charts.forecast.destroy();

  const grad = ctx.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, lineColor + "1a");
  grad.addColorStop(1, lineColor + "00");

  charts.forecast = new Chart(ctx, {
    type: "line",
    data: {
      labels: months,
      datasets: [{ data: a.forecastCurve, borderColor: lineColor, backgroundColor: grad, fill: true, borderWidth: 2, pointRadius: 0, tension: 0.3 }],
    },
    options: chartOptions({
      yTick: (v) => currSym(state.currency) + fmt(v, 0),
      xTick: (val) => months[val.index] || "",
      tooltipLabel: (ctx) => `${currSym(state.currency)}${fmt(ctx.parsed.y)}`,
    }),
  });
}

function chartOptions({ yTick, xTick, tooltipLabel, hideXLabels }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0e1320",
        borderColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
        titleColor: COLORS.textMuted,
        bodyColor: "#edf0f7",
        titleFont: { size: 11 },
        bodyFont: { size: 12, family: "'JetBrains Mono', monospace" },
        padding: 10,
        cornerRadius: 8,
        callbacks: { label: tooltipLabel },
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(255,255,255,0.04)", drawTicks: false },
        border: { display: false },
        ticks: { color: COLORS.textMuted, font: { size: 10 }, display: !hideXLabels, callback: xTick, maxRotation: 0, autoSkip: true },
      },
      y: {
        grid: { color: "rgba(255,255,255,0.04)", drawTicks: false },
        border: { display: false },
        ticks: { color: COLORS.textMuted, font: { size: 10 }, callback: yTick },
      },
    },
  };
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

// ── Init ──────────────────────────────────────────────────────────────
loadTicker(state.ticker);
