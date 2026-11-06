import { bridgeControls as B, bridgeSurfaces, buildBridgeLevel, deckY } from './bridge-model.mjs';
import { buildStairLevel, stairControls as S, stairSurfaces } from './west-stairs.mjs';
export const componentControls = [
  {
    ...B,
    id: 'ponte_coperto_main',
    title: 'Ponte Coperto — covered bridge and chapel',
    part: 'road',
    center: [0, 0],
    originY: 0,
    piers: B.mainPiers,
    heightProfile: B.profile,
  },
  {
    ...S,
    title: 'Ponte Coperto — western bank stairs',
    part: 'stairs',
    center: S.centerInBridge,
    originY: 0,
    piers: [],
    heightProfile: [
      [S.ends[0], S.topHeight],
      [S.ends[1], S.bottomHeight],
    ],
  },
];
export const surfacesById = {
  ponte_coperto_main: bridgeSurfaces,
  ponte_coperto_west_stairs: stairSurfaces,
};
export const assemblySurfaces = { ...bridgeSurfaces, ...stairSurfaces };
export const buildCopertoComponent = (out, level, id) =>
  id === 'ponte_coperto_main'
    ? buildBridgeLevel(out, level)
    : id === 'ponte_coperto_west_stairs'
      ? buildStairLevel(out, level)
      : (() => {
          throw Error('Unknown Ponte Coperto component ' + id);
        })();
export function buildAssembly(out, level = 'master') {
  buildBridgeLevel(out, level);
  const c = Math.cos(S.angleToBridge),
    s = Math.sin(S.angleToBridge),
    P = ([x, y, z]) => [
      S.centerInBridge[0] + c * x + s * z,
      y,
      S.centerInBridge[1] - s * x + c * z,
    ],
    N = ([x, y, z]) => [c * x + s * z, y, -s * x + c * z],
    mapped = {};
  for (const method of ['addTriangle', 'addQuad', 'addConvexPolygon'])
    mapped[method] = (m, r, p, n, uv, color) => out[method](m, r, p.map(P), N(n), uv, color);
  buildStairLevel(mapped, level);
}
export { deckY };
