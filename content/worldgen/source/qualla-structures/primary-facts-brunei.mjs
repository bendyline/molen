/** Whole customs-house exterior, primary renovation description, native two-storey plan. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`,
  safe = (d, p) =>
    typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
      ? path.join(d, p)
      : null;
export function inspectBruneiPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, phrases] of [
      [
        'designer',
        'https://www.hiasdesign.com/portfolio/galeri-seni-brunei/',
        [
          'Hias Design Interiors',
          'flat roof',
          'box form',
          'louvres',
          'H.H. Custom House',
          'HTTP404',
        ],
      ],
      [
        'partner',
        'https://www.bsp.com.bn/main/index/view/4',
        ['Royal Customs and Excise heritage building', '23October2022'],
      ],
      [
        'qualla-story',
        'https://qualla.com/brunei-energy-hub/',
        ['central vehicle passage/tunnel', 'genuine open passage', 'only written story content'],
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
        !phrases.every((v) =>
          b.toString().replace(/\s+/g, ' ').toLowerCase().includes(v.toLowerCase()),
        )
      )
        return fail('brunei-whole-building-construction-and-passage-facts-unbound');
    }
    const p = safe(dir, proof.nativeIdentity?.path),
      b = p && fs.readFileSync(p),
      ip = safe(dir, proof.nativeIdentity?.identityPath),
      ib = ip && fs.readFileSync(ip);
    if (
      !b ||
      !ib ||
      hash(b) !== proof.nativeIdentity.sha256 ||
      hash(ib) !== proof.nativeIdentity.identityHash
    )
      return fail('brunei-native-plan-or-independent-identity-unbound');
    const n = JSON.parse(b),
      w = n.elements.find((e) => e.type === 'way' && e.id === 508067587),
      ns = new Map(n.elements.filter((e) => e.type === 'node').map((e) => [e.id, e])),
      qid = Object.values(JSON.parse(ib).query.pages)[0].pageprops.wikibase_item;
    if (
      qid !== 'Q115946015' ||
      w?.tags['building:levels'] !== '2' ||
      w.nodes.length !== 5 ||
      f.mappedIdentity?.wikidataId !== qid ||
      P.model !== 'brunei_energy_hub' ||
      P.wholeScope !==
        'whole-former-customs-two-storey-museum-building-and-central-through-passage' ||
      P.building?.storeys !== 2 ||
      P.building.roof !== 'flat' ||
      P.passage?.kind !== 'open-through-lower-storey' ||
      P.passage.fullBuildingDepth !== true ||
      P.signs?.replicaExterior !== true ||
      P.nativeBuildingRing?.length !== 4
    )
      return fail('brunei-whole-physical-building-and-open-passage-disagree');
    const R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(f.anchor[1] * rad);
    for (let i = 0; i < 4; i++) {
      const n = ns.get(w.nodes[i]),
        p = [
          (n.lon - f.anchor[0]) * R * rad * co,
          -R * (Math.asinh(Math.tan(n.lat * rad)) - Math.asinh(Math.tan(f.anchor[1] * rad))) * co,
        ];
      if (
        !p.every(
          (v, k) =>
            Math.abs(v - P.nativeBuildingRing[i][k]) < 1e-7 &&
            Math.abs(v - f.geometry.polygons[0][i][k]) < 1e-7,
        )
      )
        return fail('brunei-original-native-whole-outline-changed');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Whole native four-control/two-storey waterfront customs building, separately bound institutionalQ115946015identity and renovation-designer flatbox/louvres/signage/replica facts. User-owned Qualla passage description requires a true full-depth opening. Original native94.43m outline retained, not rounded wharf dimensions; heights/divisions/bay census/fittings/finish/grade explicit estimates. All imagery unused; original designerURL404 and cached-text provenance disclosed. No surveyed/photographic/current replacement claim.',
    };
  } catch {
    return fail('brunei-factual-evidence-invalid');
  }
}
