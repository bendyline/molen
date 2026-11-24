import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93 },
  foundation: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.96 },
  brick: { slot: 'foundation', graph: 'brick_stack', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.76, metallic: 0.13 },
  glass: { slot: 'trim', graph: 'metal_painted', roughness: 0.46 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.85 },
  copper: { slot: 'trim', graph: 'metal_copper', roughness: 0.73 },
};

const F = facade(site.frame.origin, site.frame.along);
const P = F.P;
const xz = ([x, , z]) => [x, z];
const wall = rgb('b48f7b');
const pier = rgb('b7927d');
const stone = rgb('918477');
const pale = rgb('c19b81');
const metal = rgb('4d575c');
const pitch = rgb('566166');
const dark = rgb('394748');
const blue = rgb('46616b');
const steps = rgb('9f6f55');

const box = (out, slot, u, U, y, Y, d, D, color) => fbox(out, slot, F, u, U, y, Y, d, D, color);
const rectangle = (u, U, d, D) =>
  [
    [u, d],
    [U, d],
    [U, D],
    [u, D],
  ].map(([u, d]) => xz(P(u, 0, d)));
const plate = (out, u, U, y, Y, d, color) =>
  quad4(out, 'glass', P(u, y, d), P(U, y, d), P(U, Y, d), P(u, Y, d), color);

function panelRoof(out, detail) {
  const eaves = [
    P(-7.85, 27.54, 0.08),
    P(7.58, 27.54, 0.08),
    P(7.64, 27.54, -12.22),
    P(-7.83, 27.54, -12.22),
  ];
  const crown = [
    P(-2.12, 32.15, -5.5),
    P(2.12, 32.15, -5.5),
    P(2.12, 32.15, -6.8),
    P(-2.12, 32.15, -6.8),
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad4(out, 'roof', eaves[i], eaves[j], crown[j], crown[i], i % 2 === 0 ? metal : pitch);
    if (detail > 1) {
      const div = i % 2 === 0 ? 13 : 9;
      const lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
      for (let s = 1; s < div; s++) {
        beam(
          out,
          'roof',
          lerp(eaves[i], eaves[j], s / div),
          lerp(crown[i], crown[j], s / div),
          0.05,
          0.045,
          pitch,
        );
      }
    }
  }
  quad4(out, 'roof', ...crown, metal);
  box(out, 'roof', -0.06, 0.2, 32.12, 34.02, -6.13, -5.88, metal);
  box(out, 'roof', -0.59, 0.72, 33.3, 33.49, -6.13, -5.88, metal);
}

