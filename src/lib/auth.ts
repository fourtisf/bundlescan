import { createHmac, createPublicKey, verify, timingSafeEqual } from "crypto";
import bs58 from "bs58";
import type { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { effectiveTier } from "./subscribe";

/**
 * Wallet auth (handoff §11 "user connects wallet"). Flow:
 *   1. client requests a nonce, signs it with the wallet,
 *   2. POST /api/auth/verify checks the ed25519 signature,
 *   3. we issue an HMAC-signed session cookie naming the wallet.
 * Stateless, no JWT dependency — the HMAC over SESSION_SECRET is the trust root.
 */

const COOKIE = "bs_session";
const SECRET = process.env.SESSION_SECRET || "dev-insecure-secret-change-me";

// SPKI DER prefix for a raw 32-byte ed25519 public key.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** Verify an ed25519 signature (base58) over `message` by `wallet` (base58 pubkey). */
export function verifyWalletSignature(
  wallet: string,
  message: string,
  signatureB58: string,
): boolean {
  try {
    const pub = Buffer.from(bs58.decode(wallet));
    if (pub.length !== 32) return false;
    const der = Buffer.concat([ED25519_SPKI_PREFIX, pub]);
    const key = createPublicKey({ key: der, format: "der", type: "spki" });
    const sig = Buffer.from(bs58.decode(signatureB58));
    return verify(null, Buffer.from(message, "utf8"), key, sig);
  } catch {
    return false;
  }
}

function hmac(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("base64url");
}

export const SESSION_COOKIE = COOKIE;

/** Build the signed session token for a verified wallet. */
export function signSession(wallet: string): string {
  return `${wallet}.${hmac(wallet)}`;
}

export function verifySession(token: string | undefined | null): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx === -1) return null;
  const wallet = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = hmac(wallet);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return wallet;
}

export function getRequestWallet(req: NextRequest): string | null {
  return verifySession(req.cookies.get(COOKIE)?.value);
}

export interface AuthUser {
  id: string;
  wallet: string;
  tier: string; // effective tier (expiry-aware)
  subExpiresAt: string | null;
}

/** Resolve the authenticated user (or null) from the session cookie. */
export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const wallet = getRequestWallet(req);
  if (!wallet) return null;
  const user = await prisma.user.findUnique({ where: { wallet } });
  if (!user) {
    return { id: "", wallet, tier: "scout", subExpiresAt: null };
  }
  return {
    id: user.id,
    wallet: user.wallet,
    tier: effectiveTier(user),
    subExpiresAt: user.subExpiresAt?.toISOString() ?? null,
  };
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};
