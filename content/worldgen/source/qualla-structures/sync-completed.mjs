#!/usr/bin/env node
/** Add/update explicitly selected, freshly verified local completions. Never retract coverage.
 * Full-corpus reconciliation remains sync-qualla.mjs; this bounded path tolerates unrelated
 * catalog damage by strictly parsing only bundles containing selected story identities.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectLocalModel } from './progress.mjs';
import { contentHash, loadCatalog } from './scan.mjs';
import { loadQuallaManager, modelAnnotations, reconcileAnnotation } from './sync-qualla.mjs';
import { next1000Matches } from './work-ownership.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const read = (p) => JSON.parse(fs.readFileSync(p));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sha256 = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const inside = (dir, relative) => {
  if (
    typeof relative !== 'string' ||
    path.isAbsolute(relative) ||
    relative.split(/[\\/]/).includes('..')
  )
    throw Error(`Invalid relative evidence path: ${relative}`);
  return path.join(dir, relative);
};

/** Source manifests use both plain digests and explicit sha256: fingerprints. */
export function verifySelectedReferenceBytes(qualla, reference) {
  const expected = reference.sha256?.replace(/^sha256:/, '');
  if (!/^[a-f0-9]{64}$/.test(expected ?? '') || sha256(inside(qualla, reference.path)) !== expected)
    throw Error(`Selected reference bytes changed: ${reference.path}`);
}

/** A bounded addition must preserve every unselected association, including inactive history. */
export function upsertCompletedModels(previous, desired) {
  if (!desired?.models?.length || desired.models.some((m) => m.state !== 'ready'))
    throw Error('Only verified ready links qualify for completion sync');
  // Reuse the ordinary annotation owner/schema guard without its withdrawal semantics.
  const envelope = reconcileAnnotation(previous, desired);
  const selected = new Set(desired.models.map((m) => m.assetId));
  for (const model of desired.models) {
    const old = previous?.models?.filter((m) => m.assetId === model.assetId) ?? [];
    if (old.length > 1) throw Error(`Duplicate model association: ${model.assetId}`);
    if (
      old[0] &&
      ['structureId', 'candidateId', 'sourcePath', 'storyContentHash'].some(
        (key) => old[0][key] !== model[key],
      )
    )
      throw Error(`Existing model/story identity differs: ${model.assetId}`);
  }
  return {
    ...previous,
    ...envelope,
    models: [
      ...(previous?.models ?? []).filter((m) => !selected.has(m.assetId)),
      ...desired.models,
    ].sort((a, b) => a.assetId.localeCompare(b.assetId, 'en')),
  };
}

export function verifyCompletedStory(story, article, current, tile) {
  if (!current || current.geohash4 !== tile)
    throw Error(`Story catalog location differs: ${story.id}`);
  if (article.id !== story.id || contentHash(article, current.title) !== story.contentHash)
    throw Error(`Story changed since reference review: ${story.id}`);
}

export function locateCompletedStory(bundles, id, expectedTile) {
  const matches = bundles
    .filter(({ text }) => text.includes(JSON.stringify(id)))
    .flatMap(({ name, text }) => {
      const entry = JSON.parse(text)[id];
      return entry ? [{ tile: name.slice(0, 4), entry }] : [];
    });
  if (matches.length !== 1) throw Error(`Missing or duplicate catalog identity: ${id}`);
  const { tile, entry } = matches[0];
  if (tile !== expectedTile) throw Error(`Catalog relocation requires reconciliation: ${id}`);
  return { tile, entry };
}

/** Keep a story/room batch key separate from its explicitly identified physical building. */
export function completedPhysicalModelIdentity(entry) {
  const identity = entry.physicalModelIdentity ?? entry.modelIdentity;
  if (
    !/^[a-z][a-z0-9_]*$/.test(identity ?? '') ||
    /qualla/i.test(identity) ||
    (identity !== entry.modelIdentity && !/^QS-[a-f0-9]{12}$/.test(entry.physicalStructureId ?? ''))
  )
    throw Error(`Physical source identity invalid: ${entry.modelIdentity}`);
  return identity;
}

