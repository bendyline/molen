/** Complete native lighthouse and owner-described construction; no imagery used. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const digest = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (dir, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(dir, p)
    : undefined;
export function inspectAndenesPrimaryFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const source = proof.primarySource,
      file = safe(dir, source?.path),
      bytes = file && fs.readFileSync(file);
    if (
      !bytes ||
      source.url !==
        'https://www.kystverket.no/globalassets/om-kystverket/kystkultur/fyr/nordland/andenes-forvaltningsplan-2-1-2017-kort-red-safe.pdf' ||
      source.use !== 'factual-text-only' ||
      digest(bytes) !== source.sha256
    )
      return fail('andenes-owner-source-unbound');
    const body = bytes.toString().replace(/\s+/g, ' ');
    if (
      ![
        'Fyret er 40 m høyt',
        'Tårnet er malt rødt',
        'to utvendige gallerier',
        'Kjegleformet metalltak',
        'Teak ramtre dør',
        'Støpejernsplattinger på støpejernkonsoller',
      ].every((p) => body.includes(p))
    )
      return fail('andenes-construction-facts-incomplete');
    const nativeFile = safe(dir, proof.nativeIdentity?.path),
      nb = nativeFile && fs.readFileSync(nativeFile);
    if (!nb || digest(nb) !== proof.nativeIdentity.sha256)
      return fail('andenes-native-source-unbound');
    const native = JSON.parse(nb),
      nodes = new Map(native.elements.filter((n) => n.type === 'node').map((n) => [n.id, n]));
    if (
      frame.mappedIdentity?.wikidataId !== 'Q4753689' ||
      controls.model !== 'andenes_lighthouse' ||
      controls.wholeScope !== 'whole-lighthouse-tower-base-two-galleries-lantern-and-roof' ||
      controls.tower?.height !== 40 ||
      controls.galleries?.length !== 2 ||
      controls.nativeTowerRing?.length !== 19 ||
      controls.nativeBaseRing?.length !== 19
    )
      return fail('andenes-full-scope-or-dimensions-disagree');
    const rad = Math.PI / 180,
      R = 6378137,
      co = Math.cos(frame.anchor[1] * rad);
    for (const [id, ring] of [
      [37865155, controls.nativeTowerRing],
      [1026009624, controls.nativeBaseRing],
    ]) {
      const w = native.elements.find((n) => n.type === 'way' && n.id === id),
        feature = frame.features?.find((f) => f.id === 'way/' + id);
      if (
        !w ||
        !feature ||
        w.nodes.length !== 20 ||
        feature.points.length !== 19 ||
        (id === 37865155 && w.tags.wikidata !== 'Q4753689') ||
        (id === 1026009624 && w.tags['ref:bygningsnr'] !== '190327078')
      )
        return fail('andenes-native-outlines-incomplete');
      for (let i = 0; i < 19; i++) {
        const n = nodes.get(w.nodes[i]),
          p = feature.points[i],
          q = ring[i];
        if (
          !n ||
          Math.abs(p[0] - (n.lon - frame.anchor[0]) * rad * R * co) > 1e-7 ||
          Math.abs(
            p[1] +
              R *
                (Math.asinh(Math.tan(n.lat * rad)) - Math.asinh(Math.tan(frame.anchor[1] * rad))) *
                co,
          ) > 1e-7 ||
          q.some((v, k) => Math.abs(v - p[k]) > 1e-9)
        )
          return fail('andenes-native-controls-changed');
      }
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: digest(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Exact native tower/outer-building outlines, owner height/materials/two galleries/lantern/conical roof verified. Vertical divisions, taper, entry/window bearings, minor fittings and finishes remain explicit estimates. No photographic comparison or image approval claimed.',
    };
  } catch {
    return fail('andenes-factual-evidence-invalid');
  }
}
