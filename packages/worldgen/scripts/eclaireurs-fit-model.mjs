/** Les Eclaireurs browser placement: retained tower detail plus a bounded approximate rock footing. */
import './install-deterministic-math.mjs';
import {
  buildEclaireursMaster,
  buildEclaireursDistrict,
  buildEclaireursSkyline,
} from './eclaireurs-browser-model.mjs';
import { normalFor } from './authored-structure-mesh.mjs';
const ROCK_MEAN = [0.44849861649919487, 0.44906994842942866, 0.37575318374011624];
function fitted(out, level) {
  const far = level === 'skyline';
  function emit(s, r, p, _n, uv, c) {
    p = p.map(([x, y, z]) => [x, y + 1.1, z].map(Math.fround));
    for (let i = 1; i < p.length - 1; i++) {
      const t = [p[0], p[i], p[i + 1]],
        n = normalFor(...t);
      if (Math.hypot(...n) < 0.5) continue;
      out.addTriangle(
        s,
        r,
        t,
        n,
        typeof uv === 'function' ? t.map(uv) : [uv[0], uv[i], uv[i + 1]],
        c,
      );
    }
  }
  const wrapped = Object.fromEntries(
    ['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]),
  );
  (far
    ? buildEclaireursSkyline
    : level === 'district'
      ? buildEclaireursDistrict
      : buildEclaireursMaster)(wrapped);
  const n = 8,
    rings = [
      Array.from({ length: n }, (_, i) => {
        const a = (i * Math.PI * 2) / n;
        return [Math.sin(a) * 1.75, 1.1, Math.cos(a) * 1.75];
      }),
      Array.from({ length: n }, (_, i) => {
        const a = (i * Math.PI * 2) / n,
          r = 3.1 + 0.3 * Math.sin(i * 2.3);
        return [Math.sin(a) * r, 0.38 + 0.22 * Math.cos(i * 1.7), Math.cos(a) * r];
      }),
      Array.from({ length: n }, (_, i) => {
        const a = (i * Math.PI * 2) / n,
          r = 4.8 + 0.25 * Math.sin(i * 1.9);
        return [Math.sin(a) * r, -0.08, Math.cos(a) * r];
      }),
    ];
  function rock(p) {
    p = p.map((v) => v.map(Math.fround));
    let nn = normalFor(...p);
    if (nn[1] < 0) {
      p.reverse();
      nn = normalFor(...p);
    }
    const c = [0.43, 0.43, 0.415].map((v, i) => (far ? v * ROCK_MEAN[i] : v));
    out.addTriangle(
      'rock',
      'palette:#ffffff',
      p,
      nn,
      p.map((v) => [v[0], v[2]]),
      c,
    );
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    rock([[0, 1.1, 0], rings[0][i], rings[0][j]]);
    for (let k = 1; k < rings.length; k++) {
      rock([rings[k - 1][i], rings[k][i], rings[k][j]]);
      rock([rings[k - 1][i], rings[k][j], rings[k - 1][j]]);
    }
  }
}
export const buildEclaireursFitSkyline = (o) => fitted(o, 'skyline');
export const buildEclaireursFitDistrict = (o) => fitted(o, 'district');
export const buildEclaireursFitStreet = (o) => fitted(o, 'street');
export const buildEclaireursFitCloseup = (o) => fitted(o, 'closeup');
