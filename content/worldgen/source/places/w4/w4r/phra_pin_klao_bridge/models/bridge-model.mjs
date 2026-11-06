import {
  beam,
  beamPath,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

// Full bridge controls: the retained 279 m polygon describes only the river
// structure. Current mapped bridge carriageways extend about 617 m including
// both land viaduct approaches. Sections and heights are photo approximations.
export const bridgeControls = {
  anchor: [100.49087092, 13.762032174],
  heading: -0.926063618432,
  datum: 3,
  deck: 18.4,
  length: 616.901372398,
  width: 26.534,
  ends: [-257.5313903, 359.3699821],
  riverEnds: [-139.494, 139.494],
  riverPiers: [-63, 62],
  landSupports: [-244, -212, -180, -146, 142, 156, 198, 238, 278, 318, 349],
  landGround: [
    [4.218674, 3.221218],
    [4.080237, 3.301822],
    [1.844773, 1.930039],
    [0.48766, 1.348914],
    [3.611406, 3.555878],
    [4.857234, 4.709605],
    [7.975079, 7.981696],
    [7.055963, 7.184671],
    [5.355302, 4.414859],
    [7.655223, 6.493686],
    [9.289676, 9.513934],
  ],
  stairs: [
    {
      name: 'east-north',
      points: [
        [130.947233, 9.9877],
        [154.033116, 9.204152],
        [153.738471, 12.973934],
      ],
      flights: [0],
      ground: 7.412358,
      landingLift: 0.42,
      landingEnd: [153.61379572969892, 14.569069128124058],
      landingEndGround: 7.380438,
    },
    {
      name: 'east-south',
      points: [
        [142.867283, -14.06852],
        [153.94485, -13.358828],
        [154.18021, -16.084642],
      ],
      flights: [0],
      ground: 7.55754,
      landingLift: 0.42,
      landingEnd: [154.31784963067412, -17.6787107977838],
      landingEndGround: 7.553012,
    },
    {
      name: 'west-0',
      points: [
        [-145.058563, -11.406973],
        [-145.34427852457037, -14.887447210153788],
        [-151.49304949132795, -14.430989284389035],
        [-151.61341917615405, -10.893012946019866],
        [-146.68290204275036, -11.176962156111479],
        [-146.61645491905844, -18.021121185852287],
        [-150.73480230719179, -17.852177392926237],
      ],
      flights: [1, 3, 5],
      ground: 3.551878,
      landingLift: 0.42,
      landingEnd: [-152.33345774527933, -17.786596982184154],
      landingEndGround: 3.605874,
    },
    {
      name: 'west-1',
      points: [
        [-145.83827782717916, 9.414802871578559],
        [-152.73993041035692, 8.942300873462713],
        [-152.56206046177186, 5.81040903256374],
        [-147.11045548858212, 6.28112794325358],
        [-147.46440595282215, 11.09486296543433],
        [-152.74171939822298, 10.392349867735177],
      ],
      flights: [0, 2, 4],
      ground: 4.566119,
      landingLift: 0.42,
      landingEnd: [-154.32772844236192, 10.181221205755106],
      landingEndGround: 4.54817,
    },
  ],
};
export function deckY(x) {
  if (x < -139.494) {
    const t = Math.max(0, Math.min(1, (x + 257.5313903) / (257.5313903 - 139.494)));
    return 5.4 + 8.1 * (t * t * (3 - 2 * t));
  }
  if (x > 139.494) {
    const t = Math.max(0, Math.min(1, (x - 139.494) / (359.3699821 - 139.494)));
    return 14.0 - 2.4 * (t * t * (3 - 2 * t));
  }
  const u = (x + 139.494) / 278.988;
  return 13.5 + 0.5 * u + 1.65 * (1 - (2 * u - 1) * (2 * u - 1));
}
export function centerZ(x) {
  return x < -139.494
    ? Math.min(1.4, ((-139.494 - x) / 118.037) * 1.4)
    : x > 139.494
      ? -Math.min(1.9, ((x - 139.494) / 219.876) * 1.9)
      : 0;
}
export function girderDepth(x) {
  if (x < -139.494 || x > 139.494) return 1.65;
  if (x < -63) {
    const u = (x + 139.494) / 76.494;
    return 1.8 + 3.9 * u * u;
  }
  if (x > 62) {
    const u = (139.494 - x) / 77.494;
    return 1.8 + 3.9 * u * u;
  }
  return 1.6 + 4.1 * Math.pow(Math.abs((x + 0.5) / 62.5), 2);
}
const srgb = (h) =>
  [1, 3, 5].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
const palette = {
  concrete: { slot: 'wall', graph: 'concrete_plain', rgb: srgb('#d1cec3') },
  trim: { slot: 'trim', graph: 'concrete_plain', rgb: srgb('#d6d5c9') },
  base: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#bab8ae') },
  road: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#757a76') },
  walk: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#bcb8ad') },
  steel: { slot: 'trim', graph: 'metal_painted', rgb: srgb('#b4bbb6') },
  pole: { slot: 'trim', graph: 'metal_painted', rgb: srgb('#8f9996') },
  white: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#eee9d4') },
  yellow: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#e0bd64') },
  black: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#353b39') },
  glass: { slot: 'window', graph: 'concrete_plain', rgb: srgb('#dedecb') },
};
export const bridgeSurfaces = Object.fromEntries(
  Object.entries(palette).map(([k, { rgb, ...s }]) => [k, s]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const rod = (o, m, a, b, w, d = w) => beam(o, m, a, b, w, d, palette[m].rgb);
const box = (o, m, x, y, z, w, h, d) => rod(o, m, [x, y - h / 2, z], [x, y + h / 2, z], d, w);
function face(o, m, p, n) {
  let N = normalFor(...p);
  if (N.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = p.toReversed();
    N = normalFor(...p);
  }
  o[p.length === 3 ? 'addTriangle' : 'addQuad'](
    m,
    'palette:#ffffff',
    p,
    N,
    undefined,
    palette[m].rgb,
  );
}
function stations(t) {
  const C = bridgeControls,
    n = [8, 12, 36, 66, 88][t];
  return [
    ...new Set([
      C.ends[0],
      C.ends[1],
      ...(t < 2 ? [-235, -210, -180] : []),
      -145.838278,
      -145.058563,
      -139.494,
      -63,
      0,
      62,
      130.947233,
      139.494,
      142.867283,
      ...Array.from({ length: n + 1 }, (_, i) => C.ends[0] + (i / n) * (C.ends[1] - C.ends[0])),
    ]),
  ].sort((a, b) => a - b);
}
function body(o, t) {
  const xs = stations(t),
    ring = (x) => {
      const z = centerZ(x),
        y = deckY(x) - 0.025,
        d = girderDepth(x);
      return [
        [x, y, z - 11.25],
        [x, y - d, z - 9.3],
        [x, y - d, z + 6.7],
        [x, y, z + 8.4],
      ];
    };
  loft(
    o,
    'concrete',
    xs.map((x) => ring(x).toReversed()),
    palette.concrete.rgb,
  );
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      y = deckY(a),
      Y = deckY(b),
      z = centerZ(a),
      Z = centerZ(b);
    face(
      o,
      'road',
      [
        [a, y, z - 11.25],
        [b, Y, Z - 11.25],
        [b, Y, Z + 8.4],
        [a, y, z + 8.4],
      ],
      [0, 1, 0],
    );
    for (const [lo, hi, start, end] of [
      [-13.267, -11.25, -145.058563, 142.867283],
      [8.4, 13.267, -145.838278, 130.947233],
    ]) {
      if ((a + b) / 2 < start || (a + b) / 2 > end) continue;
      const H = t > 0 ? 0.16 : 0;
      face(
        o,
        'walk',
        [
          [a, y + H, z + lo],
          [b, Y + H, Z + lo],
          [b, Y + H, Z + hi],
          [a, y + H, z + hi],
        ],
        [0, 1, 0],
      );
      if (t > 0) {
        face(
          o,
          'trim',
          [
            [a, y - 0.2, z + hi],
            [b, Y - 0.2, Z + hi],
            [b, Y - 0.2, Z + lo],
            [a, y - 0.2, z + lo],
          ],
          [0, -1, 0],
        );
        for (const zz of [lo, hi])
          face(
            o,
            'trim',
            [
              [a, y - 0.2, z + zz],
              [b, Y - 0.2, Z + zz],
              [b, Y + H, Z + zz],
              [a, y + H, z + zz],
            ],
            [0, 0, zz < 0 ? -1 : 1],
          );
      }
    }
    if (t > 0) {
      const m = -1.4;
      face(
        o,
        'trim',
        [
          [a, y + 0.23, z + m - 0.4],
          [b, Y + 0.23, Z + m - 0.4],
          [b, Y + 0.23, Z + m + 0.4],
          [a, y + 0.23, z + m + 0.4],
        ],
        [0, 1, 0],
      );
      for (const side of [-1, 1])
        face(
          o,
          'trim',
          [
            [a, y, z + m + side * 0.4],
            [b, Y, Z + m + side * 0.4],
            [b, Y + 0.23, Z + m + side * 0.4],
            [a, y + 0.23, z + m + side * 0.4],
          ],
          [0, 0, side],
        );
      for (const zz of [-11.25, 8.4])
        rod(o, 'trim', [a, y - 0.15, z + zz], [b, Y - 0.15, Z + zz], 0.22, 0.2);
      if (t > 1)
        for (const zz of [-1.92, -0.88])
          face(
            o,
            'yellow',
            [
              [a, y + 0.015, z + zz - 0.05],
              [b, Y + 0.015, Z + zz - 0.05],
              [b, Y + 0.015, Z + zz + 0.05],
              [a, y + 0.015, z + zz + 0.05],
            ],
            [0, 1, 0],
          );
    }
  }
  if (t > 1) {
    for (let x = bridgeControls.ends[0] + 2; x < bridgeControls.ends[1] - 2; x += 9) {
      const b = Math.min(x + 4, bridgeControls.ends[1] - 1);
      for (const zz of [-8.1, -4.95, 2.13, 5.27]) {
        const z = centerZ(x) + zz,
          Z = centerZ(b) + zz;
        face(
          o,
          'white',
          [
            [x, deckY(x) + 0.012, z - 0.0525],
            [b, deckY(b) + 0.012, Z - 0.0525],
            [b, deckY(b) + 0.012, Z + 0.0525],
            [x, deckY(x) + 0.012, z + 0.0525],
          ],
          [0, 1, 0],
        );
      }
    }
  }
}
function riverPier(o, t, x) {
  const top = deckY(x) - 0.025 - girderDepth(x),
    base = 1.25;
  if (t === 0) {
    box(o, 'base', x, -1.0, 0, 7.6, 4.5, 24);
    box(o, 'concrete', x, (top + base) / 2, 0, 3.0, top - base, 19);
    return;
  }
  const poly = [
    [-3.9, -8.5],
    [-1.9, -12.2],
    [1.9, -12.2],
    [3.9, -8.5],
    [3.9, 8.5],
    [1.9, 12.2],
    [-1.9, 12.2],
    [-3.9, 8.5],
  ].toReversed();
  const ring = (y, scale) => poly.map(([u, z]) => [x + u * scale, y, z * scale]);
  loft(o, 'base', [ring(-5, 1.05), ring(0.7, 1.05), ring(1.25, 0.9)], palette.base.rgb);
  box(o, 'concrete', x, (top + base) / 2, 0, 3.0, top - base, 19);
  box(o, 'trim', x, top - 0.2, 0, 4.0, 0.6, 22.5);
  for (const side of [-1, 1]) {
    const z = side * 12.23;
    face(
      o,
      'white',
      [
        [x - 1.1, 0.4, z],
        [x, 0.95, z],
        [x + 1.1, 0.4, z],
        [x, -0.15, z],
      ],
      [0, 0, side],
    );
    face(
      o,
      'black',
      [
        [x - 0.62, 0.4, z + side * 0.012],
        [x, 0.72, z + side * 0.012],
        [x + 0.62, 0.4, z + side * 0.012],
        [x, 0.08, z + side * 0.012],
      ],
      [0, 0, side],
    );
  }
  if (t > 1) for (const side of [-1, 1]) box(o, 'trim', x, base + 0.16, side * 9.2, 3.7, 0.32, 0.5);
}
function approachPiers(o, t) {
  for (let i = 0; i < bridgeControls.landSupports.length; i++) {
    const x = bridgeControls.landSupports[i],
      z = centerZ(x),
      top = deckY(x) - 0.025 - girderDepth(x),
      ground = bridgeControls.landGround[i];
    if (t === 0) {
      const low = Math.min(...ground) - 0.4;
      if (top > low + 0.05) box(o, 'concrete', x, (top + low) / 2, z, 1.4, top - low, 15);
      continue;
    }
    const cap = top - 0.45;
    box(o, 'trim', x, cap, z, 2.0, 0.9, 22);
    for (const [j, side] of [-1, 1].entries()) {
      const low = ground[j] - 0.45,
        y = (cap + low) / 2;
      if (cap <= low + 0.05) continue;
      box(o, 'concrete', x, y, z + side * 6.6, 1.45, cap - low, 1.65);
      if (t > 1) {
        box(o, 'base', x, low + 0.12, z + side * 6.6, 2.35, 0.55, 2.55);
        box(o, 'trim', x, cap - 0.65, z + side * 6.6, 2.1, 0.45, 2.3);
      }
    }
  }
}
function railings(o, t) {
  const xs = stations(t),
    C = bridgeControls;
  for (const side of [-1, 1]) {
    const start = side < 0 ? -145.058563 : -145.838278,
      end = side < 0 ? 142.867283 : 130.947233,
      edge = (x) =>
        x >= start - 0.001 && x <= end + 0.001 ? side * 13.05 : side < 0 ? -11.45 : 8.65;
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1],
        b = xs[i],
        e = edge((a + b) / 2),
        z = centerZ(a) + e,
        Z = centerZ(b) + e,
        y = deckY(a),
        Y = deckY(b);
      if (t === 0) {
        face(
          o,
          'steel',
          [
            [a, y + 1.23, z],
            [b, Y + 1.23, Z],
            [b, Y + 1.3, Z],
            [a, y + 1.3, z],
          ],
          [0, 0, side],
        );
        face(
          o,
          'steel',
          [
            [a, y + 1.23, z],
            [b, Y + 1.23, Z],
            [b, Y + 1.3, Z],
            [a, y + 1.3, z],
          ],
          [0, 0, -side],
        );
      }
    }
    if (t === 0) continue;
    // Join each continuous rail once; internal box end caps waste vertices and
    // leave overlaps at changing grades. Keep the stair-entry breaks explicit.
    for (const h of [0.66, 1.28]) {
      let path = [],
        previous;
      const emit = () => {
        if (path.length > 1) beamPath(o, 'steel', path, 0.075, 0.075, palette.steel.rgb);
        path = [];
      };
      for (let i = 1; i < xs.length; i++) {
        const a = xs[i - 1],
          b = xs[i],
          e = edge((a + b) / 2);
        if (previous !== undefined && e !== previous) emit();
        if (!path.length) path.push([a, deckY(a) + h, centerZ(a) + e]);
        path.push([b, deckY(b) + h, centerZ(b) + e]);
        previous = e;
      }
      emit();
    }
    const count = Math.ceil(C.length / [1, 54, 7, 4.0, 3.0][t]);
    for (let i = 0; i <= count; i++) {
      const x = C.ends[0] + (i / count) * C.length,
        z = centerZ(x) + edge(x);
      rod(o, 'steel', [x, deckY(x) + 0.15, z], [x, deckY(x) + 1.28, z], 0.085, 0.085);
    }
  }
}
function stair(o, t, s) {
  const pts = s.points,
    width = 1.9,
    base = s.ground - bridgeControls.datum + 0.025 + s.landingLift,
    top = deckY(pts[0][0]) + 0.16;
  const lengths = pts.slice(1).map((b, i) => Math.hypot(b[0] - pts[i][0], b[1] - pts[i][1])),
    total = s.flights.reduce((sum, i) => sum + lengths[i], 0);
  let current = top;
  for (let j = 0; j < lengths.length; j++) {
    const [x, z] = pts[j],
      [X, Z] = pts[j + 1],
      L = lengths[j],
      dx = (X - x) / L,
      dz = (Z - z) / L,
      nx = -dz,
      nz = dx,
      flight = s.flights.includes(j),
      next = flight ? current - ((top - base) * L) / total : current;
    const p = (u, y, side) => [
      x + (X - x) * u + ((nx * width) / 2) * side,
      y,
      z + (Z - z) * u + ((nz * width) / 2) * side,
    ];
    if (t === 0) {
      rod(o, 'trim', [x, current - 0.15, z], [X, next - 0.15, Z], width, 0.3);
      current = next;
      continue;
    }
    const count = flight && t > 1 ? Math.max(2, Math.ceil((current - next) / 0.18)) : 1;
    for (let i = 0; i < count; i++) {
      const u = i / count,
        v = (i + 1) / count,
        y = current + (next - current) * u,
        Y = current + (next - current) * v;
      face(
        o,
        'walk',
        [p(u, y, -1), p(v, t === 1 ? Y : y, -1), p(v, t === 1 ? Y : y, 1), p(u, y, 1)],
        [0, 1, 0],
      );
      if (flight && t > 1)
        face(o, 'trim', [p(v, Y, -1), p(v, y, -1), p(v, y, 1), p(v, Y, 1)], [dx, 0, dz]);
      for (const side of [-1, 1])
        face(
          o,
          'trim',
          [p(u, y, side), p(v, t === 1 ? Y : y, side), p(v, Y - 0.32, side), p(u, y - 0.32, side)],
          [nx * side, 0, nz * side],
        );
    }
    face(
      o,
      'trim',
      [
        p(0, current - 0.32, -1),
        p(0, current - 0.32, 1),
        p(1, next - 0.32, 1),
        p(1, next - 0.32, -1),
      ],
      [0, -1, 0],
    );
    for (const side of [-1, 1]) {
      const a = p(0, current + 1.05, side),
        b = p(1, next + 1.05, side);
      rod(o, 'steel', a, b, 0.055, 0.055);
      if (t > 1) {
        const n = Math.max(1, Math.ceil(L / 2.5));
        for (let i = 0; i <= n; i++) {
          const u = i / n,
            y = current + (next - current) * u,
            q = p(u, y, side);
          rod(o, 'steel', q, p(u, y + 1.05, side), 0.055, 0.055);
        }
      }
    }
    current = next;
  }
  if (t > 0) {
    const [x, z] = pts[0],
      next = pts[1],
      L = Math.hypot(next[0] - x, next[1] - z),
      dx = (next[0] - x) / L,
      dz = (next[1] - z) / L;
    rod(o, 'trim', [x - dx * 1.2, top - 0.13, z - dz * 1.2], [x, top - 0.13, z], 2.4, 0.26);
  }
  // Short pads meet the retained native path surface, which is raised0.42m
  // above the field. Their buried skirts support the paving instead of floating.
  const A = pts.at(-1),
    B = s.landingEnd,
    L = Math.hypot(B[0] - A[0], B[1] - A[1]),
    N = [-(B[1] - A[1]) / L, (B[0] - A[0]) / L],
    Y = s.landingEndGround - bridgeControls.datum + s.landingLift + 0.025;
  const q = (p, y, side) => [
    p[0] + ((N[0] * width) / 2) * side,
    y,
    p[1] + ((N[1] * width) / 2) * side,
  ];
  face(o, 'walk', [q(A, base, -1), q(B, Y, -1), q(B, Y, 1), q(A, base, 1)], [0, 1, 0]);
  if (t > 1) {
    face(
      o,
      'trim',
      [q(A, base - 0.6, 1), q(B, Y - 0.6, 1), q(B, Y - 0.6, -1), q(A, base - 0.6, -1)],
      [0, -1, 0],
    );
    for (const side of [-1, 1])
      face(
        o,
        'trim',
        [q(A, base, side), q(B, Y, side), q(B, Y - 0.6, side), q(A, base - 0.6, side)],
        [N[0] * side, 0, N[1] * side],
      );
    for (const [p, y, sign] of [
      [A, base, -1],
      [B, Y, 1],
    ])
      face(
        o,
        'trim',
        [q(p, y, -1), q(p, y, 1), q(p, y - 0.6, 1), q(p, y - 0.6, -1)],
        [(B[0] - A[0]) * sign, 0, (B[1] - A[1]) * sign],
      );
  }
}
function turned(o, m, x, z, rows, n) {
  loft(
    o,
    m,
    rows.map(([y, r]) =>
      Array.from({ length: n }, (_, i) => {
        const a = (-i / n) * Math.PI * 2;
        return [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
      }),
    ),
    palette[m].rgb,
  );
}
function lamps(o, t) {
  const n = t === 0 ? 8 : t === 1 ? 8 : 16;
  for (let i = 0; i < n; i++) {
    const x = bridgeControls.ends[0] + 18 + (i / (n - 1)) * (bridgeControls.length - 36),
      y = deckY(x) + 0.16;
    for (const side of [-1, 1]) {
      const pedestrian =
        side < 0 ? x >= -145.058563 && x <= 142.867283 : x >= -145.838278 && x <= 130.947233;
      const z = centerZ(x) + (pedestrian ? side * 12.6 : side < 0 ? -11.0 : 8.2),
        top = y + 7.3;
      if (t === 0) {
        rod(o, 'pole', [x, y, z], [x, top, z], 0.13, 0.13);
        continue;
      }
      if (t === 1) {
        rod(o, 'pole', [x, y, z], [x, top, z], 0.1, 0.1);
        rod(o, 'pole', [x, top, z], [x, top + 0.15, z - side * 1.15], 0.08, 0.08);
        box(o, 'glass', x, top + 0.09, z - side * 1.15, 0.4, 0.12, 0.7);
        continue;
      }
      const seg = t === 2 ? 6 : t === 3 ? 8 : 10;
      turned(
        o,
        'pole',
        x,
        z,
        [
          [y, 0.15],
          [y + 0.25, 0.15],
          [y + 0.43, 0.075],
          [top, 0.055],
        ],
        seg,
      );
      const path = Array.from({ length: 7 }, (_, j) => {
        const u = j / 6;
        return [x, top + 0.4 * Math.sin(u * Math.PI * 0.85), z - side * 1.75 * u];
      });
      beamPath(o, 'pole', path, 0.07, 0.07, palette.pole.rgb);
      box(o, 'glass', x, top + 0.14, z - side * 1.75, 0.3, 0.14, 0.72);
    }
  }
}
export function buildBridgeLevel(o, level) {
  const t = tiers[level];
  if (t === undefined) throw Error('Unknown bridge tier');
  body(o, t);
  for (const x of bridgeControls.riverPiers) riverPier(o, t, x);
  approachPiers(o, t);
  railings(o, t);
  for (const s of bridgeControls.stairs) stair(o, t, s);
  lamps(o, t);
}
export const buildBridgeSkyline = (o) => buildBridgeLevel(o, 'skyline');
export const buildBridgeDistrict = (o) => buildBridgeLevel(o, 'district');
export const buildBridgeStreet = (o) => buildBridgeLevel(o, 'street');
export const buildBridgeCloseup = (o) => buildBridgeLevel(o, 'closeup');
