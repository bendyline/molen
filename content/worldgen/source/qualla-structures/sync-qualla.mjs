#!/usr/bin/env node
/**
 * Remember existing Molen models in Qualla's durable curation catalog. The backlog
 * must pass its read-only freshness check first. Only unambiguous, registered,
 * source-backed models qualify; planned and unresolved candidates never do.
 *
 * Writes use Qualla's own CatalogManager transaction, preserving current curation
 * fields under its cross-process lock. Lost associations become inactive records,
 * not forgotten history. No article outputs, media or runtime packs are modified.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { contentHash, scan } from './scan.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(here, '../../../..');
const owner = 'molen-qualla-structures';
const backlogPath = 'content/worldgen/source/qualla-structures/structures.jsonl';
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function articleTile(story) {
  const match =
    /^_c\/art\/([0-9bcdefghjkmnpqrstuvwxyz])\/([0-9bcdefghjkmnpqrstuvwxyz])\/([0-9bcdefghjkmnpqrstuvwxyz])\/([0-9bcdefghjkmnpqrstuvwxyz])\/([^/]+)\.json$/.exec(
      story.sourcePath,
    );
  if (!match || match[5] !== story.id) throw new Error(`Invalid article path: ${story.sourcePath}`);
  return match.slice(1, 5).join('');
}

export function modelAnnotations(structures) {
  const articles = new Map();
  for (const structure of structures) {
    if (!['existing-ready', 'existing-model-review'].includes(structure.status)) continue;
    if (structure.existing.length !== 1) continue;
    const model = structure.existing[0];
    if (
      !['editorial-identity', 'name-and-coordinate'].includes(model.basis) ||
      !model.assetId ||
      !model.sourcePath ||
      !model.sourceModelReported ||
      !model.registered
    )
      continue;
    const ready = model.readiness?.status === 'ready' && !!model.readiness.activePlacement;
    for (const story of structure.stories) {
      const geohash4 = articleTile(story);
      let record = articles.get(story.id);
      if (
        record &&
        (record.geohash4 !== geohash4 || record.story.contentHash !== story.contentHash)
      ) {
        throw new Error(`Conflicting story identities: ${story.id}`);
      }
      if (!record) {
        record = { geohash4, story, models: [] };
        articles.set(story.id, record);
      }
      if (record.models.some((link) => link.assetId === model.assetId)) continue;
      record.models.push({
        structureId: structure.id,
        structureName: structure.name,
        assetId: model.assetId,
        candidateId: model.candidateId ?? null,
        sourcePath: model.sourcePath,
        storyContentHash: story.contentHash,
        matchBasis: model.basis,
        state: ready ? 'ready' : 'needs-review',
        readinessBasis: 'reported-by-molen-catalog',
        fidelity: model.readiness?.fidelity ?? null,
        blockers: model.readiness?.blockers ?? [],
        activePlacementId: model.readiness?.activePlacement ?? null,
        placements: (model.placements ?? []).map(({ id, status }) => ({ id, status })),
        catalogEvidenceHash: digest(model),
      });
    }
  }
  for (const article of articles.values())
    article.models.sort((a, b) => order(a.assetId, b.assetId));
  return articles;
}

export function reconcileAnnotation(previous, desired) {
  if (previous && (previous.managedBy !== owner || previous.schemaVersion !== 1)) {
    throw new Error('Refusing to overwrite an unrecognized molen3d annotation');
  }
  if (!previous && !desired) return undefined;
  const models = structuredClone(desired?.models ?? []);
  for (const old of previous?.models ?? []) {
    if (models.some((model) => model.assetId === old.assetId)) continue;
    models.push(
      old.state === 'unlinked'
        ? old
        : {
            ...old,
            state: 'unlinked',
            lastKnownState: old.state,
            inactiveReason:
              'Absent from the current unambiguous, source-backed model matches; reconcile before reuse.',
          },
    );
  }
  return {
    schemaVersion: 1,
    managedBy: owner,
    sourceRepository: 'molen',
    backlogPath,
    models: models.sort((a, b) => order(a.assetId, b.assetId)),
  };
}

/** Limit a transaction to explicit story IDs without retiring unrelated links. */
export function annotationScope(desired, bundles, articleIds) {
  if (articleIds === undefined) return { desired, bundles };
  if (
    !Array.isArray(articleIds) ||
    !articleIds.length ||
    articleIds.some((id) => typeof id !== 'string' || !id.trim())
  )
    throw new Error('Article scope must contain nonempty story IDs');
  const wanted = new Set(articleIds);
  const found = new Set();
  const selected = bundles
    .map(({ geohash4, entries }) => ({
      geohash4,
      entries: Object.fromEntries(
        Object.entries(entries).filter(([id]) => {
          if (!wanted.has(id)) return false;
          found.add(id);
          return true;
        }),
      ),
    }))
    .filter(({ entries }) => Object.keys(entries).length);
  for (const id of wanted)
    if (!found.has(id)) throw new Error(`Missing curation entry in article scope: ${id}`);
  return { desired: new Map([...desired].filter(([id]) => wanted.has(id))), bundles: selected };
}

