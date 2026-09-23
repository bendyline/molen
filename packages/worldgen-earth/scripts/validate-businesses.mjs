import { readFile } from 'node:fs/promises';
import { resolveLandmarkCatalogDocuments } from '@bendyline/molen-worldgen/kernel';
import { validateBusinessCatalogDocuments } from '../dist/kernel.mjs';

const content = new URL('../../../content/', import.meta.url);
const readJson = async (url) => JSON.parse(await readFile(url, 'utf8'));
const landmarks = new URL('worldgen/landmarks/', content);
const definitions = await resolveLandmarkCatalogDocuments(
  await readJson(new URL('catalog.json', landmarks)),
  (path) => readJson(new URL(path, landmarks)),
);
const catalog = validateBusinessCatalogDocuments(
  await readJson(new URL('earth/businesses/catalog.json', content)),
  definitions,
);
console.log(
  `Validated ${catalog.profiles.length} business identities and ${catalog.categories.length} categories against landmark manifests.`,
);
