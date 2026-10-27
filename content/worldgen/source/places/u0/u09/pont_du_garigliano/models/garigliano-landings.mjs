/** Short mapped landing transitions; the three-span bridge body remains unchanged. */
import {
  beam,
  beamPath,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import C from './garigliano-controls.json' with { type: 'json' };

const linear = (h) =>
  h.match(/../g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const green = linear(C.paint),
  stone = linear(C.stone),
  paving = linear('aaa59a'),
  asphalt = linear('646766');
const landingDrafts = C.landings;
export function buildGariglianoLandings(target, level) {
  const far = level === 'skyline',
    spacing = { street: 0.65, closeup: 0.22, master: 0.16 }[level],
    out = far
      ? Object.fromEntries(
          ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
            name,
            (_component, ...args) => target[name]('far', ...args),
          ]),
        )
      : target;
  for (const cap of landingDrafts) {
    const stations = [
      {
        x: cap.end * C.halfLength,
        w: C.halfWidth,
        y: C.deckEndY + C.walkRise,
        roadY: C.deckEndY,
        roadEdgeY: C.deckEndY,
      },
      {
        x: cap.end * (C.halfLength + cap.length),
        w: cap.outerHalfWidth,
        y: cap.outerY,
        roadY: cap.outerRoadY,
        roadEdgeY: cap.outerY,
      },
    ].sort((a, b) => a.x - b.x);
    const prism = (slot, edgeA, edgeB, top, depth, color) => {
      const rings = stations.map((s) => {
        const a = edgeA(s),
          b = edgeB(s),
          ya = top(s, a),
          yb = top(s, b);
        return [
          [s.x, ya - depth, a],
          [s.x, yb - depth, b],
          [s.x, yb, b],
          [s.x, ya, a],
        ].reverse();
      });
      loft(out, slot, rings, color, { cap: !far });
      if (far) {
        const face = cap.end < 0 ? [...rings[0]].reverse() : rings.at(-1);
        out.addConvexPolygon(slot, 'palette:#ffffff', face, normalFor(...face), [], color);
      }
    };
    const roadY = (s, z) =>
      s.roadY + (s.roadEdgeY - s.roadY) * Math.max(0, (Math.abs(z) - 6) / (C.roadHalfWidth - 6));
    for (const [a, b] of [
      [-C.roadHalfWidth, -6],
      [-6, 6],
      [6, C.roadHalfWidth],
    ])
      prism(
        'road',
        () => a,
        () => b,
        roadY,
        0.26,
        asphalt,
      );
    for (const side of [-1, 1]) {
      prism(
        'road',
        (s) => Math.min(side * C.roadHalfWidth, side * s.w),
        (s) => Math.max(side * C.roadHalfWidth, side * s.w),
        (s) => s.y,
        0.4,
        paving,
      );
      if (!far)
        prism(
          'stone',
          () => side * C.roadHalfWidth - 0.1,
          () => side * C.roadHalfWidth + 0.1,
          (s) => s.y + 0.01,
          0.18,
          stone,
        );
      const ends = stations.map((s) => [s.x, s.y, side * (s.w - 0.12)]),
        length = Math.hypot(...ends[1].map((v, i) => v - ends[0][i]));
      if (far) {
        // These short terminal railings are subpixel at skyline distance.
      } else if (!spacing) {
        beam(
          out,
          'metal',
          ends[0].map((v, i) => v + (i === 1 ? 0.56 : 0)),
          ends[1].map((v, i) => v + (i === 1 ? 0.56 : 0)),
          0.07,
          0.97,
          green,
        );
      } else {
        const n = Math.ceil(length / spacing);
        for (let i = 1; i <= n; i++) {
          const t = i / n,
            p = ends[0].map((v, j) => v + (ends[1][j] - v) * t);
          beam(
            out,
            'metal',
            [p[0], p[1] + 0.04, p[2]],
            [p[0], p[1] + C.railingHeight, p[2]],
            0.045,
            0.07,
            green,
          );
        }
        for (const raise of [0.08, C.railingHeight])
          beamPath(
            out,
            'metal',
            ends.map((p) => [p[0], p[1] + raise, p[2]]),
            0.08,
            0.1,
            green,
          );
      }
    }
  }
}
