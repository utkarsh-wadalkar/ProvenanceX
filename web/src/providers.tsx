"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "@wagmi/core";
import { monadTestnet, MONAD_TESTNET_RPC_URL } from "@/lib/chain";

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: { [monadTestnet.id]: http(MONAD_TESTNET_RPC_URL) },
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <WagmiProvider config={wagmiConfig}><QueryClientProvider client={queryClient}>{children}</QueryClientProvider></WagmiProvider>;
}
