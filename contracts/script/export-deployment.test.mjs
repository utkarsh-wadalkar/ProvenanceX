import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { exportDeployment } from './export-deployment.mjs';

async function fixtureRoot() {
  const root = await mkdtemp(resolve(tmpdir(), 'provenancex-export-'));
  const broadcast = resolve(root, 'contracts/broadcast/Deploy.s.sol/143/run-latest.json');
  const artifact = resolve(root, 'contracts/out/ContentPassport.sol/ContentPassport.json');
  await mkdir(resolve(root, 'contracts/broadcast/Deploy.s.sol/143'), { recursive: true });
  await mkdir(resolve(root, 'contracts/out/ContentPassport.sol'), { recursive: true });
  await mkdir(resolve(root, 'web/src/lib'), { recursive: true });
  await writeFile(broadcast, JSON.stringify({
    transactions: [{ transactionType: 'CREATE', contractName: 'ContentPassport', contractAddress: '0x0000000000000000000000000000000000000143', hash: '0xabc' }],
    receipts: [{ transactionHash: '0xabc', status: '0x1', blockNumber: '0x22' }],
  }));
  await writeFile(artifact, JSON.stringify({ abi: [{ type: 'function', name: 'totalPassports' }] }));
  await writeFile(resolve(root, 'web/src/lib/deployment.json'), '{"address":null,"chainId":10143}\n');
  return root;
}

const rpc = (id) => async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: `0x${id.toString(16)}` }), { status: 200 });

test('exports chain 143 to a separate manifest only after the RPC chain matches', async () => {
  const root = await fixtureRoot();
  try {
    await exportDeployment({ root, chainId: 143, rpcUrl: 'https://mainnet.invalid', fetchImpl: rpc(143) });
    const mainnet = JSON.parse(await readFile(resolve(root, 'web/src/lib/deployment.mainnet.json'), 'utf8'));
    assert.deepEqual(mainnet, { address: '0x0000000000000000000000000000000000000143', chainId: 143, deploymentBlock: 34, transactionHash: '0xabc' });
    assert.equal(await readFile(resolve(root, 'web/src/lib/deployment.json'), 'utf8'), '{"address":null,"chainId":10143}\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects a mismatched RPC chain before writing any deployment file', async () => {
  const root = await fixtureRoot();
  try {
    await assert.rejects(exportDeployment({ root, chainId: 143, rpcUrl: 'https://testnet.invalid', fetchImpl: rpc(10143) }), /does not match requested chain 143/);
    await assert.rejects(readFile(resolve(root, 'web/src/lib/deployment.mainnet.json')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects unsupported chain IDs before reading broadcast data', async () => {
  await assert.rejects(exportDeployment({ chainId: 999, rpcUrl: 'https://rpc.invalid', fetchImpl: rpc(999) }), /Unsupported Monad chain ID/);
});
