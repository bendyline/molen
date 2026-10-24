/** Verify persistent building identities without requiring generated model binaries. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readStructurePlacements } from '../../worldgen-earth/scripts/placement-sources.mjs';
import { readStructureCollections } from './structure-collections.mjs';
import { structurePlacementId, validateStructureCandidateIds } from './structure-identity.mjs';
import { knownSourceEntries, sourceRepositoryRoot as root } from './structure-source-paths.mjs';

export async function validateStructureIdentities() {
  const json = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
  const catalog = await json('content/worldgen/source/structure-catalog/candidates.json');
  validateStructureCandidateIds(catalog.candidates);
  const collections = await readStructureCollections(
    resolve(root, 'content/worldgen/source/structure-catalog/collections.json'),
    catalog.candidates,
  );
  const records = [...catalog.candidates, ...collections.flatMap((entry) => entry.members)];
  const named = new Set(records.map((entry) => entry.id));
  const project = await json('content/worldgen/project.json');
  const sources = knownSourceEntries();
  const retired = /(?:next[-_ ]?1,?0{3}|(?:^|[./])n\d{4}(?:_|[./]|$))/i;
  for (const path of [
    'content/earth/structures/georeferencing.json',
    'content/earth/structures/readiness.json',
  ]) {
    for (const entry of (await json(path)).candidates)
      if (retired.test(entry.asset ?? '') || !named.has(entry.candidateId))
        throw new Error(`${path}: invalid planned identity ${entry.candidateId}`);
  }
  for (const [id, path] of Object.entries(project.assets))
    if (retired.test(id) || retired.test(path)) throw new Error(`Batch-derived asset: ${id}`);
  for (const record of records) {
    for (const asset of [record.modelRef, ...(record.modelRefs ?? []).map((entry) => entry.asset)])
      if (asset && !project.assets[asset]) throw new Error(`${record.id}: unknown model ${asset}`);
  }
  for (const entry of sources) {
    if (retired.test(entry.key) || retired.test(entry.sourcePath))
      throw new Error(`Batch-derived source: ${entry.key}`);
    if (!named.has(entry.candidateId) || !entry.hasModel) continue;
    const spec = await json(`${entry.sourcePath}/spec.json`);
    if (
      spec.id !== entry.candidateId ||
      entry.key !== spec.id ||
      spec.assetId !== `molen.worldgen.structure.${spec.id}` ||
      spec.assetId !== entry.assetId
    )
      throw new Error(`${entry.key}: catalog, spec, source and asset identities disagree`);
  }
  const placements = (await readStructurePlacements()).entries;
  for (const placement of placements) {
    if (!project.assets[placement.asset] || retired.test(placement.id))
      throw new Error(`${placement.id}: invalid placement identity or asset`);
    const key = placement.asset.replace(/^molen\.worldgen\.structure\./, '');
    if (named.has(key) && placement.id !== structurePlacementId(placement.asset))
      throw new Error(`${placement.id}: expected ${structurePlacementId(placement.asset)}`);
  }
  return {
    candidates: catalog.candidates.length,
    sources: sources.length,
    placements: placements.length,
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  console.log('Validated building identities:', await validateStructureIdentities());
