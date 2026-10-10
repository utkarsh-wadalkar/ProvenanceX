import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export async function exportDeployment({
  root = resolve(here, '../..'),
  chainId = Number(process.env.CHAIN_ID ?? 10143),
  rpcUrl = process.env.RPC_URL ?? (Number(chainId) === 143 ? process.env.MAINNET_RPC_URL : 'https://testnet-rpc.monad.xyz'),
  fetchImpl = fetch,
} = {}) {
  const id = Number(chainId);
  if (![10143, 143].includes(id)) throw new Error(`Unsupported Monad chain ID ${id}; expected 10143 or 143.`);
  if (!rpcUrl) throw new Error(`Set ${id === 143 ? 'MAINNET_RPC_URL' : 'RPC_URL'} to validate the deployment chain.`);

  const rpcResponse = await fetchImpl(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
  });
  if (!rpcResponse.ok) throw new Error(`Could not validate RPC chain ID (HTTP ${rpcResponse.status}).`);
  const rpcResult = await rpcResponse.json();
  if (rpcResult.error || !rpcResult.result) throw new Error('RPC did not return a chain ID.');
  const actualChainId = Number(BigInt(rpcResult.result));
  if (actualChainId !== id) throw new Error(`RPC chain ID ${actualChainId} does not match requested chain ${id}; no deployment files were written.`);

  const broadcastPath = resolve(root, `contracts/broadcast/Deploy.s.sol/${id}/run-latest.json`);
  const artifactPath = resolve(root, 'contracts/out/ContentPassport.sol/ContentPassport.json');
  const deploymentPath = resolve(root, id === 143 ? 'web/src/lib/deployment.mainnet.json' : 'web/src/lib/deployment.json');
  const abiPath = resolve(root, 'web/src/lib/abi.ts');

  const broadcast = JSON.parse(await readFile(broadcastPath, 'utf8'));
  const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
  const tx = broadcast.transactions?.find(
    (item) => item.transactionType === 'CREATE' && item.contractName === 'ContentPassport'
  );
  if (!tx?.contractAddress || !tx.hash) throw new Error('ContentPassport deployment transaction is missing from broadcast receipt data.');

  const receipt = broadcast.receipts?.find(
    (item) => item.transactionHash?.toLowerCase() === tx.hash.toLowerCase()
  );
  if (!receipt || !['0x1', '1', 1, true].includes(receipt.status)) {
    throw new Error('Successful on-chain receipt for ContentPassport was not found; no deployment files were written.');
  }
  if (!receipt.blockNumber) throw new Error('Successful deployment receipt has no block number.');

  const deployment = {
    address: tx.contractAddress,
    chainId: id,
    deploymentBlock: Number(BigInt(receipt.blockNumber)),
    transactionHash: receipt.transactionHash,
  };
  await mkdir(dirname(deploymentPath), { recursive: true });
  await writeFile(deploymentPath, `${JSON.stringify(deployment, null, 2)}\n`);
  await writeFile(abiPath, `export const contentPassportAbi = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`);
  console.log(`Exported ContentPassport ${deployment.address} at block ${deployment.deploymentBlock} on chain ${id}.`);
  return deployment;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await exportDeployment();
}
