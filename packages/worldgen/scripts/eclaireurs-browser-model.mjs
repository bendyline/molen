/** Isolated exact source master and controlled browser subdivisions for Les Éclaireurs. */
import { beam, normalFor, sphere as originalSphere } from './authored-structure-mesh.mjs';
import { ring as originalRing, shell as originalShell } from './lighthouse-expansion-models.mjs';
import { lathe as originalLathe, panel } from './lighthouse-models.mjs';
import { tube as originalTube, quad } from './structure-mesh.mjs';

const polar = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];
function buildEclaireursDetail(out, mode = 'master') {
  const n = (high, middle, low) => (mode === 'master' ? high : mode === 'district' ? middle : low);
  const lathe = (o, s, p, c, count, center) => originalLathe(o, s, p, c, n(count, 16, 8), center);
  const ring = (o, s, y, a, b, h, c, count) => originalRing(o, s, y, a, b, h, c, n(count, 16, 8));
  const tube = (o, s, a, b, r, c, count) => originalTube(o, s, a, b, r, c, n(count, 4, 3));
  const sphere = (o, s, p, r, c, count, rows) =>
    originalSphere(o, s, p, r, c, n(count, 8, 6), n(rows, 4, 3));
  const shell = (o, options) =>
    originalShell(o, { ...options, segments: n(options.segments, 32, 12) });
  function glazedLantern(out, { y, r, h, frame = dark, n = 16 }) {
    n = mode === 'skyline' ? 4 : n;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        b = ((i + 1) * Math.PI * 2) / n;
      const ps = [polar(r, y, a), polar(r, y, b), polar(r, y + h, b), polar(r, y + h, a)];
      quad(out, 'glass', ps, normalFor(...ps.slice(0, 3)), [0.25, 0.32, 0.33]);
      tube(out, 'metal', ps[0], ps[3], 0.027, frame, 8);
    }
    for (const yy of [y, y + h * 0.52, y + h])
      ring(out, 'metal', yy, r - 0.04, r + 0.04, 0.05, frame, 96);
  }

  function railRing(out, y, r, height, color = dark, segments = 32) {
    segments = mode === 'skyline' ? 4 : mode === 'district' ? 8 : segments;
    for (const yy of [y + height * 0.48, y + height])
      for (let i = 0; i < segments; i++) {
        const a = (i * Math.PI * 2) / segments,
          b = ((i + 1) * Math.PI * 2) / segments;
        tube(
          out,
          'metal',
          [Math.cos(a) * r, yy, Math.sin(a) * r],
          [Math.cos(b) * r, yy, Math.sin(b) * r],
          0.025,
          color,
          8,
        );
      }
    for (let i = 0; i < segments; i++) {
      const a = (i * Math.PI * 2) / segments;
      tube(
        out,
        'metal',
        [Math.cos(a) * r, y, Math.sin(a) * r],
        [Math.cos(a) * r, y + height, Math.sin(a) * r],
        0.029,
        color,
        8,
      );
    }
  }

  function build(out) {
    const red = [0.64, 0.17, 0.105],
      white = [0.88, 0.87, 0.8],
      black = [0.075, 0.085, 0.08];
    shell(out, {
      profile: [
        [0, 1.51],
        [0.18, 1.53],
        [3.15, 1.43],
        [6.28, 1.31],
        [8.8, 1.22],
      ],
      holes: [
        { angle: 0, y: 0.1, w: 0.72, h: 1.91, depth: 0.24, trimSlot: 'plaster', trimColor: red },
      ],
      slot: 'plaster',
      color: (y) => (y < 3.15 || y >= 6.28 ? red : white),
      segments: 128,
    });
    panel(out, 'wood', -0.31, 0.31, 0.14, 1.96, 1.22, [0.27, 0.105, 0.06]);
    for (let x = -0.26; x < 0.32; x += 0.105)
      beam(out, 'wood', [x, 0.16, 1.245], [x, 1.93, 1.245], 0.015, 0.017, [0.33, 0.14, 0.075]);
    sphere(out, 'metal', [0.24, 1.04, 1.29], [0.035, 0.045, 0.035], black, 12, 8);
    lathe(
      out,
      'plaster',
      [
        [8.75, 1.22],
        [8.87, 1.34],
        [9.03, 1.34],
        [9.11, 1.26],
      ],
      red,
      128,
    );
    railRing(out, 9.12, 1.14, 0.77, black, 12);
    lathe(
      out,
      'metal',
      [
        [9.1, 0.73],
        [9.85, 0.73],
      ],
      black,
      96,
    );
    glazedLantern(out, { y: 9.85, r: 0.69, h: 0.65, frame: [0.25, 0.27, 0.26], n: 8 });
    lathe(
      out,
      'metal',
      [
        [10.5, 0.79],
        [10.58, 0.82],
        [10.69, 0.68],
        [10.81, 0.41],
        [10.86, 0.11],
      ],
      black,
      96,
    );
    tube(out, 'metal', [0, 10.85, 0], [0, 10.93, 0], 0.05, black, 12);
    sphere(out, 'metal', [0, 10.94, 0], [0.075, 0.06, 0.075], black, 24, 10);
    // Small paired inclined photovoltaic panels on the north-facing gallery rail, visible in the official photo.
    for (const x of [-0.54, 0.54]) {
      const a = [x - 0.22, 9.23, -0.94],
        b = [x + 0.22, 9.23, -0.94],
        c = [x + 0.22, 9.76, -0.69],
        d = [x - 0.22, 9.76, -0.69],
        ps = [a, d, c, b];
      quad(out, 'glass', ps, normalFor(...ps.slice(0, 3)), [0.08, 0.14, 0.19]);
      for (const [p, q] of [
        [a, b],
        [b, c],
        [c, d],
        [d, a],
      ])
        beam(out, 'metal', p, q, 0.025, 0.028, black);
      beam(out, 'metal', [x, 9.23, -0.94], [x, 9.76, -0.69], 0.02, 0.021, [0.5, 0.52, 0.5]);
    }
  }

  build(out);
}
export function buildEclaireursMaster(out) {
  buildEclaireursDetail(out);
}
export function buildEclaireursDistrict(out) {
  buildEclaireursDetail(out, 'district');
}
export function buildEclaireursSkyline(destination) {
  const means = {
      plaster: [0.856015, 0.827728, 0.727643],
      metal: [0.908889, 0.908889, 0.908889],
      wood: [0.825128, 0.825128, 0.825128],
    },
    out = Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (s, r, p, n, uv, c) =>
          destination[k](
            s,
            r,
            p,
            n,
            uv,
            c.map((v, i) => v * (means[s]?.[i] ?? 1)),
          ),
      ]),
    );
  buildEclaireursDetail(out, 'skyline');
}
