/** Imperial Vault of Heaven, independently mapped annexes and estimated Echo Wall enclosure. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/wx/wx4/temple_of_heaven/map-frame.json',
      import.meta.url,
    ),
  ),
);
if (frame.candidateId !== 'temple_of_heaven') throw new Error('Wrong Imperial Vault source');
const rec = frame.reconstruction.vault;
const linear = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((n) => {
      const v = parseInt(n, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
const grayRoof = linear('#596b83'),
  terracotta = linear('#b16b4f');

export function buildHeavenVault(face, d) {
  const point = (center, x, y, z) => [center[0] + x, rec.floorY + y, center[1] + z];
  const radial = (center, a, r, y) => point(center, Math.cos(a) * r, y, Math.sin(a) * r);
  const disk = (role, center, r, y, n, tint) => {
    for (let i = 0; i < n; i++)
      face(
        role,
        [
          point(center, 0, y, 0),
          radial(center, (i * Math.PI * 2) / n, r, y),
          radial(center, ((i + 1) * Math.PI * 2) / n, r, y),
        ],
        [0, 1, 0],
        tint,
      );
  };
  const lathe = (role, center, profile, n, { cap = false, tint, chooseRole } = {}) => {
    for (let j = 1; j < profile.length; j++)
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 2) / n,
          b = ((i + 1) * Math.PI * 2) / n,
          lo = profile[j - 1],
          hi = profile[j],
          mid = (a + b) / 2;
        face(
          chooseRole?.(mid) ?? role,
          [
            radial(center, a, lo[1], lo[0]),
            radial(center, b, lo[1], lo[0]),
            radial(center, b, hi[1], hi[0]),
            radial(center, a, hi[1], hi[0]),
          ],
          [Math.cos(mid), 0, Math.sin(mid)],
          tint,
        );
      }
    if (cap) disk(role, center, profile.at(-1)[1], profile.at(-1)[0], n, tint);
  };
  const workspace = (center, axis = [1, 0], normal = [0, 1]) => {
    const p = ([u, y, v]) =>
      point(center, axis[0] * u + normal[0] * v, y, axis[1] * u + normal[1] * v);
    const dir = ([u, y, v]) => [axis[0] * u + normal[0] * v, y, axis[1] * u + normal[1] * v];
    const quad = (role, points, out, tint) => face(role, points.map(p), dir(out), tint);
    const box = (role, u0, u1, v0, v1, y0, y1, bottom = false, tint) => {
      for (const [points, out] of [
        [
          [
            [u0, y0, v1],
            [u1, y0, v1],
            [u1, y1, v1],
            [u0, y1, v1],
          ],
          [0, 0, 1],
        ],
        [
          [
            [u0, y0, v0],
            [u1, y0, v0],
            [u1, y1, v0],
            [u0, y1, v0],
          ],
          [0, 0, -1],
        ],
        [
          [
            [u0, y0, v0],
            [u0, y0, v1],
            [u0, y1, v1],
            [u0, y1, v0],
          ],
          [-1, 0, 0],
        ],
        [
          [
            [u1, y0, v0],
            [u1, y0, v1],
            [u1, y1, v1],
            [u1, y1, v0],
          ],
          [1, 0, 0],
        ],
        [
          [
            [u0, y1, v0],
            [u1, y1, v0],
            [u1, y1, v1],
            [u0, y1, v1],
          ],
          [0, 1, 0],
        ],
      ])
        quad(role, points, out, tint);
      if (bottom)
        quad(
          role,
          [
            [u0, y0, v0],
            [u1, y0, v0],
            [u1, y0, v1],
            [u0, y0, v1],
          ],
          [0, -1, 0],
          tint,
        );
    };
    return { p, dir, quad, box };
  };
  const vc = rec.vault.center,
    n = [8, 12, 24, 32, 32][d],
    platform = rec.platform,
    R = platform.radius,
    inner = R - 2.1,
    aw = 0.19,
    tau = Math.PI * 2;
  const angles = [
    ...new Set([
      ...Array.from({ length: n }, (_, i) => (i * tau) / n),
      Math.PI / 2 - aw,
      Math.PI / 2 + aw,
    ]),
  ].toSorted((a, b) => a - b);
  disk('brick', rec.center, rec.echoWall.radius - 0.45, 0.01, d <= 1 ? 16 : 48);
  // The platform has a real stair opening, with a filled inner disk beneath the hall.
  for (let i = 0; i < angles.length; i++) {
    const a = angles[i],
      b = angles[(i + 1) % angles.length] + (i === angles.length - 1 ? tau : 0),
      mid = (a + b) / 2;
    if (Math.abs(mid - Math.PI / 2) < aw) continue;
    face(
      'stone',
      [
        radial(vc, a, R, 0),
        radial(vc, b, R, 0),
        radial(vc, b, R, platform.top),
        radial(vc, a, R, platform.top),
      ],
      [Math.cos(mid), 0, Math.sin(mid)],
    );
    face(
      'stone',
      [
        radial(vc, a, R, platform.top),
        radial(vc, b, R, platform.top),
        radial(vc, b, inner, platform.top),
        radial(vc, a, inner, platform.top),
      ],
      [0, 1, 0],
    );
    if (d > 0) {
      const rr = R - 0.35,
        y = platform.top;
      for (const [lo, hi] of d === 1
        ? [[y + 0.1, y + 0.95]]
        : [
            [y + 0.16, y + 0.36],
            [y + 0.78, y + 0.98],
          ]) {
        face(
          'stone',
          [
            radial(vc, a, rr, lo),
            radial(vc, b, rr, lo),
            radial(vc, b, rr, hi),
            radial(vc, a, rr, hi),
          ],
          [Math.cos(mid), 0, Math.sin(mid)],
        );
        face(
          'stone',
          [
            radial(vc, a, rr - 0.22, lo),
            radial(vc, b, rr - 0.22, lo),
            radial(vc, b, rr - 0.22, hi),
            radial(vc, a, rr - 0.22, hi),
          ],
          [-Math.cos(mid), 0, -Math.sin(mid)],
        );
        face(
          'stone',
          [
            radial(vc, a, rr - 0.22, hi),
            radial(vc, b, rr - 0.22, hi),
            radial(vc, b, rr, hi),
            radial(vc, a, rr, hi),
          ],
          [0, 1, 0],
        );
      }
      if (d >= 2)
        lathe(
          'stone',
          [vc[0] + Math.cos(a) * (rr - 0.1), vc[1] + Math.sin(a) * (rr - 0.1)],
          [
            [y, 0.17],
            [y + 1.05, 0.17],
            [y + 1.2, 0.11],
          ],
          6,
          { cap: true },
        );
    }
  }
  disk('stone', vc, inner, platform.top, n);
  const stairCount = d === 0 ? 1 : d === 1 ? 4 : 12,
    outer = R + platform.stairRun;
  for (let i = 0; i < stairCount; i++) {
    const r0 = outer - ((outer - inner) * i) / stairCount,
      r1 = outer - ((outer - inner) * (i + 1)) / stairCount,
      y0 = (platform.top * i) / stairCount,
      y1 = (platform.top * (i + 1)) / stairCount,
      a = Math.PI / 2 - aw,
      b = Math.PI / 2 + aw;
    if (d === 0)
      face(
        'stone',
        [
          radial(vc, a, r0, y0),
          radial(vc, b, r0, y0),
          radial(vc, b, r1, y1),
          radial(vc, a, r1, y1),
        ],
        [0, 1, 0],
      );
    else {
      face(
        'stone',
        [
          radial(vc, a, r0, y0),
          radial(vc, b, r0, y0),
          radial(vc, b, r0, y1),
          radial(vc, a, r0, y1),
        ],
        [0, 0, 1],
      );
      face(
        'stone',
        [
          radial(vc, a, r0, y1),
          radial(vc, b, r0, y1),
          radial(vc, b, r1, y1),
          radial(vc, a, r1, y1),
        ],
        [0, 1, 0],
      );
    }
    for (const [angle, sign] of [
      [a, -1],
      [b, 1],
    ]) {
      const top = (r) => (d === 0 ? y0 + ((r0 - r) / (r0 - r1)) * (y1 - y0) : y1);
      if (Math.min(r0, R) > r1)
        face(
          'stone',
          [
            radial(vc, angle, Math.min(r0, R), top(Math.min(r0, R))),
            radial(vc, angle, r1, top(r1)),
            radial(vc, angle, r1, platform.top),
            radial(vc, angle, Math.min(r0, R), platform.top),
          ],
          [sign * Math.sin(angle), 0, -sign * Math.cos(angle)],
        );
      if (r0 > Math.max(r1, R))
        face(
          'stone',
          [
            radial(vc, angle, r0, -0.25),
            radial(vc, angle, Math.max(r1, R), -0.25),
            radial(vc, angle, Math.max(r1, R), top(Math.max(r1, R))),
            radial(vc, angle, r0, top(r0)),
          ],
          [-sign * Math.sin(angle), 0, sign * Math.cos(angle)],
        );
    }
  }
  lathe(
    'wall',
    vc,
    [
      [platform.top, rec.bodyRadius],
      [rec.heights.bodyTop, rec.bodyRadius],
    ],
    n,
    { chooseRole: (a) => (Math.sin(a) >= -0.05 ? 'wall' : 'brick') },
  );
  lathe(
    'band',
    vc,
    [
      [8.6, rec.bodyRadius + 0.035],
      [10.35, rec.bodyRadius + 0.035],
    ],
    n,
  );
  const roof = [
    [10.5, rec.roofRadius],
    [10.85, rec.roofRadius * 0.93],
    [12.3, rec.roofRadius * 0.69],
    [14.5, rec.roofRadius * 0.4],
    [16.65, rec.roofRadius * 0.14],
    [17.45, 0.45],
  ];
  lathe(
    'roof',
    vc,
    d === 0
      ? [roof[0], roof[3], roof.at(-1)]
      : d === 1
        ? [roof[0], roof[2], roof[4], roof[5]]
        : roof,
    n,
    { cap: true, tint: grayRoof },
  );
  lathe(
    'band',
    vc,
    [
      [10.24, rec.roofRadius * 0.99],
      [10.5, rec.roofRadius],
    ],
    n,
  );
  for (let i = 0; i < n; i++)
    face(
      'band',
      [
        radial(vc, (i * tau) / n, rec.bodyRadius, 10.24),
        radial(vc, ((i + 1) * tau) / n, rec.bodyRadius, 10.24),
        radial(vc, ((i + 1) * tau) / n, rec.roofRadius * 0.99, 10.24),
        radial(vc, (i * tau) / n, rec.roofRadius * 0.99, 10.24),
      ],
      [0, -1, 0],
    );
  lathe(
    'gold',
    vc,
    d === 1
      ? [
          [17.4, 0.42],
          [17.7, 0.65],
          [18.55, 0.68],
          [rec.mappedHeight, 0.055],
        ]
      : [
          [17.4, 0.42],
          [17.7, 0.65],
          [18.0, 0.42],
          [18.55, 0.68],
          [18.9, 0.42],
          [rec.mappedHeight, 0.055],
        ],
    d === 1 ? 6 : d === 0 ? 8 : 12,
    { cap: true },
  );
  const bays = d <= 1 ? 12 : 16;
  for (let i = 0; i < bays; i++) {
    const a = ((i + 0.5) * tau) / bays;
    if (Math.sin(a) < 0) continue;
    const da = (0.34 * tau) / bays,
      r = rec.bodyRadius + 0.055;
    face(
      'dark',
      [
        radial(vc, a - da, r, 2.45),
        radial(vc, a + da, r, 2.45),
        radial(vc, a + da, r, 7.85),
        radial(vc, a - da, r, 7.85),
      ],
      [Math.cos(a), 0, Math.sin(a)],
    );
    if (d > 0) {
      face(
        'gold',
        [
          radial(vc, a - da, r + 0.03, 8.0),
          radial(vc, a + da, r + 0.03, 8.0),
          radial(vc, a + da, r + 0.03, 8.2),
          radial(vc, a - da, r + 0.03, 8.2),
        ],
        [Math.cos(a), 0, Math.sin(a)],
      );
      if (d >= 2)
        lathe(
          'wall',
          [
            vc[0] + Math.cos(a + (tau / bays) * 0.5) * r,
            vc[1] + Math.sin(a + (tau / bays) * 0.5) * r,
          ],
          [
            [2.2, 0.19],
            [8.6, 0.19],
          ],
          6,
          { cap: true },
        );
    }
  }
  if (d > 0) {
    const q = workspace(vc),
      z = rec.bodyRadius + 0.15;
    q.box('gold', -0.9, 0.9, z, z + 0.07, 8.8, 10.7, true);
    q.box('roof', -0.7, 0.7, z + 0.08, z + 0.11, 9.0, 10.5, true, grayRoof);
  }
  // Annex long axes and inward-facing facades derive independently from their own map outlines.
  for (const building of [rec.east, rec.west]) {
    const outline = building.polygons[0].outline,
      e = outline[1].map((x, i) => x - outline[0][i]),
      length = Math.hypot(...e),
      sign = building === rec.east ? 1 : -1;
    const axis = e.map((x) => (x / length) * sign),
      normal = [-axis[1], axis[0]],
      q = workspace(building.center, axis, normal);
    const projected = outline.map((p) => {
      const x = p[0] - building.center[0],
        z = p[1] - building.center[1];
      return [x * axis[0] + z * axis[1], x * normal[0] + z * normal[1]];
    });
    const hx = Math.max(...projected.map((p) => Math.abs(p[0]))),
      hz = Math.max(...projected.map((p) => Math.abs(p[1])));
    q.box('stone', -hx - 1, hx + 1, -hz - 1, hz + 1, 0, 1);
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i],
        b = outline[(i + 1) % outline.length];
      face(
        'brick',
        [
          [a[0], rec.floorY + 1, a[1]],
          [b[0], rec.floorY + 1, b[1]],
          [b[0], rec.floorY + 5.7, b[1]],
          [a[0], rec.floorY + 5.7, a[1]],
        ],
        [(a[0] + b[0]) / 2 - building.center[0], 0, (a[1] + b[1]) / 2 - building.center[1]],
      );
    }
    q.box('wall', -hx, hx, hz - 0.05, hz + 0.05, 1, 5.7);
    q.box('band', -hx - 0.1, hx + 0.1, hz + 0.06, hz + 0.15, 4.8, 5.7, true);
    const roofRings = [
      [hx + 1.1, hz + 1.1, 5.9],
      [hx + 0.7, hz + 0.7, 6.3],
      [hx - hz * 0.35, hz * 0.28, 7.7],
      [hx - hz * 0.5, 0.09, 8.7],
    ].map(([x, z, y], j) =>
      [
        [-x, -z],
        [x, -z],
        [x, z],
        [-x, z],
      ].map(([u, v]) => [u, y + (j === 0 ? 0.25 : 0), v]),
    );
    for (let j = 1; j < roofRings.length; j++)
      for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        q.quad(
          'roof',
          [roofRings[j - 1][i], roofRings[j - 1][next], roofRings[j][next], roofRings[j][i]],
          [roofRings[j - 1][i][0], 0.5, roofRings[j - 1][i][2]],
          grayRoof,
        );
      }
    q.quad('roof', roofRings.at(-1), [0, 1, 0], grayRoof);
    q.quad(
      'band',
      [
        [-hx - 1.1, 5.65, -hz - 1.1],
        [hx + 1.1, 5.65, -hz - 1.1],
        [hx + 1.1, 5.65, hz + 1.1],
        [-hx - 1.1, 5.65, hz + 1.1],
      ],
      [0, -1, 0],
    );
    for (let i = 0; i < 4; i++)
      q.quad(
        'band',
        [
          [roofRings[0][i][0], 5.65, roofRings[0][i][2]],
          [roofRings[0][(i + 1) % 4][0], 5.65, roofRings[0][(i + 1) % 4][2]],
          roofRings[0][(i + 1) % 4],
          roofRings[0][i],
        ],
        [roofRings[0][i][0], 0, roofRings[0][i][2]],
      );
    for (let i = 0; i < 5; i++) {
      const u = ((i - 2) * hx * 2) / 5,
        half = hx / 5 - 0.18;
      q.quad(
        'dark',
        [
          [u - half, 1.2, hz + 0.17],
          [u + half, 1.2, hz + 0.17],
          [u + half, 4.6, hz + 0.17],
          [u - half, 4.6, hz + 0.17],
        ],
        [0, 0, 1],
      );
      if (d >= 2) {
        q.box('gold', u - 0.05, u + 0.05, hz + 0.18, hz + 0.23, 1.3, 4.5, true);
        q.box('gold', u - half, u + half, hz + 0.17, hz + 0.23, 4.95, 5.5, true);
      }
    }
    const count = d === 0 ? 1 : 6;
    if (d === 1) {
      q.quad(
        'stone',
        [
          [-1.6, 0, hz + 3.3],
          [1.6, 0, hz + 3.3],
          [1.6, 1, hz + 1],
          [-1.6, 1, hz + 1],
        ],
        [0, 1, 0],
      );
      for (const side of [-1, 1])
        q.quad(
          'stone',
          [
            [side * 1.6, -0.15, hz + 1],
            [side * 1.6, -0.15, hz + 3.3],
            [side * 1.6, 0, hz + 3.3],
            [side * 1.6, 1, hz + 1],
          ],
          [side, 0, 0],
        );
    } else
      for (let i = 0; i < count; i++)
        q.box(
          'stone',
          -1.6,
          1.6,
          hz + 1 + ((count - i - 1) * 2.3) / count,
          hz + 1 + ((count - i) * 2.3) / count,
          0,
          (i + 1) / count,
        );
    if (d >= 2)
      for (const side of [-1, 1])
        q.box(
          'roof',
          side * (hx - hz * 0.5) - 0.14,
          side * (hx - hz * 0.5) + 0.14,
          -0.2,
          0.2,
          8.7,
          9.15,
          true,
          grayRoof,
        );
  }
  const wall = rec.echoWall,
    count = d === 0 ? 12 : d === 1 ? 24 : d === 2 ? 48 : 64,
    center = rec.center;
  const difference = (a) => Math.atan2(Math.sin(a - wall.gateAngle), Math.cos(a - wall.gateAngle));
  const wallAngles = [
    ...new Set([
      ...Array.from({ length: count }, (_, i) => (i * tau) / count),
      (wall.gateAngle - wall.gapHalfAngle + tau) % tau,
      (wall.gateAngle + wall.gapHalfAngle) % tau,
    ]),
  ].toSorted((a, b) => a - b);
  for (let i = 0; i < wallAngles.length; i++) {
    const a = wallAngles[i],
      b = wallAngles[(i + 1) % wallAngles.length] + (i === wallAngles.length - 1 ? tau : 0),
      mid = (a + b) / 2;
    if (Math.abs(difference(mid)) < wall.gapHalfAngle) continue;
    for (const [r, sign] of [
      [wall.radius, 1],
      [wall.radius - wall.thickness, -1],
    ])
      face(
        'brick',
        [
          radial(center, a, r, 0),
          radial(center, b, r, 0),
          radial(center, b, r, wall.height),
          radial(center, a, r, wall.height),
        ],
        [sign * Math.cos(mid), 0, sign * Math.sin(mid)],
      );
    const profile = [
      [wall.radius + 0.15, wall.height],
      [wall.radius - wall.thickness / 2, wall.height + wall.copingRise],
      [wall.radius - wall.thickness - 0.15, wall.height],
    ];
    for (let j = 1; j < profile.length; j++)
      face(
        'roof',
        [
          radial(center, a, profile[j - 1][0], profile[j - 1][1]),
          radial(center, b, profile[j - 1][0], profile[j - 1][1]),
          radial(center, b, profile[j][0], profile[j][1]),
          radial(center, a, profile[j][0], profile[j][1]),
        ],
        [0, 1, 0],
        grayRoof,
      );
  }
  // Three true arched openings in the mapped south gate; no opaque plane blocks a passage.
  const gate = rec.gate,
    q = workspace(gate.center),
    gateHalf = gate.size[0] / 2,
    openings = [
      [-5.1, 1.25],
      [0, 1.55],
      [5.1, 1.25],
    ],
    spring = 2.25,
    top = 4.8,
    depth = 0.8,
    segments = d <= 1 ? 4 : 10;
  let last = -gateHalf;
  for (const [u, r] of openings) {
    q.box('brick', last, u - r, -depth, depth, 0, top);
    for (let i = 0; i < segments; i++) {
      const a = (i * Math.PI) / segments,
        b = ((i + 1) * Math.PI) / segments,
        A = [u + Math.cos(a) * r, spring + Math.sin(a) * r],
        B = [u + Math.cos(b) * r, spring + Math.sin(b) * r];
      for (const side of [-1, 1]) {
        q.quad(
          'brick',
          [
            [A[0], A[1], side * depth],
            [B[0], B[1], side * depth],
            [B[0], top, side * depth],
            [A[0], top, side * depth],
          ],
          [0, 0, side],
        );
        q.quad(
          'stone',
          [
            [u + Math.cos(a) * (r + 0.2), spring + Math.sin(a) * (r + 0.2), side * (depth + 0.03)],
            [u + Math.cos(b) * (r + 0.2), spring + Math.sin(b) * (r + 0.2), side * (depth + 0.03)],
            [B[0], B[1], side * (depth + 0.03)],
            [A[0], A[1], side * (depth + 0.03)],
          ],
          [0, 0, side],
        );
      }
      q.quad(
        'brick',
        [
          [A[0], A[1], -depth],
          [B[0], B[1], -depth],
          [B[0], B[1], depth],
          [A[0], A[1], depth],
        ],
        [-Math.cos((a + b) / 2), -Math.sin((a + b) / 2), 0],
      );
    }
    q.quad(
      'brick',
      [
        [u - r, 0, -depth],
        [u - r, 0, depth],
        [u - r, spring, depth],
        [u - r, spring, -depth],
      ],
      [1, 0, 0],
    );
    q.quad(
      'brick',
      [
        [u + r, 0, -depth],
        [u + r, 0, depth],
        [u + r, spring, depth],
        [u + r, spring, -depth],
      ],
      [-1, 0, 0],
    );
    last = u + r;
  }
  q.box('brick', last, gateHalf, -depth, depth, 0, top);
  q.box('roof', -gateHalf, gateHalf, -depth - 0.1, depth + 0.1, top, top + 0.18, false, grayRoof);
  for (const sign of [-1, 1]) {
    const cc = [gate.center[0] + sign * (gateHalf - 1.2), gate.center[1]];
    lathe(
      'roof',
      cc,
      [
        [4.9, 1.55],
        [5.2, 1.3],
        [6.2, 0.2],
      ],
      d <= 1 ? 8 : 12,
      { cap: true, tint: terracotta },
    );
    lathe(
      'gold',
      cc,
      [
        [6.2, 0.12],
        [6.45, 0.2],
        [6.6, 0.03],
      ],
      8,
      { cap: true },
    );
  }
  // Bridge the small paving-to-wall offset explicitly rather than leaving two open seams.
  for (const sign of [-1, 1]) {
    const a = wall.gateAngle - sign * wall.gapHalfAngle,
      p = radial(center, a, wall.radius - wall.thickness / 2, 0),
      end = [gate.center[0] + sign * gateHalf, gate.center[1]];
    const dx = end[0] - p[0],
      dz = end[1] - p[2],
      length = Math.hypot(dx, dz),
      axis = [dx / length, dz / length],
      normal = [-axis[1], axis[0]],
      join = workspace([p[0], p[2]], axis, normal);
    join.box('brick', 0, length, -0.45, 0.45, 0, wall.height);
    join.box('roof', 0, length, -0.55, 0.55, wall.height, wall.height + 0.2, false, grayRoof);
  }
}
