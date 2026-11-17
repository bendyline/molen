import { readFileSync } from 'node:fs';
import path from 'node:path';
import { hashBytes } from '../../../../packages/worldgen/scripts/structure-model-files.mjs';
import { tytuvenaiRegistry } from './primary-facts-tytuvenai-monastery.mjs';

const records = {
  'tytuvenai-registered-north-wall-and-gate': {
    model: 'tytuvenai_monastery_north_wall_and_gate',
    record: 31632,
    kind: 'standing-wall-and-gate',
  },
  'tytuvenai-registered-south-wall-remains': {
    model: 'tytuvenai_monastery_south_wall_remains',
    record: 31633,
    kind: 'ruined-wall',
  },
  'tytuvenai-registered-novitiate-remains': {
    model: 'tytuvenai_monastery_novitiate_remains',
    record: 31634,
    kind: 'surviving-masonry',
  },
};
export const tytuvenaiPerimeterCases = Object.fromEntries(
  Object.entries(records).map(([key, value]) => [key, value.model]),
);

function pinned(dir, reference, relative) {
  const bytes = readFileSync(path.join(dir, relative));
  if (reference.path !== relative || reference.sha256 !== hashBytes(bytes))
    throw Error('Recorded evidence bytes differ');
  return JSON.parse(bytes);
}

export function inspectTytuvenaiPerimeterFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const record = records[proof.case];
    const source = pinned(
      dir,
      proof.primarySources,
      'reference-rights/heritage-architecture-facts.json',
    );
    const excluded = pinned(
      dir,
      proof.candidateExclusion,
      'reference-rights/story-image-exclusions.json',
    );
    const native = pinned(dir, proof.nativeIdentity, 'native-map/heritage-footprint.json');
    const facts = source.sources.find((entry) => entry.url === tytuvenaiRegistry)?.facts;
    if (
      !record ||
      source.imageryUsed !== false ||
      source.mode !== 'factual-text-only' ||
      facts.record !== record.record ||
      facts.kind !== record.kind ||
      excluded.selectedImages !== 0 ||
      excluded.candidates.length !== inventory.candidates.length ||
      inventory.candidates.some(({ path, sourceUrl, license }, i) => {
        const item = excluded.candidates[i];
        return item.path !== path || item.sourceUrl !== sourceUrl || item.license !== license;
      })
    )
      return fail('tytuvenai-perimeter-survey-unbound');

    const unique = String(record.record);
    if (
      native.identity.Unikalus_kodas !== unique ||
      frame.mappedIdentity.kpd !== record.record ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      !['x', 'y'].every((axis) =>
        native.registerBounds.some(
          (q) =>
            q.id.startsWith(unique + '-' + axis) &&
            q.codes.includes(unique) &&
            q.url.startsWith('https://www.geoportal.lt/mapproxy/kpd_kvr/MapServer/0/query?'),
        ),
      ) ||
      !native.estimatedFromNearbyMappedStructures ||
      JSON.stringify(frame.geometry.centerlines) !== JSON.stringify(controls.dimensions.lines)
    )
      return fail('tytuvenai-perimeter-location-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hashBytes(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Cultural Heritage Register locations, the construction descriptions and their relation to mapped neighboring buildings guide the placement. Wall alignments, surviving heights and fine profiles are approximate.',
    };
  } catch {
    return fail('tytuvenai-perimeter-evidence-invalid');
  }
}
