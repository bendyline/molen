import { readFileSync } from 'node:fs';
import path from 'node:path';
import { hashBytes } from '../../../../packages/worldgen/scripts/structure-model-files.mjs';
import { tytuvenaiRegistry } from './primary-facts-tytuvenai-monastery.mjs';

const records = {
  'tytuvenai-registered-granary': {
    model: 'tytuvenai_monastery_granary',
    record: 31628,
    cadastralId: 283021,
    queryIds: ['pair-west'],
    length: 20.2,
    width: 9.86,
    storeys: 2,
    roof: 'half-hipped',
  },
  'tytuvenai-registered-servants-house': {
    model: 'tytuvenai_monastery_servants_house',
    record: 31629,
    cadastralId: 283021,
    queryIds: ['pair-east'],
    length: 24.17,
    width: 9.86,
    storeys: 1,
    roof: 'gable',
  },
  'tytuvenai-registered-first-livestock-barn': {
    model: 'tytuvenai_monastery_first_livestock_barn',
    record: 31630,
    cadastralId: 1667770,
    queryIds: ['x6', 'y6'],
    length: 49,
    width: 10.4,
    storeys: 1,
    roof: 'gable',
  },
  'tytuvenai-registered-second-livestock-barn': {
    model: 'tytuvenai_monastery_second_livestock_barn',
    record: 31631,
    cadastralId: 1667770,
    queryIds: ['x7', 'y5'],
    length: 36.6,
    width: 10.4,
    storeys: 1,
    roof: 'gable',
  },
};

export const tytuvenaiOutbuildingCases = Object.fromEntries(
  Object.entries(records).map(([key, value]) => [key, value.model]),
);

function pinned(dir, reference, relative) {
  const bytes = readFileSync(path.join(dir, relative));
  if (reference.path !== relative || reference.sha256 !== hashBytes(bytes))
    throw Error('Recorded evidence bytes differ');
  return JSON.parse(bytes);
}

function outlineMatches(frame, points, outline) {
  const [lon, lat] = frame.anchor;
  const rad = Math.PI / 180;
  const scale = 6378137 * Math.cos(lat * rad);
  const mercator = (latitude) => Math.asinh(Math.tan(latitude * rad));
  const c = Math.cos(frame.heading);
  const s = Math.sin(frame.heading);
  return (
    points.length === outline.length &&
    points.every(([longitude, latitude], i) => {
      const x = scale * rad * (longitude - lon);
      const z = -scale * (mercator(latitude) - mercator(lat));
      const [localX, localZ] = outline[i];
      return Math.hypot(c * x - s * z - localX, s * x + c * z - localZ) < 0.001;
    })
  );
}

export function inspectTytuvenaiOutbuildingFacts({ dir, proof, controls, frame, inventory }) {
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
      source.mode !== 'factual-text-only' ||
      source.imageryUsed !== false ||
      facts.record !== record.record ||
      facts.lengthMeters !== record.length ||
      facts.widthMeters !== record.width ||
      facts.storeys !== record.storeys ||
      facts.roof !== record.roof ||
      excluded.selectedImages !== 0 ||
      excluded.candidates.length !== inventory.candidates.length ||
      inventory.candidates.some(({ path, sourceUrl, license }, i) => {
        const item = excluded.candidates[i];
        return item.path !== path || item.sourceUrl !== sourceUrl || item.license !== license;
      })
    )
      return fail('tytuvenai-outbuilding-survey-unbound');

    if (
      native.cadastralFeature.attributes.OBJECTID !== record.cadastralId ||
      !record.queryIds.every((id) =>
        native.registerBounds.some(
          (query) =>
            query.id === id &&
            query.codes.includes(String(record.record)) &&
            query.url.startsWith('https://www.geoportal.lt/mapproxy/kpd_kvr/MapServer/0/query?'),
        ),
      ) ||
      frame.mappedIdentity.kpd !== record.record ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      JSON.stringify(frame.geometry.outline) !== JSON.stringify(controls.dimensions.outline) ||
      !outlineMatches(frame, native.memberLongitudeLatitude, frame.geometry.outline)
    )
      return fail('tytuvenai-outbuilding-footprint-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hashBytes(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The register establishes the specific exterior and its scale. The named spatial record identifies its position within the joined footprint. Roof transitions, openings and surviving finishes are estimated.',
    };
  } catch {
    return fail('tytuvenai-outbuilding-evidence-invalid');
  }
}
