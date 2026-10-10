import { createPublicClient, defineChain, http, type PublicClient } from "viem";

export const MONAD_TESTNET_CHAIN_ID = 10143;
export const MONAD_TESTNET_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || process.env.RPC_URL || "https://testnet-rpc.monad.xyz";
export const monadTestnet = defineChain({
  id: MONAD_TESTNET_CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [MONAD_TESTNET_RPC_URL] } },
  blockExplorers: { default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" } },
  testnet: true,
});

let publicClient: PublicClient | undefined;
export function getPublicClient(): PublicClient {
  publicClient ??= createPublicClient({ chain: monadTestnet, transport: http(MONAD_TESTNET_RPC_URL, { retryCount: 2, timeout: 12_000 }) });
  return publicClient;
}

export const TESTNET_FAUCET_URL = "https://faucet.monad.xyz";
