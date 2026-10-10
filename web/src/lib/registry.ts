import { type Abi, type Address, type Hex, type PublicClient } from "viem";
import { contentPassportAbi } from "@/lib/abi";
import { getPublicClient } from "@/lib/chain";
import { requireDeployment } from "@/lib/deployment";
import { hamming } from "@/lib/phash";
import type { TrailEntry } from "@/lib/trail";

const abi = contentPassportAbi as Abi;
const PAGE_MAX = 200;
const TTL_MS = 20_000;
const cache = new Map<string, { expires: number; value: unknown }>();
function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value as T);
  return fetcher().then((value) => { cache.set(key, { value, expires: Date.now() + TTL_MS }); return value; });
}
export function invalidateRegistryCache(): void { cache.clear(); }
function setup(client = getPublicClient()) { return { client, address: requireDeployment() }; }
export async function getTotalPassports(client?: PublicClient): Promise<bigint> {
  const { client: rpc, address } = setup(client);
  return cached("total", () => rpc.readContract({ address, abi, functionName: "totalPassports" }) as Promise<bigint>);
}
export async function getPage(offset: bigint | number, limit: number, client?: PublicClient): Promise<{ ids: Hex[]; perceptualHashes: bigint[]; contentHashes: Hex[] }> {
  if (limit < 1 || !Number.isInteger(limit)) throw new RangeError("Page limit must be a positive integer.");
  const bounded = Math.min(limit, PAGE_MAX); const off = BigInt(offset);
  const { client: rpc, address } = setup(client);
  return cached(`page:${off}:${bounded}`, async () => {
    const result = await rpc.readContract({ address, abi, functionName: "getPage", args: [off, BigInt(bounded)] }) as readonly [Hex[], readonly bigint[], Hex[]];
    return { ids: [...result[0]], perceptualHashes: result[1].map(BigInt), contentHashes: [...result[2]] };
  });
}
export async function getPassport(passportId: Hex, client?: PublicClient): Promise<Record<string, unknown>> {
  const { client: rpc, address } = setup(client);
  return cached(`passport:${passportId.toLowerCase()}`, () => rpc.readContract({ address, abi, functionName: "getPassport", args: [passportId] }) as Promise<Record<string, unknown>>);
}
export async function getPassports(passportIds: readonly Hex[], client?: PublicClient): Promise<Record<string, unknown>[]> {
  if (passportIds.length > PAGE_MAX) throw new RangeError(`At most ${PAGE_MAX} media records can be fetched in one batch.`);
  if (passportIds.length === 0) return [];
  const { client: rpc, address } = setup(client);
  const readOne = (passportId: Hex) => rpc.readContract({ address, abi, functionName: "getPassport", args: [passportId] }) as Promise<Record<string, unknown>>;
  try {
    const results = await rpc.multicall({
      contracts: passportIds.map((passportId) => ({ address, abi, functionName: "getPassport", args: [passportId] } as never)),
      allowFailure: true,
    });
    return await Promise.all(results.map((result, index) => result.status === "success" ? result.result as Record<string, unknown> : readOne(passportIds[index])));
  } catch {
    return Promise.all(passportIds.map(readOne));
  }
}
export async function getChildren(passportId: Hex, client?: PublicClient): Promise<Hex[]> {
  const { client: rpc, address } = setup(client);
  return cached(`children:${passportId.toLowerCase()}`, () => rpc.readContract({ address, abi, functionName: "getChildren", args: [passportId] }) as Promise<Hex[]>);
}
export async function isAuthorizedOperator(passportId: Hex, operator: Address, client?: PublicClient): Promise<boolean> {
  const { client: rpc, address } = setup(client);
  return rpc.readContract({ address, abi, functionName: "operators", args: [passportId, operator] }) as Promise<boolean>;
}
export async function getPassportIdByContentHash(contentHash: Hex, client?: PublicClient): Promise<Hex> {
  const { client: rpc, address } = setup(client);
  return cached(`hash:${contentHash.toLowerCase()}`, () => rpc.readContract({ address, abi, functionName: "passportIdByContentHash", args: [contentHash] }) as Promise<Hex>);
}
export async function getTrailLength(passportId: Hex, client?: PublicClient): Promise<bigint> {
  const { client: rpc, address } = setup(client);
  return rpc.readContract({ address, abi, functionName: "trailLength", args: [passportId] }) as Promise<bigint>;
}
export async function getTrailPage(passportId: Hex, offset: bigint | number, limit: number, client?: PublicClient): Promise<readonly Record<string, unknown>[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("Trail page limit must be positive.");
  const { client: rpc, address } = setup(client);
  return rpc.readContract({ address, abi, functionName: "getTrailPage", args: [passportId, BigInt(offset), BigInt(Math.min(limit, PAGE_MAX))] }) as Promise<readonly Record<string, unknown>[]>;
}

