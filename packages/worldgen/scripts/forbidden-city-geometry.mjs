/** 'forbidden_city': Footprint-specific Forbidden City galleries and articulated ceremonial structures. */
import earcut from 'earcut';
import { beam } from './authored-structure-mesh.mjs';
import { buildChineseHipRoof } from './chinese-roof-geometry.mjs';
import { box, prism, rect } from './khmer-structure-geometry.mjs';

function surface(f, role, p, target) {
  const rings = [p.outline, ...(p.holes ?? [])],
    points = rings.flat(),
    holes = [];
  let n = rings[0].length;
  for (const ring of rings.slice(1)) {
    holes.push(n);
    n += ring.length;
  }
  const indices = earcut(
    points.flatMap((p) => [p[0], p[2]]),
    holes,
  );
  for (let i = 0; i < indices.length; i += 3)
    f(
      role,
      indices.slice(i, i + 3).map((i) => points[i]),
      target,
    );
}

export function forbiddenWallTop(b, x, z) {
  if (!b.topProfile) return b.height;
  const v = b.topAxis === 0 ? x : z,
    p = b.topProfile;
  if (v <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++)
    if (v <= p[i][0]) {
      const t = (v - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
      return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
    }
  return p.at(-1)[1];
}

export function buildForbiddenCity(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, N) => face(role, ps.map(P), D(N)),
    adapter = {
      addQuad: (role, _ref, ps, N) => f(role, ps, N),
      addConvexPolygon: (role, _ref, ps, N) => f(role, ps, N),
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    body = (role, p, lo, hi, top = true) =>
      prism(
        (role, ps, N) => {
          if ((top && !(detail === 0 && role === 'wall')) || N[1] < 0.5) f(role, ps, N);
        },
        role,
        p,
        lo,
        hi,
        detail === 3,
      ),
    roof = (b, low, rise, w = b.width, d = b.depth, role = 'roof', level = detail) => {
      if (level === 0) {
        const at = (x, y, z) => [b.x + x, y, b.z + z],
          a = at(-w / 2, low, -d / 2),
          c = at(w / 2, low, -d / 2),
          e = at(w / 2, low, d / 2),
          g = at(-w / 2, low, d / 2),
          L = at(-w * 0.25, low + rise, 0),
          R = at(w * 0.25, low + rise, 0);
        for (const p of [
          [a, c, R, L],
          [c, e, R],
          [e, g, L, R],
          [g, a, L],
        ])
          f(role, p, [0, 1, 0]);
        return;
      }
      buildChineseHipRoof(
        f,
        { x: b.x, z: b.z, width: w, depth: d, low, rise },
        detail === 2 ? 1 : level,
        role,
      );
    };
  // The kilometre-wide compound needs a separate skyline composition: retain the
  // court pattern and many small roof masses instead of covering it with a few slabs.
  if (detail === 0) {
    for (const b of r.levels[0]) {
      const y = b.eave + b.rise * 0.5;
      f(
        'roof',
        [
          [b.x - b.width / 2, y, b.z - b.depth / 2],
          [b.x + b.width / 2, y, b.z - b.depth / 2],
          [b.x + b.width / 2, y, b.z + b.depth / 2],
          [b.x - b.width / 2, y, b.z + b.depth / 2],
        ],
        [0, 1, 0],
      );
    }
    for (const [x, z, w, d] of [
      [-371, -36, 7, 960],
      [372, -39, 7, 950],
      [0, -519, 744, 7],
      [0, 435, 744, 7],
    ])
      body('brick', rect(x, z, w, d), -13, 0);
    for (let k = 1; k <= 3; k++)
      body(
        'stone',
        rect(-2, 10, 150 - k * 5, 288 - k * 8),
        r.ceremonialFloorY - 3,
        r.ceremonialFloorY + k * 3,
      );
    for (const h of r.halls) {
      body('wall', rect(h.x, h.z, h.width * 0.89, h.depth * 0.82), h.base, h.eave, false);
      if (h.upperEave) {
        roof(h, h.eave, h.lowRidge - h.eave, h.width, h.depth, 'roof', 0);
        body('wall', rect(h.x, h.z, h.width * 0.77, h.depth * 0.64), h.eave, h.upperEave, false);
        roof(h, h.upperEave, h.ridge - h.upperEave, h.width * 0.86, h.depth * 0.72, 'roof', 0);
      } else roof(h, h.eave, h.ridge - h.eave, h.width, h.depth, 'roof', 0);
    }
    const m = r.meridian,
      G = m.ground;
    body('wall', rect(0, 435, 190, 27), m.lo, G + 12, false);
    for (const s of [-1, 1]) body('wall', rect(s * 79, 477, 25, 98), m.lo, G + 12, false);
    for (const b of [
      { x: 0, z: 435, width: 78, depth: 30 },
      ...[-79, 79].flatMap((x) => [
        { x, z: 435, width: 31, depth: 28 },
        { x, z: 510, width: 28, depth: 28 },
      ]),
    ]) {
      body('wall', rect(b.x, b.z, b.width * 0.83, b.depth * 0.8), G + 12, G + 20, false);
      roof(b, G + 20, 3, b.width, b.depth, 'roof', 0);
      body('wall', rect(b.x, b.z, b.width * 0.7, b.depth * 0.62), G + 20, G + 25, false);
      roof(b, G + 25, b.width > 50 ? 9 : 2, b.width * 0.8, b.depth * 0.73, 'roof', 0);
    }
    for (const b of [r.north, ...r.gates, ...r.sideGates]) {
      const base = b.ground,
        top = base + (b.id === r.north.id ? 19 : 15);
      body('wall', rect(b.x, b.z, b.width * 0.8, b.depth * 0.7), b.lo, top, false);
      roof(b, top, b.id === r.north.id ? 9 : 6, b.width, b.depth, 'roof', 0);
    }
    for (const t of r.cornerTowers) {
      const G = t.ground;
      body('brick', rect(t.x, t.z, t.width, t.depth), t.lo, G + 9);
      body('wall', rect(t.x, t.z, 13, 13), G + 9, G + 21, false);
      roof(t, G + 13, 3, t.width * 0.92, t.depth * 0.92, 'greyRoof', 0);
      roof(t, G + 24, 3, 14, 7, 'roof', 0);
      roof(t, G + 24, 3, 7, 14, 'roof', 0);
    }
    for (const b of r.bridges) {
      const a = b.points[0],
        q = b.points.at(-1),
        W = Math.abs((a[0] + q[0]) / 2) < 7 ? 9 : 5,
        L = Math.hypot(q[0] - a[0], q[1] - a[1]);
      body(
        'stone',
        rect((a[0] + q[0]) / 2, (a[1] + q[1]) / 2, W, L),
        Math.min(b.deckA, b.deckB) - 0.5,
        Math.max(b.deckA, b.deckB) + 0.3,
      );
    }
    return;
  }
  // Each small roof is clipped to its own actual outline, including concave courts.
  for (const b of r.levels[detail]) {
    for (const p of b.polygons) body('wall', p, b.lo, b.eave, false);
    for (const p of b.panels) surface(f, 'roof', p, [0, 1, 0]);
    if (detail === 3 && b.width > 9 && b.depth > 5) {
      const z = b.z + b.depth / 2 + 0.025,
        n = Math.min(4, Math.max(1, Math.floor(b.width / 10)));
      for (let i = 0; i < n; i++) {
        const x = b.x + b.width * ((i + 0.5) / n - 0.5),
          y = b.ground + 1.2,
          h = Math.min(2.2, b.eave - y - 0.4);
        if (h > 0) {
          const w = Math.min(1.5, (b.width / n) * 0.4);
          f(
            'window',
            [
              [x - w / 2, y, z],
              [x + w / 2, y, z],
              [x + w / 2, y + h, z],
              [x - w / 2, y + h, z],
            ],
            [0, 0, 1],
          );
        }
      }
    }
  }
  // Low walls retain all court boundaries near, while distant levels keep the outer enclosure.
  for (const b of r.walls) {
    if (detail === 0) continue;
    if (detail === 2 && Math.max(b.width, b.depth) < 8) continue;
    if (detail < 2 && Math.abs(b.x) < 335 && b.z > -475 && b.z < 405) continue;
    for (const p of b.polygons) {
      const role = Math.abs(b.x) > 335 || b.z < -490 || b.z > 410 ? 'brick' : 'wall';
      prism(
        (role, ps, N) =>
          f(
            role,
            ps.map(([x, y, z]) => [
              x,
              Math.abs(y - b.height) < 1e-7 ? forbiddenWallTop(b, x, z) : y,
              z,
            ]),
            N,
          ),
        role,
        p,
        b.lo,
        b.height,
        detail === 3,
      );
    }
    if (
      detail === 3 &&
      (Math.abs(b.x) > 360 || b.z < -510 || b.z > 430) &&
      Math.max(b.width, b.depth) > 80
    ) {
      const alongX = b.width > b.depth,
        L = Math.max(b.width, b.depth),
        n = Math.floor(L / 20);
      for (let i = 0; i < n; i++)
        box(
          f,
          'brick',
          b.x + (alongX ? ((i + 0.5) / n - 0.5) * L : 0),
          forbiddenWallTop(
            b,
            b.x + (alongX ? ((i + 0.5) / n - 0.5) * L : 0),
            b.z + (alongX ? 0 : ((i + 0.5) / n - 0.5) * L),
          ),
          b.z + (alongX ? 0 : ((i + 0.5) / n - 0.5) * L),
          alongX ? 2 : b.width,
          0.7,
          alongX ? b.depth : 2,
        );
    }
  }
  if (detail === 0)
    for (const [x, z, w, d] of [
      [-371, -36, 7, 960],
      [372, -39, 7, 950],
      [0, -519, 744, 7],
      [0, 435, 744, 7],
    ])
      body('brick', rect(x, z, w, d), -13, 0);
  if (detail < 2)
    for (let k = 1; k <= 3; k++)
      body(
        'stone',
        rect(-2, 10, 150 - k * 5, 288 - k * 8),
        r.ceremonialFloorY - 3,
        r.ceremonialFloorY + k * 3,
      );
  else for (const b of r.platforms) for (const p of b.polygons) body('stone', p, b.lo, b.height);

  const column = (x, z, y, h, R = 0.38) => {
    const n = detail === 3 ? 6 : 3;
    const ring = Array.from({ length: n }, (_, i) => [
      x + R * Math.cos((i * Math.PI * 2) / n),
      z + R * Math.sin((i * Math.PI * 2) / n),
    ]);
    body('wall', { outline: ring }, y, y + h);
  };
  const frontage = (b, y0, y1, bays) => {
    if (detail < 2) return;
    for (const sign of [-1, 1]) {
      const z = b.z + sign * (b.depth / 2 - 0.4),
        n = detail === 3 ? bays : Math.max(3, Math.ceil(bays / 2));
      for (let i = 0; i <= n; i++)
        column(b.x + b.width * (i / n - 0.5) * 0.94, z, y0, y1 - y0, 0.4);
      box(f, 'teal', b.x, y1 - 0.8, z, b.width, 1.1, 0.65);
      if (detail === 3)
        for (let i = 0; i < n; i++) {
          const x = b.x + b.width * ((i + 0.5) / n - 0.5) * 0.94;
          box(
            f,
            'window',
            x,
            y0 + 1,
            z - sign * 0.18,
            (b.width / n) * 0.65,
            Math.max(1, y1 - y0 - 2.3),
            0.18,
          );
          box(f, 'trim', x, y1 - 0.35, z, 0.9, 0.4, 1.1);
        }
    }
  };
  for (const h of r.halls) {
    const inset = { ...h, width: h.width * 0.89, depth: h.depth * 0.82 };
    body('wall', rect(h.x, h.z, inset.width, inset.depth), h.base, h.eave);
    frontage(h, h.base, h.eave, h.bays);
    if (h.upperEave) {
      roof(h, h.eave, h.lowRidge - h.eave, h.width, h.depth, 'roof', detail < 2 ? 0 : detail);
      const upper = { ...h, width: h.width * 0.86, depth: h.depth * 0.72 };
      body('wall', rect(h.x, h.z, upper.width * 0.9, upper.depth * 0.85), h.eave, h.upperEave);
      roof(
        upper,
        h.upperEave,
        h.ridge - h.upperEave,
        upper.width,
        upper.depth,
        'roof',
        detail < 2 ? 0 : detail,
      );
    } else roof(h, h.eave, h.ridge - h.eave, h.width, h.depth, 'roof', detail < 2 ? 0 : detail);
  }
  // Pale rails and original stair projections of the three stepped terrace polygons.
  if (detail > 1)
    for (const b of r.platforms.filter((b) =>
      (detail === 3 ? [3, 6, 9] : [9]).includes(b.terraceTier),
    ))
      for (const p of b.polygons) {
        const ring = p.outline;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            q = ring[(i + 1) % ring.length],
            L = Math.hypot(q[0] - a[0], q[1] - a[1]);
          if (L < 3) continue;
          const mx = (a[0] + q[0]) / 2,
            mz = (a[1] + q[1]) / 2;
          if (mz > 90 && mz < 145 && (Math.abs(mx) < 7 || Math.abs(Math.abs(mx) - 18) < 8))
            continue;
          bar('stone', [a[0], b.height + 1.1, a[1]], [q[0], b.height + 1.1, q[1]], 0.18);
          const n = Math.max(1, Math.floor(L / (detail === 3 ? 9 : 24)));
          for (let j = 0; j < n; j++)
            box(
              f,
              'stone',
              a[0] + ((q[0] - a[0]) * j) / n,
              b.height,
              a[1] + ((q[1] - a[1]) * j) / n,
              0.3,
              1.25,
              0.3,
            );
        }
      }
  // Main south stair flights, split around the central ceremonial ramp.
  for (const { x, footY } of r.entranceStairs) {
    const n = [1, 2, 6, 18][detail],
      lo = Math.min(footY, r.ceremonialFloorY) - 0.6;
    for (let i = 0; i < n; i++)
      box(
        f,
        'stone',
        x,
        lo,
        136 - ((i + 0.5) * 28) / n,
        12,
        footY + ((r.ceremonialFloorY + 9 - footY) * (i + 1)) / n - lo,
        28 / n + 0.04,
      );
  }
  for (const [j, [outer, inner]] of (detail === 0
    ? [[136, 108]]
    : [
        [136, 128],
        [128, 118],
        [118, 108],
      ]
  ).entries()) {
    const F = r.ceremonialFloorY;
    prism(
      (role, ps, N) =>
        f(
          role,
          ps.map(([x, y, z]) => [
            x,
            Math.abs(y - 1) < 1e-7
              ? F + j * 3 + ((detail === 0 ? 9 : 3) * (outer - z)) / (outer - inner)
              : y,
            z,
          ]),
          N,
        ),
      'stone',
      rect(0, (outer + inner) / 2, 8, outer - inner),
      F - 2,
      1,
      detail === 3,
    );
  }

  // Meridian Gate: U-shaped podium, passages and five distinct roofed pavilions.
  const m = r.meridian,
    G = m.ground,
    gateZ = 435,
    wallTop = G + 12,
    upper = G + 20;
  for (const sign of [-1, 1]) body('wall', rect(sign * 79, 477, 25, 98), m.lo, wallTop);
  // Three open archways have bounded stone side piers and curved brick spandrels.
  const archCenters = [-22, 0, 22],
    widths = [7, 10, 7];
  const spans = [
    [-95, -25.5],
    [-18.5, -5],
    [5, 18.5],
    [25.5, 95],
  ];
  for (const [a, b] of spans) body('wall', rect((a + b) / 2, gateZ, b - a, 27), m.lo, wallTop);
  const steps = [1, 2, 4, 12][detail];
  for (let k = 0; k < archCenters.length; k++)
    for (let i = 0; i < steps; i++) {
      const x = archCenters[k] - widths[k] / 2 + (widths[k] * (i + 0.5)) / steps,
        arch =
          G +
          4.7 +
          2.7 * Math.sqrt(Math.max(0, 1 - Math.pow((x - archCenters[k]) / (widths[k] / 2), 2)));
      box(f, 'wall', x, arch, gateZ, widths[k] / steps + 0.005, wallTop - arch, 27);
    }
  const towers = [
    { x: 0, z: gateZ, width: 78, depth: 30, top: upper + 14 },
    ...[-79, 79].flatMap((x) => [
      { x, z: 435, width: 31, depth: 28, top: upper + 7 },
      { x, z: 510, width: 28, depth: 28, top: upper + 7 },
    ]),
  ];
  for (const t of towers) {
    body('wall', rect(t.x, t.z, t.width * 0.83, t.depth * 0.8), wallTop, upper);
    frontage(t, wallTop, upper, t.width > 50 ? 9 : 5);
    roof(t, upper, 3, t.width, t.depth, 'roof', detail < 2 ? 0 : detail);
    const u = { ...t, width: t.width * 0.8, depth: t.depth * 0.73 };
    body('wall', rect(t.x, t.z, u.width * 0.9, u.depth * 0.85), upper, upper + 5);
    roof(u, upper + 5, t.top - upper - 5, u.width, u.depth, 'roof', detail < 2 ? 0 : detail);
  }
  for (const x of [-79, 79])
    roof({ x, z: 477, width: 22, depth: 53 }, wallTop, 3, 22, 53, 'greyRoof', detail < 2 ? 0 : 1);

  // Northern gate and the two central inner ceremonial gates retain their native plans.
  for (const b of [r.north, ...r.gates]) {
    const north = b.id === r.north.id,
      base = north ? b.ground + 10 : Math.max(0, b.ground) + 2,
      eave = north ? base + 7 : base + 9;
    if (north)
      for (const sign of [-1, 1]) body('wall', rect(b.x + sign * 18, b.z, 22, b.depth), b.lo, base);
    else if (detail < 2) body('stone', rect(b.x, b.z, b.width, b.depth), b.lo, base);
    else for (const p of b.polygons) body('stone', p, b.lo, base);
    const t = { ...b, width: north ? 43 : b.width * 0.85, depth: north ? 22 : b.depth * 0.72 };
    body('wall', rect(t.x, t.z, t.width * 0.8, t.depth * 0.7), base, eave);
    frontage(t, base, eave, north ? 7 : 9);
    roof(t, eave, 3, t.width, t.depth, 'roof', detail < 2 ? 0 : detail);
    const u = { ...t, width: t.width * 0.82, depth: t.depth * 0.72 };
    body('wall', rect(u.x, u.z, u.width * 0.88, u.depth * 0.78), eave, eave + 4);
    roof(u, eave + 4, north ? 7 : 6, u.width, u.depth, 'roof', detail < 2 ? 0 : detail);
  }

  // East and west gates keep open central passages beneath their transverse roof ridges.
  for (const b of r.sideGates) {
    const G = b.ground,
      W = b.depth,
      B = b.width,
      emit = (role, ps, N) =>
        f(
          role,
          ps.map(([u, y, v]) => [b.x + v, y, b.z + u]),
          [N[2], N[1], N[0]],
        );
    if (detail === 0) {
      for (const s of [-1, 1])
        body('wall', rect(b.x, b.z + s * W * 0.35, B, W * 0.3), b.lo, G + 12);
      const a = [-W / 2, G + 12, -B / 2],
        c = [W / 2, G + 12, -B / 2],
        e = [W / 2, G + 12, B / 2],
        g = [-W / 2, G + 12, B / 2],
        L = [-W / 4, G + 17, 0],
        R = [W / 4, G + 17, 0];
      for (const ps of [
        [a, c, R, L],
        [c, e, R],
        [e, g, L, R],
        [g, a, L],
      ])
        emit('roof', ps, [0, 1, 0]);
      continue;
    }
    for (const [a, c] of [
      [-W / 2, -10],
      [-6, -2.5],
      [2.5, 6],
      [10, W / 2],
    ])
      if (c > a) prism(emit, 'wall', rect((a + c) / 2, 0, c - a, B), b.lo, G + 10, detail === 3);
    for (const x of [-8, 0, 8]) {
      const w = x ? 4 : 5,
        n = detail === 3 ? 8 : 3;
      for (let i = 0; i < n; i++) {
        const u = x - w / 2 + (w * (i + 0.5)) / n,
          arch = G + 4 + 2.2 * Math.sqrt(Math.max(0, 1 - Math.pow((u - x) / (w / 2), 2)));
        box(emit, 'wall', u, arch, 0, w / n + 0.005, G + 10 - arch, B);
      }
    }
    prism(emit, 'wall', rect(0, 0, W * 0.8, B * 0.75), G + 10, G + 17, detail === 3);
    for (const [low, width, depth, rise] of [
      [G + 17, W, B, 3],
      [G + 21, W * 0.8, B * 0.72, 7],
    ]) {
      prism(emit, 'wall', rect(0, 0, width * 0.8, depth * 0.78), low - 4, low, detail === 3);
      buildChineseHipRoof(
        emit,
        { x: 0, z: 0, width, depth, low, rise },
        detail === 1 ? 0 : 1,
        'roof',
      );
    }
  }

  // Four corner towers: grey spreading base roof and crossed gold upper tiers.
  for (const t of r.cornerTowers) {
    const g = t.ground;
    body('brick', rect(t.x, t.z, t.width, t.depth), t.lo, g + 9);
    const lower = { ...t, width: t.width * 0.92, depth: t.depth * 0.92 };
    body('wall', rect(t.x, t.z, t.width * 0.77, t.depth * 0.77), g + 9, g + 13);
    if (detail === 3) frontage(lower, g + 9, g + 13, 7);
    roof(lower, g + 13, 3, lower.width, lower.depth, 'greyRoof', detail === 3 ? 1 : 0);
    body('wall', rect(t.x, t.z, 13, 13), g + 13, g + 21);
    for (let k = 0; k < (detail === 0 ? 2 : 3); k++) {
      const y = g + 18 + k * 3,
        w = 22 - k * 4;
      roof(t, y, 3, w, w * 0.5, 'roof', detail === 3 ? 1 : 0);
      roof(t, y, 3, w * 0.5, w, 'roof', detail === 3 ? 1 : 0);
    }
    if (detail > 1) bar('trim', [t.x, g + 25, t.z], [t.x, g + 29, t.z], 0.3);
  }

  // Golden Water footbridges: individual native axes, arched underside and pale parapets.
  for (const b of r.bridges) {
    const a = b.points[0],
      q = b.points.at(-1),
      L = Math.hypot(q[0] - a[0], q[1] - a[1]),
      T = [(q[0] - a[0]) / L, (q[1] - a[1]) / L],
      N = [-T[1], T[0]],
      W = Math.abs((a[0] + q[0]) / 2) < 7 ? 9 : 5,
      n = [1, 2, 4, 12][detail],
      point = (t, s, y) => [a[0] + T[0] * L * t + N[0] * s, y, a[1] + T[1] * L * t + N[1] * s];
    if (detail < 2) {
      body(
        'stone',
        rect((a[0] + q[0]) / 2, (a[1] + q[1]) / 2, W, L),
        Math.min(b.deckA, b.deckB) - 0.5,
        Math.max(b.deckA, b.deckB) + 0.3,
      );
      continue;
    }
    for (let i = 0; i < n; i++) {
      const t = i / n,
        u = (i + 1) / n,
        grade = (t) => b.deckA + (b.deckB - b.deckA) * t,
        top = (t) => grade(t) + 1.2 * Math.sin(t * Math.PI),
        bottom = (t) => grade(t) - 2.2 + 3 * Math.sin(t * Math.PI);
      f(
        'stone',
        [
          point(t, -W / 2, top(t)),
          point(u, -W / 2, top(u)),
          point(u, W / 2, top(u)),
          point(t, W / 2, top(t)),
        ],
        [0, 1, 0],
      );
      f(
        'stone',
        [
          point(t, -W / 2, bottom(t)),
          point(u, -W / 2, bottom(u)),
          point(u, W / 2, bottom(u)),
          point(t, W / 2, bottom(t)),
        ],
        [0, -1, 0],
      );
      for (const s of [-1, 1]) {
        f(
          'stone',
          [
            point(t, (s * W) / 2, top(t)),
            point(u, (s * W) / 2, top(u)),
            point(u, (s * W) / 2, bottom(u)),
            point(t, (s * W) / 2, bottom(t)),
          ],
          [N[0] * s, 0, N[1] * s],
        );
        if (detail > 1) {
          bar(
            'stone',
            point(t, (s * W) / 2, top(t) + 1.1),
            point(u, (s * W) / 2, top(u) + 1.1),
            0.2,
          );
          box(
            f,
            'stone',
            ...(() => {
              const p = point(t, (s * W) / 2, top(t));
              return [p[0], p[1], p[2], 0.3, 1.3, 0.3];
            })(),
          );
        }
      }
    }
    for (const t of [0, 1]) {
      f(
        'stone',
        [
          point(t, -W / 2, t ? b.deckB : b.deckA),
          point(t, W / 2, t ? b.deckB : b.deckA),
          point(t, W / 2, (t ? b.deckB : b.deckA) - 2.2),
          point(t, -W / 2, (t ? b.deckB : b.deckA) - 2.2),
        ],
        [T[0] * (t ? 1 : -1), 0, T[1] * (t ? 1 : -1)],
      );
      for (const s of [-1, 1])
        body(
          'stone',
          rect(...[point(t, s * (W / 2 - 0.6), -9)[0], point(t, s * (W / 2 - 0.6), -9)[2]], 1.2, 2),
          (t ? b.deckB : b.deckA) - 5,
          t ? b.deckB : b.deckA,
        );
    }
  }
}
