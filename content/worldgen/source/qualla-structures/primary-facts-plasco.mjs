/** Whole original independent tower, from written research and original 2016 numeric controls. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (d, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(d, p)
    : null;
export function inspectPlascoPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, terms] of [
      [
        'engineering',
        'https://ira.lib.polyu.edu.hk/bitstream/10397/102349/1/1-s2.0-S2214157X23003246-main.pdf',
        [
          'section3.1/PDF6',
          '1962steel-framed',
          'almost60m',
          'cemented walls',
          'steel-brace',
          'ceramic wall panels',
          'every image unused',
        ],
      ],
      [
        'structure',
        'https://doi.org/10.1007/s10694-019-00903-y',
        [
          'Two parts structurally separated',
          'fifteen storeys above ground and one basement',
          '60mabovefoundation',
          '29.4x31.9m',
          'WHOLE independent historical tower',
          '2021replacement',
          'Every image unused',
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
        return fail('plasco-original-engineering-written-tower-facts-unbound');
    }
    const p = safe(dir, proof.nativeIdentity?.path),
      b = p && fs.readFileSync(p);
    if (!b || hash(b) !== proof.nativeIdentity.sha256)
      return fail('plasco-original-2016-tower-unbound');
    const n = JSON.parse(b);
    for (const file of [n.response, n.query]) {
      const p = safe(dir, file?.path);
      if (!p || hash(fs.readFileSync(p)) !== file.sha256)
        return fail('plasco-original-attic-response-or-query-stale');
    }
    const response = JSON.parse(fs.readFileSync(safe(dir, n.response.path))),
      query = fs.readFileSync(safe(dir, n.query.path), 'utf8'),
      w = response.elements.find((e) => e.type === 'way' && e.id === 211028571),
      nodes = new Map(response.elements.filter((e) => e.type === 'node').map((e) => [e.id, e]));
    if (
      !query.includes('[date:"2016-12-31T23:59:59Z"]') ||
      n.requestedSnapshot !== '2016-12-31T23:59:59Z' ||
      n.way?.id !== 211028571 ||
      w?.tags.name !== 'مرکز خرید پلاسکو' ||
      w.nodes.length !== 5 ||
      n.excludedReplacementWay !== 1164854772 ||
      n.excludedSeparateShoppingCentreWay !== 1029124094
    )
      return fail('plasco-wrong-phase-replacement-mall-or-incomplete-original-tower');
    if (
      P.model !== 'plasco_building' ||
      P.wholeScope !== 'whole-original-structurally-independent-plasco-tower-fourcontrol-2016' ||
      P.representedDate !== '2016-12-31' ||
      P.nativeTowerRing?.length !== 4 ||
      P.building?.aboveGroundStoreys !== 15 ||
      P.building.basements !== 1 ||
      P.building.floorBoundaries?.length !== 16 ||
      P.estimatedPlanUncertaintyMeters < 6 ||
      P.estimatedHeightUncertaintyMeters < 6 ||
      f.features?.length !== 1 ||
      f.features[0].id !== 'way/211028571'
    )
      return fail('plasco-whole-independent-tower-or-explicit-estimates-disagree');
    const R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(f.anchor[1] * rad),
      c = Math.cos(f.heading),
      s = Math.sin(f.heading);
    for (const [i, id] of w.nodes.slice(0, -1).entries()) {
      const node = nodes.get(id),
        x = (node.lon - f.anchor[0]) * R * rad * co,
        z =
          -R *
          (Math.asinh(Math.tan(node.lat * rad)) - Math.asinh(Math.tan(f.anchor[1] * rad))) *
          co,
        q = [c * x - s * z, s * x + c * z];
      if (
        q.some(
          (v, k) =>
            Math.abs(v - f.geometry.polygons[0][i][k]) > 1e-7 ||
            Math.abs(v - P.nativeTowerRing[i][k]) > 1e-7,
        )
      )
        return fail('plasco-original-four-corner-tower-moved');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole original independent tower from original2016numeric footprint and primary written fifteen-above/one-below/near60m engineering facts, cement side walls and steel-brace/ceramic/glazed north/south elevations. Every image unused. Exact height/plan discrepancy/sections/grid/finish/grade estimated; separate mall and2021replacement excluded.',
    };
  } catch {
    return fail('plasco-factual-evidence-unreadable');
  }
}
