/** Exact ACT enclosure and primary instrument/optical-design numerical facts. No imagery. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (d, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(d, p)
    : null;
export function inspectActPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, phrases] of [
      [
        'instrument',
        'https://ntrs.nasa.gov/api/citations/20120002550/downloads/20120002550.pdf',
        ['Ground screen height', '12 m', '13 m', '71', 'receiver cabin', '3.3 meters'],
      ],
      [
        'optical-design',
        'https://arxiv.org/pdf/astro-ph/0701020',
        ['0.940935', '6.6625', '2.4938', '0.322366', '1.020', '0.905', 'ground screen'],
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
          b
            .toString()
            .replace(/(\d)\s*\.\s*(\d)/g, '$1.$2')
            .replace(/\s+/g, ' ')
            .includes(v),
        )
      )
        return fail('act-written-instrument-and-optics-source-unbound');
    }
    const p = safe(dir, proof.nativeIdentity?.path),
      b = p && fs.readFileSync(p);
    if (!b || hash(b) !== proof.nativeIdentity.sha256)
      return fail('act-native-whole-enclosure-unbound');
    const n = JSON.parse(b),
      w = n.elements.find((e) => e.type === 'way' && e.id === 88742220),
      ns = new Map(n.elements.filter((e) => e.type === 'node').map((e) => [e.id, e])),
      ring = f.geometry?.polygons?.[0];
    if (
      w?.tags.wikidata !== 'Q753067' ||
      f.mappedIdentity?.wikidataId !== 'Q753067' ||
      ring?.length !== 8 ||
      P.nativeScreenRing?.length !== 8 ||
      P.model !== 'atacama_cosmology_telescope' ||
      P.wholeScope !== 'whole-off-axis-gregorian-instrument-and-two-ground-screens' ||
      P.screen?.height !== 13 ||
      P.instrument?.height !== 12 ||
      P.optics?.primary?.apertureA !== 3 ||
      P.optics?.primary?.apertureB !== 3 ||
      P.optics?.primary?.R !== -10 ||
      P.optics?.primary?.K !== -0.940935 ||
      P.optics?.secondary?.vertex !== -6.6625 ||
      P.optics?.secondary?.R !== 2.4938 ||
      P.optics?.secondary?.K !== -0.322366 ||
      P.optics?.secondary?.apertureA !== 1.02 ||
      P.optics?.secondary?.apertureB !== 0.905 ||
      P.receiverCabin?.width !== 3.3 ||
      P.estimatedAssemblyPoseAndSections !== true
    )
      return fail('act-whole-instrument-screens-or-source-numeric-controls-disagree');
    const rad = Math.PI / 180,
      R = 6378137,
      co = Math.cos(f.anchor[1] * rad);
    for (let i = 0; i < 8; i++) {
      const n = ns.get(w.nodes[i]),
        q = ring[i];
      if (
        !n ||
        Math.abs(q[0] - (n.lon - f.anchor[0]) * R * rad * co) > 1e-7 ||
        Math.abs(
          q[1] +
            R * (Math.asinh(Math.tan(n.lat * rad)) - Math.asinh(Math.tan(f.anchor[1] * rad))) * co,
        ) > 1e-7 ||
        P.nativeScreenRing[i].some((v, k) => Math.abs(v - q[k]) > 1e-9)
      )
        return fail('act-original-native-controls-changed');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Whole original eight-control ACT enclosure and complete12m Gregorian instrument/13m outer screen/inner moving screen/receiver cabin bound to primary instrument and optical-design facts, including exact Table2conic parameters. Native screen-edge interpretation, vertical profiles, assembly/bearing/pose, supports and finishes explicitly estimated; no source figures/photos or optical/survey/photographic fidelity claimed.',
    };
  } catch {
    return fail('act-factual-evidence-invalid');
  }
}
