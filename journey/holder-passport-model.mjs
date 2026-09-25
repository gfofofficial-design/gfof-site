export const GFOF_MINT = "2oQmHWoTZRmRLregHKjBSGJy3ueX3iRNzimy2iZCmoon";

export function parseHolderBalance(payload, owner, mint = GFOF_MINT) {
  if (payload?.error || !Array.isArray(payload?.result?.value)) {
    throw new Error("Balance response unavailable");
  }
  const slot = payload.result.context?.slot;
  if (!Number.isSafeInteger(slot) || slot < 0) {
    throw new Error("Missing mainnet slot");
  }
  let raw = 0n;
  let decimals = null;
  for (const entry of payload.result.value) {
    const info = entry?.account?.data?.parsed?.info;
    const amount = info?.tokenAmount?.amount;
    const precision = info?.tokenAmount?.decimals;
    if (info?.owner !== owner || info?.mint !== mint || info?.state !== "initialized" ||
        typeof amount !== "string" || !/^\d+$/.test(amount) ||
        !Number.isInteger(precision) || precision < 0 || precision > 18 ||
        !["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFvjJJcsER9g8qnCSHA"].includes(entry?.account?.owner)) {
      throw new Error("Unexpected token account");
    }
    if (decimals !== null && decimals !== precision) {
      throw new Error("Inconsistent token precision");
    }
    decimals = precision;
    raw += BigInt(amount);
  }
  return {raw, decimals: decimals ?? 6, slot, accountCount: payload.result.value.length, holder: raw > 0n};
}

export function formatTokenAmount(raw, decimals) {
  if (typeof raw !== "bigint" || raw < 0n || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("Invalid token amount");
  }
  const base = 10n ** BigInt(decimals);
  const whole = (raw / base).toLocaleString("en-US");
  if (decimals === 0) return whole;
  const fraction = String(raw % base).padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
