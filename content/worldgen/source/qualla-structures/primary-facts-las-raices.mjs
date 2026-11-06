/** Whole existing tunnel: primary numerical section, original complete route; no imagery. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (d, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(d, p)
    : null;
export function inspectLasRaicesPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, phrases] of [
      [
        'engineering',
        'https://repositoriodirplan.mop.gob.cl/biblioteca/bitstreams/7e39af82-235f-4910-9850-320fb1ecd99d/download',
        [
          'pages7-8',
          '4528m',
          '5.9m total height',
          '4.2m clearance',
          '4.75m base width',
          'traffic lights',
          'NO ventilation',
          'All source figures',
        ],
      ],
      [
        'connectivity',
        'https://repositoriodirplan.mop.gob.cl/biblioteca/server/api/core/bitstreams/f518f97e-4a84-4b26-ad91-ec6747975ba6/content',
        [
          'PDFpage137/printed131',
          '4528m',
          '1010m altitude',
          'not certify portal-specific',
          'All source figures',
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
        !phrases.every((t) => b.toString().includes(t))
      )
        return fail('las-raices-primary-existing-tunnel-section-unbound');
    }
    const p = safe(dir, proof.nativeIdentity?.path),
      b = p && fs.readFileSync(p);
    if (!b || hash(b) !== proof.nativeIdentity.sha256)
      return fail('las-raices-original-whole-route-unbound');
    const n = JSON.parse(b),
      route = n.originalRoutePoints;
    if (
      n.source !== 'https://build.protomaps.com/20261029.pmtiles' ||
      n.fragments?.length !== 7 ||
      route?.length !== 13 ||
      n.fragments.some(
        (x) =>
          x.id !== 'roads/35184709025050' ||
          x.properties.is_tunnel !== true ||
          x.properties.oneway !== 'alternating' ||
          x.properties.ref !== '181',
      ) ||
      n.namedPoi?.properties.name !== 'Túnel Las Raíces'
    )
      return fail('las-raices-whole-existing-route-identity-missing');
    for (const q of [route[0], route.at(-1)])
      if (
        !n.terminalApproaches.some(
          (f) =>
            f.properties.ref === '181' &&
            !f.properties.is_tunnel &&
            f.geometry.coordinates.some((p) => p[0] === q[0] && p[1] === q[1]),
        )
      )
        return fail('las-raices-both-physical-portals-not-bound');
    for (const t of n.tiles) {
      const p = safe(dir, t.path);
      if (!p || hash(fs.readFileSync(p)) !== t.sha256)
        return fail('las-raices-original-numeric-tile-stale');
    }
    if (
      P.model !== 'las_raices_tunnel' ||
      P.wholeScope !== 'whole-existing-single-bore-both-portals-full-lining-and-deck-2020' ||
      P.tunnel?.reportedLength !== 4528 ||
      P.tunnel.height !== 5.9 ||
      P.tunnel.baseWidth !== 4.75 ||
      P.tunnel.clearance !== 4.2 ||
      P.tunnel.ventilation !== false ||
      P.portals?.length !== 2 ||
      P.nativeRoute?.length !== 13 ||
      P.representedDate !== '2020-08-08' ||
      P.estimatedPlanUncertaintyMeters < 5 ||
      P.estimatedHeightUncertaintyMeters < 5
    )
      return fail('las-raices-whole-scope-primary-section-or-estimates-disagree');
    const R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(f.anchor[1] * rad),
      c = Math.cos(f.heading),
      s = Math.sin(f.heading);
    for (let i = 0; i < route.length; i++) {
      const [lon, lat] = route[i],
        x = (lon - f.anchor[0]) * R * rad * co,
        z = -R * (Math.asinh(Math.tan(lat * rad)) - Math.asinh(Math.tan(f.anchor[1] * rad))) * co,
        local = [c * x - s * z, s * x + c * z];
      for (let k = 0; k < 2; k++)
        if (
          Math.abs(local[k] - P.nativeRoute[i][k]) > 1e-7 ||
          Math.abs(local[k] - f.geometry.centerlines[0][i][k]) > 1e-7
        )
          return fail('las-raices-original-route-controls-moved');
    }
    for (let i = 0; i < 2; i++)
      if (
        P.portals[i].center.some((v, k) => Math.abs(v - P.nativeRoute[i === 0 ? 0 : 12][k]) > 1e-7)
      )
        return fail('las-raices-terminal-architecture-not-at-original-ends');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole existing single bore/both portals/full original13-control alignment, continuous5.9m-high/4.75m-base lining and paved deck, alternating-end signals; no ventilation/future parallel tunnel/operator-building proxy. Ministry original2020writtenfacts and older context, all imagery unused. Portal profile, liner/wingwalls, road grade/finish and provider vertical/contact registration explicitly estimated.',
    };
  } catch {
    return fail('las-raices-factual-evidence-unreadable');
  }
}
