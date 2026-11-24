import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  facade,
  fbox,
  lathe,
  rgb,
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
const { mount, point } = reflectorFrame(site.dish);
const P = mount(1, 0, 0),
  F = facade([0, 0], [P[0], P[2]]);
const colors = rgb('babeb4');
const bowl = {
  sections: [16, 26, 42, 54],
  rim: 0.19,
  backDepth: 1.27,
  feedAngles: [0.04, 2.18, 4.36],
  feedFoot: 0.83,
};
const b = (o, s, u, U, y, Y, d, D, c) => fbox(o, s, F, u, U, y, Y, d, D, c);
const m = (o, s, p, q, a, c, color) => beam(o, s, mount(...p), mount(...q), a, c, color);
function mountBody(out, detail) {
  b(out, 'concrete', -1.9, 1.94, -0.43, 1.57, -1.72, 1.73, concrete);
  lathe(
    out,
    'housing',
    [0, 0],
    [
      [1.54, 1.93, 1.93],
      [2.1, 1.91, 1.91],
      [4.75, 1.01, 1.01],
      [5.2, 1.09, 1.09],
    ],
    4,
    colors,
    { rotation: Math.atan2(P[2], P[0]) + Math.PI * 0.25 },
  );
  b(out, 'housing', -0.88, 0.89, 5.02, 7.22, -0.89, 0.89, colors);
  collar(out, [0, 0], 7.17, 0.27, 0.96, detail, darkSteel);
  collar(out, [0, 0], 5.04, 0.22, 1.3, detail, steel);
  const n = [8, 12, 16, 28][detail],
    r = 2.09;
  rimTrack(out, 'steel', r - 0.28, 0.55, 5.285, 0.113, n, lightSteel);
  rimTrack(out, 'steel', r, 0.077, 6.065, 0.06, n, lightSteel);
  for (let j = 0; j < n; j += detail > 1 ? 1 : 2) {
    const point = (r, i, y) => [
      r * Math.cos((i * Math.PI * 2) / n),
      y,
      r * Math.sin((i * Math.PI * 2) / n),
    ];
    beam(out, 'steel', point(r, j, 5.302), point(r, j, 6.111), 0.066, 0.066, lightSteel);
    if (detail === 3)
      beam(out, 'steel', point(r, j, 5.692), point(r, j + 1, 5.692), 0.047, 0.045, steel);
  }
  m(out, 'steel', [-0.71, 7.21, 0], [-1.38, 9.47, -1.56], 0.89, 0.73, lightSteel);
  m(out, 'steel', [0.71, 7.21, 0], [1.38, 9.47, -1.56], 0.89, 0.73, lightSteel);
  beam(out, 'steel', mount(-1.39, 9.45, -1.55), point(-1.22, 0, -1.84), 0.63, 0.61, darkSteel);
  beam(out, 'steel', mount(1.39, 9.45, -1.55), point(1.22, 0, -1.84), 0.63, 0.61, darkSteel);
  m(out, 'housing', [0, 9.48, -1.83], [0, 7.61, -3.58], 1.11, 0.67, colors);
  if (detail > 1)
    for (const u of [-0.3, 0.33])
      m(out, 'steel', [u, 5.37, 1.93], [u, 2.1, 2.66], 0.074, 0.066, lightSteel);
}
function build(mesh, detail) {
  const out = withFootprintCaps(mesh);
  mountBody(out, detail);
  reflector(out, site.dish, detail, bowl);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
