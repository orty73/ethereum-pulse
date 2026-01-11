const WEI_PER_ETH = 1_000_000_000_000_000_000n;

const amountEl = document.getElementById("amount");
const currencyEl = document.getElementById("currency");
const ethOutEl = document.getElementById("ethOut");
const weiOutEl = document.getElementById("weiOut");
const lastUpdateEl = document.getElementById("lastUpdate");
const statusNoteEl = document.getElementById("statusNote");
const copyBtn = document.getElementById("copyBtn");
const refreshBtn = document.getElementById("refreshBtn");
const sourceNameEl = document.getElementById("sourceName");
const yearEl = document.getElementById("year");

if (yearEl) yearEl.textContent = String(new Date().getFullYear());
if (sourceNameEl) sourceNameEl.textContent = "CoinGecko";

let lastPrice = null; // 1 ETH = X fiat
let inflight = false;

function formatNumber(n, opts = {}) {
  try {
    return new Intl.NumberFormat(undefined, opts).format(n);
  } catch {
    return String(n);
  }
}

function sanitizeAmount(value) {
  const v = String(value).trim().replace(",", ".");
  const num = Number(v);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

function setStatus(msg) {
  if (statusNoteEl) statusNoteEl.textContent = msg || "";
}

// Convert a JS Number ETH -> BigInt wei safely (18 decimals)
function ethNumberToWeiBigInt(eth) {
  if (!Number.isFinite(eth) || eth < 0) return null;

  // 18 decimals string
  const s = eth.toFixed(18);
  const parts = s.split(".");
  const intPart = parts[0] || "0";
  const fracPart = (parts[1] || "").padEnd(18, "0").slice(0, 18);

  const combined = (intPart + fracPart).replace(/^0+(?=\d)/, "");
  try {
    return BigInt(combined);
  } catch {
    return null;
  }
}

function computeAndRender() {
  const amount = sanitizeAmount(amountEl?.value);

  if (amount === null) {
    if (ethOutEl) ethOutEl.textContent = "—";
    if (weiOutEl) weiOutEl.textContent = "—";
    setStatus("Enter a valid amount.");
    return;
  }

  if (!lastPrice) {
    if (ethOutEl) ethOutEl.textContent = "—";
    if (weiOutEl) weiOutEl.textContent = "—";
    setStatus("Fetching price…");
    return;
  }

  // Fiat -> ETH -> wei
  const eth = amount / lastPrice;
  const wei = ethNumberToWeiBigInt(eth);

  if (ethOutEl) ethOutEl.textContent = formatNumber(eth, { maximumFractionDigits: 8 });
  if (weiOutEl) weiOutEl.textContent = wei ? formatNumber(wei.toString(), { maximumFractionDigits: 0 }) : "—";
  setStatus("");
}

async function fetchPrice(currency) {
  if (inflight) return;
  inflight = true;

  try {
    setStatus("Fetching latest ETH price…");

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=${encodeURIComponent(currency)}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });

    if (!res.ok) throw new Error(`Price request failed (${res.status})`);
    const data = await res.json();

    const price = data?.ethereum?.[currency];
    if (!Number.isFinite(price) || price <= 0) throw new Error("Invalid price received");

    lastPrice = price;
    if (lastUpdateEl) lastUpdateEl.textContent = new Date().toLocaleString();
    setStatus("");
    computeAndRender();
  } catch {
    lastPrice = null;
    computeAndRender();
    setStatus("Could not fetch price right now. Try again in a moment.");
  } finally {
    inflight = false;
  }
}

// Events
amountEl?.addEventListener("input", computeAndRender);

currencyEl?.addEventListener("change", async () => {
  await fetchPrice(currencyEl.value);
});

refreshBtn?.addEventListener("click", async () => {
  await fetchPrice(currencyEl.value);
});

copyBtn?.addEventListener("click", async () => {
  const amount = sanitizeAmount(amountEl?.value);
  if (amount === null || !lastPrice) return;

  const ethText = ethOutEl?.textContent || "";
  const weiText = weiOutEl?.textContent || "";
  const cur = (currencyEl?.value || "").toUpperCase();

  const text = `${formatNumber(amount)} ${cur} ≈ ${ethText} ETH ≈ ${weiText} wei (via ethereum-pulse.com)`;

  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied to clipboard.");
    setTimeout(() => setStatus(""), 1500);
  } catch {
    setStatus("Copy failed (browser blocked).");
  }
});

// Initial
if (currencyEl?.value) {
  fetchPrice(currencyEl.value);
  setInterval(() => fetchPrice(currencyEl.value), 60_000);
}