function holmWindow(out, detail) {
  box(out, 'wall', -3.2, 3.3, 2.22, 27.53, -11.38, -2.44, wall);
  plate(out, -2.83, 2.93, 7.19, 24.55, -2.42, blue);
  plate(out, -2.83, 2.93, 2.27, 5.58, -2.415, dark);
  for (const [u, U] of [
    [-7.68, -2.75],
    [2.85, 7.52],
  ]) {
    box(out, 'wall', u, U, 2.25, 27.53, -11.9, 0.12, pier);
    box(out, 'trim', u - 0.12, U + 0.12, 27.25, 27.61, -12.04, 0.28, pale);
    if (detail > 0) {
      const side = u > 0 ? U : u;
      const sideCam = facade(
        xz(P(side, 0, u > 0 ? 0.1 : -11.77)),
        u > 0 ? F.normal : F.normal.map((v) => -v),
      );
      for (let i = 0; i < 3; i++) {
        const q = 2.1 + i * 2.62;
        const path = [
          [q - 0.38, 23.24],
          [q + 0.37, 23.24],
          [q + 0.54, 24.09],
          [q + 0.35, 25.05],
          [q - 0.36, 25.05],
          [q - 0.52, 24.09],
        ];
        fan(
          out,
          'trim',
          path.map(([x, y]) => sideCam.P(x, y, 0.045)),
          pale,
        );
        fan(
          out,
          'glass',
          path.map(([x, y]) => sideCam.P(q + (x - q) * 0.72, 24.09 + (y - 24.09) * 0.75, 0.075)),
          dark,
        );
      }
    }
  }
  // The front balcony sits above the long stained-glass opening.
  box(out, 'wall', -2.72, 2.8, 23.0, 23.48, -2.8, -0.22, pale);
  if (detail) {
    box(out, 'trim', -2.74, 2.82, 24.35, 24.53, -0.43, -0.19, pale);
    for (let i = 0; i < 11; i++) {
      const u = -2.63 + i * 0.532;
      box(out, 'trim', u, u + 0.12, 23.46, 24.35, -0.42, -0.21, pale);
    }
  }
  box(out, 'trim', -0.17, 0.33, 7.44, 22.43, -2.41, -2.13, pale);
  box(out, 'trim', -2.76, 2.91, 17.5, 17.79, -2.41, -2.13, pale);
  const n = [10, 16, 24, 32][detail];
  for (let j = 0; j < n; j++) {
    const a = (j * Math.PI * 2) / n,
      b = ((j + 1) * Math.PI * 2) / n;
    const q = (t, r) => P(0.08 + Math.cos(t) * r, 17.76 + Math.sin(t) * r, -2.09);
    quad4(out, 'trim', q(a, 2.25), q(a, 2.5), q(b, 2.5), q(b, 2.25), pale);
  }
  if (detail > 0) {
    for (const x of [-2.68, -1.72, -0.8, 0.92, 1.84, 2.73]) {
      box(out, 'roof', x - 0.034, x + 0.036, 7.18, 22.9, -2.42, -2.34, metal);
    }
    const curve = [
      [-2.3, 7.55],
      [-2.11, 6.29],
      [-1.59, 5.66],
      [-0.73, 5.39],
      [0.38, 5.32],
      [0.78, 5.1],
    ];
    for (let i = 0; i < curve.length - 1; i++) {
      const [a, y] = curve[i],
        [b, Y] = curve[i + 1];
      quad4(out, 'glass', P(-2.94, y, a), P(-2.94, Y, b), P(3.03, Y, b), P(3.03, y, a), blue);
      for (const u of [-2.94, -1.45, 0, 1.49, 3.03]) {
        beam(out, 'roof', P(u, y + 0.035, a), P(u, Y + 0.035, b), 0.063, 0.058, metal);
      }
    }
    box(out, 'roof', -3.08, 3.18, 4.89, 5.13, 0.6, 1.01, metal);
    for (const u of [-3.12, 3.1])
      beam(out, 'copper', P(u, 7.53, -2.23), P(u, 5.21, 0.78), 0.125, 0.105, pale);
    for (const u of [-3.2, 3.27]) {
      box(out, 'foundation', u - 0.34, u + 0.34, 2.2, 4.94, -0.56, 0.21, stone);
    }
  }
  for (const [u, U] of [
    [-8.74, -7.04],
    [6.32, 8.28],
  ]) {
    box(out, 'foundation', u, U, 0.4, 7.37, -5.6, 0.48, stone);
    if (detail > 1) {
      const w = (U - u) / 6;
      for (let i = 0; i < 6; i++) {
        const x = u + (i + 0.5) * w;
        box(out, 'trim', x - w * 0.19, x + w * 0.19, 1.7, 7.05, 0.45, 0.61, pier);
        tri(
          out,
          'trim',
          P(x - w * 0.4, 6.59, 0.635),
          P(x + w * 0.4, 6.59, 0.635),
          P(x, 7.16, 0.635),
          pale,
        );
      }
    }
  }
  const nSteps = [2, 5, 12, 14][detail];
  for (let i = 0; i < nSteps; i++) {
    box(
      out,
      'brick',
      -6.78,
      6.68,
      -1.05,
      0.24 + (1.94 * (i + 1)) / nSteps,
      -0.19,
      6.28 - (5.84 * i) / nSteps,
      steps,
    );
  }
  box(out, 'brick', -6.78, 6.68, 0.21, 2.19, -2.42, 0.43, steps);
  panelRoof(out, detail);
}

