/** Browser-only Millennium Tower variants; detailed instanced source is retained. */
import {
  buildMillenniumGroundDeck,
  buildMillenniumHoodScreens,
  buildMillenniumRuntime,
  buildMillenniumSkyline,
} from './millennium-tower-model.mjs';
import { tube } from './structure-mesh.mjs';

const means = {
  metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  stainless: [0.818960257808076, 0.8228885700850488, 0.8228885700850488],
};
function braces(out) {
  for (const y of [173, 178, 183]) {
    tube(out, 'stainless', [-3.1, y, 16.1], [3.1, y, 16.1], 0.095, [0.67, 0.72, 0.75], 4);
    tube(out, 'stainless', [-3.1, y, 16.1], [3.1, y + 5, 16.1], 0.075, [0.67, 0.72, 0.75], 4);
  }
}
export function buildMillenniumReviewedSkyline(out) {
  const mapped = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (slot, ref, points, normal, uv, color) => {
        let c = color;
        if (
          slot === 'glass' &&
          points.some((p) => p[1] === 140.5) &&
          points.some((p) => p[1] === 0)
        )
          c = [0.2988, 0.4368, 0.4996];
        const mean = means[slot] ?? [1, 1, 1];
        out[name](
          slot,
          ref,
          points,
          normal,
          uv,
          c.map((v, i) => v * mean[i]),
        );
      },
    ]),
  );
  buildMillenniumSkyline(mapped);
  buildMillenniumGroundDeck(mapped);
  braces(mapped);
}
export function buildMillenniumDistrict(out) {
  const hood = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (slot, ref, points, normal, uv, color) => {
        const cap = points.every((p) => p[1] === 153.4);
        const wall = slot === 'glass' && points.every((p) => p[1] === 140.5 || p[1] === 153.4);
        const mapped =
          cap || wall ? points.map((p) => [p[0], p[1] === 153.4 ? 150.4 : p[1], p[2]]) : points;
        out[name](slot, ref, mapped, normal, uv, color);
      },
    ]),
  );
  buildMillenniumRuntime(hood, 'district');
  buildMillenniumHoodScreens(out);
  buildMillenniumGroundDeck(out);
  braces(out);
}
export function buildMillenniumStreet(out) {
  buildMillenniumRuntime(out, 'street');
}
export function buildMillenniumCloseup(out) {
  buildMillenniumRuntime(out, 'closeup');
}
