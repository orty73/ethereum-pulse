console.log("Ethereum Pulse loaded");

const PAIRS = [
  { key: "usd", unit: "USD" },
  { key: "btc", unit: "BTC" },
  { key: "cny", unit: "CNY" },
];

const CACHE_KEY = "epulse_cache_v3";
const CACHE_TTL_MS = 60 * 1000;

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

  // Face B center
  priceBValue: $("priceBValue"),
  priceBUnit: $("priceBUnit"),
  changeB: $("changeB"),
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

function safeText(node, text) {
  if (!node) return;
  node.textContent = text;
}

function setPillChange(pct) {
  if (!el.changePill || !el.changeMini) return;

  if (pct === null || pct === undefined || Number.isNaN(pct)) {
    el.changePill.textContent = "—";
    el.changePill.classList.remove("up", "down");
    el.changeMini.textContent = "—";
    safeText(el.changeB, "—");
    return;
  }

  const sign = pct >= 0 ? "+" : "";
  const txt = `${sign}${pct.toFixed(2)}%`;

  el.changePill.textContent = txt;
  el.changeMini.textContent = txt;

  el.changePill.classList.remove("up", "down");
  el.changePill.classList.add(pct >= 0 ? "up" : "down");

  safeText(el.changeB, txt);
}

function applyPairUI() {
  safeText(el.pairLabel, "1 ETH =");
  safeText(el.priceUnit, PAIRS[pairIndex].unit);
  safeText(el.priceBUnit, PAIRS[pairIndex].unit);
}

function applyData(data) {
  const p = PAIRS[pairIndex].key;

  let value = null;
  if (p === "usd") value = data.eth_usd;
  if (p === "btc") value = data.eth_btc;
  if (p === "cny") value = data.eth_cny;

  const main =
    p === "btc" ? fmtBTC(value) :
    p === "cny" ? fmtNumber(value, 0) :
    fmtNumber(value, 2);

  safeText(el.priceValue, main);
  safeText(el.priceBValue, main);

  safeText(el.ethUsdMini, fmtNumber(data.eth_usd, 2));
  safeText(el.ethBtc, fmtBTC(data.eth_btc));
  safeText(el.ethCny, fmtNumber(data.eth_cny, 0));

  setPillChange(data.eth_usd_24h_change_pct);

  const gas = data.gas_gwei;
  const bt = data.block_time_s;

  safeText(el.gasGwei, gas ? fmtNumber(gas, 0) : "--");
  safeText(el.gasGwei2, gas ? fmtNumber(gas, 0) : "--");

  safeText(el.blockTime, bt ? fmtNumber(bt, 1) : "--");
  safeText(el.blockTime2, bt ? fmtNumber(bt, 1) : "--");

  const now = new Date();
  safeText(el.updatedAt, `Updated ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`);
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

async function fetchData() {
  const cg = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd,btc,cny&include_24hr_change=true";
  const r1 = await fetch(cg, { cache: "no-store" });
  const j1 = await r1.json();
  const eth = j1.ethereum || {};

  // Gas/time: still placeholders (we'll do CF Worker next)
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

  const cached = readCache();
  if (cached) applyData(cached);

  try {
    const data = await fetchData();
    applyData(data);
    writeCache(data);
  } catch {
    if (!cached) safeText(el.updatedAt, "Offline (no cached data)");
  }

  if (el.priceTap) {
    el.priceTap.addEventListener("click", () => {
      pairIndex = (pairIndex + 1) % PAIRS.length;
      applyPairUI();
      const data = readCache();
      if (data) applyData(data);
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
