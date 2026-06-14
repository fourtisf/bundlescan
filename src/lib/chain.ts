import {
  Connection,
  PublicKey,
  type ConfirmedSignatureInfo,
  type ParsedTransactionWithMeta,
} from "@solana/web3.js";
import { WINDOW_BLOCKS, FREE_RPC_URL } from "./config";
import type { DeployInfo, Platform, ReplayBuy, ReplayResult } from "./types";

/**
 * Helius RPC wrapper + block-zero replay (handoff §6.1).
 *
 * We deliberately lean on standard Solana JSON-RPC (served by Helius) rather
 * than the Enhanced Transactions API: parsing buys from pre/post token-balance
 * deltas is program-agnostic, so it works across Pump.fun, Raydium and PumpSwap
 * without per-platform decoders. Helius is still required for the paid
 * block-level history depth (handoff §3/§4).
 */

const KNOWN_PROGRAMS: Record<string, Platform> = {
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": "pumpfun", // pump.fun bonding curve
  pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA: "pumpswap", // pump.fun AMM (pumpswap)
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "raydium", // Raydium AMM v4
  CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK: "raydium", // Raydium CLMM
};

/** Accounts that "receive" mint supply but are not buyers (pools/curves). */
const SYSTEM_OWNERS = new Set<string>([
  "11111111111111111111111111111111", // system program
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // SPL token program
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", // token-2022
]);

const MAX_SIG_PAGES = Number(process.env.MAX_SIG_PAGES || 8);
const SIG_PAGE_SIZE = 1000;
const PARSE_CONCURRENCY = Number(process.env.PARSE_CONCURRENCY || 8);

let _pool: Connection[] = [];
let _rr = 0;

/** Build the RPC connection pool from RPC_URLS (comma-separated) → RPC_URL →
 *  Helius (only if a key is set) → free PublicNode default. No key needed. */
function buildPool(): Connection[] {
  const key = process.env.HELIUS_API_KEY;
  const raw =
    process.env.RPC_URLS ||
    process.env.HELIUS_RPC_URL ||
    (key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : "") ||
    process.env.RPC_URL ||
    FREE_RPC_URL;
  const urls = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return urls.map((u) => new Connection(u, { commitment: "confirmed" }));
}

/**
 * Lazily-built RPC connection, round-robined across the pool. Set RPC_URLS to a
 * comma-separated list of free RPCs (PublicNode, Ankr, …) to spread load and
 * survive free-tier rate limits — entirely Helius-free.
 */
export function getConnection(): Connection {
  if (_pool.length === 0) _pool = buildPool();
  const conn = _pool[_rr % _pool.length];
  _rr++;
  return conn;
}

/** Run async tasks with a bounded concurrency pool, preserving input order. */
async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Page backwards through an address's signatures and return them oldest-first.
 * Capped at MAX_SIG_PAGES to bound cost on very active addresses.
 */
async function getAllSignaturesOldestFirst(
  address: PublicKey,
  maxPages = MAX_SIG_PAGES,
): Promise<ConfirmedSignatureInfo[]> {
  const conn = getConnection();
  const all: ConfirmedSignatureInfo[] = [];
  let before: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const batch = await conn.getSignaturesForAddress(address, {
      before,
      limit: SIG_PAGE_SIZE,
    });
    if (batch.length === 0) break;
    all.push(...batch);
    before = batch[batch.length - 1].signature;
    if (batch.length < SIG_PAGE_SIZE) break;
  }
  // RPC returns newest-first within each page; reverse the accumulated list.
  return all.reverse();
}

function detectPlatform(tx: ParsedTransactionWithMeta): Platform {
  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
  for (const k of keys) {
    const p = KNOWN_PROGRAMS[k];
    if (p) return p;
  }
  return "other";
}

/**
 * §6.1 step 1 — resolve the deploy transaction (the mint's earliest signature)
 * and extract deploySlot, deployer (fee payer), deployTs and platform.
 */
