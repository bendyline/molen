/** Bujagali's entire composite dam, integral open-air powerhouse and both spillways. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`,
  safe = (d, p) =>
    typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
      ? path.join(d, p)
      : null;
export function inspectBujagaliPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, phrases] of [
      [
        'designer',
        'https://www.pietrangeli.com/bujagali-rockfill-dam-uganda-africa/',
        ['H = 30 m', 'L_crest = 560 m', 'Open-air power house inside dam body', 'No. 5 Kaplan'],
      ],
      [
        'engineer',
        'https://www.stantec.com/en/projects/united-kingdom-projects/b/bujagali-hydroelectric-power',
        [
          'two radial gates and one flap gate',
          '30-meter-tall',
          'integral intake',
          'approximately 22 meters',
        ],
      ],
      [
        'contractor',
        'https://www.webuildgroup.com/en/projects/dams-hydroelectric-plants/bujagali-hydropower-plant/',
        ['900 m long', 'siphon spillway', 'three sections of the dam in rockfill', 'February 2012'],
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
        !phrases.every((v) => b.toString().replace(/\s+/g, ' ').includes(v))
      )
        return fail('bujagali-primary-built-dam-open-air-powerhouse-account-unbound');
    }
    const p = safe(dir, proof.nativeIdentity?.path),
      b = p && fs.readFileSync(p);
    if (!b || hash(b) !== proof.nativeIdentity.sha256)
      return fail('bujagali-native-layout-unbound');
    const n = JSON.parse(b),
      r = n.elements.find((e) => e.type === 'relation' && e.id === 9845511),
      plant = n.elements.find((e) => e.type === 'way' && e.id === 377974430),
      ws = new Map(n.elements.filter((e) => e.type === 'way').map((e) => [e.id, e])),
      ns = new Map(n.elements.filter((e) => e.type === 'node').map((e) => [e.id, e]));
    if (
      r?.tags.waterway !== 'dam' ||
      r.members.length !== 10 ||
      plant?.tags.wikidata !== 'Q4986717' ||
      f.mappedIdentity?.wikidataId !== 'Q4986717' ||
      P.model !== 'bujagali_hydroelectric_power_station' ||
      P.wholeScope !== 'whole-composite-dam-integral-open-air-powerhouse-and-both-spillways' ||
      P.nativeDamRing?.length !== 49 ||
      P.nativeCrest?.length !== 11 ||
      P.nativePowerhouseRing?.length !== 4 ||
      P.dam?.nominalHeight !== 30 ||
      P.powerhouse?.units !== 5 ||
      P.powerhouse?.roof !== 'open-air' ||
      P.spillway?.radialGates !== 2 ||
      P.spillway?.flapGates !== 1 ||
      P.rockfill?.sections.length !== 3 ||
      P.estimatedFunctionalPartitionsAndSections !== true
    )
      return fail('bujagali-whole-dam-or-open-air-census-disagrees');
    const rad = Math.PI / 180,
      R = 6378137,
      co = Math.cos(f.anchor[1] * rad),
      toLocal = (id) => {
        const n = ns.get(id);
        return [
          (n.lon - f.anchor[0]) * R * rad * co,
          -R * (Math.asinh(Math.tan(n.lat * rad)) - Math.asinh(Math.tan(f.anchor[1] * rad))) * co,
        ];
      },
      same = (a, b) =>
        a.length === b.length && a.every((p, i) => p.every((v, k) => Math.abs(v - b[i][k]) < 1e-7));
    if (
      !same(P.nativeDamRing, f.geometry.polygons[0]) ||
      !same(P.nativePowerhouseRing, plant.nodes.slice(0, -1).map(toLocal)) ||
      !same(P.nativeCrest, f.geometry.centerlines[0]) ||
      !same(P.nativeWeir, f.geometry.centerlines[1])
    )
      return fail('bujagali-original-layout-controls-changed');
    for (const m of r.members)
      if (
        !ws
          .get(m.ref)
          .nodes.every((id) =>
            P.nativeDamRing.some((p) => p.every((v, k) => Math.abs(v - toLocal(id)[k]) < 1e-7)),
          )
      )
        return fail('bujagali-whole-dam-member-omitted');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Entire original49control dam/11control connected crest/fourcontrol narrow integral plant/twocontrolweir bind whole composite physical scope. Primary construction accounts specify30m composite dam/three earthfill sections/open-air five-unit powerhouse/intake/two radial andoneflap gate/main and siphon spillways. Native upperworks/plant edge roles, functional sections, slopes/floors/census/finish/grades explicitly estimated; original provider field preserved, no generic shed/photographic/survey fidelity claim.',
    };
  } catch {
    return fail('bujagali-factual-evidence-invalid');
  }
}
