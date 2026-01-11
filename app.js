/* Ethereum Pulse — app.js (v2)
   - Fiat -> ETH + wei using CoinGecko
   - Works with:
     * Home (amount input + currency select)
     * Fixed fiat amount pages (hidden amount + hidden/disabled select)
     * Fixed currency pages (displayed currency text + hidden select)
   - Safe no-op on pages that don't have expected IDs
*/

const WEI_PER_ETH = 10n ** 18n;

// Elements (may or may not exist depending on the page)
const amountEl = document.getElementById("amount");      // input (visible or hidden)
const currencyEl = document.getElementById("currency");  // select (visible, hidden, even disabled)
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

function clearOutputs() {
  if (ethOutEl) ethOutEl.textContent = "—";
  if (weiOutEl) weiOutEl.textContent = "—";
}

/**
 * Convert ETH Number -> wei BigInt (estimate).
 * We do: eth.toFixed(18) then parse to BigInt safely.
 */
function ethNumberToWeiBigInt(ethValue) {
  if (!Number.isFinite(ethValue) || ethValue < 0) return null;

  // Convert to string with 18 decimals (stable), then parse
  const s = ethValue.toFixed(18); // e.g. "0.123400000000000000"
  const parts = s.split(".");
  const intPart = parts[0] || "0";
  const decPart = (parts[1] || "").padEnd(18, "0").slice(0, 18);

  // BigInt parsing
  const intBI = BigInt(intPart);
  const decBI = BigInt(decPart || "0");
  return intBI * WEI_PER_ETH + decBI;
}

/**
 * Get currency even if the select is hidden/disabled.
 * Returns lowercase currency code like "eur".
 */
function getCurrencyCode() {
  if (!currencyEl) return null;

  // Prefer value
  let v = String(currencyEl.value || "").trim().toLowerCase();

  // Fallback: selected option value
  if (!v && currencyEl.options && currencyEl.selectedIndex >= 0) {
    v = String(currencyEl.options[currencyEl.selectedIndex]?.value || "").trim().toLowerCase();
  }

  // Fallback: first option
  if (!v && currencyEl.options && currencyEl.options.length > 0) {
    v = String(currencyEl.options[0]?.value || "").trim().toLowerCase();
  }

  return v || null;
}

function renderFiatConversion() {
  // Need these to compute:
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

  // Wei output (big integer; estimate)
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

function setupFiatModeIfPresent() {
  // Fiat mode requires:
  // - amountEl
  // - currencyEl (even hidden/disabled)
  // - outputs
  if (!amountEl || !currencyEl || !ethOutEl || !weiOutEl) return;

  // Amount change (works even if input is hidden; no harm)
  amountEl.addEventListener("input", renderFiatConversion);

  // Currency change (only relevant on home; safe elsewhere)
  currencyEl.addEventListener("change", async () => {
    const cur = getCurrencyCode();
    if (!cur) return;
    await fetchEthPrice(cur);
  });

  // Refresh
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      const cur = getCurrencyCode();
      if (!cur) return;
      await fetchEthPrice(cur);
    });
  }

  // Copy
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const amount = sanitizeAmount(amountEl.value);
      const cur = getCurrencyCode();

      if (amount === null || !cur || !lastPrice) return;

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
  const cur = getCurrencyCode();
  if (cur) {
    fetchEthPrice(cur);
    setInterval(() => fetchEthPrice(cur), 60_000);
  } else {
    // If somehow missing currency code, keep UX clean
    setStatus("");
  }
}

// Boot
setupFiatModeIfPresent();
