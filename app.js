console.log("Ethereum Pulse loaded");

const PAIRS = [
  { key: "usd", unit: "USD" },
  { key: "btc", unit: "BTC" },
  { key: "cny", unit: "CNY" },
];

const CACHE_KEY = "epulse_home_cache_v1";
const CACHE_TTL_MS = 60 * 1000;     // show cached data instantly (fast)
const REFRESH_MS = 60 * 1000;       // refresh in background (light)

const $ = (id) => document.getElementById(id);

const el = {
  diamondTap: $("diamondTap"),
  pairLabel: $("pairLabel"),
  priceValue: $("priceValue"),
  priceUnit: $("priceUnit"),
  changePill: $("changePill"),
  updatedAt: $("updatedAt"),
};

let pairIndex = 0;
let timer = null;

function fmtNumber(n, maxFrac = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: maxFrac }).format(n);
}
function fmtBTC(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(n);
}
function safeText(node, text) {
  if (!node) return;
  node.textContent = text;
}

function setChangePill(pct) {
  if (!el.changePill) return;

  if (pct === null || pct === undefined || Number.isNaN(pct)) {
    el.changePill.textContent = "—";
    el.changePill.classList.remove("up", "down");
    return;
  }

  const sign = pct >= 0 ? "+" : "";
  const txt = `${sign}${pct.toFixed(2)}%`;

  el.changePill.textContent = txt;
  el.changePill.classList.remove("up", "down");
  el.changePill.classList.add(pct >= 0 ? "up" : "down");
}

function applyPairUI() {
  safeText(el.pairLabel, "1 ETH =");
  safeText(el.priceUnit, PAIRS[pairIndex].unit);
}

function applyData(data) {
  const p = PAIRS[pairIndex].key;

  let v = null;
  if (p === "usd") v = data.eth_usd;
  if (p === "btc") v = data.eth_btc;
  if (p === "cny") v = data.eth_cny;

  const main =
    p === "btc" ? fmtBTC(v) :
    p === "cny" ? fmtNumber(v, 0) :
    fmtNumber(v, 2);

  safeText(el.priceValue, main);
  setChangePill(data.eth_usd_24h_change_pct);

  const now = new Date();
  safeText(el.updatedAt, `Updated ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`);
}

function readCache() {
  try{
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.ts || !obj.data) return null;
    if (Date.now() - obj.ts > CACHE_TTL_MS) return null;
    return obj.data;
  }catch{
    return null;
  }
}

function writeCache(data) {
  try{
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  }catch{}
}

async function fetchData() {
  // Lightweight endpoint (no heavy charts)
  const url = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd,btc,cny&include_24hr_change=true";
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  const eth = j.ethereum || {};

  return {
    eth_usd: Number(eth.usd),
    eth_btc: Number(eth.btc),
    eth_cny: Number(eth.cny),
    eth_usd_24h_change_pct: Number(eth.usd_24h_change),
  };
}

async function refresh() {
  try{
    const data = await fetchData();
    applyData(data);
    writeCache(data);
  }catch{
    const cached = readCache();
    if (!cached) safeText(el.updatedAt, "Offline (no cached data)");
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  timer = setInterval(() => {
    if (document.visibilityState === "visible") refresh();
  }, REFRESH_MS);
}

function stopAutoRefresh() {
  if (timer) clearInterval(timer);
  timer = null;
}

function initTap() {
  if (!el.diamondTap) return;
  el.diamondTap.addEventListener("click", () => {
    pairIndex = (pairIndex + 1) % PAIRS.length;
    applyPairUI();
    const cached = readCache();
    if (cached) applyData(cached);
    // also refresh in background (non-blocking feeling)
    refresh();
  });
}

function init() {
  applyPairUI();

  const cached = readCache();
  if (cached) applyData(cached);

  // Fetch after first paint (CWV-friendly)
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => refresh(), { timeout: 1200 });
  } else {
    setTimeout(() => refresh(), 250);
  }

  initTap();
  startAutoRefresh();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
}

document.addEventListener("DOMContentLoaded", init);
