import { encodeAbiParameters, keccak256, type Hex } from "viem";

export type TrailEntry = { previousHead: Hex; eventType: string; dataHash: Hex; trailHead: Hex; actor: string; timestamp: bigint | number; blockNumber: bigint | number };
export const ZERO_HEAD = `0x${"00".repeat(32)}` as Hex;
export function computeTrailHead(previousHead: Hex, eventType: string, dataHash: Hex, timestamp: bigint | number): Hex {
  return keccak256(encodeAbiParameters(
    [{ type: "bytes32" }, { type: "string" }, { type: "bytes32" }, { type: "uint256" }],
    [previousHead, eventType, dataHash, BigInt(timestamp)],
  ));
}
export type TrailVerification = { valid: boolean; count: number; finalHead: Hex; error?: string; invalidIndex?: number };
export function verifyTrailEntries(entries: readonly TrailEntry[], expectedHead: Hex, expectedCount: number, contentHash?: Hex): TrailVerification {
  let previous = ZERO_HEAD;
  if (entries.length !== expectedCount) return { valid: false, count: entries.length, finalHead: previous, error: `Expected ${expectedCount} entries, received ${entries.length}.` };
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.previousHead.toLowerCase() !== previous.toLowerCase()) return { valid: false, count: entries.length, finalHead: previous, error: "Previous head does not match chain.", invalidIndex: i };
    if (i === 0 && (entry.eventType !== "REGISTERED" || entry.previousHead.toLowerCase() !== ZERO_HEAD || (contentHash && entry.dataHash.toLowerCase() !== contentHash.toLowerCase()))) {
      return { valid: false, count: entries.length, finalHead: previous, error: "First entry is not a valid REGISTERED anchor.", invalidIndex: i };
    }
    const calculated = computeTrailHead(entry.previousHead, entry.eventType, entry.dataHash, entry.timestamp);
    if (calculated.toLowerCase() !== entry.trailHead.toLowerCase()) return { valid: false, count: entries.length, finalHead: previous, error: "Trail hash does not match entry fields.", invalidIndex: i };
    previous = calculated;
  }
  if (previous.toLowerCase() !== expectedHead.toLowerCase()) return { valid: false, count: entries.length, finalHead: previous, error: "Final head does not match the registered source record." };
  return { valid: true, count: entries.length, finalHead: previous };
}

export async function verifyPagedTrail(
  trailLength: number,
  expectedHead: Hex,
  readPage: (offset: number, limit: number) => Promise<readonly TrailEntry[]>,
  contentHash?: Hex,
): Promise<TrailVerification> {
  const all: TrailEntry[] = [];
  for (let offset = 0; offset < trailLength; offset += 200) {
    const page = await readPage(offset, Math.min(200, trailLength - offset));
    if (page.length === 0) return { valid: false, count: all.length, finalHead: all.at(-1)?.trailHead ?? ZERO_HEAD, error: `Trail page at ${offset} was empty before completion.` };
    all.push(...page);
  }
  return verifyTrailEntries(all, expectedHead, trailLength, contentHash);
}
