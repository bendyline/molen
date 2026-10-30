/** Whole Colombo hall from native plan and the traceably transmitted designer account. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (dir, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(dir, p)
    : null;
export function inspectIndependencePrimaryFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, phrases] of [
      [
        'official',
        'https://srilanka.travel/attraction?attraction_id=202',
        ['Audience Hall (Magul Maduwa)', 'statues of lions'],
      ],
      [
        'designer-account',
        'https://www.sundaytimes.lk/180204/plus/monument-to-freedom-279357.html',
        [
          'four corner towers and 48 pillars',
          'two-pitched Kandyan roof',
          '28 vertical panels',
          'three tiers',
          'precast concrete',
        ],
      ],
    ]) {
      const source = proof.primarySources?.find((s) => s.key === key),
        p = safe(dir, source?.path),
        b = p && fs.readFileSync(p);
      if (
        !b ||
        source.url !== url ||
        source.use !== 'factual-text-only' ||
        hash(b) !== source.sha256 ||
        !phrases.every((s) => b.toString().replace(/\s+/g, ' ').includes(s))
      )
        return fail('independence-written-construction-account-unbound');
    }
    if (
      proof.designerAccountTransmission !==
      '1953-principal-architect-account-transmitted-by-2018-report-no-original-page-byte-claim'
    )
      return fail('independence-documentary-source-misrepresented');
    const np = safe(dir, proof.nativeIdentity?.path),
      nb = np && fs.readFileSync(np);
    if (!nb || hash(nb) !== proof.nativeIdentity.sha256)
      return fail('independence-native-plan-unbound');
    const n = JSON.parse(nb),
      w = n.elements.find((w) => w.type === 'way' && w.id === 1078848223),
      ns = new Map(n.elements.filter((n) => n.type === 'node').map((n) => [n.id, n])),
      points = frame.geometry?.polygons?.[0];
    if (
      w?.tags.wikidata !== 'Q6016118' ||
      w?.tags.historic !== 'monument' ||
      frame.mappedIdentity?.wikidataId !== 'Q6016118' ||
      points?.length !== 12 ||
      controls.nativeBaseRing?.length !== 12 ||
      controls.model !== 'independence_memorial_hall' ||
      controls.wholeScope !== 'whole-open-pavilion-basement-three-tier-terrace-and-kandyan-roof' ||
      controls.pavilion?.pillars !== 48 ||
      controls.pavilion?.cornerTowers !== 4 ||
      controls.pavilion?.friezePanels !== 28 ||
      controls.terrace?.tiers !== 3 ||
      controls.estimatedVerticalSections !== true
    )
      return fail('independence-whole-native-hall-or-reported-census-disagrees');
    const R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(frame.anchor[1] * rad);
    for (let i = 0; i < 12; i++) {
      const n = ns.get(w.nodes[i]),
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
        return fail('independence-original-plan-controls-changed');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Complete native memorial-hall plan and official/designer-derived construction description bound, including48reported pillars/fourcorner towers/28frieze panels/three tiers and concrete Kandyan roof. Vertical sections, grid setout, carvings, symbolic lion census and finish estimated. Historical account transmission explicit; no original1953page or photographic approval claimed.',
    };
  } catch {
    return fail('independence-factual-evidence-invalid');
  }
}
