import {GFOF_MINT, parseHolderBalance, formatTokenAmount} from "./holder-passport-model.mjs";

const RPC = "https://api.mainnet-beta.solana.com";
const $ = id => document.getElementById(id);
let wallet = "";
let provider = null;
let requestId = 0;
let controller = null;
let onDisconnect = null;
let onAccountChanged = null;

function renderProgress() {
  const passport = globalThis.FederationPassport;
  if (!passport) {
    $("mission-progress").textContent = "Open the Journey hub to see your saved missions.";
    return;
  }
  const state = passport.read();
  const done = new Set([...state.done, ...passport.session()]);
  $("mission-progress").textContent = `${done.size} of ${passport.missions.length} missions explored${state.enabled ? " · remembered on this device" : " · this session"}.`;
}

function walletProvider() {
  return [globalThis.phantom?.solana, globalThis.solflare, globalThis.solana]
    .find(candidate => candidate && typeof candidate.connect === "function") || null;
}

function clearView(message = "Wallet view cleared. The Journey and tester steps stay open.") {
  requestId += 1;
  controller?.abort();
  controller = null;
  if (provider && typeof provider.off === "function") {
    if (onDisconnect) provider.off("disconnect", onDisconnect);
    if (onAccountChanged) provider.off("accountChanged", onAccountChanged);
  }
  onDisconnect = null;
  onAccountChanged = null;
  wallet = "";
  provider = null;
  $("wallet-result").hidden = true;
  $("wallet-refresh").hidden = true;
  $("wallet-clear").hidden = true;
  $("wallet-connect").disabled = false;
  $("wallet-status").textContent = message;
}

async function readBalance(address) {
  requestId += 1;
  const thisRequest = requestId;
  controller?.abort();
  const abortController = new AbortController();
  controller = abortController;
  const timeout = setTimeout(() => abortController.abort(), 12000);
  $("wallet-connect").disabled = true;
  $("wallet-refresh").disabled = true;
  $("wallet-result").hidden = true;
  $("wallet-status").textContent = "Reading GFOF token accounts from Solana mainnet…";
  try {
    const response = await fetch(RPC, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({jsonrpc:"2.0",id:1,method:"getTokenAccountsByOwner",params:[address,{mint:GFOF_MINT},{commitment:"confirmed",encoding:"jsonParsed"}]}),
      signal: abortController.signal,
      cache: "no-store"
    });
    if (!response.ok) throw new Error("Mainnet request failed");
    const balance = parseHolderBalance(await response.json(), address);
    if (thisRequest !== requestId || wallet !== address) return;
    if (provider?.publicKey?.toString() !== address) {
      clearView("Wallet account changed. Connect again to check the new address.");
      return;
    }
    $("wallet-address").textContent = `${address.slice(0,6)}…${address.slice(-6)}`;
    $("wallet-balance").textContent = `${formatTokenAmount(balance.raw, balance.decimals)} GFOF`;
    $("wallet-marker").textContent = balance.holder ? "GFOF visible in this connected wallet" : "No GFOF found in this connected wallet";
    $("wallet-slot").textContent = `Read at mainnet slot ${balance.slot.toLocaleString("en-US")}. ${balance.accountCount} token account${balance.accountCount === 1 ? "" : "s"} found. Refresh for a new reading.`;
    $("wallet-result").hidden = false;
    $("wallet-status").textContent = balance.holder ? "Read-only holder check complete." : "Balance check complete. Every tester step remains open.";
  } catch {
    if (thisRequest === requestId && wallet === address) {
      $("wallet-status").textContent = "The mainnet balance could not be verified right now. Please try again later; no balance or holder status is claimed.";
    }
  } finally {
    clearTimeout(timeout);
    if (thisRequest === requestId) {
      controller = null;
      $("wallet-connect").disabled = false;
      $("wallet-refresh").disabled = false;
    }
  }
}

$("wallet-connect").addEventListener("click", async () => {
  const candidate = walletProvider();
  if (!candidate) {
    $("wallet-status").textContent = "No supported Solana wallet was found in this browser. The Journey and tester path remain open without one.";
    return;
  }
  $("wallet-connect").disabled = true;
  $("wallet-status").textContent = "Waiting for your wallet to approve a read-only connection…";
  try {
    const connected = await candidate.connect();
    const address = connected?.publicKey?.toString() || candidate.publicKey?.toString();
    if (!address || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) throw new Error("Invalid wallet address");
    provider = candidate;
    wallet = address;
    $("wallet-refresh").hidden = false;
    $("wallet-clear").hidden = false;
    if (typeof candidate.on === "function") {
      onDisconnect = () => clearView("Wallet disconnected. The Journey stays open.");
      onAccountChanged = key => {
        const changed = key?.toString();
        if (changed !== wallet) clearView("Wallet account changed. Connect again to check the new address.");
      };
      candidate.on("disconnect", onDisconnect);
      candidate.on("accountChanged", onAccountChanged);
    }
    await readBalance(address);
  } catch {
    clearView("Wallet connection was declined or unavailable. Nothing was changed; the tester path remains open.");
  } finally {
    $("wallet-connect").disabled = false;
  }
});

$("wallet-refresh").addEventListener("click", () => {
  if (!wallet || !provider) return;
  if (provider.publicKey?.toString() !== wallet) {
    clearView("Wallet account changed. Connect again to check the new address.");
    return;
  }
  readBalance(wallet);
});
$("wallet-clear").addEventListener("click", () => clearView());
$("copy-tester-note").addEventListener("click", async () => {
  const note = "Federation Journey feedback: I tried [mission or Lending Lab]. I expected [what]. Instead I saw [what happened]. One change that would help is [suggestion].";
  try {
    await navigator.clipboard.writeText(note);
    $("copy-status").textContent = "Feedback template copied. Add your observation before posting; leave out wallet details.";
  } catch {
    $("copy-status").textContent = `Copy this template: ${note}`;
  }
});

renderProgress();
window.addEventListener("pageshow", renderProgress);
