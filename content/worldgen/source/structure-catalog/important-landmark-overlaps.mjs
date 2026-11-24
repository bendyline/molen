import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPlacementSourcesSync } from '../../../../packages/worldgen-earth/scripts/placement-sources.mjs';
import { normalize } from '../qualla-structures/classify.mjs';
import { structureCatalogEntries } from '../qualla-structures/work-ownership.mjs';

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const optional = (path) => {
  try {
    return read(path);
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
};
const coordinate = (point) => (point ? [point.longitude, point.latitude] : undefined);
const keys = (values) => values.filter((value) => typeof value === 'string' && value.length > 0);
const namesAtLocation = (title) => {
  const parts = title.split(',');
  return parts.length > 1 ? [normalize(title), normalize(parts[0])] : [normalize(title)];
};

export function landmarkDistanceKm(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return Infinity;
  const east = (a[0] - b[0]) * Math.cos((a[1] * Math.PI) / 180);
  return 111.32 * Math.hypot(east, a[1] - b[1]);
}

/** Catalog identity and work-state evidence. Source specs supply QIDs absent from the source index. */
export function loadLandmarkCoverage(repository) {
  const worldgen = join(repository, 'content/worldgen');
  const sources = join(worldgen, 'source');
  const catalog = join(sources, 'structure-catalog');
  const batches = join(sources, 'qualla-structures/batches');
  const coverage = [];
  for (const entry of read(join(sources, 'structure-index.json')).entries) {
    if (entry.role === 'reusable') continue;
    const spec = optional(join(repository, entry.sourcePath, 'spec.json'));
    const frame = optional(join(repository, entry.sourcePath, 'map-frame.json'));
    coverage.push({
      id: entry.key,
      assetId: entry.assetId,
      names: keys([entry.title, spec.title, frame.mappedIdentity?.name]),
      wikidata: keys([spec.wikidataId, spec.source?.wikidataId, frame.mappedIdentity?.wikidataId]),
      anchor: entry.anchor,
      source: entry.sourcePath,
      hasModel: entry.hasModel,
    });
  }
  const candidateCatalog = read(join(catalog, 'candidates.json'));
  const planned = {
    candidates: [...candidateCatalog.candidates, ...(candidateCatalog.releaseReplacements ?? [])],
  };
  for (const entry of structureCatalogEntries(planned, read(join(catalog, 'collections.json')))) {
    coverage.push({
      id: entry.id,
      assetId: entry.assetId,
      names: keys([entry.title]),
      wikidata: keys([entry.wikidataId]),
      anchor: coordinate(entry.referenceCoordinate),
      source: 'original structure catalog',
    });
  }
  for (const { asset, title, anchor, mapIdentity } of readPlacementSourcesSync(
    join(repository, 'content/earth/source/placements'),
  ).catalog.entries) {
    coverage.push({
      assetId: asset,
      names: keys([title, ...(mapIdentity?.names ?? [])]),
      wikidata: keys([mapIdentity?.wikidata]),
      anchor,
      source: 'Earth placement catalog',
    });
  }
  for (const name of ['project.json', 'stylepack.json']) {
    for (const assetId of Object.keys(read(join(worldgen, name)).assets ?? {})) {
      coverage.push({ assetId, names: [], wikidata: [], source: name });
    }
  }
  for (const name of readdirSync(batches).filter((name) => /^qualla-\d+\.json$/.test(name))) {
    const batch = read(join(batches, name));
    for (const entry of [...batch.entries, ...(batch.deferredEntries ?? [])]) {
      coverage.push({
        id: entry.modelIdentity,
        names: keys([entry.name, ...(entry.stories ?? []).map((story) => story.title)]),
        wikidata: keys([entry.wikidataId]),
        anchor: entry.coordinate,
        source: name,
      });
    }
  }
  const queue = read(join(batches, 'BUILD-QUEUE.json'));
  for (const entry of [...(queue.activeOtherDeviceHolds ?? []), queue.currentDraft].filter(
    Boolean,
  )) {
    coverage.push({
      id: entry.model,
      assetId: entry.reservation?.modelRef,
      names: keys([entry.reservation?.title]),
      wikidata: keys([entry.reservation?.wikidataId]),
      source: 'Qualla build queue',
    });
  }
  return coverage;
}

export function createLandmarkOverlapIndex(coverage) {
  const byId = new Map();
  const byWikidata = new Map();
  const byName = new Map();
  for (const entry of coverage) {
    for (const id of keys([entry.id, entry.assetId])) byId.set(id, entry);
    for (const id of entry.wikidata) byWikidata.set(id, entry);
    for (const key of new Set(entry.names.flatMap(namesAtLocation))) {
      const matches = byName.get(key) ?? [];
      matches.push(entry);
      byName.set(key, matches);
    }
  }
  return (entry) => {
    const anchor = coordinate(entry.referenceCoordinate);
    const sameName = [entry.title, ...(entry.aliases ?? [])]
      .flatMap(namesAtLocation)
      .flatMap((key) => byName.get(key) ?? []);
    return (
      byId.get(entry.id) ??
      byId.get(`molen.worldgen.structure.${entry.id}`) ??
      byWikidata.get(entry.wikidataId) ??
      sameName.find((match) => !match.anchor || landmarkDistanceKm(match.anchor, anchor) < 3)
    );
  };
}
