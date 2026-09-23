// Stamp the engine version + three.js pin into docs-src/llms.txt from the package manifests, so
// the shipped bundle can't drift from the code. Run in the docs/release flow (and locally).
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(join(root, 'packages/kernel/package.json'), 'utf8'));
const client = JSON.parse(await readFile(join(root, 'packages/client/package.json'), 'utf8'));
const version = pkg.version;
const three = (client.dependencies?.three ?? '').replace(/^[\^~]/, '');

const path = join(root, 'docs-src/llms.txt');
const before = await readFile(path, 'utf8');
let after = before.replace(/Engine version: \d+\.\d+\.\d+/, `Engine version: ${version}`);
if (three) after = after.replace(/three\.js pin: \d+\.\d+\.\d+/, `three.js pin: ${three}`);

if (after === before) {
  console.log(`llms.txt already at version ${version} (three ${three || 'n/a'})`);
} else {
  await writeFile(path, after);
  console.log(`stamped llms.txt -> engine ${version}, three.js ${three || 'n/a'}`);
}