function aisles(out, detail) {
  for (const part of site.modules) {
    for (const [outer, ...holes] of part.shape) {
      extrude(out, 'wall', outer, part.base, part.top, wall, {
        holes,
        topSlot: 'roof',
        topColor: metal,
      });
      if (!detail || !part.role.endsWith('aisles')) continue;
      for (const [i, a] of outwardRing(outer).entries()) {
        const r = outwardRing(outer),
          f = wallFace(a, r[(i + 1) % r.length]);
        if (
          f.length < 5.9 ||
          Math.abs(f.normal[0]) < 0.72 ||
          Math.sign(f.normal[0]) !== Math.sign(a[0])
        )
          continue;
        const n = Math.max(1, Math.round(f.length / 5.45));
        for (let j = 0; j < n; j++) {
          const u = ((j + 0.5) * f.length) / n;
          fbox(out, 'foundation', f, u - 1.73, u - 1.35, 1.18, part.top + 0.1, -0.08, 0.32, stone);
          opening(out, f, u, 2.6, 1.14, 5.42, {
            head: detail === 1 ? 'flat' : 'pointed',
            rise: 1.04,
            glassSlot: 'glass',
            glass: blue,
            frame: pale,
            frameWidth: 0.13,
            mullions: detail > 1 ? 1 : 0,
            transoms: detail > 2 ? 4 : 0,
          });
        }
      }
    }
    if (part.roof) {
      const { u, d, peak } = part.roof,
        mid = (u[0] + u[1]) / 2;
      gableRoof(
        out,
        'roof',
        xz(P(mid, 0, d[0])),
        xz(P(mid, 0, d[1])),
        u[1] - u[0],
        part.top,
        peak,
        pitch,
        { overhang: 0.16, endSlot: 'wall', endColor: wall },
      );
    }
  }
  for (const p of site.parts) {
    extrude(out, 'wall', p.outline, p.base, p.top, wall, { topSlot: 'roof', topColor: metal });
    if (!detail || p.role === 'service link') continue;
    const r = outwardRing(p.outline);
    for (const [i, a] of r.entries()) {
      const f = wallFace(a, r[(i + 1) % r.length]);
      if (f.length < 3.5 || f.normal[0] > 0.45) continue;
      const n = Math.floor(f.length / 3.1);
      for (let j = 0; j < n; j++)
        opening(out, f, ((j + 0.5) * f.length) / n, p.top - 3.88, 1.05, 2.47, {
          head: detail === 1 ? 'flat' : 'pointed',
          glassSlot: 'glass',
          glass: blue,
          frame: pale,
          frameWidth: 0.11,
          mullions: 1,
        });
    }
  }
}

function bellTower(out, detail) {
  for (const [outer, ...holes] of site.bell) {
    extrude(out, 'wall', outer, -3.6, 39.8, pier, { holes, topSlot: 'roof', topColor: metal });
    const r = outwardRing(outer);
    for (const [i, a] of r.entries()) {
      const f = wallFace(a, r[(i + 1) % r.length]);
      if (f.length < 3.6) continue;
      fbox(out, 'trim', f, 0, f.length, 38.93, 39.36, -0.12, 0.24, pale);
      if (!detail) continue;
      const u = f.length * 0.5,
        w = Math.min(4.5, f.length * 0.63);
      opening(out, f, u, 31.04, w, 6.91, {
        head: 'flat',
        glassSlot: 'glass',
        glass: dark,
        frame: stone,
        frameWidth: 0.18,
        mullions: 2,
      });
      if (detail > 1)
        for (let j = 0; j < 12; j++)
          fbox(
            out,
            'roof',
            f,
            u - w / 2,
            u + w / 2,
            31.15 + j * 0.54,
            31.27 + j * 0.54,
            0.04,
            0.17,
            metal,
          );
    }
  }
}

function build(sink, detail) {
  const out = withFootprintCaps(sink);
  aisles(out, detail);
  holmWindow(out, detail);
  bellTower(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
