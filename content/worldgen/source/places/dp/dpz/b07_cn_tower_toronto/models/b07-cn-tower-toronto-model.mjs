import {
  areaSign,
  at,
  cap,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  ring,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  base: surface('foundation', 'concrete_plain'),
  concrete: surface('wall', 'concrete_boardformed'),
  glass: surface('window', 'window_grid', 0.37, 0.24),
  trim: surface('trim', 'metal_painted', 0.63, 0.1),
  dome: surface('roof', 'metal_painted', 0.61, 0.1),
  grating: surface('trim', 'metal_stainless', 0.46, 0.35),
};
const C = palette({
  base: 'adaaa0',
  rail: 'a7aaa7',
  seam: '888983',
  shaft: 'c6c2b5',
  light: 'd3cdbf',
  shadow: 'b2afa3',
  glass: '5f7b85',
  darkglass: '435b66',
  white: 'f5f3e8',
  pod: 'd7d9d1',
  top: 'babbaf',
  red: 'b75b50',
  silver: 'adb7b5',
});

const scale = (p, n) => p.map((x) => x * n);
function loft(out, points, controls, color, grade) {
  for (const [a, b] of pairs(controls)) {
    for (const [i, [p, q]] of pairs(closed(points)).entries()) {
      const normal = edge(p, q, areaSign(points)).normal;
      const vertices = [
        at(scale(p, a[1]), a[0] + (grade && a[0] < 1 ? grade(p) : 0)),
        at(scale(q, a[1]), a[0] + (grade && a[0] < 1 ? grade(q) : 0)),
        at(scale(q, b[1]), b[0]),
        at(scale(p, b[1]), b[0]),
      ];
      const tint = Array.isArray(color[0]) ? color[i % color.length] : color;
      // A conforming foundation has a nonplanar foot. Split its side faces individually.
      if (grade && a[0] < 1) {
        face(out, 'concrete', vertices.slice(0, 3), normal, tint);
        face(out, 'concrete', [vertices[0], vertices[2], vertices[3]], normal, tint);
      } else face(out, 'concrete', vertices, normal, tint);
    }
  }
  const [y, s] = controls.at(-1);
  cap(
    out,
    'concrete',
    points.map((p) => scale(p, s)),
    y,
    color[0]?.length ? color[0] : color,
  );
}

function elevator(out, core, rungs, lod) {
  const sign = areaSign(core);
  for (let i = 0; i < core.length; i += 2) {
    const a = core[i],
      b = core[(i + 1) % core.length];
    const wall = edge(a, b, sign),
      n = wall.normal;
    const unit = (v, y, s, d) => [
      mix(a[0], b[0], v) * s + n[0] * d,
      y,
      mix(a[1], b[1], v) * s + n[2] * d,
    ];
    const tile = (l, r, h0, h1, s0, s1, d, slot, tint) =>
      face(
        out,
        slot,
        [unit(l, h0, s0, d), unit(r, h0, s0, d), unit(r, h1, s1, d), unit(l, h1, s1, d)],
        n,
        tint,
      );
    for (const [[y0, s0], [y1, s1]] of pairs(rungs)) {
      tile(0.22, 0.78, y0, y1, s0, s1, 0.09, 'glass', C.darkglass);
      if (lod < 1) continue;
      const rows = Math.ceil((y1 - y0) / (lod > 2 ? 5 : lod === 2 ? 8 : 40));
      for (let j = 0; j < rows; j++) {
        const t0 = (j + 0.075) / rows,
          t1 = (j + 0.925) / rows;
        const pane = j % 4 === 1 ? C.darkglass : C.glass;
        for (const [l, r] of lod > 1
          ? [
              [0.242, 0.402],
              [0.424, 0.575],
              [0.596, 0.757],
            ]
          : [
              [0.241, 0.493],
              [0.507, 0.758],
            ])
          tile(
            l,
            r,
            mix(y0, y1, t0),
            mix(y0, y1, t1),
            mix(s0, s1, t0),
            mix(s0, s1, t1),
            0.13,
            'glass',
            pane,
          );
      }
      for (const l of lod > 1 ? [0.222, 0.407, 0.58, 0.758] : [0.22, 0.49, 0.76])
        tile(l, l + 0.018, y0, y1, s0, s1, 0.153, 'trim', C.rail);
    }
  }
}

