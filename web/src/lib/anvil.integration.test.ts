import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  parseEventLogs,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { contentPassportAbi } from "@/lib/abi";
import { verifyPagedTrail } from "@/lib/trail";

const enabled = process.env.ANVIL_INTEGRATION === "1";
const rpcUrl = process.env.ANVIL_RPC_URL ?? "http://127.0.0.1:8545";
const localMonad = defineChain({ id: 10143, name: "Monad Testnet (local Anvil)", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const fixtureOutput = process.env.LOCAL_FIXTURE_OUTPUT;
const deployedTransactions: Hex[] = [];

async function rpc(method: string, params: unknown[]) {
  const response = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const data = await response.json() as { result?: unknown; error?: { message?: string } };
  if (!response.ok || data.error) throw new Error(data.error?.message ?? `Anvil RPC failed: ${method}`);
  return data.result;
}

async function fundedAccount() {
  const account = privateKeyToAccount(generatePrivateKey());
  await rpc("anvil_setBalance", [account.address, "0x3635c9adc5dea00000"]);
  return account;
}

describe("local Anvil cross-stack integration", () => {
  (enabled ? it : it.skip)("deploys and exercises the Solidity contract with the web ABI and trail verifier", async () => {
    const creator = await fundedAccount();
    const operator = await fundedAccount();
    const publicClient = createPublicClient({ chain: localMonad, transport: http(rpcUrl) });
    const wallet = createWalletClient({ account: creator, chain: localMonad, transport: http(rpcUrl) });
    const operatorWallet = createWalletClient({ account: operator, chain: localMonad, transport: http(rpcUrl) });

    const artifactPath = resolve(root, "contracts/out/ContentPassport.sol/ContentPassport.json");
    const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as { abi: typeof contentPassportAbi; bytecode: { object: Hex } | Hex };
    const bytecode = typeof artifact.bytecode === "string" ? artifact.bytecode : artifact.bytecode.object;
    const deployHash = await wallet.deployContract({ abi: contentPassportAbi, bytecode, account: creator });
    deployedTransactions.push(deployHash);
    const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    expect(deployReceipt.status).toBe("success");
    const address = deployReceipt.contractAddress as Address;
    expect(address).toBeTruthy();

    const contentHash = keccak256(toBytes(`ProvenanceX local integration ${Date.now()}`));
    const tool = "integration fixture";
    const metadataURI = "local://integration";
    const signature = await creator.signTypedData({
      domain: { name: "ProvenanceX", version: "1", chainId: 10143, verifyingContract: address },
      types: { Register: [{ name: "contentHash", type: "bytes32" }, { name: "tool", type: "string" }, { name: "metadataURI", type: "string" }] },
      primaryType: "Register",
      message: { contentHash, tool, metadataURI },
    });
    const registerHash = await wallet.writeContract({ address, abi: contentPassportAbi, functionName: "register", args: [contentHash, 123n, tool, metadataURI, `0x${"00".repeat(32)}`, signature] });
    deployedTransactions.push(registerHash);
    const registerReceipt = await publicClient.waitForTransactionReceipt({ hash: registerHash });
    expect(registerReceipt.status).toBe("success");
    const registration = parseEventLogs({ abi: contentPassportAbi, logs: registerReceipt.logs, eventName: "PassportRegistered" })[0];
    const passportId = registration.args.passportId;
    expect(passportId).toMatch(/^0x[0-9a-f]{64}$/i);

    const [exists, foundId] = await publicClient.readContract({ address, abi: contentPassportAbi, functionName: "verifyByHash", args: [contentHash] });
    expect(exists).toBe(true);
    expect(foundId).toBe(passportId);
    await expect(wallet.writeContract({ address, abi: contentPassportAbi, functionName: "register", args: [contentHash, 123n, tool, metadataURI, `0x${"00".repeat(32)}`, signature] })).rejects.toThrow();

    const firstLength = await publicClient.readContract({ address, abi: contentPassportAbi, functionName: "trailLength", args: [passportId] });
    const firstPage = await publicClient.readContract({ address, abi: contentPassportAbi, functionName: "getTrailPage", args: [passportId, 0n, 200n] });
    const firstPassport = await publicClient.readContract({ address, abi: contentPassportAbi, functionName: "getPassport", args: [passportId] });
    const firstProof = await verifyPagedTrail(Number(firstLength), firstPassport.trailHead, async (offset, limit) => publicClient.readContract({ address, abi: contentPassportAbi, functionName: "getTrailPage", args: [passportId, BigInt(offset), BigInt(limit)] }), contentHash);
    expect(firstPage).toHaveLength(1);
    expect(firstProof.valid).toBe(true);

    const creatorAppend = await wallet.writeContract({ address, abi: contentPassportAbi, functionName: "appendEvent", args: [passportId, "EDITED", keccak256(toBytes("creator edit"))] });
    deployedTransactions.push(creatorAppend);
    await publicClient.waitForTransactionReceipt({ hash: creatorAppend });
    const authorizeHash = await wallet.writeContract({ address, abi: contentPassportAbi, functionName: "authorize", args: [passportId, operator.address, true] });
    deployedTransactions.push(authorizeHash);
    await publicClient.waitForTransactionReceipt({ hash: authorizeHash });
    expect(await publicClient.readContract({ address, abi: contentPassportAbi, functionName: "operators", args: [passportId, operator.address] })).toBe(true);
    const operatorAppend = await operatorWallet.writeContract({ address, abi: contentPassportAbi, functionName: "appendEvent", args: [passportId, "DERIVATIVE", keccak256(toBytes("operator edit"))] });
    deployedTransactions.push(operatorAppend);
    await publicClient.waitForTransactionReceipt({ hash: operatorAppend });

    const finalLength = await publicClient.readContract({ address, abi: contentPassportAbi, functionName: "trailLength", args: [passportId] });
    const finalPassport = await publicClient.readContract({ address, abi: contentPassportAbi, functionName: "getPassport", args: [passportId] });
    const proof = await verifyPagedTrail(Number(finalLength), finalPassport.trailHead, async (offset, limit) => publicClient.readContract({ address, abi: contentPassportAbi, functionName: "getTrailPage", args: [passportId, BigInt(offset), BigInt(limit)] }), contentHash);
    expect(finalLength).toBe(3n);
    expect(proof.valid).toBe(true);

    const revokeHash = await wallet.writeContract({ address, abi: contentPassportAbi, functionName: "revoke", args: [passportId] });
    deployedTransactions.push(revokeHash);
    await publicClient.waitForTransactionReceipt({ hash: revokeHash });
    const revokedPassport = await publicClient.readContract({ address, abi: contentPassportAbi, functionName: "getPassport", args: [passportId] });
    expect(revokedPassport.revoked).toBe(true);
    await expect(operatorWallet.writeContract({ address, abi: contentPassportAbi, functionName: "appendEvent", args: [passportId, "AFTER_REVOKE", keccak256(toBytes("should fail"))] })).rejects.toThrow();

    if (fixtureOutput) {
      await writeFile(fixtureOutput, `${JSON.stringify({ address, chainId: 10143, deploymentBlock: Number(deployReceipt.blockNumber), transactionHash: deployHash, passportId, registrationHash: registerHash, transactions: deployedTransactions }, null, 2)}\n`);
    }
  }, 120_000);
});
