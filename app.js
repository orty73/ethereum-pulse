/* Ethereum Pulse — lightweight realtime updater
   - Tap price to switch: USD → BTC → CNY
   - Keeps SEO/Core Web Vitals: no render blocking, minimal DOM updates, cached values
*/

console.log("Ethereum Pulse loaded");

const PAIRS = [
  { key: "usd", unit: "USD" },
  { key: "btc", unit: "BTC" },
  { key: "cny", unit: "CNY" },
];

const CACHE_KEY = "epulse_cache_v2";
const CACHE_TTL_MS = 60 * 1000; // 60s

const $ = (id) => document.getElementById(id);

const el = {
  priceTap: $("priceTap"),
  pairLabel: $("pairLabel"),
  priceValue: $("priceValue"),
  priceUnit: $("priceUnit"),
  changePill: $("changePill"),
  updatedAt: $("updatedAt"),

  gasGwei: $("gasGwei"),
  blockTime: $("blockTime"),
  gasGwei2: $("gasGwei2"),
  blockTime2: $("blockTime2"),

  ethUsdMini: $("ethUsdMini"),
  changeMini: $("changeMini"),
  ethBtc: $("ethBtc"),
  ethCny: $("ethCny"),
};

let pairIndex = 0;

function fmtNumber(n, maxFrac = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: maxFrac }).format(n);
}

function fmtBTC(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(n);
}

function setPillChange(pct) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) {
    el.changePill.textContent = "—";
    el.changePill.classList.remove("up", "down");
    el.changeMini.textContent = "—";
    return;
  }
  const sign = pct >= 0 ? "+" : "";
  const txt = `${sign}${pct.toFixed(2)}%`;

  el.changePill.textContent = txt;
  el.changeMini.textContent = txt;

  el.changePill.classList.remove("up", "down");
  el.changePill.classList.add(pct >= 0 ? "up" : "down");
}

function applyPairUI() {
  el.pairLabel.textContent = "1 ETH =";
  el.priceUnit.textContent = PAIRS[pairIndex].unit;
}

function applyData(data) {
  // Face A main price: depends on current pair
  const p = PAIRS[pairIndex].key;

  let value = null;
  if (p === "usd") value = data.eth_usd;
  if (p === "btc") value = data.eth_btc;
  if (p === "cny") value = data.eth_cny;

  if (p === "btc") el.priceValue.textContent = fmtBTC(value);
  else if (p === "cny") el.priceValue.textContent = fmtNumber(value, 0);
  else el.priceValue.textContent = fmtNumber(value, 2);

  // Face B minis (always show all)
  el.ethUsdMini.textContent = fmtNumber(data.eth_usd, 2);
  el.ethBtc.textContent = fmtBTC(data.eth_btc);
  el.ethCny.textContent = fmtNumber(data.eth_cny, 0);

  setPillChange(data.eth_usd_24h_change_pct);

  // Network indicators
  const gas = data.gas_gwei;
  const bt = data.block_time_s;

  el.gasGwei.textContent = gas ? fmtNumber(gas, 0) : "--";
  el.gasGwei2.textContent = gas ? fmtNumber(gas, 0) : "--";

  el.blockTime.textContent = bt ? fmtNumber(bt, 1) : "--";
  el.blockTime2.textContent = bt ? fmtNumber(bt, 1) : "--";

  const now = new Date();
  el.updatedAt.textContent = `Updated ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.ts || !obj.data) return null;
    if (Date.now() - obj.ts > CACHE_TTL_MS) return null;
    return obj.data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

/* Data fetch:
   - Price: CoinGecko (simple endpoint, no key)
   - Gas + block time: placeholders (reliable solution = Cloudflare Worker proxy/cache)
*/
async function fetchData() {
  const cg = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd,btc,cny&include_24hr_change=true";
  const r1 = await fetch(cg, { cache: "no-store" });
  const j1 = await r1.json();
  const eth = j1.ethereum || {};

  // Gas: best practice = CF Worker. For now, keep very defensive (may stay null).
  let gas_gwei = null;
  let block_time_s = null;

  return {
    eth_usd: Number(eth.usd),
    eth_btc: Number(eth.btc),
    eth_cny: Number(eth.cny),
    eth_usd_24h_change_pct: Number(eth.usd_24h_change),

    gas_gwei,
    block_time_s,
  };
}

async function init() {
  applyPairUI();

  // 1) paint cache fast
  const cached = readCache();
  if (cached) applyData(cached);
  else el.updatedAt.textContent = "Updating…";

  // 2) fetch fresh
  try {
    const data = await fetchData();
    applyData(data);
    writeCache(data);
  } catch {
    if (!cached) el.updatedAt.textContent = "Offline (no cached data)";
  }

  // 3) tap to switch currency (instant, no refetch)
  el.priceTap.addEventListener("click", () => {
    pairIndex = (pairIndex + 1) % PAIRS.length;
    applyPairUI();

    const data = readCache();
    if (data) applyData(data);
  });
}

document.addEventListener("DOMContentLoaded", init);
