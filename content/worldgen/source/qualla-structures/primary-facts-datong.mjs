/** Original numeric outline with an openly estimated exhibition-building correspondence. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export function inspectDatongPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const source = (key) => {
      const s = proof.primarySources.find((s) => s.key === key);
      if (!s || path.isAbsolute(s.path) || s.path.split(/[\\/]/).includes('..'))
        throw Error('unsafe');
      const b = fs.readFileSync(path.join(dir, s.path));
      if (hash(b) !== s.sha256) throw Error('changed');
      return JSON.parse(b);
    };
    const r = source('numerical'),
      location = source('location'),
      written = source('written');
    if (
      r.id !== '52ec1fd1-44a2-4af2-8bac-4b98f9e8c039' ||
      r.height !== null ||
      r.num_floors !== null ||
      !r.sources.some((s) => s.dataset === 'doi:10.5281/zenodo.8174931') ||
      location.locationComparison.source !== 'https://www.amap.com/place/B0JU3D6WCA' ||
      location.locationComparison.nearest[0].id !== r.id ||
      Math.abs(
        location.locationComparison.nearest[0]
          .approximateDistanceFromExhibitionPointToOutlineMeters - 4.583848791361591,
      ) > 0.001 ||
      !written.firstPartyWrittenFacts.some((s) => s.facts.exteriorColor === 'grey-white')
    )
      return fail('datong-original-location-facts-unbound');
    if (
      P.model !== 'datong_mass_grave_memorial' ||
      P.kind !== 'probable-exhibition-building-original-outline-reconstruction' ||
      P.memorialIdentityVerified !== false ||
      P.physicalAssociationEstimated !== true ||
      P.nativeOutlineUnchanged !== true ||
      P.heightMeasured !== false ||
      P.storeysMeasured !== false ||
      P.footprintMeasured !== false ||
      P.allowancesAreMeasuredErrorBounds !== false ||
      !proof.estimates.some((s) => s.includes('unverified')) ||
      !proof.estimates.some((s) => s.includes('original estimates')) ||
      f.identityStatus !== 'probable-exhibition-building-correspondence-explicitly-unverified'
    )
      return fail('datong-estimate-disclosure-missing');
    const b = Buffer.from(r.geometry_wkb, 'hex'),
      n = b.readUInt32LE(9),
      ring = Array.from({ length: n - 1 }, (_, i) => [
        b.readDoubleLE(13 + i * 16),
        b.readDoubleLE(21 + i * 16),
      ]),
      D = (6378137 * Math.PI) / 180,
      co = Math.cos((f.anchor[1] * Math.PI) / 180);
    if (
      ring.length !== 4 ||
      ring.some(
        (p, i) =>
          Math.abs((p[0] - f.anchor[0]) * D * co - P.nativeRing[i][0]) > 1e-6 ||
          Math.abs(-(p[1] - f.anchor[1]) * D - P.nativeRing[i][1]) > 1e-6,
      )
    )
      return fail('datong-original-roof-outline-changed');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Unchanged original four-corner numerical roof, published exhibition POI4.58m outside south edge and first-party grey-white exterior fact. Building correspondence is probable and explicitly unverified. All heights, roof/facade details and precise era are original estimates; all appearance imagery unused. Whole grounds and underground galleries are not represented by a fabricated aggregate building.',
    };
  } catch {
    return fail('datong-original-facts-unreadable');
  }
}
