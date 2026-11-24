import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  facade,
  fbox,
  lathe,
  opening,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  collar,
  concrete,
  darkSteel,
  lightSteel,
  reflector,
  reflectorFrame,
  reflectorSurfaces,
  rimTrack,
  steel,
} from '../../../../../../../../packages/worldgen/scripts/telescope-reflector-geometry.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = reflectorSurfaces;
const { mount, point, onDish } = reflectorFrame(site.dish);
const P = mount(1, 0, 0),
  F = facade([0, 0], [P[0], P[2]]);
const plate = rgb('bcbaaf'),
  dark = rgb('626d69');
const bowl = {
  sections: [16, 28, 42, 60],
  rim: 0.32,
  backDepth: 3.52,
  feedAngles: [-0.98, 1.22, 3.72],
  feedFoot: 0.92,
};
const b = (o, s, u, U, y, Y, d, D, c) => fbox(o, s, F, u, U, y, Y, d, D, c);
const xz = ([x, , z]) => [x, z];
const joint = (o, a, c, w, d, t = steel) => beam(o, 'steel', mount(...a), mount(...c), w, d, t);

function foundation(out, detail) {
  const r = site.dish.radius;
  lathe(
    out,
    'concrete',
    [0, 0],
    [
      [-0.52, r + 0.24, r + 0.24],
      [0.16, r + 0.24, r + 0.24],
      [2.6, r, r],
      [2.89, r + 0.18, r + 0.18],
    ],
    detail ? 24 : 10,
    concrete,
  );
  collar(out, [0, 0], 2.88, 0.61, 4.83, detail);
  b(out, 'housing', -2.68, 2.63, 3.48, 6.44, -2.41, 2.68, plate);
  b(out, 'steel', -2.79, 2.77, 6.36, 6.69, -2.6, 3.05, darkSteel);
  if (detail) {
    const g = wallFace(xz(mount(-2.68, 0, 2.695)), xz(mount(2.63, 0, 2.695)));
    for (let i = 1; i <= 4; i++)
      opening(out, g, (i * g.length) / 5, 4.04, 0.61, 1.38, {
        glassSlot: 'steel',
        frameSlot: 'steel',
        glass: dark,
        frame: lightSteel,
        frameWidth: detail > 1 ? 0.085 : 0,
        mullions: detail > 1 ? 1 : 0,
      });
    rimTrack(out, 'steel', r - 0.22, 0.095, 2.94, 0.051, detail === 3 ? 32 : 18, darkSteel);
    const start = [-5.4, 2.88, 4.08],
      end = [-0.69, 6.48, 3.45];
    joint(out, start, end, 0.35, 0.27, darkSteel);
    if (detail > 1) {
      for (let i = 0; i < 12; i++) {
        const x = -5.42 + i * 0.39;
        b(out, 'steel', x, x + 0.38, 2.94 + i * 0.298, 3.0 + i * 0.298, 3.18, 4.16, steel);
      }
    }
  }
}
function cradle(out, detail) {
  for (const side of [-1, 1]) {
    const a = [side * 3.42, 2.96, 1.45],
      m = [side * 7.68, 8.65, 0.95],
      end = [side * 11.21, 12.33, -2.67];
    joint(out, a, m, 1.38, 1.08, lightSteel);
    joint(out, m, end, 1.1, 0.82, steel);
    joint(out, [side * 3.42, 3.19, -2.87], [side * 11.21, 12.63, -3.25], 0.91, 0.91, steel);
    beam(
      out,
      'steel',
      mount(...end),
      onDish(0.82, side > 0 ? 0.49 : Math.PI - 0.49, -0.84),
      0.89,
      0.72,
      steel,
    );
    if (detail) {
      joint(out, m, [side * 8.71, 9.06, -2.79], 0.74, 0.56, darkSteel);
      joint(out, [side * 9.35, 11.03, -3.49], [side * 9.29, 11.42, -1.91], 0.48, 0.49, steel);
      b(
        out,
        'steel',
        Math.min(side * 6.94, side * 9.77),
        Math.max(side * 6.94, side * 9.77),
        8.31,
        8.68,
        -3.1,
        1.69,
        darkSteel,
      );
    }
  }
  joint(out, [-11.19, 11.83, -3.2], [11.19, 11.83, -3.2], 1.06, 0.93, lightSteel);
  for (const u of [-6.4, 0, 6.4])
    beam(out, 'steel', mount(u, 7.35, -1.26), point(u * 0.73, 0, -3.67), 0.82, 0.73, steel);
}
function build(mesh, detail) {
  const out = withFootprintCaps(mesh);
  foundation(out, detail);
  cradle(out, detail);
  reflector(out, site.dish, detail, bowl);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
