import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const hongKongPoliceHeadquartersCase =
  'arsenal-house-native-exterior-and-published-construction-facts';
export const hongKongPoliceHeadquartersModel = 'hong_kong_police_headquarters';

const digest = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function inspectHongKongPoliceHeadquartersFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  function readBound(record, expectedPath) {
    const bytes = readFileSync(path.join(dir, expectedPath));
    if (record.path !== expectedPath || record.sha256 !== digest(bytes))
      throw new Error('Arsenal House source evidence changed');
    return JSON.parse(bytes);
  }
  try {
    const map = readBound(proof.nativeIdentity, 'native-map/arsenal-house-footprints.json');
    const written = readBound(
      proof.primarySources,
      'reference-rights/arsenal-house-written-evidence.json',
    );
    const excluded = readBound(
      proof.candidateExclusion,
      'reference-rights/qualla-image-screening.json',
    );
    const height = written.sources.find(
      ({ url }) =>
        url === 'https://www.bachy-soletanche.com.hk/offer-portfolio/police-headquarter-phase-3/',
    )?.facts.mainTowerHeightMeters;
    const floorCount = written.sources.find(
      ({ url }) => new URL(url).hostname === 'www.archsd.gov.hk',
    )?.facts.mainTowerAboveGroundFloors;
    const rejected = new Set(
      excluded.candidates.filter(({ reason }) => reason).map(({ path }) => path),
    );
    const dimensions = controls.dimensions;
    if (
      written.imageryUsed !== false ||
      excluded.selectedImages !== 0 ||
      excluded.excludedOriginal.first.revid !== 2748578 ||
      !inventory.candidates.every(({ path }) => rejected.has(path)) ||
      height !== 206 ||
      floorCount !== 43 ||
      height !== dimensions.highBlockHeight ||
      floorCount !== dimensions.highBlockFloors
    )
      return fail('arsenal-house-written-facts-or-exclusions-unbound');
    if (
      !same(
        map.ways.map(({ id }) => id),
        [107358582, 107497686],
      ) ||
      !map.ways.every(
        ({ tags }) =>
          tags['addr:street:en'] === 'Arsenal Street' && tags['addr:housenumber'] === '1',
      ) ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      !same(frame.geometry.polygons, map.polygons) ||
      !same(dimensions.polygons, map.polygons)
    )
      return fail('arsenal-house-mapped-outlines-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: digest(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The exact map envelopes and primary construction records establish the standing height, distinctive glazed and strip-window elevations, and the adjacent low mass. Secondary envelope detail is estimated.',
    };
  } catch {
    return fail('arsenal-house-evidence-invalid');
  }
}
