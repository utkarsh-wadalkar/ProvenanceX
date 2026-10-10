import { getAddress, type Hex } from "viem";
import type { Address } from "viem";
import { monadTestnet } from "@/lib/chain";

export const REGISTER_TYPES = {
  Register: [
    { name: "contentHash", type: "bytes32" },
    { name: "tool", type: "string" },
    { name: "metadataURI", type: "string" },
  ],
} as const;
export type RegisterMessage = { contentHash: Hex; tool: string; metadataURI: string };
export function provenanceDomain(verifyingContract: Address) {
  return { name: "ProvenanceX", version: "1", chainId: monadTestnet.id, verifyingContract: getAddress(verifyingContract) } as const;
}
export async function signRegistration(account: Address, verifyingContract: Address, message: RegisterMessage): Promise<Hex> {
  if (typeof window === "undefined" || !(window as Window & { ethereum?: unknown }).ethereum) throw new Error("Connect an injected wallet to sign registration.");
  const { signTypedData } = await import("@wagmi/core");
  const { wagmiConfig } = await import("@/providers");
  return signTypedData(wagmiConfig, { account, domain: provenanceDomain(verifyingContract), types: REGISTER_TYPES, primaryType: "Register", message });
}
