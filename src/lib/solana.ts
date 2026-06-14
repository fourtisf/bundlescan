import { PublicKey } from "@solana/web3.js";
import { getConnection } from "./chain";
import {
  PRICE_OPERATOR_SOL,
  PRICE_SYNDICATE_SOL,
  PAYMENT_MAX_AGE_SECONDS,
} from "./config";
import { LAMPORTS_PER_SOL } from "./util";

/** On-chain SOL payment verification for subscriptions (handoff §11). */

export type PaidTier = "operator" | "syndicate";

const EPS = 1e-4; // tolerance so a payment of exactly the price isn't rejected

/** Map a paid SOL amount to the tier it unlocks (highest tier that fits). */
export function tierForAmount(sol: number): PaidTier | null {
  if (sol + EPS >= PRICE_SYNDICATE_SOL) return "syndicate";
  if (sol + EPS >= PRICE_OPERATOR_SOL) return "operator";
  return null;
}

export interface VerifiedPayment {
  txSig: string;
  wallet: string; // payer
  amountSol: number;
  tier: PaidTier;
  blockTime: number;
}

/**
 * Verify a SOL transfer to the treasury: correct destination, sufficient amount,
 * recent, succeeded. Replay protection (txSig already used) is enforced by the
 * Subscription.txSig unique constraint in lib/subscribe.ts.
 */
export async function verifySolPayment(txSig: string): Promise<VerifiedPayment> {
  const treasury = process.env.TREASURY_PUBKEY;
  if (!treasury) throw new Error("TREASURY_PUBKEY is not configured");
  // Validate it's a real pubkey early.
  new PublicKey(treasury);

  const conn = getConnection();
  const tx = await conn.getParsedTransaction(txSig, {
    maxSupportedTransactionVersion: 0,
  });
  if (!tx) throw new Error("Transaction not found or not yet confirmed");
  if (tx.meta?.err) throw new Error("Transaction failed on-chain");

  const blockTime = tx.blockTime ?? 0;
  const age = Math.floor(Date.now() / 1000) - blockTime;
  if (!blockTime || age > PAYMENT_MAX_AGE_SECONDS) {
    throw new Error("Payment transaction is too old");
  }

  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
  const treasuryIdx = keys.indexOf(treasury);
  if (treasuryIdx === -1) throw new Error("Payment was not sent to the treasury");

  const pre = tx.meta?.preBalances ?? [];
  const post = tx.meta?.postBalances ?? [];
  const receivedLamports =
    BigInt(post[treasuryIdx] ?? 0) - BigInt(pre[treasuryIdx] ?? 0);
  if (receivedLamports <= 0n) throw new Error("No SOL received by the treasury");

  const amountSol = Number(receivedLamports) / LAMPORTS_PER_SOL;
  const tier = tierForAmount(amountSol);
  if (!tier) throw new Error(`Amount ${amountSol} SOL is below the lowest tier price`);

  // Payer = fee-paying signer.
  const signer = tx.transaction.message.accountKeys.find((k) => k.signer);
  const wallet = signer?.pubkey.toBase58() ?? keys[0];

  return { txSig, wallet, amountSol, tier, blockTime };
}
