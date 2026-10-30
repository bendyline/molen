/** Whole historic dwelling; official facts and explicitly transmitted heritage description. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (d, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(d, p)
    : null;
export function inspectXumaPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, phrases] of [
      [
        'tourism',
        [
          'SouthAfricanTourism',
          'single-storey',
          'red brick',
          'corrugated tin roof',
          'separate wing',
          'DirectHTTPfetch failed',
        ],
      ],
      [
        'heritage-transmission',
        [
          'Flo Bird',
          'original report was not retrieved',
          'L-shaped',
          'curved front bay windows',
          'arched entrance',
          'plain columns',
          'stretcherbond',
          'plaster above',
          'across the whole front',
        ],
      ],
    ]) {
      const s = proof.primarySources?.find((s) => s.key === key),
        p = safe(dir, s?.path),
        b = p && fs.readFileSync(p);
      if (
        !b ||
        s.use !== 'factual-text-only' ||
        hash(b) !== s.sha256 ||
        !phrases.every((v) =>
          b.toString().replace(/\s+/g, ' ').toLowerCase().includes(v.toLowerCase()),
        )
      )
        return fail('xuma-official-or-transmitted-architecture-unbound');
    }
    const n = proof.nativeIdentity,
      p = safe(dir, n?.path),
      b = p && fs.readFileSync(p),
      ip = safe(dir, n?.identityPath),
      ib = ip && fs.readFileSync(ip);
    if (!b || !ib || hash(b) !== n.sha256 || hash(ib) !== n.identityHash)
      return fail('xuma-native-frontage-or-published-house-identity-unbound');
    const data = JSON.parse(b),
      qid = Object.values(JSON.parse(ib).query.pages)[0].pageprops.wikibase_item;
    if (
      qid !== 'Q20981521' ||
      f.mappedIdentity?.wikidataId !== qid ||
      n.buildingFootprintAvailable !== false ||
      n.frontageControlsOnly !== true ||
      P.model !== 'dr_xuma_house' ||
      P.wholeScope !==
        'whole-original-single-storey-l-house-and-full-corrugated-roofs-bays-stoep-canopy' ||
      P.house?.storeys !== 1 ||
      P.house.plan !== 'L' ||
      P.house.estimatedWholePlan !== true ||
      P.house.roofMaterial !== 'corrugated-tin' ||
      P.canopy?.separateFullFrontCovering !== true ||
      f.geometry.polygons?.length ||
      P.estimatedPlanUncertaintyFraction < 0.2
    )
      return fail('xuma-honest-whole-historic-house-scope-disagrees');
    if (f.anchor.some((v, i) => v !== n.housePoint[i]))
      return fail('xuma-published-house-point-changed');
    const ns = new Map(data.elements.filter((e) => e.type === 'node').map((e) => [e.id, e])),
      R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(f.anchor[1] * rad),
      c = Math.cos(f.heading),
      s = Math.sin(f.heading);
    for (let j = 0; j < 2; j++) {
      const w = data.elements.find((e) => e.type === 'way' && e.id === [23056922, 23056909][j]);
      for (let i = 0; i < 2; i++) {
        const id = data.selectedFrontageNodeIds[j][i],
          node = ns.get(id);
        if (!w?.nodes.includes(id) || !node) return fail('xuma-original-street-control-missing');
        const x = (node.lon - f.anchor[0]) * R * rad * co,
          z =
            -R *
            (Math.asinh(Math.tan(node.lat * rad)) - Math.asinh(Math.tan(f.anchor[1] * rad))) *
            co,
          local = [c * x - s * z, s * x + c * z];
        if (local.some((v, k) => Math.abs(v - f.geometry.centerlines[j][i][k]) > 1e-7))
          return fail('xuma-original-frontage-controls-changed');
      }
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Complete original1935Empilweni single-storey residence/consulting-wing dwelling with completeLroof, curvedbays, plain-column arch, brick/plaster and full bracketed canopy. Official tourism construction facts plus explicitly transmitted FloBird1991 architecture; original1991report not retrieved. Published housepoint and real adjacent street axes only, no native house footprint. Wholeplan/sections/roofprofile/detail/finish/grade estimated with20percent plan uncertainty; no detached2015centre/campus proxy, imagery, survey or photographic claim.',
    };
  } catch {
    return fail('xuma-factual-evidence-invalid');
  }
}
