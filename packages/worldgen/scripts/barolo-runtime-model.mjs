/** Budgeted Palacio Barolo exterior; detailed instanced master remains in barolo-palace-model. */
import { buildBaroloRuntime, buildBaroloSkyline } from './barolo-palace-model.mjs';
import { box } from './structure-mesh.mjs';

const means = {
  concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
  metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
};
export function buildBaroloCloseup(out) {
  buildBaroloRuntime(out, 'closeup');
}
export function buildBaroloDistrict(out) {
  buildBaroloRuntime(out, 'district', { omitArchRelief: true, districtBalconySides: 3 });
}
export function buildBaroloStreet(out) {
  buildBaroloRuntime(out, 'street', { omitArchRelief: true });
}
/** Keep the H-plan and 7.5 by 13.5 m through passage even at skyline distance. */
export function buildBaroloReviewedSkyline(out) {
  const mapped = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (slot, ref, points, normal, uv, color) => {
        if (points.every((p) => p[1] <= 40.100001)) return;
        const mean = means[slot] ?? [1, 1, 1];
        out[name](
          slot,
          ref,
          points,
          normal,
          uv,
          color.map((c, i) => c * mean[i]),
        );
      },
    ]),
  );
  buildBaroloSkyline(mapped);
  const stone = [0.8, 0.76, 0.66].map((c, i) => c * means.concrete[i]);
  for (const [z0, z1] of [
    [-22.105, -11.5],
    [11.5, 22.105],
  ]) {
    for (const [x0, x1] of [
      [-15.44, -3.75],
      [3.75, 15.44],
    ])
      box(out, 'concrete', [x0, 0, z0], [x1, 40.1, z1], stone);
    box(out, 'concrete', [-3.75, 13.5, z0], [3.75, 40.1, z1], stone);
  }
  for (const [x0, x1] of [
    [-5.5, -3.75],
    [3.75, 5.5],
  ])
    box(out, 'concrete', [x0, 0, -11.5], [x1, 40.1, 11.5], stone);
  box(out, 'concrete', [-3.75, 13.5, -11.5], [3.75, 40.1, 11.5], stone);
  box(out, 'concrete', [-3.75, 0, -22.105], [3.75, 0.08, 22.105], stone);
}
