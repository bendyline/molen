/** Original Sorpe dam/crown/cascade layout and primary owner engineering metrics. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (dir, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(dir, p)
    : null;
export function inspectSorpePrimaryFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, phrases] of [
      [
        'technical',
        'https://ruhrverband.de/flussgebiet/talsperren/sorpetalsperre/technische-daten-sorpetalsperre',
        ['Steinschüttdamm mit Betonkerndichtung', '69 m', '60 m', '307 m', '700 m', '10 m'],
      ],
      [
        'cascade',
        'https://ruhrverband.de/fileadmin/noindex/Gesch%C3%A4ftsbericht_2022.pdf',
        [
          '37 gestuften Becken',
          '66 Metern Höhenunterschied',
          '350 Metern Länge',
          'sechs',
          '18 Metern',
          'drei Metern',
          'sieben Meter',
        ],
      ],
    ]) {
      const source = proof.primarySources?.find((s) => s.key === key),
        p = safe(dir, source?.path),
        bytes = p && fs.readFileSync(p);
      if (
        !bytes ||
        source.url !== url ||
        source.use !== 'factual-text-only' ||
        hash(bytes) !== source.sha256 ||
        !phrases.every((s) => bytes.toString().replace(/\s+/g, ' ').includes(s))
      )
        return fail('sorpe-primary-construction-unbound');
    }
    const p = safe(dir, proof.nativeIdentity?.path),
      bytes = p && fs.readFileSync(p);
    if (!bytes || hash(bytes) !== proof.nativeIdentity.sha256) return fail('sorpe-native-unbound');
    const native = JSON.parse(bytes),
      nodes = new Map(native.elements.filter((n) => n.type === 'node').map((n) => [n.id, n])),
      ids = [25819413, 316663481, 316663483, 323041180, 121161717, 323041181];
    if (
      frame.mappedIdentity?.wikidataId !== 'Q32744446' ||
      controls.model !== 'sorpe_dam' ||
      controls.wholeScope !== 'whole-main-dam-and-connected-thirty-seven-basin-spillway' ||
      controls.dam?.heightAboveCoreFoundation !== 69 ||
      controls.dam?.heightAboveValley !== 60 ||
      controls.dam?.maximumFootWidth !== 307 ||
      controls.dam?.crestWidth !== 10 ||
      controls.dam?.publishedCrestLength !== 700 ||
      controls.cascade?.basins !== 37 ||
      controls.cascade?.drop !== 66 ||
      controls.cascade?.topWidth !== 3 ||
      controls.cascade?.bottomWidth !== 7
    )
      return fail('sorpe-whole-scope-or-primary-dimensions-disagree');
    const rad = Math.PI / 180,
      R = 6378137,
      co = Math.cos(frame.anchor[1] * rad);
    for (const id of ids) {
      const w = native.elements.find((e) => e.type === 'way' && e.id === id),
        feature = frame.features?.find((f) => f.id === `way/${id}`);
      if (!w || !feature || (id === 25819413 && w.tags.wikidata !== 'Q32744446'))
        return fail('sorpe-native-layout-incomplete');
      const list = w.nodes.slice(0, w.nodes[0] === w.nodes.at(-1) ? -1 : undefined);
      if (list.length !== feature.points.length) return fail('sorpe-native-control-count');
      for (let i = 0; i < list.length; i++) {
        const n = nodes.get(list[i]),
          p = feature.points[i];
        if (
          !n ||
          Math.abs(p[0] - (n.lon - frame.anchor[0]) * rad * R * co) > 1e-7 ||
          Math.abs(
            p[1] +
              R *
                (Math.asinh(Math.tan(n.lat * rad)) - Math.asinh(Math.tan(frame.anchor[1] * rad))) *
                co,
          ) > 1e-7
        )
          return fail('sorpe-native-controls-changed');
      }
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Whole original native main dam/crown/connected cascade bound to primary owner height, width, crest and37-basin/66m drop/3–7m width facts. Submerged/abutment sections, absolute grades, basin divisions, fittings and finishes remain explicit estimates. No photographic fidelity or image approval claimed.',
    };
  } catch {
    return fail('sorpe-factual-evidence-invalid');
  }
}
