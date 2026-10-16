/** Small shelter derivatives; the detailed Aljaž source master remains separate. */
import { buildAljaz } from './aljaz-tower-model.mjs';
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import { face } from './heritage-tower-detail-mesh.mjs';

const mean = [0.908889, 0.908889, 0.908889];
function skylineColor(out) {
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((key) => [
      key,
      (component, ref, p, n, uv, c) =>
        out[key](
          'skyline',
          ref,
          p,
          n,
          uv,
          component === 'metal' ? c.map((v, i) => v * mean[i]) : c,
        ),
    ]),
  );
}
export function buildAljazSkyline(builder) {
  const out = skylineColor(builder),
    light = [0.72, 0.73, 0.69],
    steel = [0.29, 0.33, 0.34];
  loft(out, 'metal', [radialRing(0, 0.625, 0.625, 12), radialRing(2, 0.625, 0.625, 12)], light);
  loft(
    out,
    'metal',
    [radialRing(1.993, 0.642, 0.642, 12), radialRing(2.395, 0.038, 0.038, 12)],
    steel,
  );
  beam(out, 'metal', [0, 2.38, 0], [0, 2.9, 0], 0.018, 0.018, steel);
  for (const z of [-0.003, 0.003]) {
    const points = [
      [-0.52, 2.68, z],
      [-0.009, 2.68, z],
      [-0.009, 2.88, z],
      [-0.52, 2.88, z],
    ];
    face(out, 'metal', z < 0 ? points.reverse() : points, light);
  }
  // Dark pane accents are a far-view impression; the district and near versions have real recesses.
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      y = i % 2 ? 0.97 : 1.555,
      p = (t, h) => [0.632 * Math.sin(t), h, 0.632 * Math.cos(t)];
    face(
      out,
      'glass',
      [p(a - 0.11, y), p(a + 0.11, y), p(a + 0.11, y + 0.15), p(a - 0.11, y + 0.15)],
      [0.11, 0.17, 0.19],
    );
  }
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 6 + (i * 2 * Math.PI) / 3,
      q = (r, y, t = 0) => [
        r * Math.cos(a) - t * Math.sin(a),
        y,
        r * Math.sin(a) + t * Math.cos(a),
      ];
    beam(out, 'metal', q(0.55, 0.06), q(1.22, 0.06), 0.073, 0.095, steel);
    for (const t of [-0.3, 0.3])
      beam(out, 'metal', q(0.78, 0.06), q(1.22, 0.06, t), 0.065, 0.085, steel);
    beam(out, 'metal', q(0.635, 1.91), q(2.23, 0.08), 0.008, 0.008, steel);
  }
  beam(out, 'metal', [0.014, 2.5, 0], [-0.45, 1.72, -0.44], 0.008, 0.008, steel);
  beam(out, 'metal', [-0.45, 1.72, -0.44], [-1.72, 0.018, -1.42], 0.008, 0.008, steel);
}
export const buildAljazDistrict = (out) =>
  buildAljaz(out, {
    segments: 24,
    roofSegments: 24,
    shellBands: false,
    rivets: false,
    lettering: false,
    cutFlag: false,
  });
export const buildAljazStreet = (out) =>
  buildAljaz(out, {
    segments: 72,
    roofSegments: 48,
    shellBands: false,
  });
