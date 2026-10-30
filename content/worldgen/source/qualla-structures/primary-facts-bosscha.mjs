/** Complete main Zeiss dome building, independent of its surrounding institution. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (dir, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(dir, p)
    : null;
export function inspectBosschaPrimaryFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const source = proof.primarySource,
      p = safe(dir, source?.path),
      bytes = p && fs.readFileSync(p);
    if (
      !bytes ||
      source.url !== 'https://bosscha.itb.ac.id/id/tentang/instrumen/' ||
      source.use !== 'factual-text-only' ||
      hash(bytes) !== source.sha256 ||
      ![
        'Kubah gedung memiliki bobot 56 ton',
        'diameter 14,5 m',
        'baja setebal 2 mm',
        'teleskop Ganda Zeiss',
      ].every((s) => bytes.toString().replace(/\s+/g, ' ').includes(s))
    )
      return fail('bosscha-primary-dome-description-unbound');
    const np = safe(dir, proof.nativeIdentity?.path),
      nb = np && fs.readFileSync(np);
    if (!nb || hash(nb) !== proof.nativeIdentity.sha256)
      return fail('bosscha-native-outline-unbound');
    const n = JSON.parse(nb),
      w = n.elements.find((n) => n.type === 'way' && n.id === 183137134),
      nodes = new Map(n.elements.filter((n) => n.type === 'node').map((n) => [n.id, n])),
      points = frame.geometry?.polygons?.[0];
    if (
      w?.tags.wikidata !== 'Q126583' ||
      w?.tags.man_made !== 'observatory' ||
      frame.mappedIdentity?.wikidataId !== 'Q126583' ||
      points?.length !== 19 ||
      controls.nativeBaseRing?.length !== 19 ||
      controls.model !== 'bosscha_zeiss_dome' ||
      controls.wholeScope !== 'whole-main-zeiss-dome-building-and-intrinsic-base' ||
      controls.dome?.diameter !== 14.5 ||
      controls.dome?.sheetThicknessMeters !== 0.002 ||
      controls.dome?.pose !== 'closed-static' ||
      !controls.estimatedVerticalSections
    )
      return fail('bosscha-full-building-scope-or-dome-metrics-disagree');
    const R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(frame.anchor[1] * rad);
    for (let i = 0; i < 19; i++) {
      const n = nodes.get(w.nodes[i]),
        p = points[i],
        q = controls.nativeBaseRing[i];
      if (
        !n ||
        Math.abs(p[0] - (n.lon - frame.anchor[0]) * R * rad * co) > 1e-7 ||
        Math.abs(
          p[1] +
            R *
              (Math.asinh(Math.tan(n.lat * rad)) - Math.asinh(Math.tan(frame.anchor[1] * rad))) *
              co,
        ) > 1e-7 ||
        q.some((v, k) => Math.abs(v - p[k]) > 1e-9)
      )
        return fail('bosscha-original-horizontal-controls-changed');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Whole native circular main building and owner14.5m/2mmsteel Zeiss dome verified. Full building/base retained; wall height, dome profile, shutter/entry/window geometry and finishes are explicit estimates. Other separate campus buildings excluded, no campus proxy or photographic approval claimed.',
    };
  } catch {
    return fail('bosscha-factual-evidence-invalid');
  }
}
