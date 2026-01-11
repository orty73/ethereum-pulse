/* Ethereum Pulse — app.js
   Supports:
   - Home quick converter: fiat -> ETH + wei (CoinGecko)
   - Fiat pages: EUR/USD/GBP/JPY/CNY -> ETH + wei (CoinGecko)
   - Safe no-op on pages that don't have expected IDs
*/

const WEI_PER_ETH = 10n ** 18n;

// Elements (may or may not exist depending on the page)
const amountEl = document.getElementById("amount");
const currencyEl = document.getElementById("currency"); // may be disabled on fixed pages
const ethOutEl = document.getElementById("ethOut");
const weiOutEl = document.getElementById("weiOut");
const lastUpdateEl = document.getElementById("lastUpdate");
const statusNoteEl = document.getElementById("statusNote");
const copyBtn = document.getElementById("copyBtn");
const refreshBtn = document.getElementById("refreshBtn");

// Set year if present
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

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
  const v = String(value ?? "").trim().replace(",", ".");
  if (!v) return null;
  const num = Number(v);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

function setStatus(msg) {
  if (!statusNoteEl) return;
  statusNoteEl.textContent = msg || "";
}

/**
 * Convert a decimal ETH string to wei BigInt.
 * Accepts "." or "," decimals.
 * Example: "0.0000045" -> 4500000000000n
 */
function ethStringToWeiBigInt(ethStr) {
  const clean = String(ethStr ?? "").trim().replace(",", ".");
  if (!clean) return null;

  // Handle sign (we only allow positive)
  if (clean.startsWith("-")) return null;

  const parts = clean.split(".");
  if (parts.length > 2) return null;

  const intPart = parts[0] ? parts[0].replace(/\D/g, "") : "0";
  const decPartRaw = parts[1] ? parts[1].replace(/\D/g, "") : "";

  // Pad/truncate to 18 decimals
  const decPart = (decPartRaw + "0".repeat(18)).slice(0, 18);

  // Avoid BigInt("") edge case
  const intBI = BigInt(intPart || "0");
  const decBI = BigInt(decPart || "0");

  return intBI * WEI_PER_ETH + decBI;
}

/**
 * Convert a Number ETH value to wei BigInt (approx).
 * We use toFixed(18) for stable decimal string, then parse to BigInt.
 * This is an estimate on fiat pages (which are estimates anyway).
 */
function ethNumberToWeiBigInt(ethValue) {
  if (!Number.isFinite(ethValue) || ethValue < 0) return null;
  // Convert to string with 18 decimals; may include scientific for huge values (unlikely)
  const s = ethValue.toFixed(18);
  return ethStringToWeiBigInt(s);
}

function clearOutputs() {
  if (ethOutEl) ethOutEl.textContent = "—";
  if (weiOutEl) weiOutEl.textContent = "—";
}

function renderFiatConversion() {
  if (!amountEl || !ethOutEl || !weiOutEl) return;

  const amount = sanitizeAmount(amountEl.value);
  if (amount === null) {
    clearOutputs();
    setStatus("Enter a valid amount.");
    return;
  }

  if (!lastPrice) {
    clearOutputs();
    setStatus("Fetching price…");
    return;
  }

  // amount is fiat; lastPrice is fiat per 1 ETH
  const eth = amount / lastPrice;

  // ETH output (human readable)
  ethOutEl.textContent = formatNumber(eth, { maximumFractionDigits: 8 });

  // Wei output (big integer; estimate derived from ETH)
  const weiBI = ethNumberToWeiBigInt(eth);
  weiOutEl.textContent = weiBI ? weiBI.toString() : "—";

  setStatus("");
}

async function fetchEthPrice(vsCurrency) {
  if (inflight) return;
  inflight = true;

  try {
    setStatus("Fetching latest ETH price…");

    const url =
      `https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=${encodeURIComponent(vsCurrency)}`;

    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`Price request failed (${res.status})`);

    const data = await res.json();
    const price = data?.ethereum?.[vsCurrency];

    if (!Number.isFinite(price) || price <= 0) throw new Error("Invalid price received");

    lastPrice = price;

    if (lastUpdateEl) lastUpdateEl.textContent = new Date().toLocaleString();

    setStatus("");
    renderFiatConversion();
  } catch (e) {
    lastPrice = null;
    renderFiatConversion();
    setStatus("Could not fetch price right now. Try again in a moment.");
  } finally {
    inflight = false;
  }
}

function getSelectedCurrency() {
  // If no currency select exists on a page, we can't do fiat mode
  if (!currencyEl) return null;

  const v = String(currencyEl.value || "").trim().toLowerCase();
  return v || null;
}

function setupFiatModeIfPresent() {
  // Fiat mode requires these IDs:
  // amount, currency, ethOut, weiOut, refreshBtn, copyBtn (some optional)
  if (!amountEl || !currencyEl || !ethOutEl || !weiOutEl) return;

  // Events
  amountEl.addEventListener("input", renderFiatConversion);

  currencyEl.addEventListener("change", async () => {
    const cur = getSelectedCurrency();
    if (!cur) return;
    await fetchEthPrice(cur);
  });

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      const cur = getSelectedCurrency();
      if (!cur) return;
      await fetchEthPrice(cur);
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const amount = sanitizeAmount(amountEl.value);
      if (amount === null || !lastPrice) return;

      const cur = getSelectedCurrency();
      if (!cur) return;

      const ethText = ethOutEl.textContent || "—";
      const weiText = weiOutEl.textContent || "—";

      const text =
        `${formatNumber(amount)} ${cur.toUpperCase()} ≈ ${ethText} ETH ≈ ${weiText} wei (via ethereum-pulse.com)`;

      try {
        await navigator.clipboard.writeText(text);
        setStatus("Copied to clipboard.");
        setTimeout(() => setStatus(""), 1500);
      } catch {
        setStatus("Copy failed (browser blocked).");
      }
    });
  }

  // Initial fetch + refresh loop
  const cur = getSelectedCurrency();
  if (cur) {
    fetchEthPrice(cur);
    setInterval(() => fetchEthPrice(cur), 60_000);
  }
}

// Boot
setupFiatModeIfPresent();