function lowerPod(out, dims, lod, radome, pod, roof) {
  const n = [10, 20, 36, 60][lod],
    zero = [0, 0];
  const { lowerDeck, mainObservation, restaurantDeck, edgeWalk } = dims;
  ring(
    out,
    'dome',
    zero,
    [
      [328, 7.8],
      [330, radome * 0.7],
      [332, radome * 0.89],
      [335, radome * 0.98],
      [338, radome],
      [339.4, pod * 0.94],
    ],
    n,
    C.white,
  );
  ring(
    out,
    'trim',
    zero,
    [
      [339.4, pod * 0.94],
      [340.9, pod],
      [lowerDeck, pod],
    ],
    n,
    C.pod,
  );
  ring(
    out,
    'glass',
    zero,
    [
      [lowerDeck, pod * 0.992],
      [mainObservation - 0.5, pod * 0.986],
    ],
    n,
    C.darkglass,
  );
  ring(
    out,
    'trim',
    zero,
    [
      [mainObservation - 0.5, pod * 0.986],
      [mainObservation + 0.15, pod * 1.006],
    ],
    n,
    C.white,
  );
  ring(
    out,
    'glass',
    zero,
    [
      [mainObservation + 0.15, pod * 0.989],
      [restaurantDeck - 0.45, pod * 0.982],
    ],
    n,
    C.glass,
  );
  ring(
    out,
    'trim',
    zero,
    [
      [restaurantDeck - 0.45, pod * 0.982],
      [restaurantDeck + 0.21, pod],
    ],
    n,
    C.white,
  );
  ring(
    out,
    'glass',
    zero,
    [
      [restaurantDeck + 0.21, pod * 0.961],
      [edgeWalk - 0.41, pod * 0.974],
    ],
    n,
    C.darkglass,
  );
  ring(
    out,
    'trim',
    zero,
    [
      [edgeWalk - 0.41, pod * 0.974],
      [edgeWalk + 0.33, pod * 0.998],
      [358, pod * 0.96],
      [360, roof],
    ],
    n,
    C.pod,
  );
  ring(
    out,
    'dome',
    zero,
    [
      [360, roof],
      [362.4, roof * 0.9],
      [365, roof * 0.71],
      [367.3, 14.1],
      [370, 7.4],
    ],
    n,
    C.top,
  );
  if (lod === 0) return;
  const divisions = [0, 26, 56, 84][lod];
  for (let i = 0; i < divisions; i++) {
    const angle = (2 * Math.PI * i) / divisions;
    const p = (r, d = 0) => [Math.cos(angle + d) * r, Math.sin(angle + d) * r];
    const w = edge(p(pod * 0.986, -0.004), p(pod * 0.986, 0.004));
    for (const [a, b] of [
      [lowerDeck + 0.11, mainObservation - 0.53],
      [mainObservation + 0.25, restaurantDeck - 0.51],
      [restaurantDeck + 0.25, edgeWalk - 0.46],
    ])
      panel(out, 'grating', w, 0, w.length, a, b, 0.12, C.rail);
    if (lod > 1)
      panel(out, 'grating', w, 0, w.length, edgeWalk + 0.35, edgeWalk + 0.98, 0.13, C.rail);
  }
  ring(
    out,
    'grating',
    zero,
    [
      [edgeWalk + 0.91, pod * 0.994],
      [edgeWalk + 1.02, pod * 0.994],
    ],
    n,
    C.rail,
  );
}

