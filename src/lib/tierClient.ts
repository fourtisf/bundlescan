/** Tier helpers safe for client components (score.ts pulls Prisma — server only). */
export const tierColor = (s: number) =>
  s < 25 ? "var(--signal)" : s < 55 ? "var(--signal-2)" : s < 80 ? "var(--mild)" : "var(--clean)";

export const tierName = (s: number) =>
  s < 25 ? "TRAP" : s < 55 ? "RIGGED" : s < 80 ? "MILD" : "CLEAN";

export const scoreBar = (s: number, n = 5) => {
  const filled = Math.max(1, Math.min(n, Math.round(s / (100 / n))));
  return "▰".repeat(filled) + "▱".repeat(n - filled);
};
