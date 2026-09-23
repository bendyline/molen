import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveLandmarkCatalogDocuments } from '../dist/kernel.mjs';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/worldgen/landmarks');
const docs = await resolveLandmarkCatalogDocuments(
  JSON.parse(await readFile(resolve(dir, 'catalog.json'), 'utf8')),
  async (path) => JSON.parse(await readFile(resolve(dir, path), 'utf8')),
);
console.log(`Validated ${Object.keys(docs).length} external landmark model manifests.`);
