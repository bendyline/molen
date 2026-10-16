/** Isolated Shabla master recipe; browser derivatives reduce regular subdivisions and share stone for the tiny steps. */
import {
  beam,
  loft,
  normalFor,
  sphere as originalSphere,
  radialRing,
} from './authored-structure-mesh.mjs';
import { facadeBlock, hipRoof, ring as originalRing } from './lighthouse-expansion-models.mjs';
import { lathe as originalLathe, panel, piercedFacade, transformed } from './lighthouse-models.mjs';
import { box, tube as originalTube, quad } from './structure-mesh.mjs';

const pale = [0.86, 0.85, 0.78],
  dark = [0.085, 0.105, 0.11],
  ochre = [0.66, 0.49, 0.28];
const polar = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];
/** Municipal tower control + mapped service-house centroid, in the reviewed native frame. */
export const SHABLA_HOUSE_CENTER = [-2.0643493377162585, -9.814871364070381];
export function shablaBaseGallery(out, postsPerFace = 12) {
  for (let face = 0; face < 4; face++) {
    const o = transformed(out, (face * Math.PI) / 2);
    for (const y of [12.66, 13.1])
      beam(o, 'metal', [-4.12, y, 4.12], [4.12, y, 4.12], 0.055, 0.065, dark);
    for (let i = 0; i < postsPerFace; i++) {
      const x = -4.12 + (8.24 * i) / postsPerFace;
      beam(o, 'metal', [x, 12.23, 4.12], [x, 13.1, 4.12], 0.055, 0.055, dark);
    }
  }
}
export function buildShablaDetail(out, district = false, reviewed = false) {
  const lathe = (o, s, p, c, n, center) =>
    originalLathe(o, s, p, c, district ? Math.min(8, n) : n, center);
  const ring = (o, s, y, a, b, h, c, n) =>
    originalRing(o, s, y, a, b, h, c, district ? Math.min(16, n) : n);
  const tube = (o, s, a, b, r, c, n) =>
    originalTube(o, s, a, b, r, c, district ? Math.min(4, n) : n);
  const sphere = (o, s, p, r, c, n, m) =>
    originalSphere(o, s, p, r, c, district ? 8 : n, district ? 4 : m);
  function archedHead(out, { x = 0, y, w, h, z, slot = 'ashlar', color = ochre, frame = pale }) {
    const r = w / 2,
      cy = y + h - r;
    const arcSegments = district ? 6 : 24;
    for (let i = 0; i < arcSegments; i++) {
      const a = (i * Math.PI) / arcSegments,
        b = ((i + 1) * Math.PI) / arcSegments;
      const p = [x + r * Math.cos(a), cy + r * Math.sin(a), z],
        q = [x + r * Math.cos(b), cy + r * Math.sin(b), z];
      const ps = [p, [p[0], y + h + 0.001, z], [q[0], y + h + 0.001, z], q];
      quad(out, slot, ps, [0, 0, 1], color);
      tube(out, 'wood', p, q, 0.042, frame, 8);
    }
    for (const xx of [x - r, x + r]) tube(out, 'wood', [xx, y, z], [xx, cy, z], 0.042, frame, 8);
    for (const yy of [y, y + h * 0.32, y + h * 0.64])
      beam(out, 'wood', [x - r, yy, z - 0.08], [x + r, yy, z - 0.08], 0.055, 0.045, frame);
    beam(out, 'wood', [x, y, z - 0.08], [x, y + h, z - 0.08], 0.06, 0.045, frame);
  }

  function glazedLantern(out, { y, r, h, frame = dark, n = 16 }) {
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
    segments = district ? Math.min(8, segments) : segments;
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
    const red = [0.61, 0.19, 0.135],
      white = [0.87, 0.86, 0.8],
      roof = [0.45, 0.35, 0.22];
    // The reviewed municipal tower point puts the mapped service house south of the tower.
    // The legacy export retains its original geometry for exact source-master reproduction.
    const houseOut = reviewed
      ? transformed(out, 0, [SHABLA_HOUSE_CENTER[0] - 0.48, 0, SHABLA_HOUSE_CENTER[1] + 8.36])
      : out;
    facadeBlock(houseOut, {
      cx: 0.48,
      cz: -8.36,
      rx: 5.3,
      rz: 5.96,
      y0: 0,
      y1: 3.8,
      slot: 'plaster',
      color: white,
      windows: [
        { face: 0, x: -3, y: 1, w: 1.15, h: 1.25, trim: 0.06 },
        { face: 3, x: 0, y: 1, w: 1.2, h: 1.3, trim: 0.06 },
        { face: 2, x: -2.4, y: 0.1, w: 1.05, h: 2.1, trim: 0.04 },
        { face: 2, x: 2.7, y: 1, w: 1.1, h: 1.25, trim: 0.05 },
      ],
    });
    hipRoof(houseOut, 0.48, -8.36, 5.47, 6.12, 3.8, 1.15, roof);
    facadeBlock(out, {
      rx: 4.25,
      rz: 4.25,
      y0: 0,
      y1: 8.05,
      slot: 'ashlar',
      color: white,
      windows: [
        { face: 0, x: 0, y: 1.15, w: 0.95, h: 1.75, trim: 0.11 },
        { face: 0, x: 0, y: 4.8, w: 0.95, h: 1.75, trim: 0.11 },
        { face: 1, x: 0, y: 1.2, w: 0.9, h: 1.6, trim: 0.1 },
        { face: 3, x: 0, y: 4.8, w: 0.9, h: 1.6, trim: 0.1 },
      ],
    });
    facadeBlock(out, {
      rx: 4.25,
      rz: 4.25,
      y0: 8.05,
      y1: 12.05,
      slot: 'ashlar',
      color: red,
      windows: [],
    });
    box(out, 'limestone', [-4.32, 12.02, -4.32], [4.32, 12.23, 4.32], white);
    if (reviewed) shablaBaseGallery(out, district ? 4 : 12);
    // Eight planar faces, projecting stone edges and the characteristic broad red/white bands.
    const levels = [12.23, 14.3, 17.7, 20.6, 23.7, 26.4, 29.4],
      colors = [white, red, white, red, white, red];
    const apothem = (y) => 2.94 - ((y - 12.23) * 1.02) / 17.17;
    for (let j = 0; j < levels.length - 1; j++)
      for (let f = 0; f < 8; f++) {
        const lo = levels[j],
          hi = levels[j + 1],
          a = apothem(lo),
          b = apothem(hi),
          o = transformed(out, (f * Math.PI) / 4);
        const taper = {
          addQuad(s, r, p, _n, uv, c) {
            const ps = p.map(([x, y, z]) => [(x * apothem(y)) / a, y, (z * apothem(y)) / a]);
            o.addQuad(s, r, ps, normalFor(...ps.slice(0, 3)), uv, c);
          },
        };
        const holes =
          f === 0 && [0, 2, 4].includes(j)
            ? [
                {
                  x: 0,
                  y: lo + 0.38,
                  w: 0.53,
                  h: Math.min(1.5, hi - lo - 0.64),
                  depth: 0.28,
                  trim: 0.055,
                },
              ]
            : [];
        piercedFacade(taper, {
          half: a * Math.tan(Math.PI / 8),
          z: a,
          y0: lo,
          y1: hi,
          holes,
          slot: 'ashlar',
          color: colors[j],
        });
        if (j === 0 && f === 0)
          archedHead(o, {
            x: 0,
            y: lo + 0.38,
            w: 0.53,
            h: 1.43,
            z: apothem(lo + 1) + 0.04,
            color: colors[j],
            frame: [0.35, 0.21, 0.12],
          });
        const edge0 = polar(a / Math.cos(Math.PI / 8), lo, (f * Math.PI) / 4 + Math.PI / 8),
          edge1 = polar(b / Math.cos(Math.PI / 8), hi, (f * Math.PI) / 4 + Math.PI / 8);
        beam(out, 'ashlar', edge0, edge1, 0.08, 0.08, colors[j]);
      }
    loft(
      out,
      'limestone',
      [
        radialRing(29.4, 2.17, 2.17, 8, [0, 0], Math.PI / 8),
        radialRing(29.62, 2.29, 2.29, 8, [0, 0], Math.PI / 8),
      ],
      white,
    );
    railRing(out, 29.63, 2.09, 0.76, dark, 16);
    lathe(
      out,
      'metal',
      [
        [29.64, 1.15],
        [29.95, 1.15],
      ],
      white,
      64,
    );
    glazedLantern(out, { y: 29.95, r: 0.98, h: 1.12, frame: dark, n: 12 });
    lathe(
      out,
      'metal',
      [
        [31.08, 1.13],
        [31.18, 1.14],
        [31.45, 0.7],
        [31.62, 0.14],
      ],
      dark,
      64,
    );
    sphere(out, 'metal', [0, 31.69, 0], [0.13, 0.12, 0.13], dark, 24, 10);
    tube(out, 'metal', [0, 31.8, 0], [0, 32, 0], 0.027, dark, 8);
    // With the reviewed heading, the +X ground door and steps face inland/west.
    for (let i = 0; i < 3; i++)
      box(
        out,
        'concrete',
        [4.25, 0.18 * i, -1.5],
        [5.2 - 0.25 * i, 0.18 * (i + 1), -0.25],
        [0.55, 0.54, 0.49],
      );
    panel(transformed(out, Math.PI / 2), 'wood', -0.65, 0.65, 0.55, 2.8, 4.27, [0.25, 0.19, 0.13]);
    for (const z of [-6.5, -10.5])
      box(houseOut, 'plaster', [-3.4, 4.4, z - 0.3], [-2.8, 5.6, z + 0.3], white);
  }

  build(out);
}
export function buildShablaMaster(out) {
  buildShablaDetail(out);
}
export function buildShablaReviewedMaster(out) {
  buildShablaDetail(out, false, true);
}
function stepSurface(out) {
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (slot, ref, ...args) => out[k](slot === 'concrete' ? 'granite' : slot, ref, ...args),
    ]),
  );
}
export function buildShablaDistrict(out) {
  buildShablaDetail(stepSurface(out), true, true);
}
export function buildShablaNear(out) {
  buildShablaDetail(stepSurface(out), false, true);
}