export async function getDeployInfo(mint: string): Promise<DeployInfo> {
  const conn = getConnection();
  const mintPk = new PublicKey(mint);
  const sigs = await getAllSignaturesOldestFirst(mintPk);
  if (sigs.length === 0) {
    throw new Error(`No transaction history for mint ${mint}`);
  }
  const first = sigs[0];
  const tx = await conn.getParsedTransaction(first.signature, {
    maxSupportedTransactionVersion: 0,
  });
  if (!tx) throw new Error(`Could not fetch deploy tx ${first.signature}`);

  const feePayer = tx.transaction.message.accountKeys.find((k) => k.signer);
  const deployer = feePayer?.pubkey.toBase58() ?? first.signature;
  const blockTime = tx.blockTime ?? first.blockTime ?? Math.floor(Date.now() / 1000);

  return {
    mint,
    deployer,
    deploySlot: tx.slot,
    deployTs: new Date(blockTime * 1000).toISOString(),
    platform: detectPlatform(tx),
  };
}

/** Total mint supply in raw base units (for % math, §6.1 step 3). */
export async function getMintSupply(mint: string): Promise<bigint> {
  const conn = getConnection();
  const res = await conn.getTokenSupply(new PublicKey(mint));
  return BigInt(res.value.amount);
}

export interface TokenMeta {
  name: string | null;
  ticker: string | null;
}

/**
 * Best-effort token name/ticker via Helius DAS `getAsset`. Never throws — a
 * launch is still scannable without metadata (we fall back to the short mint).
 */
export async function getTokenMeta(mint: string): Promise<TokenMeta> {
  const key = process.env.HELIUS_API_KEY;
  const url =
    process.env.HELIUS_RPC_URL ||
    (key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : "");
  if (!url) return { name: null, ticker: null };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "meta",
        method: "getAsset",
        params: { id: mint },
      }),
    });
    const json = (await res.json()) as {
      result?: { content?: { metadata?: { name?: string; symbol?: string } } };
    };
    const md = json.result?.content?.metadata;
    return { name: md?.name ?? null, ticker: md?.symbol ?? null };
  } catch {
    return { name: null, ticker: null };
  }
}

/**
 * Extract per-wallet token acquisitions from one parsed tx by diffing pre/post
 * token balances for the mint. Positive delta on an owner = an acquisition.
 */
function buysFromTx(tx: ParsedTransactionWithMeta, mint: string): ReplayBuy[] {
  const meta = tx.meta;
  if (!meta) return [];
  const pre = meta.preTokenBalances ?? [];
  const post = meta.postTokenBalances ?? [];

  const preByAcct = new Map<number, bigint>();
  for (const b of pre) {
    if (b.mint !== mint) continue;
    preByAcct.set(b.accountIndex, BigInt(b.uiTokenAmount.amount));
  }

  const buys: ReplayBuy[] = [];
  for (const b of post) {
    if (b.mint !== mint) continue;
    const owner = b.owner;
    if (!owner || SYSTEM_OWNERS.has(owner)) continue;
    const before = preByAcct.get(b.accountIndex) ?? 0n;
    const after = BigInt(b.uiTokenAmount.amount);
    const delta = after - before;
    if (delta > 0n) {
      buys.push({
        wallet: owner,
        tokensReceived: delta,
        slot: tx.slot,
        signature: tx.transaction.signatures[0],
      });
    }
  }
  return buys;
}

/**
 * §6.1 step 2 — pull every transaction touching the mint from deploySlot up to
 * deploySlot + windowBlocks and parse out the buys.
 */
export async function getBlockZeroTxs(
  mint: string,
  deploySlot: number,
  windowBlocks = WINDOW_BLOCKS,
): Promise<ReplayBuy[]> {
  const conn = getConnection();
  const mintPk = new PublicKey(mint);
  const maxSlot = deploySlot + windowBlocks;

  const sigs = (await getAllSignaturesOldestFirst(mintPk)).filter(
    (s) => s.slot >= deploySlot && s.slot <= maxSlot,
  );

  const txs = await pool(sigs, PARSE_CONCURRENCY, (s) =>
    conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 }),
  );

  const buys: ReplayBuy[] = [];
  for (const tx of txs) {
    if (tx) buys.push(...buysFromTx(tx, mint));
  }
  // Oldest-first by slot so first-buyer logic downstream is stable.
  buys.sort((a, b) => a.slot - b.slot);
  return buys;
}

