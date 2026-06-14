"use client";

/**
 * Minimal Phantom-based wallet flow (handoff §11). Kept dependency-light: the
 * injected provider plus a lazily-imported @solana/web3.js for building the
 * subscription transfer. Swappable for @solana/wallet-adapter later without
 * touching the API. web3.js is dynamically imported so it stays out of the
 * initial bundle.
 */

interface PhantomProvider {
  publicKey?: { toString(): string };
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signMessage(message: Uint8Array, display?: string): Promise<{ signature: Uint8Array }>;
  signAndSendTransaction(tx: unknown): Promise<{ signature: string }>;
}

function getProvider(): PhantomProvider {
  const w = window as unknown as { solana?: PhantomProvider & { isPhantom?: boolean } };
  if (!w.solana?.isPhantom) {
    throw new Error("Phantom wallet not found — install it to connect.");
  }
  return w.solana;
}

export async function connectWallet(): Promise<string> {
  const provider = getProvider();
  const { publicKey } = await provider.connect();
  return publicKey.toString();
}

/** Connect → request nonce → sign → verify → server sets the session cookie. */
export async function authenticate(): Promise<{ wallet: string; tier: string }> {
  const { default: bs58 } = await import("bs58");
  const provider = getProvider();
  const wallet = (await provider.connect()).publicKey.toString();

  const nonceRes = await fetch("/api/auth/nonce", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet }),
  });
  const { message } = (await nonceRes.json()) as { message: string };

  const { signature } = await provider.signMessage(new TextEncoder().encode(message), "utf8");
  const verifyRes = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet, signature: bs58.encode(signature) }),
  });
  if (!verifyRes.ok) throw new Error("Signature verification failed");
  return verifyRes.json();
}

/** Send `amountSol` to the treasury and redeem the resulting tx for a tier. */
export async function subscribe(amountSol: number): Promise<{ tier: string; expiresAt: string }> {
  const treasury = process.env.NEXT_PUBLIC_TREASURY_PUBKEY;
  if (!treasury) throw new Error("Treasury wallet is not configured");

  const provider = getProvider();
  const wallet = (await provider.connect()).publicKey.toString();

  const web3 = await import("@solana/web3.js");
  const rpc =
    process.env.NEXT_PUBLIC_RPC_URL || web3.clusterApiUrl("mainnet-beta");
  const connection = new web3.Connection(rpc, "confirmed");

  const tx = new web3.Transaction().add(
    web3.SystemProgram.transfer({
      fromPubkey: new web3.PublicKey(wallet),
      toPubkey: new web3.PublicKey(treasury),
      lamports: Math.round(amountSol * web3.LAMPORTS_PER_SOL),
    }),
  );
  tx.feePayer = new web3.PublicKey(wallet);
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const { signature } = await provider.signAndSendTransaction(tx);
  await connection.confirmTransaction(signature, "confirmed");

  const res = await fetch("/api/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ txSig: signature }),
  });
  if (!res.ok) {
    const { error } = (await res.json()) as { error?: string };
    throw new Error(error || "Subscription failed");
  }
  return res.json();
}
