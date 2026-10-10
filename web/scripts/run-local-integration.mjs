import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(webRoot, '..');
const rpcUrl = process.env.ANVIL_RPC_URL ?? 'http://127.0.0.1:8545';
const response = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
});
if (!response.ok) throw new Error(`Anvil RPC is unavailable at ${rpcUrl} (HTTP ${response.status}). Start Anvil with --chain-id 10143.`);
const rpcResult = await response.json();
if (rpcResult.error || Number(BigInt(rpcResult.result)) !== 10143) throw new Error(`Expected local chain 10143 at ${rpcUrl}; got ${rpcResult.result ?? 'no chain ID'}.`);

const output = process.env.LOCAL_FIXTURE_OUTPUT ?? resolve(root, '.superpowers/sdd/provenancex/local-anvil-fixture.json');
const vitest = resolve(webRoot, 'node_modules/vitest/vitest.mjs');
const result = spawnSync(process.execPath, [vitest, 'run', 'src/lib/anvil.integration.test.ts'], {
  cwd: webRoot,
  stdio: 'inherit',
  env: { ...process.env, ANVIL_INTEGRATION: '1', ANVIL_RPC_URL: rpcUrl, LOCAL_FIXTURE_OUTPUT: output },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Local Anvil fixture details written to ${output}`);
