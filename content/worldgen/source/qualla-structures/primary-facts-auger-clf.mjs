/** Bind the post2013 whole forty-foot CLF housing to its written construction and site records. */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export function inspectAugerClfPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const s = proof.primarySources?.find((s) => s.key === 'building'),
      n = proof.nativeIdentity;
    for (const p of [s?.path, n?.path])
      if (typeof p !== 'string' || path.isAbsolute(p) || p.split(/[\\/]/).includes('..'))
        return fail('auger-clf-unsafe-source');
    const text = fs.readFileSync(path.join(dir, s.path)),
      bytes = fs.readFileSync(path.join(dir, n.path)),
      site = JSON.parse(bytes);
    if (
      s.url !== 'https://pos.sissa.it/236/624/pdf' ||
      s.use !== 'factual-text-only' ||
      hash(text) !== s.sha256 ||
      ![
        'first half of2013',
        'replaced by a40ft unit',
        'Raman backscatter receiver',
        'All photographs, figures, diagrams, plans and image-derived descriptions unused',
      ].every((v) => text.toString().includes(v))
    )
      return fail('auger-clf-written-facts-unbound');
    if (
      hash(bytes) !== n.sha256 ||
      site.sourceUrl !== 'https://www.le.infn.it/~lorenzo/allow_listing/thesis_mimmo_221205.pdf' ||
      site.record.name !== 'Central Laser Facility' ||
      site.record.zone !== 19 ||
      site.record.hemisphere !== 'south' ||
      site.record.easting !== 469378 ||
      site.record.northing !== 6095769 ||
      site.coordinate.some((v, i) => Math.abs(v - f.anchor[i]) > 1e-10)
    )
      return fail('auger-clf-original-site-unbound');
    if (
      P.model !== 'auger_central_laser_shelter' ||
      P.parentModelIdentity !== 'pierre_auger_observatory' ||
      P.kind !== 'laser-container-shelter' ||
      P.nominalLengthMeters !== 12.192 ||
      P.assumedWidthMeters !== 2.438 ||
      P.assumedHeightMeters !== 2.591 ||
      P.estimatedAnchorUncertaintyMeters < 15 ||
      P.estimatedHeightUncertaintyMeters < 0.4 ||
      P.estimatedComponentUncertaintyMeters < 1.5 ||
      f.orientationControl.uncertaintyDegrees !== 180 ||
      !f.geometryLabel.includes('NOT a surveyed') ||
      JSON.stringify(P.outlineRing) !== JSON.stringify(f.geometry.polygons[0])
    )
      return fail('auger-clf-whole-container-or-estimates-disagree');
    const r = P.outlineRing;
    if (
      r.length !== 4 ||
      Math.abs(
        Math.max(...r.map((p) => p[0])) - Math.min(...r.map((p) => p[0])) - P.nominalLengthMeters,
      ) > 1e-9 ||
      Math.abs(
        Math.max(...r.map((p) => p[1])) - Math.min(...r.map((p) => p[1])) - P.assumedWidthMeters,
      ) > 1e-9
    )
      return fail('auger-clf-container-outline-disagrees');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole post2013 forty-foot housing at original published CLF site. Width/height, exact container centroid, heading and exterior service details explicit estimates; no whole-compound or observatory proxy. Every image unused.',
    };
  } catch {
    return fail('auger-clf-evidence-unreadable');
  }
}
