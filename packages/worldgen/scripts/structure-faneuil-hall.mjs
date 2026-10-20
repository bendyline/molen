/** Faneuil Hall: seven-bay brick gables, layered white cornices and the eastern grasshopper cupola. */
import './install-deterministic-math.mjs';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { B, c, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const gold = rgb('c8b064');
const entrance = { width: 1.9, floor: 0.12, shoulder: 3.1, top: 4.05, front: 0.215, back: -0.335 };
const doorCenters = [-2, 0, 2].map((i) => (i * (24.5 - 1.8)) / 7);
function facing(o, angle, tx = 0, tz = 0) {
  const co = Math.cos(angle),
    si = Math.sin(angle),
    rot = (p) => [co * p[0] + si * p[2], p[1], -si * p[0] + co * p[2]],
    point = (p) => {
      const q = rot(p);
      return [q[0] + tx, q[1], q[2] + tz];
    };
  return {
    addTriangle: (s, r, p, n, uv, col) => o.addTriangle(s, r, p.map(point), rot(n), uv, col),
    addQuad: (s, r, p, n, uv, col) => o.addQuad(s, r, p.map(point), rot(n), uv, col),
    addConvexPolygon: (s, r, p, n, uv, col) => {
      const uvs = p.map(uv);
      const pts = p.map(point);
      return o.addConvexPolygon(s, r, pts, rot(n), (q) => uvs[pts.indexOf(q)] ?? [q[0], q[1]], col);
    },
  };
}
function faceQuad(o, slot, x, y, z, w, h, col) {
  quad(
    o,
    slot,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    col,
  );
}
function arch(o, x, y, z, w, h, detail, { half = false, open = false } = {}) {
  const rad = w / 2,
    shoulder = half ? y : y + h - rad,
    segments = detail > 1 ? 12 : 4;
  if (!detail) {
    if (!open) faceQuad(o, 'glass', x, y, z, w, h, c.glass);
    return;
  }
  const point = (a, r = rad, zz = z) => [x + Math.cos(a) * r, shoulder + Math.sin(a) * r, zz];
  const pts = half
    ? [
        [x - rad, y, z],
        [x + rad, y, z],
      ]
    : [
        [x - rad, y, z],
        [x + rad, y, z],
        [x + rad, shoulder, z],
      ];
  for (let i = 1; i <= segments - (half ? 1 : 0); i++) pts.push(point((i * Math.PI) / segments));
  if (!open)
    o.addConvexPolygon('glass', 'palette:#ffffff', pts, [0, 0, 1], (p) => [p[0], p[1]], c.glass);
  for (let i = 0; i < segments; i++) {
    const a = (i * Math.PI) / segments,
      b = ((i + 1) * Math.PI) / segments;
    quad(
      o,
      'concrete',
      [
        point(a, rad, z + 0.035),
        point(b, rad, z + 0.035),
        point(b, rad + 0.14, z + 0.035),
        point(a, rad + 0.14, z + 0.035),
      ],
      [0, 0, 1],
      c.white,
    );
  }
  if (!half)
    for (const sign of [-1, 1])
      faceQuad(o, 'concrete', x + sign * (rad + 0.07), y, z + 0.035, 0.14, shoulder - y, c.white);
  faceQuad(o, 'concrete', x, y - 0.12, z + 0.06, w + 0.4, 0.17, c.white);
  if (open || detail < 2) return;
  for (const dx of [-w / 3, 0, w / 3]) {
    const height = shoulder - y + Math.sqrt(Math.max(0, rad * rad - dx * dx));
    faceQuad(o, 'concrete', x + dx, y, z + 0.07, 0.045, height, c.white);
  }
  for (let v = 0.5; v < h - 0.4; v += 0.65) {
    const yy = y + v,
      ww =
        yy <= shoulder
          ? w
          : 2 * Math.sqrt(Math.max(0, rad * rad - (yy - shoulder) * (yy - shoulder)));
    if (ww > 0.1) faceQuad(o, 'concrete', x, yy, z + 0.075, ww, 0.045, c.white);
  }
}
function oculus(o, x, y, z, detail) {
  const n = detail > 1 ? 20 : 10,
    r = 0.66;
  const p = Array.from({ length: n }, (_, i) => [
    x + Math.cos((i * Math.PI * 2) / n) * r,
    y + Math.sin((i * Math.PI * 2) / n) * r,
    z,
  ]);
  o.addConvexPolygon('glass', 'palette:#ffffff', p, [0, 0, 1], (p) => [p[0], p[1]], c.glass);
  if (!detail) return;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    quad(
      o,
      'concrete',
      [
        [x + Math.cos(a) * r, y + Math.sin(a) * r, z + 0.03],
        [x + Math.cos(b) * r, y + Math.sin(b) * r, z + 0.03],
        [x + Math.cos(b) * (r + 0.12), y + Math.sin(b) * (r + 0.12), z + 0.03],
        [x + Math.cos(a) * (r + 0.12), y + Math.sin(a) * (r + 0.12), z + 0.03],
      ],
      [0, 0, 1],
      c.white,
    );
  }
  if (detail > 1)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      beam(
        o,
        'concrete',
        [x, y, z + 0.08],
        [x + Math.cos(a) * r, y + Math.sin(a) * r, z + 0.08],
        0.035,
        0.035,
        c.white,
      );
    }
}
function entranceSegments(detail) {
  return detail > 1 ? 12 : detail ? 4 : 2;
}
function entranceProfile(x, detail, z) {
  const n = entranceSegments(detail),
    r = entrance.width / 2;
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (i * Math.PI) / n;
    return [x + Math.cos(a) * r, entrance.shoulder + Math.sin(a) * r, z];
  });
}
function wallWithEntrances(o, detail) {
  const { width, floor, top } = entrance;
  let left = -12.25;
  for (const x of doorCenters) {
    const a = x - width / 2;
    faceQuad(o, 'brick', (left + a) / 2, -0.75, 0, a - left, top + 0.76, c.redbrick);
    faceQuad(o, 'brick', x, -0.75, 0, width, floor + 0.75, c.redbrick);
    const arc = entranceProfile(x, detail, 0);
    for (let i = 0; i < arc.length - 1; i++) {
      const a = arc[i],
        b = arc[i + 1];
      // Triangles avoid degenerate spandrel quads at the crown of the arch.
      o.addConvexPolygon(
        'brick',
        'palette:#ffffff',
        [b, a, [a[0], top + 0.01, 0], [b[0], top + 0.01, 0]],
        [0, 0, 1],
        (p) => [p[0], p[1]],
        c.redbrick,
      );
    }
    left = x + width / 2;
  }
  faceQuad(o, 'brick', (left + 12.25) / 2, -0.75, 0, 12.25 - left, top + 0.76, c.redbrick);
  faceQuad(o, 'brick', 0, top + 0.01, 0, 24.5, 18.4 - top - 0.01, c.redbrick);
  // Projecting stone base is split around the door thresholds too.
  left = -12.35;
  for (const x of [...doorCenters, 13.3]) {
    const right = Math.min(12.35, x - width / 2);
    if (right > left) {
      faceQuad(o, 'concrete', (left + right) / 2, -0.35, 0.1, right - left, 0.55, c.cream);
      quad(
        o,
        'concrete',
        [
          [left, 0.2, 0.1],
          [right, 0.2, 0.1],
          [right, 0.2, -0.1],
          [left, 0.2, -0.1],
        ],
        [0, 1, 0],
        c.cream,
      );
    }
    left = x + width / 2;
  }
}
function recessedDoor(o, x, detail) {
  const { width, floor, shoulder, front, back } = entrance,
    r = width / 2;
  for (const sign of [-1, 1]) {
    const p = [
      [x + sign * r, floor, front],
      [x + sign * r, floor, back],
      [x + sign * r, shoulder, back],
      [x + sign * r, shoulder, front],
    ];
    if (sign > 0) p.reverse();
    quad(o, 'concrete', p, [-sign, 0, 0], c.cream);
  }
  const arc = entranceProfile(x, detail, front);
  for (let i = 0; i < arc.length - 1; i++) {
    const a = arc[i],
      b = arc[i + 1],
      p = [a, [a[0], a[1], back], [b[0], b[1], back], b];
    p.reverse();
    quad(o, 'concrete', p, normalFor(...p), c.cream);
  }
  quad(
    o,
    'concrete',
    [
      [x - r, floor, front],
      [x + r, floor, front],
      [x + r, floor, back],
      [x - r, floor, back],
    ],
    [0, 1, 0],
    c.cream,
  );
  faceQuad(o, 'metal', x, floor, back, width, 2.75, c.dark);
  // Upper glazing is behind the curved reveals, not a painted arch on a solid wall.
  const fan = [
    [x - r, floor + 2.75, back],
    [x + r, floor + 2.75, back],
    ...arc.map((p) => [p[0], p[1], back]),
  ];
  o.addConvexPolygon('glass', 'palette:#ffffff', fan, [0, 0, 1], (p) => [p[0], p[1]], c.glass);
  if (detail) {
    arch(o, x, floor, 0.18, width, entrance.top - floor, detail, { open: true });
    faceQuad(o, 'concrete', x, floor + 2.75, back + 0.015, width, 0.1, c.white);
    faceQuad(o, 'concrete', x, floor, back + 0.015, 0.075, 2.75, c.white);
  }
  if (detail > 1) {
    for (const sign of [-1, 1])
      for (const y of [0.35, 1.1, 1.85])
        faceQuad(o, 'metal', x + sign * 0.45, y, back + 0.025, 0.65, 0.53, c.roof);
    for (const dx of [-0.5, 0, 0.5]) {
      const h = shoulder + Math.sqrt(r * r - dx * dx) - floor - 2.75;
      faceQuad(o, 'concrete', x + dx, floor + 2.75, back + 0.02, 0.04, h, c.white);
    }
  }
}
function facade(o, w, bays, detail, gable) {
  const pitch = (w - 1.8) / bays;
  for (const [y, h, depth] of [
    [4.6, 0.5, 0.45],
    [10.7, 0.62, 0.48],
    [18.0, 0.65, 0.65],
  ]) {
    B(o, 'concrete', 0, y, 0.08, w + 0.5, h, depth, 'white');
    if (detail > 1) {
      B(o, 'concrete', 0, y + h - 0.08, 0.16, w + 0.8, 0.15, depth + 0.18, 'cream');
      B(o, 'concrete', 0, y - 0.12, 0.06, w + 0.25, 0.13, depth * 0.7, 'cream');
    }
  }
  for (let i = 0; i < bays; i++) {
    const x = (i - (bays - 1) / 2) * pitch;
    if (gable && [1, 3, 5].includes(i)) recessedDoor(o, x, detail);
    else arch(o, x, 0.25, 0.18, 1.9, 3.8, detail);
    arch(o, x, 5.4, 0.18, 1.8, 4.65, detail);
    if (gable) arch(o, x, 12.0, 0.18, 1.8, 4.5, detail);
    else {
      faceQuad(o, 'glass', x, 11.9, 0.18, 1.8, 3.8, c.glass);
      if (detail) {
        for (const sign of [-1, 1])
          faceQuad(o, 'concrete', x + sign * 0.95, 11.8, 0.22, 0.14, 4, c.white);
        faceQuad(o, 'concrete', x, 11.7, 0.22, 2.1, 0.17, c.white);
        faceQuad(o, 'concrete', x, 15.65, 0.22, 2.1, 0.25, c.white);
      }
      if (detail > 1) {
        for (const dx of [-0.45, 0, 0.45])
          faceQuad(o, 'concrete', x + dx, 11.9, 0.25, 0.04, 3.8, c.white);
        for (const y of [12.6, 13.3, 14, 14.7])
          faceQuad(o, 'concrete', x, y, 0.25, 1.8, 0.04, c.white);
      }
      arch(o, x, 16.55, 0.18, 1.8, 0.9, detail, { half: true });
    }
  }
  if (detail)
    for (let i = 0; i <= bays; i++) {
      const x = (i - bays / 2) * pitch;
      for (const [y, h] of [
        [0.1, 4.4],
        [5.15, 5.5],
        [11.4, 6.5],
      ]) {
        if (detail === 1) {
          faceQuad(o, 'concrete', x, y, 0.38, 0.63, 0.22, c.white);
          faceQuad(o, 'concrete', x, y + h - 0.2, 0.38, 0.66, 0.27, c.white);
        } else {
          B(o, 'brick', x, y, 0.11, 0.42, h, 0.25, 'redbrick');
          B(o, 'concrete', x, y, 0.18, 0.63, 0.22, 0.34, 'white');
          B(o, 'concrete', x, y + h - 0.2, 0.18, 0.66, 0.27, 0.38, 'white');
        }
      }
    }
  if (detail > 2)
    for (let i = 0; i < Math.round(w / 0.5); i++)
      B(o, 'concrete', -w / 2 + 0.2 + i * 0.5, 18.3, 0.38, 0.16, 0.23, 0.32, 'white');
  if (!gable) return;
  const points = [
    [-w / 2 - 0.2, 18.65, 0.15],
    [0, 24.0, 0.15],
    [w / 2 + 0.2, 18.65, 0.15],
  ];
  for (let i = 0; i < 2; i++) beam(o, 'concrete', points[i], points[i + 1], 0.35, 0.55, c.white);
  if (detail) {
    arch(o, 0, 18.9, 0.18, 4.6, 2.3, detail, { half: true });
    // Large blind relieving arch around the central fanlight.
    for (let i = 0; i < (detail > 1 ? 24 : 8); i++) {
      const count = detail > 1 ? 24 : 8,
        a = (i * Math.PI) / count,
        b = ((i + 1) * Math.PI) / count;
      beam(
        o,
        'concrete',
        [Math.cos(a) * 4.15, 18.75 + Math.sin(a) * 4.15, 0.23],
        [Math.cos(b) * 4.15, 18.75 + Math.sin(b) * 4.15, 0.23],
        0.14,
        0.14,
        c.white,
      );
    }
    for (const x of [-6.4, 6.4]) oculus(o, x, 20.15, 0.2, detail);
  }
}
function cupola(o, detail) {
  const z = 12.5;
  B(o, 'concrete', 0, 21.8, z, 5.6, 5.1, 5.6, 'cream');
  for (const y of [22.5, 26.55]) B(o, 'concrete', 0, y, z, 6.2, 0.32, 6.2, 'white');
  if (detail)
    for (let j = 0; j < 4; j++) {
      const face = facing(
        o,
        (j * Math.PI) / 2,
        Math.sin((j * Math.PI) / 2) * 2.83,
        z + Math.cos((j * Math.PI) / 2) * 2.83,
      );
      arch(face, 0, 23.5, 0.03, 1.5, 2.25, detail);
      if (detail > 1)
        for (let row = 0; row < 12; row++)
          for (const x of [-2.55, 2.55])
            B(face, 'concrete', x, 22.1 + row * 0.38, 0.04, 0.48, 0.16, 0.16, 'white');
    }
  const sides = 8,
    rr = 2.25;
  loft(
    o,
    'concrete',
    [
      radialRing(27.0, 2.7, 2.7, sides, [0, z], Math.PI / 8),
      radialRing(27.3, 2.7, 2.7, sides, [0, z], Math.PI / 8),
    ],
    c.white,
  );
  if (!detail) {
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      B(o, 'concrete', Math.cos(a) * rr, 27.3, z + Math.sin(a) * rr, 0.34, 4.7, 0.34, 'white');
    }
  } else
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        r = rr * Math.cos(Math.PI / 8),
        face = facing(o, a, Math.sin(a) * r, z + Math.cos(a) * r),
        w = 2 * rr * Math.sin(Math.PI / 8);
      // Open lantern: opaque corner posts and arch spandrels; no dark box behind the openings.
      for (const sign of [-1, 1])
        B(face, 'concrete', sign * (w / 2 - 0.13), 27.3, 0, 0.26, 4.7, 0.32, 'white');
      arch(face, 0, 27.5, 0.05, w - 0.55, 3.9, detail, { open: true });
      B(face, 'concrete', 0, 31.45, 0, w, 0.65, 0.32, 'white');
      const rad = (w - 0.55) / 2,
        shoulder = 31.4 - rad;
      for (let j = 0; j < (detail > 1 ? 8 : 2); j++) {
        const count = detail > 1 ? 8 : 2,
          a = (j * Math.PI) / count,
          b = ((j + 1) * Math.PI) / count;
        quad(
          face,
          'concrete',
          [
            [Math.cos(a) * rad, shoulder + Math.sin(a) * rad, 0.04],
            [Math.cos(b) * rad, shoulder + Math.sin(b) * rad, 0.04],
            [Math.cos(b) * rad, 31.6, 0.04],
            [Math.cos(a) * rad, 31.6, 0.04],
          ],
          [0, 0, 1],
          c.white,
        );
      }
      if (detail > 1)
        for (const sign of [-1, 1])
          for (const dx of [-0.06, 0, 0.06])
            faceQuad(
              face,
              'concrete',
              sign * (w / 2 - 0.13) + dx,
              27.6,
              0.18,
              0.023,
              3.55,
              c.cream,
            );
    }
  loft(
    o,
    'concrete',
    [
      radialRing(32.0, 2.65, 2.65, 8, [0, z], Math.PI / 8),
      radialRing(32.4, 2.65, 2.65, 8, [0, z], Math.PI / 8),
    ],
    c.white,
  );
  const rings = [];
  for (let i = 0; i <= 5; i++) {
    const a = (i * Math.PI) / 12;
    const r = Math.max(0.06, 2.35 * Math.cos(a));
    rings.push(radialRing(32.4 + 1.55 * Math.sin(a), r, r, 8, [0, z], Math.PI / 8));
  }
  rings.push(radialRing(34, 0.08, 0.08, 8, [0, z], Math.PI / 8));
  loft(o, 'metal', rings, gold);
  sphere(
    o,
    'metal',
    [0, 34.2, z],
    [0.23, 0.23, 0.23],
    gold,
    detail > 1 ? 10 : 6,
    detail > 1 ? 6 : 4,
  );
  beam(o, 'metal', [0, 34.2, z], [0, 36.5, z], 0.045, 0.045, c.dark);
  if (detail < 2) return;
  for (const angle of [0, Math.PI / 2])
    beam(
      o,
      'metal',
      [-Math.cos(angle) * 0.8, 35, z - Math.sin(angle) * 0.8],
      [Math.cos(angle) * 0.8, 35, z + Math.sin(angle) * 0.8],
      0.045,
      0.045,
      c.dark,
    );
  // Gold grasshopper: tapered body, raised hind legs, head and long antennae define the silhouette.
  sphere(o, 'metal', [0, 35.95, z], [0.64, 0.17, 0.14], gold, 12, 6);
  sphere(o, 'metal', [0.61, 36.03, z], [0.18, 0.19, 0.17], gold, 10, 6);
  for (const sign of [-1, 1]) {
    beam(
      o,
      'metal',
      [-0.15, 35.9, z + sign * 0.12],
      [-0.72, 36.5, z + sign * 0.17],
      0.07,
      0.06,
      gold,
    );
    beam(
      o,
      'metal',
      [-0.72, 36.5, z + sign * 0.17],
      [-0.48, 35.8, z + sign * 0.2],
      0.045,
      0.04,
      gold,
    );
    beam(
      o,
      'metal',
      [0.65, 36.12, z + sign * 0.08],
      [1.05, 36.48, z + sign * 0.2],
      0.025,
      0.025,
      gold,
    );
    beam(
      o,
      'metal',
      [0.2, 35.9, z + sign * 0.12],
      [0.45, 35.65, z + sign * 0.3],
      0.035,
      0.035,
      gold,
    );
  }
}
function build(o, detail) {
  // Exterior shell: whole solid blocks would occlude the entrance recesses.
  for (const sign of [-1, 1]) {
    wallWithEntrances(facing(o, sign > 0 ? 0 : Math.PI, 0, sign * 15.55), detail);
    faceQuad(
      facing(o, (sign * Math.PI) / 2, sign * 12.25, 0),
      'brick',
      0,
      -0.75,
      0,
      31.1,
      19.15,
      c.redbrick,
    );
    faceQuad(
      facing(o, (sign * Math.PI) / 2, sign * 12.35, 0),
      'concrete',
      0,
      -0.35,
      0,
      31.3,
      0.55,
      c.cream,
    );
  }
  quad(
    o,
    'brick',
    [
      [-12.25, -0.75, -15.55],
      [12.25, -0.75, -15.55],
      [12.25, -0.75, 15.55],
      [-12.25, -0.75, 15.55],
    ],
    [0, -1, 0],
    c.redbrick,
  );
  quad(
    o,
    'brick',
    [
      [-12.25, 18.4, 15.55],
      [12.25, 18.4, 15.55],
      [12.25, 18.4, -15.55],
      [-12.25, 18.4, -15.55],
    ],
    [0, 1, 0],
    c.redbrick,
  );
  for (const sign of [-1, 1]) {
    const p = [
      [sign * 12.6, 18.5, -15.85],
      [sign * 12.6, 18.5, 15.85],
      [0, 24, 15.85],
      [0, 24, -15.85],
    ];
    if (sign > 0) p.reverse();
    quad(o, 'roof', p, normalFor(...p), c.roof);
    o.addTriangle(
      'brick',
      'palette:#ffffff',
      [
        [-12.25, 18.5, sign * 15.55],
        [12.25, 18.5, sign * 15.55],
        [0, 24, sign * 15.55],
      ],
      [0, 0, sign],
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      c.brick,
    );
  }
  for (const sign of [-1, 1])
    facade(facing(o, sign > 0 ? 0 : Math.PI, 0, sign * 15.55), 24.5, 7, detail, true);
  for (const sign of [-1, 1])
    facade(facing(o, (sign * Math.PI) / 2, sign * 12.25, 0), 31.1, 9, detail, false);
  B(o, 'brick', 0, 23.5, -13.4, 1.25, 1.6, 1.1, 'redbrick');
  B(o, 'concrete', 0, 25.05, -13.4, 1.5, 0.16, 1.3, 'cream');
  cupola(o, detail);
}
export function faneuil(o) {
  build(o, 3);
}
export function faneuilSkyline(o) {
  build(o, 0);
}
export function faneuilDistrict(o) {
  build(o, 1);
}
export function faneuilStreet(o) {
  build(o, 2);
}
const surfaces = {
  ...landmarkSurfaces,
  glass: { ...landmarkSurfaces.glass, localRef: 'palette:#ffffff' },
};
export const faneuilModel = {
  id: 'faneuil_hall',
  recipe: 'structure-faneuil-hall.mjs',
  key: 'faneuil_hall',
  cell: 'dr/drt',
  title: 'Faneuil Hall',
  brief:
    'Three-storey seven-bay brick gables, long arcaded side elevations, white cornices and pilasters, slate gable roof and east-end open cupola with a gilded grasshopper weather vane.',
  camera: [-45, 27, 57],
  lookAt: [0, 15, 0],
  qaCameras: [
    { name: 'front', position: [0, 24.225956535339357, 72.03105354309082], lookAt: [0, 15, 0] },
    { name: 'back', position: [0, 29.81656188964844, -72.03105354309082], lookAt: [0, 15, 0] },
    { name: 'west-entrances', position: [-9, 3.4, -26], lookAt: [0, 2.2, -15.5] },
    { name: 'east-entrance-detail', position: [3.3, 2.9, 21], lookAt: [0, 2.1, 15.4] },
  ],
  build: faneuil,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'East entrance [0,15.9] defines the 5.5784 m host datum. Preserved terrain spans -0.012635..0.171418 m across mapped hall/cupola vertices. Foundation closes to -0.75 m; exact historic paving datum is not surveyed.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-faneuil-hall.mjs',
    level: 'skyline',
    export: 'faneuilSkyline',
    errorMeters: 1.2,
    authoredLevels: {
      district: { export: 'faneuilDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'faneuilStreet', errorMeters: 0.14, surfaces },
    },
  },
  limitations: [
    'Original medium-fi exterior: Qualla corpus searched first; current entrance construction uses two inspected NPS originals with explicit public-domain grants. Generalized hall/cupola footprints and retained photographic proportions are not a measured survey.',
    'The west gable doors, arched fanlights and white reveals are visible in the NPS originals. East gable entrance distribution is retained as a conservative symmetry approximation. Recess depth 0.55 m is estimated; opaque leaves terminate the exterior, with no navigable interior.',
    'Facade bay rhythm, arched fanlights, pilasters, cornices, gables, open lantern and grasshopper silhouette are retained. Fine Corinthian ornament, pane counts, access ramps, plaques and hidden roof service details are simplified.',
    'Only historic Faneuil Hall is included. Quincy Market, neighboring market buildings, plaza furniture and interiors are excluded.',
    'Height estimates and entrance datum are photographic/map interpretations. Other host elevation datasets may require a new placement review.',
    'Qualla corpus and exact supplemental NPS originals/rights are recorded with the source; no photographs are embedded or redistributed in the runtime pack.',
  ],
};
