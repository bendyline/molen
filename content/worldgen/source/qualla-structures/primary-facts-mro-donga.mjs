/** The entire named MWA field donga is an independent observatory member. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`,
  safe = (d, p) =>
    typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
      ? path.join(d, p)
      : null;
export function inspectMroDongaPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const source = proof.primarySources?.find((s) => s.key === 'building'),
      sp = safe(dir, source?.path),
      sb = sp && fs.readFileSync(sp);
    if (
      !sb ||
      source.url !== 'https://www.openstreetmap.org/way/629792391' ||
      source.use !== 'factual-text-only' ||
      hash(sb) !== source.sha256 ||
      ![
        'Original numeric provider record',
        'MWA Donga',
        'four unique corners',
        'are estimates',
        'All imagery unused',
      ].every((t) => sb.toString().includes(t))
    )
      return fail('mro-donga-primary-numeric-facts-unbound');
    const n = proof.nativeIdentity,
      p = safe(dir, n?.path),
      b = p && fs.readFileSync(p);
    if (!b || hash(b) !== n.sha256 || n.featureId !== 'way/629792391')
      return fail('mro-donga-original-numeric-whole-building-unbound');
    const data = JSON.parse(b),
      w = data.feature;
    if (
      w.id !== '629792391' ||
      w.type !== 'way' ||
      w.tags.name !== 'MWA Donga' ||
      w.coordinates.length !== 5 ||
      P.model !== 'murchison_widefield_array_donga' ||
      P.parentModelIdentity !== 'murchison_radio_astronomy_observatory' ||
      P.wholeScope !==
        'whole-independent-named-MWA-Donga-way629792391-fourcorners-allwalls-roof-base-entry-windows-servicebox-2013' ||
      P.nativeRing.length !== 4 ||
      P.building.storeys !== 1 ||
      P.building.closedDoor !== true ||
      P.building.closedWindows !== 4 ||
      P.building.intrinsicServiceUnit !== true ||
      P.building.estimatedExternalForm !== true ||
      P.estimatedHeightUncertaintyMeters < 1 ||
      P.estimatedComponentUncertaintyMeters < 2
    )
      return fail('mro-donga-whole-independent-building-scope-or-estimates-disagree');
    const r = w.coordinates.slice(0, -1),
      anchor = [0, 1].map((k) => r.reduce((s, p) => s + p[k] / r.length, 0)),
      R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(anchor[1] * rad),
      c = Math.cos(f.heading),
      s = Math.sin(f.heading);
    if (anchor.some((v, i) => Math.abs(v - f.anchor[i]) > 1e-10))
      return fail('mro-donga-building-moved-to-observatory-centroid');
    for (const [i, p] of r.entries()) {
      const x = (p[0] - anchor[0]) * R * rad * co,
        z = -R * (Math.asinh(Math.tan(p[1] * rad)) - Math.asinh(Math.tan(anchor[1] * rad))) * co,
        q = [c * x - s * z, s * x + c * z];
      if (
        q.some(
          (v, a) =>
            Math.abs(v - f.geometry.polygons[0][i][a]) > 1e-7 ||
            Math.abs(v - P.nativeRing[i][a]) > 1e-7,
        )
      )
        return fail('mro-donga-full-original-fourcorners-changed');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole independent named MWA Donga: original four-corner plan/name/buildingtype, all imagery unused. External height, roof, storeys, facade, service, finish,2013appearance and grade estimates explicit. Parent observatory remains unfinished; no centroid/composite/onebuildingproxy.',
    };
  } catch {
    return fail('mro-donga-factual-evidence-unreadable');
  }
}
