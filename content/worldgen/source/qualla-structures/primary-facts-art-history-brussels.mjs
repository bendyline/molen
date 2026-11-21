import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const artHistoryBrusselsCase = 'brussels-museum-urbis-8459643-and-heritage-inventory-18704';
export const artHistoryBrusselsModel = 'art_and_history_museum';
export const artHistoryBrusselsInventory = 'https://monument.heritage.brussels/fr/buildings/18704';

const digest = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function inspectArtHistoryBrusselsFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  function readBound(record, expectedPath) {
    const bytes = readFileSync(path.join(dir, expectedPath));
    if (record.path !== expectedPath || record.sha256 !== digest(bytes))
      throw new Error('Source evidence changed');
    return JSON.parse(bytes);
  }
  try {
    const map = readBound(proof.nativeIdentity, 'native-map/cinquantenaire-museum-outline.json');
    const written = readBound(
      proof.primarySources,
      'reference-rights/cinquantenaire-museum-facts.json',
    );
    const excluded = readBound(
      proof.candidateExclusion,
      'reference-rights/qualla-image-screening.json',
    );
    const facts = written.sources.find(({ url }) => url === artHistoryBrusselsInventory)?.facts;
    const rejected = new Set(
      excluded.candidates.filter(({ reason }) => reason).map(({ path }) => path),
    );
    const d = controls.dimensions;
    if (
      written.imageryUsed !== false ||
      excluded.selectedImages !== 0 ||
      !inventory.candidates.every(({ path }) => rejected.has(path)) ||
      facts?.mainEntrance !== 'Albert–Élisabeth Gallery' ||
      facts.cloisterCourt !== true ||
      facts.antiquitiesReconstructionPlans !== 1956
    )
      return fail('brussels-museum-written-scope-or-exclusions-unbound');
    if (
      map.relation.id !== 3171598 ||
      map.relation.tags['ref:UrbIS'] !== '8459643' ||
      !same(
        map.relation.members.map(({ ref }) => ref),
        [117777686, 235595645, 235595639, 235595641],
      ) ||
      !map.pois.some(({ id, tags }) => id === 251316201 && tags.wikidata === 'Q5121082') ||
      !map.pois.some(({ id, tags }) => id === 6755630168 && tags['addr:housenumber'] === '10') ||
      map.excludedWingId !== 1232647182 ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      !same(frame.geometry.outline, map.outline) ||
      !same(frame.geometry.holes, map.courts) ||
      !same(d.outline, map.outline) ||
      !same(d.courts, map.courts) ||
      !same(d.entrance, map.entrance) ||
      d.estimatedExterior !== true
    )
      return fail('brussels-museum-native-footprint-or-scope-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: digest(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The native mapping binds the museum’s exterior footprint, its three courts, and the street entrance. Roof and architectural details are informed estimates.',
    };
  } catch {
    return fail('brussels-museum-evidence-invalid');
  }
}
