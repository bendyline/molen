#!/usr/bin/env node
/**
 * Molen-owned Qualla discovery ledger. Reads the published article corpus and Molen
 * source/planning/placement/readiness registries without changing either. Semantic
 * hashes invalidate changed stories; per-geohash checkpoints make interruption and
 * bounded passes resumable. Generated queues never overwrite editorial decisions.
 * No engine build, network, credentials, model generation or Qualla write is needed.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPlacementSourcesSync } from '../../../../packages/worldgen-earth/scripts/placement-sources.mjs';
import { categoryFor, classify, normalize, storyText } from './classify.mjs';
import { structureCatalogEntries, workAssignment } from './work-ownership.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const hash = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const optional = (file, fallback) => (fs.existsSync(file) ? read(file) : fallback);
const jsonl = (rows) =>
  rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '');
const readLines = (file) =>
  fs.existsSync(file)
    ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
    : [];
const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function walk(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => order(a.name, b.name))
    .flatMap((entry) => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory()
        ? walk(file)
        : entry.isFile() && entry.name.endsWith('.json')
          ? [file]
          : [];
    });
}

export function contentHash(article, sourceTitle) {
  return hash({
    id: article.id,
    title: article.title,
    sourceTitle,
    summary: article.summary,
    text: storyText(article),
    location: article.location,
    categories: article.categories,
    source: article.source,
    sourceId: article.sourceId,
    sources: article.sources,
    locationWikipediaPath: article.locationWikipediaPath,
    duplicates: article.duplicates,
  });
}

export function distanceKm(a, b) {
  if (!a || !b) return Infinity;
  const rad = Math.PI / 180;
  const dLat = (a[1] - b[1]) * rad;
  const dLon = (a[0] - b[0]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function loadCatalog(repository) {
  const files = [
    'content/worldgen/source/structure-index.json',
    'content/worldgen/source/structure-catalog/candidates.json',
    'content/worldgen/source/structure-catalog/collections.json',
    'content/worldgen/project.json',
    'content/worldgen/stylepack.json',
    'content/earth/structures/readiness.json',
  ];
  const documents = files.map((file) => read(path.join(repository, file)));
  const [index, planned, collections, project, stylepack, readiness] = documents;
  const { catalog: placements } = readPlacementSourcesSync(
    path.join(repository, 'content/earth/source/placements'),
  );
  files.push('content/earth/source/placements/');
  documents.push(placements);
  const localReadinessPath = 'content/worldgen/source/qualla-structures/batches/readiness.json';
  const localReadinessFile = path.join(repository, localReadinessPath);
  const localReadiness = fs.existsSync(localReadinessFile)
    ? read(localReadinessFile)
    : { candidates: [], counts: { ready: 0 } };
  if (fs.existsSync(localReadinessFile)) {
    files.push(localReadinessPath);
    documents.push(localReadiness);
  }
  const batchDirectory = path.dirname(localReadinessFile);
  for (const name of fs.existsSync(batchDirectory) ? fs.readdirSync(batchDirectory).sort() : []) {
    if (!/^qualla-\d{3}\.readiness\.json$/.test(name)) continue;
    const relative = `content/worldgen/source/qualla-structures/batches/${name}`;
    const document = read(path.join(repository, relative));
    files.push(relative);
    documents.push(document);
    localReadiness.candidates.push(...document.candidates);
  }
  const models = new Map();
  const add = (value) => {
    const key = value.assetId || value.candidateId;
    const old = models.get(key);
    models.set(key, {
      ...old,
      ...value,
      names: [...new Set([...(old?.names ?? []), value.title])],
    });
  };
  for (const candidate of planned.candidates)
    add({
      candidateId: candidate.id,
      title: candidate.title,
      category: candidate.category,
      wikidataId: candidate.wikidataId,
      assetId: candidate.modelRef,
      coordinate: [candidate.referenceCoordinate.longitude, candidate.referenceCoordinate.latitude],
    });
  for (const collection of collections.collections)
    for (const member of collection.members)
      add({
        candidateId: member.id,
        title: member.title,
        wikidataId: member.wikidataId,
        assetId: member.assetId,
        collectionId: collection.id,
        coordinate: [member.referenceCoordinate.longitude, member.referenceCoordinate.latitude],
      });
  for (const entry of index.entries.filter((entry) => entry.role === 'place')) {
    // A planned entry may have no modelRef yet. Merge it into the indexed identity.
    const plannedEntry = models.get(entry.candidateId);
    if (plannedEntry) models.delete(entry.candidateId);
    add({
      ...plannedEntry,
      candidateId: entry.candidateId,
      assetId: entry.assetId,
      title: entry.title,
      sourcePath: entry.sourcePath,
      coordinate: entry.anchor,
      sourceModelReported: entry.hasModel,
    });
  }
  for (const placement of placements.entries) {
    // Reusable recipes placed at a real location do not become replicas of that place.
    const reusable = index.entries.some(
      (entry) => entry.assetId === placement.asset && entry.role === 'reusable',
    );
    if (reusable) continue;
    const old = models.get(placement.asset);
    add({
      ...old,
      assetId: placement.asset,
      title: old?.title ?? placement.title,
      coordinate: old?.coordinate ?? placement.anchor,
      names: old?.names,
      placements: [
        ...(old?.placements ?? []),
        {
          id: placement.id,
          title: placement.title,
          status: placement.status,
          note: placement.note,
          anchor: placement.anchor,
        },
      ],
    });
    models.get(placement.asset).names.push(placement.title);
  }
  const runtimeAssets = new Set(Object.keys(project.assets ?? {}));
  // The style pack is fingerprinted too; a project-only registration is insufficient.
  const styleText = JSON.stringify(stylepack);
  for (const model of models.values()) {
    model.registered = runtimeAssets.has(model.assetId) && styleText.includes(`"${model.assetId}"`);
    const ready = [...readiness.candidates, ...localReadiness.candidates].find(
      (candidate) => candidate.candidateId === model.candidateId,
    );
    if (ready)
      model.readiness = {
        status: ready.readiness,
        blockers: ready.blockers,
        activePlacement: ready.geographic?.activePlacement ?? null,
        fidelity: ready.fidelityQa?.target ?? null,
      };
    model.names = [...new Set(model.names.filter(Boolean))];
  }
  return {
    structureCatalog: structureCatalogEntries(planned, collections),
    models: [...models.values()].sort((a, b) =>
      order(a.assetId ?? a.candidateId, b.assetId ?? b.candidateId),
    ),
    inputs: files.map((file, i) => ({ path: file, sha256: hash(documents[i]) })),
    counts: {
      namedSourceBundles: index.entries.filter((entry) => entry.role === 'place').length,
      reusableSourceBundles: index.entries.filter((entry) => entry.role === 'reusable').length,
      plannedCandidates: planned.candidates.length,
      placements: placements.entries.length,
      readyCandidatesReported: readiness.counts.ready,
    },
  };
}

export function matchCatalog(article, title, coordinate, catalog, explicitAsset) {
  if (explicitAsset) {
    const model = catalog.models.find(
      (item) => item.assetId === explicitAsset || item.candidateId === explicitAsset,
    );
    if (!model) throw new Error(`Unknown explicit Molen identity: ${explicitAsset}`);
    return [{ model, basis: 'editorial-identity' }];
  }
  const names = new Set(
    [
      title,
      article.title.split(/:\s| — | – /)[0],
      article.id.replace(/-w[pk]$/, '').replaceAll('-', ' '),
    ].map(normalize),
  );
  const exact = [];
  const possible = [];
  for (const model of catalog.models) {
    const distance = distanceKm(coordinate, model.coordinate);
    if (distance > 3) continue;
    const aliases = model.names.flatMap((name) => [normalize(name), normalize(name.split(',')[0])]);
    if (aliases.some((alias) => names.has(alias))) {
      exact.push({
        model,
        basis: 'name-and-coordinate',
        distanceKm: Math.round(distance * 1000) / 1000,
      });
    } else if (
      distance < 1 &&
      aliases.some(
        (alias) =>
          alias.length >= 9 &&
          alias.split(' ').length > 1 &&
          [...names].some(
            (name) =>
              ` ${name} `.includes(` ${alias} `) ||
              (name.length >= 9 &&
                name.split(' ').length > 1 &&
                ` ${alias} `.includes(` ${name} `)),
          ),
      )
    ) {
      possible.push({
        model,
        basis: 'possible-name-and-coordinate',
        distanceKm: Math.round(distance * 1000) / 1000,
      });
    }
  }
  return exact.length ? exact : possible;
}

export function applyDecision(automatic, decision, fingerprint) {
  if (!decision) return { ...automatic, review: 'automated-only' };
  if (decision.contentHash !== fingerprint) {
    return {
      ...automatic,
      disposition: 'review',
      review: 'stale-editorial-decision',
      reason: 'story-changed-since-review',
    };
  }
  if (!['structure', 'review', 'no-structure'].includes(decision.disposition) || !decision.reason) {
    throw new Error('Editorial decisions require a valid disposition and reason');
  }
  if (decision.disposition === 'structure' && !decision.targets?.length)
    throw new Error('Structure decisions need named targets');
  if (decision.targets?.some((target) => !target.name || !target.scope || !target.category))
    throw new Error('Each target needs a name, category and modeling scope');
  if (
    decision.targets?.length > 1 &&
    (decision.targets.some((target) => !target.identity) ||
      new Set(decision.targets.map((target) => target.identity)).size !== decision.targets.length)
  )
    throw new Error('Multiple targets need distinct explicit identities');
  return { ...automatic, ...decision, review: 'editorial', contentHash: undefined };
}

const keepCity = new Set([
  'atlantic-city',
  'carson-city',
  'jersey-city',
  'kansas-city',
  'mexico-city',
  'new-york-city',
  'oklahoma-city',
  'panama-city',
  'quebec-city',
  'salt-lake-city',
  'vatican-city',
]);
export function storyUrl(id, exceptions) {
  let slug = id.replace(/-w[pk]$/, '');
  if (slug.endsWith('-city') && !keepCity.has(slug)) slug = slug.slice(0, -5);
  return `https://qualla.com/${exceptions[id] ?? slug}/`;
}

export function publishedStoryLink(qualla, id, sourcePath, exceptions, cache = new Map()) {
  const canonicalUrl = storyUrl(id, exceptions);
  const slug = canonicalUrl.split('/').at(-2);
  const tile = sourcePath
    .replace(/^_c\/art\//, '')
    .split('/')
    .slice(0, 4)
    .join('');
  const deepLink = `https://qualla.com/#list/${tile}/${encodeURIComponent(id)}`;
  if (!cache.has(slug)) {
    const file = path.join(qualla, 'r', slug, 'index.html');
    let published = null;
    if (fs.existsSync(file)) {
      const html = fs.readFileSync(file, 'utf8');
      const match = /window\.__QUALLA_ARTICLE__\s*=\s*(\{[^<]+?\})\s*<\/script>/.exec(html);
      const canonical = /<link rel="canonical" href="(https:\/\/qualla\.com\/[^"?#]+\/)"/.exec(
        html,
      )?.[1];
      if (match) published = { ...JSON.parse(match[1]), canonical };
    }
    cache.set(slug, published);
  }
  const published = cache.get(slug);
  return published?.id === id && published?.tile === tile
    ? { url: published.canonical ?? canonicalUrl, urlKind: 'verified-local-page-identity' }
    : { url: deepLink, urlKind: 'precise-story-route', canonicalUrl };
}

function writeIfChanged(file, content, check) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false;
  if (check) throw new Error(`Stale generated file: ${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, content);
  fs.renameSync(temporary, file);
  return true;
}

function existingStatus(matches) {
  if (!matches.length) return 'new';
  if (matches.length !== 1 || matches[0].basis.startsWith('possible')) return 'identity-review';
  const model = matches[0].model;
  if (!model.registered) return 'existing-planned';
  if (model.readiness?.status === 'ready' && model.readiness.activePlacement)
    return 'existing-ready';
  return 'existing-model-review';
}

const cell = (value) =>
  String(value ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ');
const link = (text, url) => `[${cell(text).replaceAll('[', '\\[').replaceAll(']', '\\]')}](${url})`;

export function scan({
  qualla,
  repository = root,
  output = here,
  limit = Infinity,
  check = false,
}) {
  const articleRoot = path.join(qualla, '_c/art');
  const files = walk(articleRoot);
  if (!files.length) throw new Error('No published Qualla articles found');
  const catalog = loadCatalog(repository);
  const decisions = optional(path.join(output, 'decisions.json'), { articles: {} });
  const exceptions = read(path.join(qualla, '_c/idx/slug-exceptions.json'));
  const pipelineHash = hash(
    fs.readFileSync(fileURLToPath(import.meta.url), 'utf8') +
      fs.readFileSync(path.join(here, 'work-ownership.mjs'), 'utf8'),
  );
  const rulesHash = hash(fs.readFileSync(path.join(here, 'classify.mjs'), 'utf8') + pipelineHash);
  const shards = new Map();
  for (const file of files) {
    const relative = path.relative(articleRoot, file).replaceAll(path.sep, '/');
    const shard = relative.split('/').slice(0, 2).join('');
    if (!/^[a-z0-9]{2}$/.test(shard)) throw new Error(`Unexpected article layout: ${relative}`);
    if (!shards.has(shard)) shards.set(shard, []);
    shards.get(shard).push({ file, relative });
  }
  const articles = [];
  const seen = new Map();
  let classified = 0;
  let reused = 0;
  let pending = 0;
  let writes = 0;
  const curation = new Map();
  for (const [shard, paths] of shards) {
    const ledgerPath = path.join(output, 'scan', `${shard}.jsonl`);
    const oldLines = readLines(ledgerPath);
    const header = oldLines[0];
    const old = new Map(oldLines.slice(1).map((row) => [row.sourcePath, row]));
    const rows = [];
    for (const { file, relative } of paths) {
      const article = read(file);
      if (!article.id || !article.title) throw new Error(`Missing story identity: ${file}`);
      if (!seen.has(article.id)) seen.set(article.id, []);
      seen.get(article.id).push(relative);
      const prefix = relative.split('/').slice(0, 4).join('');
      if (!curation.has(prefix))
        curation.set(prefix, optional(path.join(qualla, 'catalog', `${prefix}.json`), {}));
      const sourceTitle = curation.get(prefix)[article.id]?.title;
      const fingerprint = contentHash(article, sourceTitle);
      const decisionHash = hash(decisions.articles[article.id] ?? null);
      const prior = old.get(relative);
      let row;
      if (
        header?.rulesHash === rulesHash &&
        prior?.contentHash === fingerprint &&
        prior?.decisionHash === decisionHash
      ) {
        row = { ...prior, active: true };
        reused++;
      } else if (classified < limit) {
        row = {
          articleId: article.id,
          sourcePath: relative,
          contentHash: fingerprint,
          decisionHash,
          active: true,
          building3dScan: applyDecision(
            classify(article, sourceTitle),
            decisions.articles[article.id],
            fingerprint,
          ),
        };
        classified++;
      } else {
        pending++;
        // Keep a checkpoint, but never publish an old decision as current.
        row = {
          articleId: article.id,
          sourcePath: relative,
          contentHash: fingerprint,
          active: true,
          building3dScan: {
            disposition: 'pending',
            reason: 'scan-budget-exhausted',
            review: 'not-scanned',
          },
        };
      }
      rows.push(row);
      const coordinate = article.location?.coordinates;
      const point =
        coordinate &&
        Number.isFinite(coordinate.lng) &&
        Number.isFinite(coordinate.lat) &&
        Math.abs(coordinate.lng) <= 180 &&
        Math.abs(coordinate.lat) <= 90
          ? [coordinate.lng, coordinate.lat]
          : null;
      articles.push({
        article,
        sourceTitle,
        row,
        path: `_c/art/${relative}`,
        coordinate: point,
        url: storyUrl(article.id, exceptions),
      });
      old.delete(relative);
    }
    for (const removed of old.values()) rows.push({ ...removed, active: false });
    rows.sort((a, b) => order(a.sourcePath ?? a.articleId, b.sourcePath ?? b.articleId));
    writes += Number(
      writeIfChanged(
        ledgerPath,
        jsonl([{ format: 'molen/qualla-structure-scan@1', rulesHash }, ...rows]),
        check,
      ),
    );
  }
  // Retain tombstones even when an entire geographic shard disappears.
  const scanDirectory = path.join(output, 'scan');
  if (fs.existsSync(scanDirectory))
    for (const name of fs.readdirSync(scanDirectory).filter((name) => name.endsWith('.jsonl'))) {
      if (shards.has(name.slice(0, -6))) continue;
      const file = path.join(scanDirectory, name);
      const rows = readLines(file);
      writes += Number(
        writeIfChanged(
          file,
          jsonl([rows[0], ...rows.slice(1).map((row) => ({ ...row, active: false }))]),
          check,
        ),
      );
    }
  const structures = new Map();
  const linkCache = new Map();
  const review = [];
  const counts = { structure: 0, review: 0, 'no-structure': 0, pending: 0, editorial: 0 };
  for (const entry of articles) {
    const { article, row } = entry;
    const result =
      seen.get(article.id).length > 1 && row.building3dScan.disposition !== 'pending'
        ? {
            ...row.building3dScan,
            disposition: 'review',
            reason: 'duplicate-story-id-at-multiple-paths',
          }
        : row.building3dScan;
    counts[result.disposition]++;
    counts.editorial += Number(result.review === 'editorial');
    if (result.disposition === 'no-structure' || result.disposition === 'pending') continue;
    const title =
      entry.sourceTitle?.split(/:\s| — | – /)[0] || article.title.split(/:\s| — | – /)[0];
    const story = {
      id: article.id,
      title: article.title,
      ...publishedStoryLink(qualla, article.id, entry.path, exceptions, linkCache),
      sourcePath: entry.path,
      contentHash: row.contentHash,
    };
    const targets = result.targets ?? [{ name: title, category: result.category }];
    for (const target of targets) {
      const coordinate = target.coordinate ?? entry.coordinate;
      const matchingSubject = result.targets ? { id: target.name, title: target.name } : article;
      const matches = matchCatalog(
        matchingSubject,
        target.name,
        coordinate,
        catalog,
        target.molenId,
      ).filter(
        ({ model }) =>
          !(target.rejectMolenIds ?? []).some(
            (id) => id === model.candidateId || id === model.assetId,
          ),
      );
      if (result.disposition === 'review') {
        review.push({
          story,
          subject: target.name,
          reason: result.reason,
          review: result.review,
          category: target.category ?? result.category,
          coordinate,
          summary: article.summary,
          flags: result.flags ?? [],
          possibleMolenMatches: matches.map(({ model, ...match }) => ({
            ...match,
            title: model.title,
            candidateId: model.candidateId,
            assetId: model.assetId,
          })),
        });
        continue;
      }
      const status = coordinate ? existingStatus(matches) : 'identity-review';
      // Source identity stays stable as the model moves from planned to imported to
      // ready. WP/WK variants with the same stem can share one target. More unusual
      // aliases and multi-target stories use explicit editorial target identities.
      let identity = target.identity ?? `qualla:${article.id.replace(/-w[pk]$/, '')}`;
      const priorId = `QS-${hash(identity).slice(0, 12)}`;
      if (
        structures.has(priorId) &&
        distanceKm(coordinate, structures.get(priorId).coordinate) > 1
      ) {
        identity += `:${article.id}`;
      }
      const id = `QS-${hash(identity).slice(0, 12)}`;
      let record = structures.get(id);
      if (!record) {
        record = {
          id,
          identity,
          name: target.name,
          category: target.category ?? result.category ?? categoryFor(target.name) ?? 'other',
          status,
          priority: target.priority ?? (result.review === 'editorial' ? 'P1' : 'P2'),
          coordinate,
          coordinateBasis: target.coordinate
            ? 'editorial-reference'
            : 'story-reference-not-placement',
          scope:
            target.scope ??
            'Research the specific exterior, current survival/era and footprint before authoring.',
          review: result.review,
          flags: result.flags ?? [],
          existing: matches.map(({ model, ...match }) => ({ ...match, ...model })),
          stories: [],
        };
        structures.set(id, record);
      }
      if (!record.stories.some((item) => item.id === article.id)) record.stories.push(story);
    }
  }
  const rank = {
    new: 0,
    'existing-planned': 1,
    'identity-review': 2,
    'existing-model-review': 3,
    'existing-ready': 4,
  };
  // Exact existing-model identities may have several differently named stories.
  // Keep all stable source target IDs as aliases while presenting one work item.
  const byModel = new Map();
  for (const record of [...structures.values()].sort((a, b) => order(a.id, b.id))) {
    if (record.existing.length !== 1 || record.existing[0].basis.startsWith('possible')) continue;
    const model = record.existing[0];
    const key = model.assetId ?? model.candidateId;
    const prior = byModel.get(key);
    if (!prior) {
      byModel.set(key, record);
      continue;
    }
    prior.aliasIds = [...(prior.aliasIds ?? []), record.id];
    prior.stories.push(
      ...record.stories.filter(
        (story) => !prior.stories.some((old) => old.sourcePath === story.sourcePath),
      ),
    );
    if (record.priority < prior.priority) {
      prior.priority = record.priority;
      prior.scope = record.scope;
      prior.review = record.review;
    }
    structures.delete(record.id);
  }
  // Flag remaining same-name, nearby candidates instead of silently deciding
  // that an umbrella institution and one of its buildings are the same target.
  const byName = new Map();
  for (const record of structures.values()) {
    const name = normalize(record.name);
    for (const prior of byName.get(name) ?? []) {
      if (distanceKm(record.coordinate, prior.coordinate) > 0.25) continue;
      for (const [item, other] of [
        [record, prior],
        [prior, record],
      ]) {
        item.possibleDuplicateIds = [...(item.possibleDuplicateIds ?? []), other.id].sort();
        item.status = 'identity-review';
      }
    }
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(record);
  }
  const backlog = [...structures.values()].sort(
    (a, b) =>
      order(a.priority, b.priority) ||
      rank[a.status] - rank[b.status] ||
      order(a.name, b.name) ||
      order(a.id, b.id),
  );
  for (const record of backlog) {
    record.stories.sort((a, b) => order(a.id, b.id));
    record.workAssignment = workAssignment(record, catalog.structureCatalog);
  }
  review.sort(
    (a, b) =>
      order(a.reason, b.reason) || order(a.subject, b.subject) || order(a.story.id, b.story.id),
  );
  const statuses = {};
  const byCategory = {};
  for (const record of backlog) {
    statuses[record.status] = (statuses[record.status] ?? 0) + 1;
    byCategory[record.category] = (byCategory[record.category] ?? 0) + 1;
  }
  const summary = {
    format: 'molen/qualla-structure-backlog@1',
    corpus: '_c/art/**/*.json',
    sourceRepository: 'qualla-internal',
    scanComplete: pending === 0,
    articleCount: articles.length,
    uniqueArticleIds: seen.size,
    duplicateArticleIds: [...seen]
      .filter(([, paths]) => paths.length > 1)
      .map(([id, paths]) => ({ id, paths })),
    articleDecisions: counts,
    structureCount: backlog.length,
    statuses,
    workOwners: {
      'structure-catalog-other-device': backlog.filter((r) => !r.workAssignment.localAuthoringAllowed)
        .length,
      'qualla-local': backlog.filter((r) => r.workAssignment.localAuthoringAllowed).length,
    },
    categories: byCategory,
    rulesHash,
    pipelineHash,
    corpusHash: hash(articles.map((entry) => [entry.article.id, entry.row.contentHash])),
    decisionsHash: hash(decisions),
    catalog: { counts: catalog.counts, inputs: catalog.inputs },
    urlPolicy:
      'CanonicalUrl.ts and slug exceptions, verified against local landing-page story identity; exact #list/tile/id fallback. No live HTTP verification.',
    limits: [
      'Automated subject triage is not a complete semantic or factual review.',
      'Narrative-only mentions and multi-building sites remain in the review queue.',
      'Story coordinates are reference points, never surveyed anchors.',
      'Registry readiness is reported, not independently revalidated by this scanner.',
    ],
  };
  writes += Number(writeIfChanged(path.join(output, 'structures.jsonl'), jsonl(backlog), check));
  writes += Number(writeIfChanged(path.join(output, 'review.jsonl'), jsonl(review), check));
  writes += Number(
    writeIfChanged(
      path.join(output, 'scan-summary.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
      check,
    ),
  );
  const table = (records) =>
    [
      '| Structure | Work | Owner | Qualla stories | Molen identity / scope |',
      '| --- | --- | --- | --- | --- |',
      ...records.map(
        (record) =>
          `| ${cell(record.name)} (${record.id}) | ${record.priority} · ${record.status} | ${record.workAssignment.owner} | ${record.stories.map((story) => link(story.title, story.url)).join('<br>')} | ${cell([record.existing.map((model) => model.candidateId ?? model.assetId).join(', '), record.scope].filter(Boolean).join(' — '))} |`,
      ),
    ].join('\n');
  for (const category of Object.keys(byCategory).sort()) {
    const records = backlog.filter((record) => record.category === category);
    const sections = Object.keys(rank)
      .filter((status) => records.some((record) => record.status === status))
      .map(
        (status) =>
          `## ${status}\n\n${table(records.filter((record) => record.status === status))}`,
      );
    writes += Number(
      writeIfChanged(
        path.join(output, 'lists', `${category}.md`),
        `# Qualla structures: ${category}\n\nGenerated by ../scan.mjs. Automated candidates require identity, survival and footprint review.\n\n${sections.join('\n\n')}\n`,
        check,
      ),
    );
  }
  const listsDirectory = path.join(output, 'lists');
  if (fs.existsSync(listsDirectory)) {
    for (const name of fs.readdirSync(listsDirectory)) {
      if (!name.endsWith('.md') || Object.hasOwn(byCategory, name.slice(0, -3))) continue;
      const obsolete = path.join(listsDirectory, name);
      if (check) throw new Error(`Obsolete generated category list: ${obsolete}`);
      fs.unlinkSync(obsolete);
      writes++;
    }
  }
  const reasonCounts = {};
  for (const item of review) reasonCounts[item.reason] = (reasonCounts[item.reason] ?? 0) + 1;
  const starter = backlog.filter(
    (record) => record.priority === 'P1' && record.workAssignment.localAuthoringAllowed,
  );
  const otherDevice = backlog.filter((record) => !record.workAssignment.localAuthoringAllowed);
  writes += Number(
    writeIfChanged(
      path.join(output, 'OTHER-DEVICE.md'),
      `# Qualla targets owned by the other device\n\nAll structure catalog candidates and collection members are excluded from local production, regardless of whether they are planned, imported or ready. These **${otherDevice.length} targets** remain visible for story coverage and later model synchronization. Possible identity overlaps are held here until reconciled.\n\n${table(otherDevice)}\n`,
      check,
    ),
  );
  const report =
    `# Qualla structure backlog\n\n` +
    `Scanned **${articles.length.toLocaleString('en-US')} article records** (${seen.size.toLocaleString('en-US')} unique story IDs) from the local published corpus. ` +
    `**${backlog.length.toLocaleString('en-US')} structure candidates**, **${review.length.toLocaleString('en-US')} records awaiting scope/identity review**, ` +
    `**${counts['no-structure'].toLocaleString('en-US')} automated or editorial non-structure decisions**; **${pending} pending scans**.\n\n` +
    `This is an initial discovery backlog. “Scanned” records an automated pass; it does not mean every story received editorial review. ` +
    `Only ${counts.editorial} stories have hash-bound editorial decisions. Read [the workflow](README.md) before promoting candidates.\n\n` +
    `## Work remaining and existing coverage\n\n| Work | Structures |\n| --- | ---: |\n` +
    Object.keys(rank)
      .map((status) => `| ${status} | ${statuses[status] ?? 0} |`)
      .join('\n') +
    `\n\nExisting-ready means the current registry reports readiness and an active placement. Imported assets, previews, and old simplified models remain separate. ` +
    `Generic styles and reusable models do not count as accurate versions of named buildings.\n\n` +
    `**${otherDevice.length} targets are reserved for the other device** because they match the structure catalog lists. They remain in coverage tracking but are excluded from local batches. See [other-device ownership](OTHER-DEVICE.md).\n\n` +
    `## Reviewed starting batch\n\n${starter.length ? table(starter) : 'No editorial starting batch yet.'}\n\n` +
    `## Complete lists\n\n| Category | Structures |\n| --- | ---: |\n` +
    Object.keys(byCategory)
      .sort()
      .map((category) => `| [${category}](lists/${category}.md) | ${byCategory[category]} |`)
      .join('\n') +
    `\n\nEvery structure row links to its Qualla story. [structures.jsonl](structures.jsonl) adds reference coordinates, stable identity, source hashes, source paths, existing model IDs and placement/readiness evidence.\n\n` +
    `## Review queue\n\n[review.jsonl](review.jsonl) retains story links, summaries, reasons, coordinates and possible catalog matches. ` +
    `Review these before claiming exhaustive coverage; a city story may imply several separate buildings, and a destroyed landmark needs an explicit era decision.\n\n| Reason | Stories |\n| --- | ---: |\n` +
    Object.entries(reasonCounts)
      .sort()
      .map(([reason, count]) => `| ${reason} | ${count} |`)
      .join('\n') +
    `\n\n## Reproduce or resume\n\n\`\`\`sh\nnode content/worldgen/source/qualla-structures/scan.mjs --qualla ../qualla-internal\nnode content/worldgen/source/qualla-structures/scan.mjs --qualla ../qualla-internal --check\n\`\`\`\n\n` +
    `The [scan summary](scan-summary.json) pins the corpus, rules, decisions and catalog inputs. The [scan/](scan/) ledger marks every article, including non-structures.\n`;
  writes += Number(writeIfChanged(path.join(output, 'BACKLOG.md'), report, check));
  return { ...summary, run: { classified, reused, pending, filesChanged: writes } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = { qualla: path.resolve(root, '../qualla-internal') };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') options.check = true;
    else if (args[i] === '--qualla') options.qualla = path.resolve(args[++i]);
    else if (args[i] === '--out') options.output = path.resolve(args[++i]);
    else if (args[i] === '--limit') {
      options.limit = Number(args[++i]);
      if (!Number.isInteger(options.limit) || options.limit < 0)
        throw new Error('--limit must be a nonnegative integer');
    } else throw new Error(`Unknown option: ${args[i]}`);
  }
  const result = scan(options);
  console.log(
    JSON.stringify(
      {
        articles: result.articleCount,
        structures: result.structureCount,
        statuses: result.statuses,
        decisions: result.articleDecisions,
        ...result.run,
      },
      null,
      2,
    ),
  );
}
