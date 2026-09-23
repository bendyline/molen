import { readFile } from 'node:fs/promises';
import { validateBusinessCatalogDocuments } from '../dist/kernel.mjs';

const source = JSON.parse(
  await readFile(new URL('../packs/default/businesses/catalog.json', import.meta.url), 'utf8'),
);
const catalog = validateBusinessCatalogDocuments(source);
console.log(
  `Validated ${catalog.profiles.length} business identities and ${catalog.categories.length} categories against landmark manifests.`,
);
