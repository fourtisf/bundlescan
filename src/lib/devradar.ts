/**
 * DevRadar cross-link (handoff §1/§4/§12). Looks up a deployer's reputation
 * from the sibling Fourtis product when DEVRADAR_API_URL is configured. No-op
 * (returns null) until both services are live — safe to call unconditionally.
 */
export interface DeployerReputation {
  deployer: string;
  priorLaunches: number;
  ruggedCount: number;
  score: number; // DevRadar's own 0..100 reputation
}

export async function getDeployerReputation(
  deployer: string,
): Promise<DeployerReputation | null> {
  const baseUrl = process.env.DEVRADAR_API_URL;
  if (!baseUrl) return null;
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/deployer/${deployer}`, {
      headers: { accept: "application/json" },
      // Keep the scan snappy — never let a cross-link stall the forensic path.
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    return (await res.json()) as DeployerReputation;
  } catch {
    return null;
  }
}
