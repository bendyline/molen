/** The full control building is an independent member, never an observatory proxy. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`,
  safe = (d, p) =>
    typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
      ? path.join(d, p)
      : null;
export function inspectMroControlPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, terms] of [
      [
        'system',
        'https://arxiv.org/abs/2102.01870',
        [
          'Original ASKAPsystemdescription2021',
          'dual-shielded',
          '160dB',
          'Abeywickrema2013',
          'All photographs/figures/plans unused',
        ],
      ],
      [
        'owner',
        'https://research.csiro.au/mro/wp-content/uploads/sites/453/2022/06/MRO-Booklet-May-2022.pdf',
        [
          'CSIRO original2022',
          'chillers',
          'airlockstylepairedmassivesteeldoors',
          'workshops',
          'No photos/maps/plans/diagrams used',
        ],
      ],
    ]) {
      const s = proof.primarySources?.find((s) => s.key === key),
        p = safe(dir, s?.path),
        b = p && fs.readFileSync(p);
      if (
        !b ||
        s.url !== url ||
        s.use !== 'factual-text-only' ||
        hash(b) !== s.sha256 ||
        !terms.every((t) => b.toString().includes(t))
      )
        return fail('mro-control-primary-written-construction-facts-unbound');
    }
    const n = proof.nativeIdentity,
      p = safe(dir, n?.path),
      b = p && fs.readFileSync(p);
    if (!b || hash(b) !== n.sha256 || n.featureId !== 'way/307391927')
      return fail('mro-control-original-numeric-whole-building-unbound');
    const data = JSON.parse(b),
      w = data.feature;
    if (
      w.id !== '307391927' ||
      w.type !== 'way' ||
      w.tags.name !== 'MRO Control Building' ||
      w.coordinates.length !== 5 ||
      P.model !== 'murchison_control_building' ||
      P.parentModelIdentity !== 'murchison_radio_astronomy_observatory' ||
      P.wholeScope !==
        'whole-independent-original-MRO-control-building-way307391927-fourcorners-2013' ||
      P.nativeRing.length !== 4 ||
      P.building.storeys !== 1 ||
      P.building.closedPairedSteelAirlock !== true ||
      P.building.estimatedExternalForm !== true ||
      P.estimatedPlanUncertaintyMeters < 2 ||
      P.estimatedHeightUncertaintyMeters < 2
    )
      return fail('mro-control-whole-independent-building-scope-or-estimates-disagree');
    const r = w.coordinates.slice(0, -1),
      anchor = [0, 1].map((k) => r.reduce((s, p) => s + p[k] / r.length, 0)),
      R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(anchor[1] * rad),
      c = Math.cos(f.heading),
      s = Math.sin(f.heading);
    if (anchor.some((v, i) => Math.abs(v - f.anchor[i]) > 1e-10))
      return fail('mro-control-building-moved-to-observatory-centroid');
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
        return fail('mro-control-full-original-fourcorners-changed');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole independentnamedcontrolbuilding/fulloriginalfourcornerplan, primarywrittenCSIROshielding/steelairlock/workshop/chillerfacts, allimageryunused. Externalroof/height/door/plant/finish/grade estimates explicit. Parentobservatory remainsunfinished untilallrequiredphysicalparts complete; no centroid/composite/onebuildingproxy.',
    };
  } catch {
    return fail('mro-control-factual-evidence-unreadable');
  }
}
