import { createWalletClient, decodeEventLog, http, isAddressEqual, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getAccount, switchChain, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import { contentPassportAbi } from "@/lib/abi";
import { getPublicClient, MONAD_TESTNET_RPC_URL, MONAD_TESTNET_CHAIN_ID, monadTestnet } from "@/lib/chain";
import { requireDeployment } from "@/lib/deployment";
import { signRegistration } from "@/lib/eip712";
import { invalidateRegistryCache } from "@/lib/registry";
import { wagmiConfig } from "@/providers";

const EMPTY_ID = `0x${"00".repeat(32)}` as Hex;
const abi = contentPassportAbi as never;
const RECEIPT_TIMEOUT_MS = 120_000;
export const DEMO_KEY_LABEL = "Public Monad Testnet demo key. Testnet funds and assets have no value.";

export async function ensureMonadTestnet(): Promise<void> {
  const state = getAccount(wagmiConfig);
  if (!state.isConnected) throw new Error("Connect a wallet first.");
  if (state.chainId !== MONAD_TESTNET_CHAIN_ID) {
    try { await switchChain(wagmiConfig, { chainId: MONAD_TESTNET_CHAIN_ID }); }
    catch {
      const ethereum = (window as Window & { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!ethereum) throw new Error("Switch your wallet to Monad Testnet (chain 10143) to continue.");
      try {
        await ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x279f", chainName: "Monad Testnet", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: [MONAD_TESTNET_RPC_URL], blockExplorerUrls: ["https://testnet.monadexplorer.com"] }] });
        await switchChain(wagmiConfig, { chainId: MONAD_TESTNET_CHAIN_ID });
      } catch { throw new Error("Add or switch to Monad Testnet (chain 10143) in your wallet to continue."); }
    }
  }
}
async function submitAndWait(hash: Hex) {
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Transaction confirmation timed out. Check the transaction in your wallet or explorer.")), RECEIPT_TIMEOUT_MS));
  const receipt = await Promise.race([waitForTransactionReceipt(wagmiConfig, { hash, chainId: MONAD_TESTNET_CHAIN_ID, confirmations: 1 }), timeout]);
  if (receipt.status !== "success") throw new Error("Transaction reverted on Monad Testnet.");
  invalidateRegistryCache();
  return receipt;
}
async function walletAccount(): Promise<Address> {
  await ensureMonadTestnet();
  const account = getAccount(wagmiConfig).address;
  if (!account) throw new Error("Wallet account is unavailable.");
  return account;
}
export async function registerPassport(input: { contentHash: Hex; perceptualHash: bigint; tool: string; metadataURI: string; parentId?: Hex }) {
  const address = requireDeployment(); const account = await walletAccount();
  if (input.perceptualHash < 0n || input.perceptualHash > (1n << 64n) - 1n) throw new RangeError("Perceptual hash must fit uint64.");
  const signature = await signRegistration(account, address, { contentHash: input.contentHash, tool: input.tool, metadataURI: input.metadataURI });
  const hash = await writeContract(wagmiConfig, {
    address, abi, functionName: "register", account, chainId: MONAD_TESTNET_CHAIN_ID,
    args: [input.contentHash, input.perceptualHash, input.tool, input.metadataURI, input.parentId ?? EMPTY_ID, signature],
  } as never);
  const receipt = await submitAndWait(hash as Hex);
  for (const log of receipt.logs) {
    if (!isAddressEqual(log.address, address)) continue;
    try {
      const event = decodeEventLog({ abi: contentPassportAbi as never, data: log.data, topics: log.topics, strict: true }) as { eventName: string; args: { passportId?: Hex } };
      if (event.eventName === "PassportRegistered" && event.args.passportId) return { passportId: event.args.passportId, transactionHash: hash as Hex, receipt, signerAddress: account };
    } catch { /* Ignore unrelated contract logs. */ }
  }
  throw new Error("Registration succeeded, but its confirmation event was missing from the confirmed receipt.");
}
export async function appendPassportEvent(passportId: Hex, eventType: string, dataHash: Hex) {
  const address = requireDeployment(); const account = await walletAccount();
  const hash = await writeContract(wagmiConfig, { address, abi, functionName: "appendEvent", args: [passportId, eventType, dataHash], account, chainId: MONAD_TESTNET_CHAIN_ID } as never);
  return submitAndWait(hash as Hex);
}
export async function authorizeOperator(passportId: Hex, operator: Address, allowed: boolean) {
  const address = requireDeployment(); const account = await walletAccount();
  const hash = await writeContract(wagmiConfig, { address, abi, functionName: "authorize", args: [passportId, operator, allowed], account, chainId: MONAD_TESTNET_CHAIN_ID } as never);
  return submitAndWait(hash as Hex);
}
export async function revokePassport(passportId: Hex) {
  const address = requireDeployment(); const account = await walletAccount();
  const hash = await writeContract(wagmiConfig, { address, abi, functionName: "revoke", args: [passportId], account, chainId: MONAD_TESTNET_CHAIN_ID } as never);
  return submitAndWait(hash as Hex);
}

export function getPublicDemoClient() {
  const key = process.env.NEXT_PUBLIC_DEMO_KEY;
  if (!key) throw new Error("Public testnet demo key is not configured.");
  const client = createWalletClient({ account: privateKeyToAccount(key as Hex), chain: monadTestnet, transport: http(MONAD_TESTNET_RPC_URL) });
  return client;
}
export async function registerWithPublicDemoKey(input: { contentHash: Hex; perceptualHash: bigint; tool: string; metadataURI: string; parentId?: Hex }) {
  if (monadTestnet.id !== 10143 || await getPublicClient().getChainId() !== MONAD_TESTNET_CHAIN_ID) throw new Error("Demo key writes are restricted to an RPC connected to Monad Testnet (10143).");
  let client;
  try { client = getPublicDemoClient(); }
  catch { throw new Error("Public testnet demo key is unavailable or invalid. No transaction was sent."); }
  const address = requireDeployment();
  try {
    const sig = await client.signTypedData({ domain: { name: "ProvenanceX", version: "1", chainId: 10143, verifyingContract: address }, types: { Register: [{ name: "contentHash", type: "bytes32" }, { name: "tool", type: "string" }, { name: "metadataURI", type: "string" }] }, primaryType: "Register", message: { contentHash: input.contentHash, tool: input.tool, metadataURI: input.metadataURI } });
    const hash = await client.writeContract({ address, abi: contentPassportAbi as never, functionName: "register", args: [input.contentHash, input.perceptualHash, input.tool, input.metadataURI, input.parentId ?? EMPTY_ID, sig] } as never);
    const receipt = await getPublicClient().waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS });
    if (receipt.status !== "success") throw new Error("reverted");
    invalidateRegistryCache();
    for (const log of receipt.logs) if (isAddressEqual(log.address, address)) {
      try { const event = decodeEventLog({ abi: contentPassportAbi as never, data: log.data, topics: log.topics, strict: true }) as { eventName: string; args: { passportId?: Hex } }; if (event.eventName === "PassportRegistered" && event.args.passportId) return { passportId: event.args.passportId, transactionHash: hash, receipt, signerAddress: client.account.address }; } catch { /* unrelated */ }
    }
    throw new Error("Registration event missing.");
  } catch {
    throw new Error("The public testnet demo transaction could not be completed. Check the wallet funds and testnet status.");
  }
}

