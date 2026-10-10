import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const artifactPath = resolve(root, 'contracts/out/ContentPassport.sol/ContentPassport.json');
const abiPath = resolve(root, 'web/src/lib/abi.ts');
const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
await mkdir(dirname(abiPath), { recursive: true });
await writeFile(abiPath, `export const contentPassportAbi = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`);
console.log(`Exported ${artifact.abi.length} ABI entries.`);