/** Pure planning over current catalog bundles, including old annotations to retire. */
export function planAnnotations(desired, bundles) {
  const changes = [];
  const found = new Set();
  const activeIds = new Map();
  for (const { geohash4, entries } of bundles) {
    for (const [articleId, current] of Object.entries(entries)) {
      const target = desired.get(articleId);
      if (!target && !current.molen3d) continue;
      if (activeIds.has(articleId)) throw new Error(`Duplicate catalog identity: ${articleId}`);
      activeIds.set(articleId, geohash4);
      if (current.geohash4 !== geohash4 || (target && target.geohash4 !== geohash4)) {
        throw new Error(
          `Catalog location differs from story: ${articleId}; reconcile relocation first`,
        );
      }
      if (target) found.add(articleId);
      const next = reconcileAnnotation(current.molen3d, target);
      if (!equal(current.molen3d, next))
        changes.push({ articleId, geohash4, target, previous: current.molen3d, next });
    }
  }
  for (const articleId of desired.keys()) {
    if (!found.has(articleId))
      throw new Error(`Missing curation entry: ${articleId}; sync will not create one`);
  }
  return changes.sort((a, b) => order(a.geohash4, b.geohash4) || order(a.articleId, b.articleId));
}

/**
 * Recompute only our field from fresh state inside Qualla's lock. Throwing the
 * private sentinel avoids its normal timestamp/write on a concurrent no-op.
 */
export async function applyAnnotations(changes, manager, verifyStory = () => {}) {
  const unchanged = new Error('annotation-already-current');
  let written = 0;
  for (const change of changes) {
    try {
      await manager.mutateEntry(change.geohash4, change.articleId, (current) => {
        if (!current || current.geohash4 !== change.geohash4) {
          throw new Error(`Catalog entry moved or disappeared: ${change.articleId}`);
        }
        verifyStory(change, current);
        const next = reconcileAnnotation(current.molen3d, change.target);
        if (equal(next, current.molen3d)) throw unchanged;
        if (!equal(current.molen3d, change.previous)) {
          throw new Error(`Model annotation changed during sync: ${change.articleId}; rerun sync`);
        }
        return { ...current, molen3d: next };
      });
      written++;
    } catch (error) {
      if (error !== unchanged) throw error;
    }
  }
  return written;
}

export async function loadQuallaManager(qualla, catalogPath = path.join(qualla, 'catalog')) {
  // Use the sibling's installed TS loader and locking implementation, without
  // adding an engine/runtime dependency or invoking catalog-wide migrations.
  const require = createRequire(path.join(qualla, 'package.json'));
  const { tsImport } = require('tsx/esm/api');
  const { CatalogManager } = await tsImport(
    pathToFileURL(path.join(qualla, 'pipeline/processors/CatalogManager.ts')).href,
    import.meta.url,
  );
  return new CatalogManager({ catalogPath, lazy: true });
}

export async function syncQualla({
  qualla,
  output = here,
  molen = repository,
  write = false,
  check = false,
  articleIds,
}) {
  if (write && check) throw new Error('--write and --check are mutually exclusive');
  // Verify the full corpus, decisions, generated links and current model registry.
  // A bounded/incomplete or stale backlog must never retract valid annotations.
  const summary = scan({ qualla, output, repository: molen, check: true });
  if (!summary.scanComplete) throw new Error('Finish the story scan before syncing annotations');
  const structures = fs
    .readFileSync(path.join(output, 'structures.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(JSON.parse);
  const allDesired = modelAnnotations(structures);
  const catalogPath = path.join(qualla, 'catalog');
  const files = fs
    .readdirSync(catalogPath)
    .filter((name) => /^[0-9bcdefghjkmnpqrstuvwxyz]{4}\.json$/.test(name))
    .sort();
  const allBundles = files.map((name) => ({
    geohash4: name.slice(0, 4),
    entries: read(path.join(catalogPath, name)),
  }));
  const { desired, bundles } = annotationScope(allDesired, allBundles, articleIds);
  const changes = planAnnotations(desired, bundles);
  const result = {
    mode: write ? 'write' : check ? 'check' : 'dry-run',
    ...(articleIds ? { articleScope: [...new Set(articleIds)].sort(order) } : {}),
    linkedStories: desired.size,
    linkedModels: new Set(
      [...desired.values()].flatMap((record) => record.models.map((model) => model.assetId)),
    ).size,
    readyStoryLinks: [...desired.values()]
      .flatMap((record) => record.models)
      .filter((model) => model.state === 'ready').length,
    reviewStoryLinks: [...desired.values()]
      .flatMap((record) => record.models)
      .filter((model) => model.state === 'needs-review').length,
    changedArticles: changes.length,
    changedBundles: new Set(changes.map((change) => change.geohash4)).size,
    writtenArticles: 0,
  };
  if (check && changes.length)
    throw new Error(`Qualla annotations need synchronization: ${changes.length} articles`);
  if (write && changes.length) {
    const manager = await loadQuallaManager(qualla, catalogPath);
    result.writtenArticles = await applyAnnotations(changes, manager, (change, current) => {
      if (!change.target) return;
      const { story } = change.target;
      const article = read(path.join(qualla, story.sourcePath));
      if (
        article.id !== change.articleId ||
        contentHash(article, current.title) !== story.contentHash
      ) {
        throw new Error(`Story changed during sync: ${change.articleId}; rerun scan and sync`);
      }
    });
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = { qualla: path.resolve(repository, '../qualla-internal') };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--qualla' && args[i + 1]) options.qualla = path.resolve(args[++i]);
    else if (args[i] === '--write') options.write = true;
    else if (args[i] === '--check') options.check = true;
    else if (args[i].startsWith('--ids=')) options.articleIds = args[i].slice(6).split(',');
    else if (args[i] === '--help') {
      console.log(
        'Usage: node sync-qualla.mjs [--qualla PATH] [--ids=story-id,...] [--write | --check]\nDefault: read-only dry run. Run scan.mjs first when the backlog is stale. Explicit IDs scope annotations only; full backlog freshness is still required.',
      );
      process.exit(0);
    } else throw new Error(`Unknown or incomplete option: ${args[i]}`);
  }
  try {
    console.log(JSON.stringify(await syncQualla(options), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