export type TrailTransactionLink = { blockNumber: bigint; transactionHash: Hex };
export function matchTrailTransactionHash(passportId: Hex, entry: TrailEntry, logs: readonly { args: Record<string, unknown>; transactionHash?: Hex }[]): Hex | null {
  const match = logs.find((log) => entry.eventType === "REGISTERED"
    ? String(log.args.passportId).toLowerCase() === passportId.toLowerCase()
    : String(log.args.passportId).toLowerCase() === passportId.toLowerCase() && String(log.args.trailHead).toLowerCase() === entry.trailHead.toLowerCase());
  return match?.transactionHash ?? null;
}
export async function getTrailTransactionHashes(passportId: Hex, entries: readonly TrailEntry[], client?: PublicClient): Promise<TrailTransactionLink[]> {
  if (entries.length > PAGE_MAX) throw new RangeError(`Resolve at most ${PAGE_MAX} trail entries at once.`);
  const { client: rpc, address } = setup(client);
  return Promise.all(entries.map(async (entry) => {
    const blockNumber = BigInt(entry.blockNumber);
    const eventName = entry.eventType === "REGISTERED" ? "PassportRegistered" : "TrailEvent";
    const logs = await rpc.getContractEvents({
      address,
      abi,
      eventName,
      args: { passportId },
      fromBlock: blockNumber,
      toBlock: blockNumber,
    } as never) as unknown as Array<{ args: Record<string, unknown>; transactionHash: Hex }>;
    const transactionHash = matchTrailTransactionHash(passportId, entry, logs);
    if (!transactionHash) throw new Error(`No matching ${eventName} log found for trail entry in block ${blockNumber}.`);
    return { blockNumber, transactionHash };
  }));
}

export class IncompleteRegistryIndexError extends Error {
  constructor(message = "Could not complete registry scan within the configured page bound.") { super(message); this.name = "IncompleteRegistryIndexError"; }
}
export type PerceptualMatch = { passportId: Hex; distance: number; contentHash: Hex };
export async function findPerceptualMatches(hash: bigint, options: { maxPages?: number; client?: PublicClient } = {}): Promise<PerceptualMatch[]> {
  if (hash === 0n) return [];
  const maxPages = options.maxPages ?? 100;
  if (!Number.isInteger(maxPages) || maxPages < 1) throw new RangeError("maxPages must be positive.");
  const total = await getTotalPassports(options.client); const matches: PerceptualMatch[] = [];
  const cappedTotal = total > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : total;
  const pages = Math.ceil(Number(cappedTotal) / PAGE_MAX);
  if (pages > maxPages) throw new IncompleteRegistryIndexError(`Registry has ${pages} pages; scan bound is ${maxPages}.`);
  for (let pageNo = 0; pageNo < pages; pageNo++) {
    const page = await getPage(pageNo * PAGE_MAX, PAGE_MAX, options.client);
    const expectedLength = Math.min(PAGE_MAX, Number(cappedTotal) - pageNo * PAGE_MAX);
    if (page.ids.length !== expectedLength || page.perceptualHashes.length !== expectedLength || page.contentHashes.length !== expectedLength) {
      throw new IncompleteRegistryIndexError(`Registry page ${pageNo} returned ${page.ids.length} of ${expectedLength} expected records.`);
    }
    page.ids.forEach((passportId, i) => {
      const candidate = page.perceptualHashes[i];
      if (candidate === 0n) return;
      const distance = hamming(hash, candidate);
      if (distance <= 6) matches.push({ passportId, distance, contentHash: page.contentHashes[i] });
    });
  }
  return matches.sort((a, b) => a.distance - b.distance);
}
export type VerificationDecision = "exact" | "authentic" | "revoked" | "perceptual" | "none";
export function verifyDecision(input: { exact: boolean; exists: boolean; revoked: boolean; perceptualDistance?: number; candidateHash?: bigint }): VerificationDecision {
  if (input.exact) return input.revoked ? "revoked" : "exact";
  if (input.exists) return input.revoked ? "revoked" : "authentic";
  if (input.candidateHash !== 0n && input.perceptualDistance !== undefined && input.perceptualDistance <= 6) return "perceptual";
  return "none";
}
export const REGISTRY_PAGE_MAX = PAGE_MAX;
