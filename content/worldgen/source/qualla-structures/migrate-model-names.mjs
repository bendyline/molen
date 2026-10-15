#!/usr/bin/env node
/** Rename existing model links only; story geography, content and review state stay intact. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadQuallaManager } from './sync-qualla.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const read = (p) => JSON.parse(fs.readFileSync(p));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hash = (p) => `sha256:${createHash('sha256').update(fs.readFileSync(p)).digest('hex')}`;

export function renameModelAnnotation(annotation, models) {
  if (!annotation?.models?.some((link) => models.some((m) => m.oldAsset === link.assetId)))
    return annotation;
  if (annotation.managedBy !== 'molen-qualla-structures' || annotation.schemaVersion !== 1)
    throw Error('Unrecognized model annotation owner');
  const next = structuredClone(annotation);
  for (const link of next.models) {
    const model = models.find((m) => m.oldAsset === link.assetId);
    if (!model) continue;
    if (link.sourcePath !== model.oldSource || link.candidateId !== model.oldId)
      throw Error(`Model identity differs from the approved rename: ${link.assetId}`);
    if (next.models.some((other) => other.assetId === model.asset))
      throw Error(`Both old and new identities exist: ${model.asset}`);
    link.assetId = model.asset;
    link.sourcePath = model.source;
    link.candidateId = model.key;
    if (link.activePlacementId === model.oldPlacement) link.activePlacementId = model.placement;
    for (const placement of link.placements ?? [])
      if (placement.id === model.oldPlacement) placement.id = model.placement;
    // The next ordinary sync refreshes catalogEvidenceHash and reported readiness.
    // This transaction makes no new coverage or location claim.
  }
  next.models.sort((a, b) => a.assetId.localeCompare(b.assetId, 'en'));
  return next;
}

async function migrate({ qualla, write, check }) {
  const migration = read(path.join(here, 'batches/naming-migration.json'));
  for (const model of migration.models) {
    const source = read(path.join(root, model.source, 'source.json'));
    const sidecar = read(path.join(root, 'content/worldgen', model.runtime));
    if (
      source.id !== model.asset ||
      sidecar.id !== model.asset ||
      hash(path.join(root, model.source, 'models/source.glb')) !== model.sourceHash ||
      hash(path.join(root, 'content/worldgen', path.dirname(model.runtime), sidecar.files.main)) !==
        model.runtimeHash
    )
      throw Error(`Renamed model does not match verified migration: ${model.key}`);
  }
  const catalog = path.join(qualla, 'catalog');
  const changes = [];
  for (const file of fs
    .readdirSync(catalog)
    .filter((f) => /^[0-9bcdefghjkmnpqrstuvwxyz]{4}\.json$/.test(f))) {
    const text = fs.readFileSync(path.join(catalog, file), 'utf8');
    // An identity-only migration need not parse unrelated editorial bundles.
    // A malformed bundle mentioning any affected old identity still fails closed.
    if (!migration.models.some((model) => text.includes(model.oldAsset))) continue;
    for (const [id, entry] of Object.entries(JSON.parse(text))) {
      const next = renameModelAnnotation(entry.molen3d, migration.models);
      if (!equal(entry.molen3d, next)) {
        if (entry.geohash4 !== file.slice(0, 4)) throw Error(`Catalog entry misplaced: ${id}`);
        changes.push({ id, tile: entry.geohash4, previous: entry.molen3d });
      }
    }
  }
  if (check && changes.length)
    throw Error(`${changes.length} annotations still use old model names`);
  let written = 0;
  if (write && changes.length) {
    const manager = await loadQuallaManager(qualla);
    const noChange = new Error('already-renamed');
    for (const change of changes) {
      try {
        await manager.mutateEntry(change.tile, change.id, (current) => {
          if (!current || current.geohash4 !== change.tile)
            throw Error(`Entry moved: ${change.id}`);
          const next = renameModelAnnotation(current.molen3d, migration.models);
          if (equal(next, current.molen3d)) throw noChange;
          if (!equal(current.molen3d, change.previous))
            throw Error(`Annotation changed: ${change.id}`);
          return { ...current, molen3d: next };
        });
        written++;
      } catch (error) {
        if (error !== noChange) throw error;
      }
    }
  }
  return {
    mode: write ? 'write' : check ? 'check' : 'dry-run',
    changedArticles: changes.length,
    writtenArticles: written,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = { qualla: path.resolve(root, '../qualla-internal'), write: false, check: false };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--qualla' && args[i + 1]) options.qualla = path.resolve(args[++i]);
    else if (args[i] === '--write') options.write = true;
    else if (args[i] === '--check') options.check = true;
    else throw Error(`Unknown option: ${args[i]}`);
  }
  if (options.write && options.check) throw Error('Choose --write or --check');
  console.log(JSON.stringify(await migrate(options), null, 2));
}
