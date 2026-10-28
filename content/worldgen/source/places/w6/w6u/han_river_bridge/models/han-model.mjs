/** Original Han River swing bridge: A-mast/stays, perforated pivot drum and haunched approaches. */
import {
  beam,
  beamPath,
  cross,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import controls from './han-controls.json' with { type: 'json' };
export const hanControls = controls;
const C = controls;
export const hanSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
  road: { slot: 'foundation', graph: 'concrete_plain', roughness: 1, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.25 },
  walk: { slot: 'foundation', graph: 'brick', roughness: 1, metallic: 0 },
};
const linear = (h) =>
  h.match(/../g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const colors = {
  stone: linear('c4c6ba'),
  shade: linear('a2aaa2'),
  blue: linear('355b83'),
  steel: linear('7b898b'),
  green: linear('526f66'),
  road: linear('69716b'),
  walk: linear('ad8e7e'),
  red: linear('985b50'),
  gold: linear('b6aa79'),
  line: linear('d3c7a1'),
};
const configs = {
  skyline: {
    step: 90,
    girders: 0,
    posts: 0,
    lamps: 0,
    cables: 2,
    round: 6,
    holes: 0,
    detail: false,
  },
  district: {
    step: 65,
    girders: 0,
    posts: 32,
    lamps: 0,
    cables: 4,
    round: 6,
    holes: 0,
    detail: false,
  },
  street: {
    step: 10,
    girders: 3,
    posts: 6,
    lamps: 40,
    cables: 9,
    round: 12,
    holes: 12,
    detail: false,
  },
  closeup: {
    step: 5,
    girders: 5,
    posts: 3.5,
    lamps: 28,
    cables: 12,
    round: 20,
    holes: 20,
    detail: true,
  },
  master: {
    step: 3.5,
    girders: 5,
    posts: 2.8,
    lamps: 25,
    cables: 14,
    round: 28,
    holes: 24,
    detail: true,
  },
};
function interpolate(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [a, y] = points[i - 1],
      [b, z] = points[i];
    if (x <= b) return y + ((z - y) * (x - a)) / (b - a);
  }
  return points.at(-1)[1];
}
export const hanDeckY = (x) => interpolate(C.deckProfile, x);
export const hanCenterZ = (x) => interpolate(C.spine, x);
function writer(target, far) {
  function emit(slot, _ref, points, hint, _uv, color) {
    const p = points.map(([x, y, z]) => [x, y, z + hanCenterZ(x)]);
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]],
        n = normalFor(...t);
      if (hint && n.reduce((v, q, j) => v + q * hint[j], 0) < 0) {
        t = [t[0], t[2], t[1]];
        n = normalFor(...t);
      }
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, j) => v - t[0][j]),
            t[2].map((v, j) => v - t[0][j]),
          ),
        ) < 1e-10
      )
        continue;
      target.addTriangle(
        far ? 'far' : slot,
        'palette:#ffffff',
        t,
        n,
        t.map((p) => [p[0], p[1]]),
        color,
      );
    }
  }
  return { addTriangle: emit, addQuad: emit, addConvexPolygon: emit };
}
function prism(o, slot, lo, hi, color) {
  box(o, slot, lo, hi, color);
}
function ribbon(o, slot, a, b, z0, z1, top, depth, step, color) {
  const xs = [
    a,
    b,
    ...C.spine.map((p) => p[0]).filter((x) => x > a && x < b),
    ...C.deckProfile.map((p) => p[0]).filter((x) => x > a && x < b),
  ];
  for (const x of [C.ends[0][0] + 4, C.ends[1][0] - 4]) if (x > a && x < b) xs.push(x);
  for (let x = a + step; x < b; x += step) xs.push(x);
  xs.sort((a, b) => a - b);
  const unique = xs.filter((x, i) => !i || x - xs[i - 1] > 0.0001);
  const rings = unique.map((x) => [
    [x, top(x) - depth(x), z0],
    [x, top(x), z0],
    [x, top(x), z1],
    [x, top(x) - depth(x), z1],
  ]);
  loft(o, slot, rings, color);
}
function cylindrical(o, slot, x, y0, y1, r0, r1, n, color) {
  loft(o, slot, [radialRing(y0, r0, r0, n, [x, 0]), radialRing(y1, r1, r1, n, [x, 0])], color);
}
function drum(o, cfg) {
  const x = C.pivotX,
    y = hanDeckY(x),
    r = 6.4;
  cylindrical(o, 'concrete', x, -0.7, y - 7.2, 4.2, 4.2, cfg.round, colors.stone);
  cylindrical(o, 'concrete', x, y - 7.2, y - 5.4, 4.2, r, cfg.round, colors.stone);
  cylindrical(o, 'metal', x, y - 3.1, y - 1.1, r + 0.1, r + 0.1, cfg.round, colors.blue);
  if (!cfg.holes) {
    cylindrical(o, 'concrete', x, y - 5.4, y - 3.1, r, r, cfg.round, colors.stone);
    return;
  }
  const count = cfg.holes,
    segments = cfg.detail ? 12 : 8,
    cy = y - 4.25,
    hr = 0.38;
  // Closed outer/inner panel rings around real open portholes; no black discs.
  const p = (u, v, radius) => [x + radius * Math.cos(u), cy + v, radius * Math.sin(u)];
  for (let i = 0; i < count; i++) {
    const center = (i * Math.PI * 2) / count,
      halfAngle = Math.PI / count,
      corner = Math.atan2(1.15, halfAngle * r),
      angles = [
        ...Array.from({ length: segments + 1 }, (_, j) => (j * Math.PI * 2) / segments),
        corner,
        Math.PI - corner,
        Math.PI + corner,
        Math.PI * 2 - corner,
      ].sort((a, b) => a - b);
    for (let j = 1; j < angles.length; j++) {
      const t = angles[j - 1],
        t2 = angles[j];
      const q = (t) => {
          const dx = Math.cos(t),
            dy = Math.sin(t),
            scale = Math.min(
              (halfAngle * r) / Math.max(0.0001, Math.abs(dx)),
              1.15 / Math.max(0.0001, Math.abs(dy)),
            );
          return {
            hole: [center + (dx * hr) / r, dy * hr],
            outer: [center + (dx * scale) / r, dy * scale],
          };
        },
        a = q(t),
        b = q(t2);
      for (const [rad, sign] of [
        [r, 1],
        [r - 0.2, -1],
      ]) {
        const pts = [p(...a.hole, rad), p(...b.hole, rad), p(...b.outer, rad), p(...a.outer, rad)],
          n = [Math.cos(center) * sign, 0, Math.sin(center) * sign];
        o.addConvexPolygon('metal', 'palette:#ffffff', pts, n, () => [0, 0], colors.stone);
      }
      const pts = [p(...a.hole, r), p(...a.hole, r - 0.2), p(...b.hole, r - 0.2), p(...b.hole, r)];
      o.addConvexPolygon(
        'metal',
        'palette:#ffffff',
        pts,
        normalFor(...pts),
        () => [0, 0],
        colors.shade,
      );
    }
  }
}
function approach(o, cfg, stations) {
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1],
      b = stations[i],
      depth = (x) =>
        cfg.girders ? 1 + 1.2 * Math.pow(Math.cos((Math.PI * (x - a)) / (b - a)), 2) : 1.6;
    ribbon(
      o,
      'concrete',
      a,
      b,
      -6.45,
      6.45,
      (x) => hanDeckY(x) - 0.1,
      () => 0.28,
      cfg.step,
      colors.stone,
    );
    for (const z of [-6.25, 6.25])
      ribbon(
        o,
        'concrete',
        a,
        b,
        z - 0.2,
        z + 0.2,
        (x) => hanDeckY(x) - 0.2,
        depth,
        cfg.step,
        colors.stone,
      );
    if (cfg.girders)
      for (let j = 0; j < cfg.girders; j++) {
        const z = cfg.girders === 1 ? 0 : -4.9 + (9.8 * j) / (cfg.girders - 1);
        ribbon(
          o,
          'metal',
          a,
          b,
          z - 0.19,
          z + 0.19,
          (x) => hanDeckY(x) - 0.35,
          depth,
          cfg.step,
          colors.green,
        );
        if (cfg.detail)
          ribbon(
            o,
            'metal',
            a,
            b,
            z - 0.4,
            z + 0.4,
            (x) => hanDeckY(x) - depth(x) - 0.2,
            () => 0.14,
            cfg.step,
            colors.green,
          );
      }
  }
  for (const [x, index] of stations.map((x, i) => [x, i])) {
    const end =
        (index === 0 && x === C.ends[0][0]) ||
        (index === stations.length - 1 && x === C.ends[1][0]),
      top = hanDeckY(x) - 2.2;
    if (end) {
      prism(o, 'concrete', [x - 1.4, top - 2.8, -6.8], [x + 1.4, top, 6.8], colors.shade);
      continue;
    }
    const rings = [
      radialRing(0.3, 2.2, 3.6, cfg.round, [x, 0]),
      radialRing(top - 0.9, 1.55, 2.9, cfg.round, [x, 0]),
      radialRing(top, 2.6, 4.9, cfg.round, [x, 0]),
    ];
    loft(o, 'concrete', rings, colors.stone);
    if (cfg.detail) prism(o, 'concrete', [x - 2.5, -0.3, -4.1], [x + 2.5, 0.35, 4.1], colors.shade);
  }
}
function mast(o, cfg) {
  const x = C.pivotX,
    y = hanDeckY(x),
    peak = y + C.mastRise;
  for (const side of [-1, 1])
    beam(
      o,
      'metal',
      [x, y + 0.05, side * 6.1],
      [x, peak - 3.4, side * 0.3],
      0.95,
      0.8,
      colors.blue,
    );
  beam(o, 'metal', [x, peak - 3.8, 0], [x, peak, 0], 1.05, 0.95, colors.blue);
  if (cfg.detail) {
    beam(o, 'metal', [x + 0.51, peak - 3.5, 0.42], [x + 0.51, peak, 0.42], 0.08, 0.08, colors.gold);
    cylindrical(o, 'metal', x, peak, peak + 1.2, 0.21, 0.12, 8, colors.gold);
  }
  for (const side of [-1, 1])
    for (const direction of [-1, 1])
      for (let i = 1; i <= cfg.cables; i++) {
        const reach = 8 + (50 * i) / cfg.cables,
          anchor = x + direction * reach,
          h = peak - 2.7 + (2.2 * i) / cfg.cables;
        beam(
          o,
          'metal',
          [x, h, side * 0.35],
          [anchor, hanDeckY(anchor) + 0.65, side * 6.0],
          cfg.detail ? 0.1 : 0.14,
          cfg.detail ? 0.1 : 0.14,
          colors.steel,
        );
        if (cfg.detail)
          beam(
            o,
            'metal',
            [anchor, hanDeckY(anchor) + 0.3, side * 6.0],
            [anchor + direction * 0.3, hanDeckY(anchor) + 1.35, side * 5.95],
            0.24,
            0.2,
            colors.blue,
          );
      }
  if (cfg.detail)
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI * 2) / 10,
        c = Math.cos(a),
        s = Math.sin(a),
        p = [
          [x, peak + 0.5, 0],
          [x + c * 0.7, peak + 2.1, s * 0.7],
          [x + c * 1.6, peak + 2.3, s * 1.6],
          [x + c * 2.1, peak + 1.75, s * 2.1],
        ];
      beamPath(o, 'metal', p, 0.055, 0.055, colors.stone);
    }
}
function railsAndLamps(o, cfg) {
  const [a, b] = C.ends.map((p) => p[0]);
  const ramp = (x) => Math.max(0, Math.min(1, (x - a) / 4, (b - x) / 4));
  for (const side of [-1, 1]) {
    ribbon(
      o,
      'concrete',
      a,
      b,
      side < 0 ? -6.45 : 4.7,
      side < 0 ? -4.7 : 6.45,
      (x) => hanDeckY(x) + 0.15 * ramp(x),
      () => 0.25,
      cfg.step,
      colors.stone,
    );
    if (cfg.posts)
      ribbon(
        o,
        'walk',
        a,
        b,
        side < 0 ? -6.25 : 4.85,
        side < 0 ? -4.85 : 6.25,
        (x) => hanDeckY(x) + 0.17 * ramp(x),
        () => 0.03,
        cfg.step,
        colors.walk,
      );
    ribbon(
      o,
      'metal',
      a,
      b,
      side * 6.3 - 0.065,
      side * 6.3 + 0.065,
      (x) => hanDeckY(x) + 1.25,
      () => 0.1,
      cfg.step,
      colors.steel,
    );
    if (!cfg.posts) continue;
    for (let x = a + 1; x <= b - 1; x += cfg.posts) {
      const y = hanDeckY(x);
      prism(
        o,
        'concrete',
        [x - 0.12, y + 0.15, side * 6.3 - 0.14],
        [x + 0.12, y + 1.2, side * 6.3 + 0.14],
        colors.stone,
      );
      if (cfg.detail)
        sphere(o, 'metal', [x, y + 1.29, side * 6.3], [0.15, 0.15, 0.15], colors.steel, 8, 4);
    }
    for (const h of [0.42, 0.75])
      ribbon(
        o,
        'metal',
        a,
        b,
        side * 6.3 - 0.04,
        side * 6.3 + 0.04,
        (x) => hanDeckY(x) + h,
        () => 0.07,
        cfg.step,
        colors.red,
      );
    if (cfg.lamps)
      for (let x = a + 12; x < b - 10; x += cfg.lamps) {
        const y = hanDeckY(x),
          z = side * 6.15;
        beam(o, 'metal', [x, y + 0.2, z], [x, y + 7, z], 0.12, 0.12, colors.steel);
        const p = [
          [x, y + 6.8, z],
          [x - 0.3, y + 7.7, z - side * 0.15],
          [x - 1.3, y + 8, z - side * 0.6],
          [x - 2.3, y + 8, z - side * 1.0],
        ];
        beamPath(o, 'metal', p, 0.1, 0.1, colors.steel);
        prism(
          o,
          'metal',
          [x - 2.65, y + 7.91, z - side * 1.0 - 0.18],
          [x - 2.0, y + 8.07, z - side * 1.0 + 0.18],
          colors.shade,
        );
        if (cfg.detail)
          beamPath(
            o,
            'metal',
            [
              [x, y + 6.1, z],
              [x + 0.45, y + 6.6, z],
              [x + 0.5, y + 7.0, z],
              [x - 0.3, y + 7.7, z],
            ],
            0.06,
            0.06,
            colors.steel,
          );
      }
  }
  if (cfg.posts)
    for (let x = a + 5; x < b - 4; x += 11)
      ribbon(
        o,
        'road',
        x,
        x + 5,
        -0.06,
        0.06,
        (p) => hanDeckY(p) + 0.018,
        () => 0.012,
        5,
        colors.line,
      );
}
export function buildHanLevel(target, level = 'master') {
  const cfg = configs[level];
  if (!cfg) throw new Error(`Unknown Han River level ${level}`);
  const o = writer(target, level === 'skyline'),
    [a, b] = C.ends.map((p) => p[0]);
  // Source-local paving meets native bank cross-slopes without changing the DEM.
  for (const apron of C.aprons) {
    const innerY = hanDeckY(C.ends[apron.end][0]) + 0.004,
      direction = Math.sign(apron.outerX - apron.innerX);
    for (let i = 1; i < apron.edge.length; i++) {
      const p = apron.edge[i - 1],
        q = apron.edge[i],
        v = [
          [apron.innerX, innerY, p.z],
          [apron.innerX, innerY, q.z],
          [apron.outerX, q.top, q.z],
          [apron.outerX, p.top, p.z],
        ],
        bottom = [
          [apron.innerX, p.floor, p.z],
          [apron.innerX, q.floor, q.z],
          [apron.outerX, q.floor, q.z],
          [apron.outerX, p.floor, p.z],
        ];
      o.addQuad('road', 'palette:#ffffff', v, [0, 1, 0], [], colors.road);
      o.addQuad('concrete', 'palette:#ffffff', bottom, [0, -1, 0], [], colors.shade);
      for (const [j, k, hint] of [
        [0, 1, [-direction, 0, 0]],
        [2, 3, [direction, 0, 0]],
        ...(i === 1 ? [[3, 0, [0, 0, -1]]] : []),
        ...(i === apron.edge.length - 1 ? [[1, 2, [0, 0, 1]]] : []),
      ])
        o.addQuad(
          'concrete',
          'palette:#ffffff',
          [v[j], v[k], bottom[k], bottom[j]],
          hint,
          [],
          colors.shade,
        );
    }
  }
  if (level === 'skyline') {
    const [w, e] = C.swingEnds;
    for (const [lo, hi, color] of [
      [a, w, colors.stone],
      [w, e, colors.blue],
      [e, b, colors.stone],
    ])
      ribbon(
        o,
        'concrete',
        lo,
        hi,
        -6.45,
        6.45,
        (x) => hanDeckY(x) - 0.08,
        () => 1.5,
        90,
        color,
      );
    const xs = [
      a,
      ...C.deckProfile.slice(1, -1).map((p) => p[0]),
      ...C.spine.slice(1, -1).map((p) => p[0]),
      b,
    ].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      const p = xs[i - 1],
        q = xs[i];
      o.addConvexPolygon(
        'road',
        'palette:#ffffff',
        [
          [p, hanDeckY(p), -4.65],
          [p, hanDeckY(p), 4.65],
          [q, hanDeckY(q), 4.65],
          [q, hanDeckY(q), -4.65],
        ],
        [0, 1, 0],
        () => [0, 0],
        colors.road,
      );
      for (const side of [-1, 1])
        o.addConvexPolygon(
          'concrete',
          'palette:#ffffff',
          [
            [p, hanDeckY(p), side * 6.3],
            [q, hanDeckY(q), side * 6.3],
            [q, hanDeckY(q) + 1.1, side * 6.3],
            [p, hanDeckY(p) + 1.1, side * 6.3],
          ],
          [0, 0, side],
          () => [0, 0],
          colors.stone,
        );
    }
    for (const x of [...C.westSupports, ...C.eastSupports].slice(1, -1))
      loft(
        o,
        'concrete',
        [radialRing(-0.2, 2.0, 3.2, 4, [x, 0]), radialRing(hanDeckY(x) - 1.5, 2.2, 4.0, 4, [x, 0])],
        colors.stone,
      );
    drum(o, cfg);
    mast(o, cfg);
    return;
  }
  approach(o, cfg, C.westSupports);
  approach(o, cfg, C.eastSupports);
  const [w, e] = C.swingEnds;
  ribbon(
    o,
    'metal',
    w,
    e,
    -6.45,
    6.45,
    (x) => hanDeckY(x) - 0.08,
    () => 1.05,
    cfg.step,
    colors.blue,
  );
  if (cfg.detail)
    for (let x = w + 3; x < e; x += 9)
      prism(
        o,
        'metal',
        [x - 0.14, hanDeckY(x) - 1.4, -6.2],
        [x + 0.14, hanDeckY(x) - 1.05, 6.2],
        colors.blue,
      );
  ribbon(
    o,
    'road',
    a,
    b,
    -C.roadHalfWidth,
    C.roadHalfWidth,
    hanDeckY,
    () => 0.13,
    cfg.step,
    colors.road,
  );
  railsAndLamps(o, cfg);
  drum(o, cfg);
  mast(o, cfg);
}
export const buildHanSkyline = (o) => buildHanLevel(o, 'skyline');
export const buildHanDistrict = (o) => buildHanLevel(o, 'district');
export const buildHanStreet = (o) => buildHanLevel(o, 'street');
export const buildHanCloseup = (o) => buildHanLevel(o, 'closeup');