/** Testnet-only append for the demo walkthrough; uses the same guarded signer as registration. */
export async function appendWithPublicDemoKey(passportId: Hex, eventType: string, dataHash: Hex, expectedSigner?: Address) {
  if (monadTestnet.id !== 10143 || await getPublicClient().getChainId() !== MONAD_TESTNET_CHAIN_ID) throw new Error("Demo key writes are restricted to an RPC connected to Monad Testnet (10143).");
  let client;
  try { client = getPublicDemoClient(); }
  catch { throw new Error("Public testnet demo key is unavailable or invalid. No transaction was sent."); }
  if (expectedSigner && client.account.address.toLowerCase() !== expectedSigner.toLowerCase()) throw new Error("The configured demo signer changed after registration. Reset the walkthrough and register again with the current signer.");
  const address = requireDeployment();
  try {
    const hash = await client.writeContract({ address, abi: contentPassportAbi as never, functionName: "appendEvent", args: [passportId, eventType, dataHash] } as never);
    const receipt = await getPublicClient().waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS });
    if (receipt.status !== "success") throw new Error("reverted");
    invalidateRegistryCache();
    return { transactionHash: hash, receipt };
  } catch {
    throw new Error("The public testnet demo append could not be completed. Check the demo key funds and testnet status.");
  }
}
