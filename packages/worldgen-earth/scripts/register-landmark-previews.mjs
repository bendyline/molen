/** Register explicit authored geographic proposals; never promote coordinate-only candidates. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { formatJson } from '../../worldgen/scripts/format-json.mjs';
import {
  authoredModels,
  content,
  hashBytes,
  readOptionalJson,
  registerSourceDocuments,
  root,
  writeIndex,
} from '../../worldgen/scripts/structure-model-files.mjs';
import { createStructureIndex } from '../dist/kernel.mjs';
import { hasAuthoredGroundContact } from './authored-ground-contact.mjs';
import { authoredHistoricalAppearance } from './historical-placement.mjs';

if (!process.argv.some((arg) => arg.startsWith('--ids=')))
  throw new Error('Select an explicit authored batch with --ids=N0637,N0641');
const path = resolve(root, 'content/earth/structures/placements.json');
const catalog = JSON.parse(await readFile(path, 'utf8'));
const project = JSON.parse(await readFile(resolve(content, 'project.json'), 'utf8'));
const check = process.argv.includes('--check');
for (const { dir, spec, sourceHash, inputHash } of await authoredModels()) {
  const proposal = spec.geographicProposal;
  if (!proposal) throw new Error(`${spec.id}: no authored geographic proposal`);
  if (!/^Q[1-9][0-9]*$/.test(spec.wikidataId ?? ''))
    throw new Error(`${spec.id}: authored placement needs an explicit valid Wikidata identity`);
  if (proposal.wikidataId && proposal.wikidataId !== spec.wikidataId)
    throw new Error(`${spec.id}: geographic proposal and source identity disagree`);
  if (spec.appearance?.currentWorldEligible === false && proposal.status === 'preview-proposal')
    throw new Error(
      `${spec.id}: dated historical geometry cannot activate as a current-world preview`,
    );
  if (spec.collectionId) {
    const duplicate = catalog.entries.find(
      (item) => item.asset !== spec.assetId && item.mapIdentity?.wikidata === spec.wikidataId,
    );
    if (duplicate) throw new Error(`${spec.id}: reuse existing placed identity ${duplicate.id}`);
  }
  const sidecarPath = project.assets?.[spec.assetId];
  if (!sidecarPath) throw new Error(`${spec.id}: runtime asset is not registered`);
  const sidecar = await readOptionalJson(resolve(content, sidecarPath));
  if (sidecar?.sourceHash !== sourceHash)
    throw new Error(`${spec.id}: import current geometry first`);
  const absolute = proposal.elevationMode === 'sea-level';
  if (absolute && !Number.isFinite(proposal.elevationMeters))
    throw new Error(`${spec.id}: absolute placement needs an explicit finite sea-level elevation`);
  const preview =
    proposal.status === 'preview-proposal' &&
    (proposal.elevationMode === 'terrain-contact' || absolute);
  const appearance = authoredHistoricalAppearance(spec);
  const historical =
    appearance !== undefined && (proposal.elevationMode === 'terrain-contact' || absolute);
  const active = preview || historical;
  const entry = {
    id: `next1000.${spec.id.toLowerCase()}`,
    title: spec.title,
    asset: spec.assetId,
    anchor: proposal.anchor,
    heading: proposal.heading ?? 0,
    datum: absolute ? 'sea-level' : 'terrain',
    elevation: absolute ? proposal.elevationMeters : 0,
    orientation: 'fixed',
    mapIdentity: { wikidata: spec.wikidataId, maxDistance: 80 },
    replaceFootprint: active && proposal.replaceFootprint !== false,
    ...(historical ? { appearance } : {}),
    ...(proposal.groundCutout ? { groundCutout: proposal.groundCutout } : {}),
    ...(proposal.terrainReference ? { terrainReference: proposal.terrainReference } : {}),
    ...(proposal.bounds ? { bounds: proposal.bounds } : {}),
    ...(proposal.replaceRoads ? { replaceRoads: proposal.replaceRoads } : {}),
    minLevel: (spec.actualBounds?.max?.[1] ?? 0) > 150 ? 11 : 13,
    status: preview ? 'preview' : historical ? 'historical' : 'draft',
    source: proposal.source,
    note: `${proposal.notes} ${historical ? 'Historical placement requires an explicit viewingDate within the recorded appearance interval; excluded from the default current world.' : preview ? (absolute ? 'Preview places the authored base at the recorded absolute sea-level elevation; local tide and terrain resolution remain host-dependent.' : 'Preview uses the host terrain sample at the authored base; ground slope, facade azimuth and final site fit remain review items.') : 'Draft is discoverable but never rendered; resolve the recorded placement uncertainty before activation.'}`,
  };
  if (active && !hasAuthoredGroundContact(spec))
    throw new Error(
      `${spec.id}: geographic placement needs a Y=0 base or a reviewed Y=0 contact plane with its source basis`,
    );
  createStructureIndex({ ...catalog, entries: [entry] });
  const existing = catalog.entries.find((item) => item.asset === spec.assetId);
  const reportPath = resolve(dir, 'placement-report.json');
  const previous = await readOptionalJson(reportPath);
  const entryHash = hashBytes(JSON.stringify(entry));
  if (check) {
    if (
      JSON.stringify(existing) !== JSON.stringify(entry) ||
      previous?.inputHash !== inputHash ||
      previous?.placementHash !== entryHash
    )
      throw new Error(`${spec.id}: missing or stale authored placement`);
  } else {
    if (existing && JSON.stringify(existing) !== JSON.stringify(entry)) {
      if (previous?.placementHash !== hashBytes(JSON.stringify(existing)))
        throw new Error(
          `${spec.id}: catalog placement was edited independently; preserve and review it`,
        );
      catalog.entries[catalog.entries.indexOf(existing)] = entry;
    } else if (!existing) catalog.entries.push(entry);
    createStructureIndex(catalog);
    await writeIndex(path, `${formatJson(catalog)}\n`);
    await writeFile(
      reportPath,
      `${JSON.stringify(
        {
          format: 'molen/structure-placement-report@1',
          assetId: spec.assetId,
          inputHash,
          placementHash: entryHash,
          entry,
          review:
            'Explicit authoring proposal; registration is not geographic or maximum-fidelity approval.',
        },
        null,
        2,
      )}\n`,
    );
    await registerSourceDocuments(dir, ['placement-report.json']);
  }
  console.log(
    `${spec.id}: ${entry.status} at ${entry.anchor.join(', ')}; heading ${entry.heading}`,
  );
}
