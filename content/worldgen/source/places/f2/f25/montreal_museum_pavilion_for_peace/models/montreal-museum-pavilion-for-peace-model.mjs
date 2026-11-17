import {
  areaSign,
  bands,
  block,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  plane,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  pane: surface('window', 'window_grid', 0.58, 0.04),
  rail: surface('trim', 'metal_painted', 0.75, 0.28),
  wall: surface('wall', 'concrete_panel', 0.86),
  stone: surface('foundation', 'stone_ashlar', 0.91),
  roof: surface('roof', 'concrete_plain', 0.92),
  dark: surface('trim', 'metal_painted', 0.87, 0.05),
};
const c = palette({
  glass: '768b90',
  gray: 'a2afad',
  metal: 'c8cfc9',
  wall: 'a3a5a2',
  roof: 'e6e5da',
  stem: 'b8c1bb',
  white: 'd3d5cb',
  ground: 'aaa79d',
  dark: '687675',
});
function clip(outline, maximum) {
  const result = [];
  const inside = ([, z]) => z <= maximum;
  for (const [a, b] of pairs(closed(outline))) {
    if (inside(a)) result.push(a);
    if (inside(a) !== inside(b))
      result.push([mix(a[0], b[0], (maximum - a[1]) / (b[1] - a[1])), maximum]);
  }
  return result;
}
function stripScreen(out, w, inset, levels, lod, sideIndex) {
  if (lod === 0) return;
  if (w.length < 2.6) return;
  const stride = [0, 1.52, 0.93, 0.61][lod];
  const count = Math.max(2, Math.round(w.length / stride));
  const pad = lod < 2 ? 0.034 : 0.057;
  for (let i = 0; i <= count; i++) {
    const x = mix(0.17, w.length - 0.17, i / count);
    for (const [j, [base, top]] of levels.entries()) {
      const d = inset + 0.17 + (0.13 * Math.sin((j + sideIndex) * 0.7) + 0.08);
      const turn = Math.sin(i * 0.67 + j * 0.41) * 0.055;
      const lo = x - pad,
        hi = x + pad;
      face(
        out,
        'rail',
        [
          w.p(lo, base, d),
          w.p(hi, base, d + 0.06),
          w.p(hi + turn, top, d + 0.06),
          w.p(lo + turn, top, d),
        ],
        w.normal,
        i % 4 === 0 ? c.stem : c.metal,
      );
      if (lod === 3 && i % 4 === 0) {
        const direction = [w.normal[2], 0.035, -w.normal[0]];
        face(
          out,
          'rail',
          [
            w.p(hi, base, d + 0.06),
            w.p(hi, base, d - 0.03),
            w.p(hi + turn, top, d - 0.03),
            w.p(hi + turn, top, d + 0.06),
          ],
          direction,
          c.gray,
        );
      }
    }
  }
}
function curtain(out, outline, base, roof, grade, lod, upper = false) {
  const side = areaSign(outline);
  shell(out, outline, (p) => (upper ? base : grade(p) - 0.53), roof, {
    wall: 'wall',
    roof: 'roof',
    color: c.wall,
    roofColor: c.roof,
  });
  for (const [[a, b], i] of pairs(closed(outline)).map((p, i) => [p, i])) {
    const w = edge(a, b, side);
    if (w.length < 1.38) continue;
    const white = upper
      ? [
          [base + 0.02, base + 0.26],
          [roof - 0.24, roof + 0.03],
        ]
      : [
          [0.17, 0.35],
          [roof - 0.2, roof + 0.02],
        ];
    for (const [lo, hi] of white)
      trimBlock(out, 'rail', w, 0, w.length, lo, hi, -0.04, 0.22, c.white);
    const levels = upper
      ? [
          [base + 0.43, base + 4.12],
          [base + 4.45, base + 8.0],
          [base + 8.31, roof - 0.41],
        ]
      : [
          [0.48, 4.45],
          [4.76, 8.19],
          [8.48, roof - 0.28],
        ];
    for (const [b, t] of levels) {
      panel(out, 'pane', w, 0.085, w.length - 0.085, b, t, 0.031, c.glass);
      if (lod > 0) panel(out, 'dark', w, 0.042, w.length - 0.04, t, t + 0.13, 0.061, c.dark);
    }
    stripScreen(out, w, 0.1, levels, lod, i);
  }
}
function draw(out, lod, plan, grade) {
  const roof = plan.roof;
  const outline = plan.footprint;
  curtain(out, outline, 0.0, 12.29, grade, lod);
  const back = clip(outline, -13.4);
  // The two upper planes follow the mapped east axis and the gently turned west face.
  const shifted = outline.map(([x, z]) => [x + 0.23 - 0.045 * Math.max(0, z + 13.4), z + 0.17]);
  const upper = shifted.map(([x, z]) => [x, z < 0 ? z + 0.18 : z - 0.06]);
  curtain(out, upper, 12.16, roof, grade, lod, true);
  if (lod > 1) {
    const gap = plane(-13.3, 1);
    const left = Math.min(...back.map((p) => p[0]));
    const right = Math.max(...back.map((p) => p[0]));
    panel(out, 'dark', gap, left - 0.03, left + 0.16, 12.63, roof - 0.42, 0.05, c.dark);
    panel(out, 'dark', gap, right - 0.16, right + 0.04, 12.63, roof - 0.42, 0.05, c.dark);
  }
  const front = plane(0.22, 1);
  trimBlock(out, 'rail', front, -6.3, 6.7, 3.85, 4.14, -0.25, 0.71, c.white);
  panel(out, 'pane', front, -4.94, 5.37, 0.37, 3.66, 0.19, c.glass);
  for (const x of [-4.9, -2.51, -0.14, 2.36, 5.35])
    panel(out, 'rail', front, x - 0.052, x + 0.052, 0.4, 3.66, 0.205, c.gray);
  trimBlock(out, 'stone', front, -6.38, 6.75, 0.04, 0.34, -0.3, 1.3, c.ground);
  if (lod > 0) {
    block(out, 'roof', -7.4, roof - 0.03, -21.0, 9.4, 0.61, 4.9, c.white);
    block(out, 'dark', 9.3, roof - 0.01, -5.6, 1.18, 0.41, 2.61, c.dark);
  }
}
export const { model, skyline, district, street, closeup } = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [52, 32, 46],
    lookAt: [0, 11, -10],
    views: [
      {
        name: 'bishop-street-glass-and-aluminum-veil',
        position: [25, 7.4, 35],
        lookAt: [1.5, 12.8, -7],
      },
      { name: 'slanted-corner-and-upper-screen', position: [-32, 19, 14], lookAt: [-4, 14, -15] },
      { name: 'white-roofs-and-rear-link', position: [34, 39, -47], lookAt: [1, 13, -13] },
    ],
    brief:
      'The six-level Pavilion for Peace with two glazed volumes, offset upper form and an aluminum-strip veil on Bishop Street.',
  },
  draw,
);