function top(out, { skypodDeck, fullHeight }, sky, radii, lod) {
  const zero = [0, 0],
    n = [8, 16, 24, 36][lod];
  ring(
    out,
    'dome',
    zero,
    [
      [439.9, 5.05],
      [441, sky * 0.65],
      [443.5, sky * 0.89],
      [skypodDeck - 0.51, sky],
    ],
    n,
    C.pod,
  );
  ring(
    out,
    'glass',
    zero,
    [
      [skypodDeck - 0.51, sky],
      [skypodDeck + 2, sky * 0.977],
    ],
    n,
    C.darkglass,
  );
  ring(
    out,
    'dome',
    zero,
    [
      [skypodDeck + 2, sky * 0.977],
      [450.2, sky],
      [453.6, sky * 0.81],
      [456.8, 5.0],
    ],
    n,
    C.white,
  );
  const bands = [
    [450.0, 456.8, 5.04, 5.01, C.silver],
    [456.8, 476.1, radii[0] * 0.72, 4.6, C.white],
    [476.1, 482.3, 4.6, 3.85, C.white],
    [482.3, 492.8, 3.85, 2.96, C.pod],
    [492.8, 500.25, 2.96, 2.93, C.red],
    [500.25, 508.72, 2.91, 2.52, C.white],
    [508.72, 515.9, 2.45, 2.41, C.red],
    [515.9, 524.18, 2.38, 1.82, C.white],
    [524.18, 530.42, 1.81, 1.65, C.red],
    [530.42, 538.31, 1.6, 1.21, C.white],
    [538.31, 544.85, 1.19, 0.88, C.red],
    [544.85, 550.3, 0.86, 0.76, C.white],
    [550.3, fullHeight, 0.75, 0.32, C.red],
  ];
  for (const [a, b, r0, r1, color] of bands)
    ring(
      out,
      'trim',
      zero,
      [
        [a, r0],
        [b, r1],
      ],
      n,
      color,
    );
  if (lod > 0)
    for (const [y, r] of [
      [458, 5.08],
      [466.8, 4.94],
      [482.5, 4],
      [500.2, 3.05],
      [518, 2.54],
      [533, 1.63],
    ]) {
      ring(
        out,
        'grating',
        zero,
        [
          [y, r],
          [y + 0.26, r * 0.99],
        ],
        n,
        C.silver,
      );
      if (lod > 1)
        ring(
          out,
          'grating',
          zero,
          [
            [y + 0.26, r * 0.82],
            [y + 0.35, r * 0.97],
          ],
          n,
          C.silver,
        );
    }
  cap(
    out,
    'trim',
    Array.from({ length: n }, (_, i) => [
      Math.cos((i * Math.PI * 2) / n) * 0.32,
      Math.sin((i * Math.PI * 2) / n) * 0.32,
    ]),
    fullHeight,
    C.red,
  );
}

function draw(out, lod, dims, grade) {
  const features = new Map(dims.footprints.map((p) => [p.id, p.points]));
  const ground = features.get(32742038),
    core = features.get(288273461);
  const base = lod === 0 ? ground.filter((_, i) => i % 2 === 0) : ground;
  shell(out, base, (p) => Math.min(-0.35, grade(p) - 0.27), 1.2, {
    wall: 'base',
    color: C.base,
    roof: 'dome',
    roofColor: C.pod,
  });
  const coreRows = [
    [1.19, 1],
    [48, 0.97],
    [151, 0.835],
    [230, 0.748],
    [329, 0.66],
    [368, 0.603],
    [440, 0.465],
  ];
  loft(out, core, coreRows, [C.shaft, C.light, C.shadow]);
  elevator(out, core, coreRows.slice(0, 5), lod);
  const buttressRows =
    lod === 0
      ? [
          [0, 1],
          [110, 0.69],
          [240, 0.385],
          [330, 0.233],
        ]
      : [
          [0, 1],
          [40, 0.94],
          [105, 0.751],
          [178, 0.562],
          [248, 0.402],
          [307, 0.282],
          [330, 0.233],
        ];
  for (const id of [288273459, 288273458, 288273460])
    loft(out, features.get(id), buttressRows, [C.shadow, C.shaft, C.light], (p) => grade(p) - 0.42);
  const r = (id) => Math.max(...features.get(id).map((p) => Math.hypot(...p)));
  lowerPod(out, dims, lod, r(288273793), r(288273795), r(288273794));
  top(out, dims, r(288273454), [r(288273452)], lod);
}

const tower = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [455, 275, 610],
    lookAt: [0, 271, 0],
    yaw: 0.96,
    sun: [-370, 870, 450],
    brief:
      'Geographically fitted concrete CN Tower with three swept buttresses, stacked observation decks and segmented broadcast mast.',
    views: [
      { name: 'tower-buttresses-and-base-grade', position: [113, 19, 79], lookAt: [0, 16, 0] },
      { name: 'observation-levels-and-radome', position: [121, 347, 108], lookAt: [0, 349, 0] },
      { name: 'skypod-and-mast', position: [122, 485, 123], lookAt: [0, 476, 0] },
      { name: 'tower-in-profile', position: [-542, 246, 495], lookAt: [0, 263, 0] },
    ],
  },
  draw,
);

export const { skyline, district, street, closeup } = tower;
export const model = {
  ...tower.model,
  category: 'tower',
  runtimeLodOverlay: { ...tower.model.runtimeLodOverlay, errorMeters: 3.1 },
};
