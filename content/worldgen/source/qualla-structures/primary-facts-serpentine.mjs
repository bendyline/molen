/** Complete Serpentine Main Dam, post2001 enlargement; no source imagery. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
export function inspectSerpentinePrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, phrases] of [
      [
        'government-plan',
        'https://www.wa.gov.au/system/files/2022-04/Serpentine-Dam-Catchment-Area-drinking-water-source-protection-plan-WRP-78.pdf',
        ['completed in 1961', 'height of 55 m', 'crest length of 424 m'],
      ],
      [
        'heritage',
        'https://inherit.dplh.wa.gov.au/public/inventory/details/5ae48559-72e4-4829-b1fa-819c7ed62bda',
        [
          'rolled earth dam with a spillway, and control tower',
          '2001/2002',
          'tainter gates were demolished',
          'spillway was enlarged',
        ],
      ],
    ]) {
      const s = proof.primarySources?.find((s) => s.key === key);
      if (
        !s ||
        s.url !== url ||
        s.use !== 'factual-text-only' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..')
      )
        return fail('serpentine-primary-source-invalid');
      const b = fs.readFileSync(path.join(dir, s.path));
      if (
        hash(b) !== s.sha256 ||
        !phrases.every((p) => b.toString().replace(/\s+/g, ' ').includes(p))
      )
        return fail('serpentine-primary-dimensions-and-upgrade-unbound');
    }
    const p = proof.nativeIdentity?.path;
    if (!p || path.isAbsolute(p) || p.split(/[\\/]/).includes('..'))
      return fail('serpentine-native-path-invalid');
    const b = fs.readFileSync(path.join(dir, p));
    if (hash(b) !== proof.nativeIdentity.sha256) return fail('serpentine-native-bytes-unbound');
    const n = JSON.parse(b),
      ws = new Map(n.elements.filter((e) => e.type === 'way').map((e) => [e.id, e])),
      ns = new Map(n.elements.filter((e) => e.type === 'node').map((e) => [e.id, e])),
      dam = ws.get(226236601),
      road = ws.get(1422670539),
      bridge = ws.get(591908393),
      canal = ws.get(591908394),
      conduit = ws.get(591908391);
    if (
      dam?.tags.wikidata !== 'Q7455118' ||
      f.mappedIdentity?.wikidataId !== 'Q7455118' ||
      P.model !== 'serpentine_dam_western_australia' ||
      P.wholeScope !==
        'whole-main-earthfill-dam-crest-bridge-enlarged-spillway-and-control-conduit' ||
      P.dam?.height !== 55 ||
      P.dam.publishedCrestLength !== 424 ||
      P.canal?.ungatedPost2001 !== true ||
      P.representedDate !== '2007-01-01' ||
      P.tower?.registration !== 'inferred-upstream-conduit-endpoint' ||
      road.nodes.at(-1) !== bridge.nodes[0]
    )
      return fail('serpentine-whole-main-dam-scope-disagrees');
    const R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(f.anchor[1] * rad),
      local = (id) => {
        const q = ns.get(id);
        return [
          (q.lon - f.anchor[0]) * R * rad * co,
          -R * (Math.asinh(Math.tan(q.lat * rad)) - Math.asinh(Math.tan(f.anchor[1] * rad))) * co,
        ];
      },
      same = (a, b) =>
        a.length === b.length && a.every((p, i) => p.every((v, k) => Math.abs(v - b[i][k]) < 1e-7));
    for (const [original, controls, framed, count] of [
      [dam.nodes.slice(0, -1), P.nativeDamRing, f.geometry.polygons[0], 23],
      [[...road.nodes, ...bridge.nodes.slice(1)], P.nativeCrest, f.geometry.centerlines[0], 5],
      [canal.nodes, P.nativeCanal, f.geometry.centerlines[1], 10],
      [conduit.nodes, P.nativeConduit, f.geometry.centerlines[2], 2],
    ])
      if (
        controls?.length !== count ||
        !same(controls, original.map(local)) ||
        !same(controls, framed)
      )
        return fail('serpentine-original-whole-native-control-changed');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Exact whole23control main dam/fivecontrol crest/tencontrol enlarged canal/twocontrol conduit; primary government55m/424m/1961 and heritage post2001demolition/enlargement facts. Tower presence documented; inferred registration/form/sections, channel/abutment/floors/finish/grade explicitly estimated. Original field unchanged; no imagery, survey or current replacement claim.',
    };
  } catch {
    return fail('serpentine-factual-evidence-invalid');
  }
}
