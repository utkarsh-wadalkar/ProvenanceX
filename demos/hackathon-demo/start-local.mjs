/** Real local EVM + original app; disposable signer, no production transactions. */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, defineChain, http, parseEther } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(dir, '../..');
const rpc = 'http://127.0.0.1:8545';
const chain = defineChain({id:10143, name:'Local Monad demo EVM', nativeCurrency:{name:'MON',symbol:'MON',decimals:18},rpcUrls:{default:{http:[rpc]}}});
const key = generatePrivateKey();
const account = privateKeyToAccount(key);
const scratch = resolve(dir, 'smoke');
mkdirSync(scratch, {recursive:true});
const children = [];
const anvil = spawn(resolve(dir,'node_modules/@foundry-rs/anvil-win32-amd64/bin/anvil.exe'),
  ['--host','127.0.0.1','--port','8545','--chain-id','10143','--silent'], {stdio:'ignore',windowsHide:true});
children.push(anvil);
const client = createPublicClient({chain, transport:http(rpc,{timeout:3000,retryCount:0})});
let ready = false;
for (let i=0;i<40;i++) {
  try {await client.getChainId();ready=true;break;} catch {await new Promise(r=>setTimeout(r,250));}
}
if (!ready) throw Error('Local EVM did not start.');
await client.request({method:'anvil_setBalance',params:[account.address,'0x'+parseEther('100').toString(16)]});
const artifact = JSON.parse(readFileSync(resolve(root,'contracts/out/ContentPassport.sol/ContentPassport.json'),'utf8'));
const wallet = createWalletClient({account,chain,transport:http(rpc)});
const tx = await wallet.deployContract({abi:artifact.abi,bytecode:artifact.bytecode.object});
const receipt = await client.waitForTransactionReceipt({hash:tx});
if (receipt.status !== 'success') throw Error('Local contract deployment failed.');
const code = await client.getCode({address:receipt.contractAddress});
const deployment = JSON.parse(readFileSync(resolve(root,'web/src/lib/deployment.json'),'utf8'));
// Copy constructor-initialized runtime to the existing configured address locally.
// EIP-712 rebuilds its domain when this address differs from its deployment address.
await client.request({method:'anvil_setCode',params:[deployment.address,code]});
await client.readContract({address:deployment.address,abi:artifact.abi,functionName:'totalPassports'});
writeFileSync(resolve(scratch,'local-runtime.json'),JSON.stringify({rpc,chainId:10143,contract:deployment.address,signer:account.address,localOnly:true},null,2));
const app = spawn(process.execPath,[resolve(root,'web/node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3002'],
  {cwd:resolve(root,'web'),env:{...process.env,NEXT_PUBLIC_RPC_URL:rpc,NEXT_PUBLIC_DEMO_KEY:key},stdio:['ignore','pipe','pipe'],windowsHide:true});
children.push(app);
// Filter server logs: never emit environment or wallet material.
app.stdout.on('data',data=>{if(String(data).includes('Ready in'))console.log('Local app ready at http://127.0.0.1:3002 (isolated EVM).');});
app.stderr.on('data',()=>{});
app.on('exit',code=>{console.log('Local app exited:',code);anvil.kill();});
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{children.forEach(c=>c.kill());process.exit(0);});
console.log('Real Solidity contract running locally. No public Testnet writes.');