/**
 * §6.4 — trace a wallet's funding to its first inbound SOL transfer and return
 * the source address. Returns null if no inbound SOL is found in the cap.
 */
export async function getFundingSource(wallet: string): Promise<string | null> {
  const conn = getConnection();
  const walletPk = new PublicKey(wallet);
  const sigs = await getAllSignaturesOldestFirst(walletPk, 4);

  for (const s of sigs) {
    const tx = await conn.getParsedTransaction(s.signature, {
      maxSupportedTransactionVersion: 0,
    });
    if (!tx?.meta) continue;
    const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
    const idx = keys.indexOf(wallet);
    if (idx === -1) continue;
    const delta =
      BigInt(tx.meta.postBalances[idx] ?? 0) - BigInt(tx.meta.preBalances[idx] ?? 0);
    if (delta > 0n) {
      // First account whose lamports decreased is the funder.
      for (let i = 0; i < keys.length; i++) {
        if (i === idx) continue;
        const d = BigInt(tx.meta.postBalances[i] ?? 0) - BigInt(tx.meta.preBalances[i] ?? 0);
        if (d < 0n) return keys[i];
      }
    }
  }
  return null;
}

/** §6.6 — current token balance (raw base units) held by a wallet for the mint. */
export async function getTokenBalance(wallet: string, mint: string): Promise<bigint> {
  const conn = getConnection();
  const res = await conn.getParsedTokenAccountsByOwner(new PublicKey(wallet), {
    mint: new PublicKey(mint),
  });
  let total = 0n;
  for (const { account } of res.value) {
    const amt = account.data.parsed?.info?.tokenAmount?.amount;
    if (amt) total += BigInt(amt);
  }
  return total;
}

/**
 * §6.1 — full block-zero replay. Fetches the mint's signatures once and derives
 * both the deploy info and the first-window buys from a single pass (cheaper RPC,
 * which matters for the throttled realtime indexer).
 */
export async function replayLaunch(mint: string): Promise<ReplayResult> {
  const conn = getConnection();
  const mintPk = new PublicKey(mint);
  const sigs = await getAllSignaturesOldestFirst(mintPk);
  if (sigs.length === 0) throw new Error(`No transaction history for mint ${mint}`);

  const firstTx = await conn.getParsedTransaction(sigs[0].signature, {
    maxSupportedTransactionVersion: 0,
  });
  if (!firstTx) throw new Error(`Could not fetch deploy tx ${sigs[0].signature}`);

  const feePayer = firstTx.transaction.message.accountKeys.find((k) => k.signer);
  const blockTime = firstTx.blockTime ?? sigs[0].blockTime ?? Math.floor(Date.now() / 1000);
  const deploy: DeployInfo = {
    mint,
    deployer: feePayer?.pubkey.toBase58() ?? sigs[0].signature,
    deploySlot: firstTx.slot,
    deployTs: new Date(blockTime * 1000).toISOString(),
    platform: detectPlatform(firstTx),
  };

  const maxSlot = deploy.deploySlot + WINDOW_BLOCKS;
  const windowSigs = sigs.filter((s) => s.slot >= deploy.deploySlot && s.slot <= maxSlot);
  const txs = await pool(windowSigs, PARSE_CONCURRENCY, (s) =>
    s.signature === sigs[0].signature
      ? Promise.resolve(firstTx) // reuse the deploy tx instead of re-fetching
      : conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 }),
  );

  const buys: ReplayBuy[] = [];
  for (const tx of txs) if (tx) buys.push(...buysFromTx(tx, mint));
  buys.sort((a, b) => a.slot - b.slot);

  const totalSupply = await getMintSupply(mint);
  return { deploy, totalSupply, buys };
}
