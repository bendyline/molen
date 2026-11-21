import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const normantonCase = 'normanton-heritage-two-roofs-and-exercise-walls';
export const normantonModel = 'normanton_gaol';
const register = 'https://qhr.detsi.qld.gov.au/asset/?slug=qld-601501-normanton-gao-eb543d';
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export function inspectNormantonFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  function read(record, expected) {
    if (record.path !== expected) throw Error('Unexpected evidence path');
    const bytes = fs.readFileSync(path.join(dir, expected));
    if (hash(bytes) !== record.sha256) throw Error('Changed evidence');
    return JSON.parse(bytes);
  }
  try {
    const source = read(
      proof.primarySources,
      'reference-rights/normanton-gaol-architectural-facts.json',
    );
    const exclusion = read(
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const map = read(proof.nativeIdentity, 'native-map/roof-outlines-and-heritage-site.json');
    const facts = source.sources.find((s) => s.url === register)?.facts;
    const dimensions = controls.dimensions;
    const reasons = new Map(exclusion.candidates.map((r) => [r.sourceUrl, r.reason]));
    if (
      source.mode !== 'factual-text-only' ||
      source.imageryUsed !== false ||
      proof.primarySources.use !== source.mode ||
      exclusion.selectedImages !== 0 ||
      !inventory.candidates.every((r) => reasons.get(r.sourceUrl)?.trim()) ||
      facts?.placeId !== 601501 ||
      facts.yardWallMeters !== 3.5 ||
      facts.storeys !== 1 ||
      facts.coreRoof !== 'hipped-skillion' ||
      facts.laterRoof !== 'pitched' ||
      facts.quartersRoof !== 'hipped-with-covered-porch' ||
      facts.coreFinials !== 2 ||
      facts.laterFinials !== 3 ||
      facts.quartersRooms !== 2 ||
      dimensions.wallsMeters !== facts.yardWallMeters ||
      dimensions.coreFinials !== facts.coreFinials ||
      dimensions.additionFinials !== facts.laterFinials ||
      dimensions.quartersRooms !== facts.quartersRooms
    )
      return fail('normanton-architectural-facts-or-image-exclusions-unbound');
    const [lon, lat] = frame.anchor,
      m = (Math.PI * 6378137) / 180;
    const sx = m * Math.cos((lat * Math.PI) / 180);
    if (
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      frame.heading !== 0 ||
      frame.mappedIdentity.qhr !== 601501 ||
      map.parcel.properties.place_id !== 601501 ||
      !map.named.some(
        (f) =>
          f.id === 65965 &&
          f.properties.name === 'Normanton Gaol' &&
          f.geometry.coordinates[0] === lon &&
          f.geometry.coordinates[1] === lat,
      ) ||
      map.outlines.length !== 2 ||
      frame.geometry.polygons.length !== 2 ||
      dimensions.polygons.length !== 2 ||
      ![805884, 1290].every((id, i) => {
        const roof = map.outlines[i];
        const vertices = roof.geometry.coordinates[0].slice(0, -1);
        const points = frame.geometry.polygons[i];
        return (
          roof.id === id &&
          frame.features[i].id === `qra/${id}` &&
          vertices.length === 4 &&
          points.length === 4 &&
          vertices.every(
            ([x, y], j) =>
              Math.hypot(points[j][0] - (x - lon) * sx, points[j][1] - (lat - y) * m) < 0.001 &&
              points[j][0] === dimensions.polygons[i][j][0] &&
              points[j][1] === dimensions.polygons[i][j][1],
          )
        );
      })
    )
      return fail('normanton-roof-outlines-or-registered-site-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The two Queensland roof polygons and named site fix the two standing volumes. The register distinguishes roofs, enclosed exercise yards, and the timber quarters. Unmeasured divisions and elevations are estimates.',
    };
  } catch {
    return fail('normanton-primary-facts-invalid');
  }
}