export async function syncCompleted({
  ids,
  qualla = path.resolve(root, '../qualla-internal'),
  repository = root,
  output = path.join(repository, 'content/worldgen/source/qualla-structures'),
  write = false,
  check = false,
  batchName = 'qualla-001',
} = {}) {
  if (write && check) throw Error('Choose --write or --check');
  if (!Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== 'string' || !id.trim()))
    throw Error('Explicit --ids=model_identity,... required');
  if (!/^qualla-\d{3}$/.test(batchName)) throw Error('Invalid batch name');
  const batch = read(path.join(output, `batches/${batchName}.json`));
  const entries = [...new Set(ids)].map((id) => {
    const matches = batch.entries.filter((e) => e.modelIdentity === id);
    if (matches.length !== 1 || !matches[0].sourcePath || matches[0].modelState !== 'completed')
      throw Error(`Not a completed fixed-batch identity: ${id}`);
    return matches[0];
  });
  const structures = fs
    .readFileSync(path.join(output, 'structures.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);
  const verifyModel = async (entry) => {
    const catalog = loadCatalog(repository);
    const target = structures.find((s) => s.id === entry.structureId),
      physicalIdentity = completedPhysicalModelIdentity(entry),
      physicalTarget = entry.physicalStructureId
        ? structures.find((s) => s.id === entry.physicalStructureId)
        : target;
    if (
      !target ||
      !physicalTarget ||
      entry.workOwner !== batch.id ||
      next1000Matches(target, catalog.next1000, entry.modelIdentity).length ||
      next1000Matches(physicalTarget, catalog.next1000, physicalIdentity).length
    )
      throw Error(`Local ownership unavailable: ${entry.modelIdentity}`);
    const dir = inside(repository, entry.sourcePath),
      refs = read(path.join(dir, 'reference-images.json'));
    if (!equal(refs.stories.map((s) => s.id).sort(), [...entry.storyIds].sort()))
      throw Error(`Story scope differs from fixed batch: ${entry.modelIdentity}`);
    for (const ref of refs.references) verifySelectedReferenceBytes(qualla, ref);
    const row = await inspectLocalModel(entry, {
      repository,
      project: read(path.join(repository, 'content/worldgen/project.json')),
      stylepack: read(path.join(repository, 'content/worldgen/stylepack.json')),
      placements: read(path.join(repository, 'content/earth/structures/placements.json')),
      currentReferences: read(path.join(output, `references/${entry.structureId}.json`)),
      imageryPolicy: batch.policy?.imagery,
      qualla,
    });
    if (row.readiness !== 'ready')
      throw Error(
        `Completion evidence rejected: ${entry.modelIdentity}: ${row.blockers.join(', ')}`,
      );
    const spec = read(path.join(dir, 'spec.json'));
    if (
      spec.id !== physicalIdentity ||
      spec.assetId !== `molen.worldgen.structure.${physicalIdentity}`
    )
      throw Error(`Source identity differs: ${entry.modelIdentity}`);
    const matches = catalog.models.filter(
      (m) =>
        m.assetId === spec.assetId &&
        m.sourcePath === entry.sourcePath &&
        m.candidateId === physicalIdentity &&
        m.registered &&
        m.sourceModelReported,
    );
    if (matches.length !== 1)
      throw Error(`Registered source identity missing: ${entry.modelIdentity}`);
    const model = {
      ...matches[0],
      basis: 'editorial-identity',
      readiness: {
        status: 'ready',
        blockers: [],
        activePlacement: row.geographic.activePlacement,
        fidelity: 'medium-fi',
      },
    };
    return { entry, row, refs, model, physicalTarget };
  };
  const verified = [];
  for (const entry of entries) verified.push(await verifyModel(entry));
  const desired = modelAnnotations(
    verified.map(({ refs, model, physicalTarget }) => ({
      id: physicalTarget.id,
      name: physicalTarget.name,
      status: 'existing-ready',
      stories: refs.stories,
      existing: [model],
    })),
  );
  const catalogPath = path.join(qualla, 'catalog');
  const bundles = fs
    .readdirSync(catalogPath)
    .filter((f) => /^[0-9bcdefghjkmnpqrstuvwxyz]{4}\.json$/.test(f))
    .map((name) => ({ name, text: fs.readFileSync(path.join(catalogPath, name), 'utf8') }));
  const changes = [];
  for (const [id, target] of desired) {
    // Read all bundle names/text to detect relocations and duplicates, but parse no unrelated tile.
    const { tile, entry } = locateCompletedStory(bundles, id, target.geohash4);
    verifyCompletedStory(target.story, read(inside(qualla, target.story.sourcePath)), entry, tile);
    const next = upsertCompletedModels(entry.molen3d, target);
    if (!equal(next, entry.molen3d))
      changes.push({ id, tile, target, previous: entry.molen3d, next });
  }
  if (check && changes.length)
    throw Error(`Completion annotations need synchronization: ${changes.length} stories`);
  let written = 0;
  if (write && changes.length) {
    const manager = await loadQuallaManager(qualla);
    for (const change of changes) {
      await manager.mutateEntry(change.tile, change.id, async (current) => {
        verifyCompletedStory(
          change.target.story,
          read(inside(qualla, change.target.story.sourcePath)),
          current,
          change.tile,
        );
        if (!equal(current.molen3d, change.previous))
          throw Error(`Annotation changed concurrently: ${change.id}; rerun`);
        for (const proof of verified.filter(({ refs }) =>
          refs.stories.some((s) => s.id === change.id),
        )) {
          const fresh = await verifyModel(proof.entry);
          if (fresh.row.inputHash !== proof.row.inputHash || !equal(fresh.model, proof.model))
            throw Error(`Model evidence changed during sync: ${proof.entry.modelIdentity}`);
        }
        return { ...current, molen3d: upsertCompletedModels(current.molen3d, change.target) };
      });
      written++;
    }
  }
  return {
    mode: write ? 'write' : check ? 'check' : 'dry-run',
    modelScope: entries.map((e) => e.modelIdentity),
    linkedStories: desired.size,
    changedArticles: changes.length,
    writtenArticles: written,
    policy:
      'Add/update selected verified completions only; unrelated associations and curation preserved; full-corpus reconciliation remains separate.',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--ids=')) options.ids = arg.slice(6).split(',');
    else if (arg.startsWith('--batch=')) options.batchName = arg.slice(8);
    else if (arg === '--write') options.write = true;
    else if (arg === '--check') options.check = true;
    else throw Error(`Unknown option: ${arg}`);
  }
  try {
    console.log(JSON.stringify(await syncCompleted(options), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
