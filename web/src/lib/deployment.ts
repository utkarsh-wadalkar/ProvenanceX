import deployment from "@/lib/deployment.json";
import { getAddress, type Address } from "viem";
export class DeploymentNotConfigured extends Error {
  constructor() { super("ProvenanceX is not deployed on Monad Testnet yet."); this.name = "DeploymentNotConfigured"; }
}
export function requireDeployment(): Address {
  if (deployment.chainId !== 10143 || !deployment.address) throw new DeploymentNotConfigured();
  try { return getAddress(deployment.address); } catch { throw new DeploymentNotConfigured(); }
}
export const deploymentInfo = deployment;
