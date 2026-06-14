/** Shared formatting / math helpers used across pipeline and API. */

/** "7xKpVeR4nQ2mL8sD3wYt9fQa" → "7xKp…9fQa". */
export function shortAddr(addr: string, head = 4, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/** Percentage of total supply (0..100), guarding divide-by-zero. */
export function supplyPct(part: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  // Scale to keep precision before converting to Number.
  return Number((part * 1_000_000n) / total) / 10_000;
}

export function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Base58 mint addresses are 32–44 chars; reject obvious junk before chain calls. */
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export function isValidMint(mint: string): boolean {
  return BASE58_RE.test(mint.trim());
}

/** JSON.stringify replacer that renders BigInt as a decimal string. */
export function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

export const LAMPORTS_PER_SOL = 1_000_000_000;
