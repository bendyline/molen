/** Fangze square altar, Lingxing gates and mapped Huangqi hall court. */
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';
export const earthTempleCandidateId = 'N0533';
const pose = (f, x, Y, z, a = 0) => {
  const c = Math.cos(a),
    s = Math.sin(a);
  return (role, ps, n) =>
    f(
      role,
      ps.map(([u, y, v]) => [x + c * u - s * v, Y + y, z + s * u + c * v]),
      [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
    );
};
function roof(f, x, z, width, depth, low, high, detail, angle = 0) {
  const at = pose(f, x, 0, z, angle),
    levels =
      detail === 0
        ? [
            [low, width + 1.2, depth + 1.2],
            [high, width - depth * 0.7, 0.15],
          ]
        : [
            [low, width + 1.5, depth + 1.5],
            [low + 0.55, width + 1, depth * 0.88],
            [high - 0.6, width - depth * 0.4, depth * 0.25],
            [high, width - depth * 0.7, 0.15],
          ],
    rings = levels.map(([y, w, d]) =>
      [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2],
      ].map(([u, v]) => [u, y + (detail >= 1 && y === low ? 0.24 : 0), v]),
    );
  for (let k = 0; k < rings.length - 1; k++)
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4,
        a = rings[k][i],
        b = rings[k][j];
      at('tile', [a, b, rings[k + 1][j], rings[k + 1][i]], [b[2] - a[2], 1, a[0] - b[0]]);
    }
  at('tile', rings[0], [0, -1, 0]);
  at('tile', rings.at(-1), [0, 1, 0]);
  if (detail >= 1) {
    box(at, 'tile', 0, high, 0, width - depth * 0.65, 0.15, 0.3);
    if (detail >= 2)
      for (const side of [-1, 1])
        loft(
          at,
          'tile',
          (side * (width - depth * 0.65)) / 2,
          0,
          [
            [high, 0.34],
            [high + 0.22, 0.24],
            [high + 0.42, 0.1],
          ],
          true,
        );
  }
}
function gateway(f, x, z, Y, angle, detail, width = 3.2) {
  const at = pose(f, x, Y, z, angle),
    span = width / 2 + 0.26;
  for (const side of [-1, 1]) {
    box(at, 'stone', side * span, -0.6, 0, 0.5, 5, 0.55);
    if (detail === 1) box(at, 'stone', side * span, 4.4, 0, 0.42, 0.65, 0.42);
    else if (detail >= 2) {
      box(at, 'stone', side * span, -0.15, 0, 0.85, 0.4, 0.9);
      loft(
        at,
        'stone',
        side * span,
        0,
        [
          [4.4, 0.5],
          [4.65, 0.55],
          [4.95, 0.35],
          [5.12, 0.1],
        ],
        true,
      );
    }
    if (detail >= 2) {
      box(at, 'stone', side * span, 3.7, 0, 0.75, 0.16, 0.7);
      loft(
        at,
        'stone',
        side * (span + 0.55),
        0,
        [
          [3.7, 0.18],
          [3.95, 0.65],
          [4.25, 0.35],
        ],
        true,
      );
    }
  }
  box(at, 'stone', 0, 3.45, 0, width + 0.55, 0.36, 0.55);
  if (detail >= 1) box(at, 'stone', 0, 4.08, 0, width + 0.7, 0.3, 0.58);
  if (detail >= 2) {
    for (const side of [-1, 1])
      box(at, 'wood', side * (width / 2 - 0.09), 0, -0.22, 0.13, 3.4, 0.17);
  }
}
function vessel(f, x, z, Y, round, detail) {
  const at = pose(f, x, Y, z);
  box(at, 'stone', 0, -0.12, 0, round ? 2 : 2.8, 0.4, round ? 2 : 2.3);
  if (!round) {
    for (const u of [-0.8, 0.8])
      for (const v of [-0.55, 0.55]) box(at, 'bronze', u, 0.28, v, 0.19, 0.8, 0.19);
    box(at, 'bronze', 0, 0.85, 0, 2.3, 1.2, 1.65);
    box(at, 'bronze', 0, 2.05, 0, 2.5, 0.16, 1.85);
    if (detail >= 2) for (const x of [-1, 1]) box(at, 'bronze', x, 2.2, 0, 0.16, 0.45, 0.85);
    return;
  }
  for (const a of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3])
    box(at, 'bronze', Math.cos(a) * 0.55, 0.28, Math.sin(a) * 0.55, 0.18, 0.75, 0.18);
  loft(
    at,
    'bronze',
    0,
    0,
    [
      [0.9, 1.25],
      [1.3, 1.85],
      [1.65, 1.95],
      [1.85, 1.7],
      [2.1, 1.2],
      [2.5, 0.15],
    ],
    true,
  );
  if (detail >= 2)
    for (const side of [-1, 1]) {
      box(at, 'bronze', side * 0.95, 1.5, 0, 0.15, 0.75, 0.25);
      box(at, 'bronze', side * 0.8, 2.1, 0, 0.4, 0.15, 0.25);
    }
}
function hall(f, r, detail) {
  const p = r.hall,
    at = pose(f, p.center[0], p.floorY, p.center[1], Math.PI / 2),
    w = p.width,
    d = p.depth,
    door = 3.4;
  for (const side of [-1, 1]) box(at, 'red', side * (w / 2 - 0.25), 0.4, 0, 0.5, 4.1, d);
  const oct = (x, radius) =>
      Array.from({ length: 8 }, (_, k) => [
        x + radius * Math.cos((k * Math.PI) / 4),
        3.98 + radius * Math.sin((k * Math.PI) / 4),
      ]),
    front = [
      [-w / 2, 0.4],
      [-door / 2, 0.4],
      [-door / 2, 3.65],
      [door / 2, 3.65],
      [door / 2, 0.4],
      [w / 2, 0.4],
      [w / 2, 4.5],
      [-w / 2, 4.5],
    ];
  prism(
    (role, ps, n) =>
      at(
        role,
        ps.map(([u, v, y]) => [u, y, d / 2 - 0.5 + v]),
        [n[0], n[2], n[1]],
      ),
    'red',
    { outline: front, holes: detail >= 1 ? [-5.4, -1.8, 1.8, 5.4].map((x) => oct(x, 0.28)) : [] },
    0,
    0.5,
  );
  box(at, 'red', 0, 0.4, -d / 2 + 0.25, w, 4.1, 0.5);
  box(at, 'stone', 0, -0.6, 0, w + 1.1, 1, d + 1.1);
  if (detail >= 1) {
    box(at, 'paint', 0, 4.25, d / 2 + 0.04, w, 0.35, 0.22);
    for (const x of [-10, -6, -2, 2, 6, 10]) box(at, 'wood', x, 0.4, d / 2 + 0.12, 0.24, 3.9, 0.26);
    for (const x of [-8, -4, 4, 8]) {
      box(at, 'wood', x, 0.9, d / 2 + 0.03, 2.8, 2.1, 0.08);
      if (detail >= 2)
        for (let k = 0; k < 5; k++)
          box(at, 'paint', x - 1 + k * 0.5, 1.05, d / 2 + 0.12, 0.06, 1.75, 0.07);
    }
    for (const x of [-5.4, -1.8, 1.8, 5.4]) {
      const shape = oct(x, 0.34);
      prism(
        (role, ps, n) =>
          at(
            role,
            ps.map(([u, v, y]) => [u, y, d / 2 + 0.045 + v]),
            [n[0], n[2], n[1]],
          ),
        'stone',
        { outline: shape, holes: [oct(x, 0.28)] },
        0,
        0.06,
      );
    }
    for (let i = 0; i < 3; i++)
      box(at, 'stone', 0, -0.15 - i * 0.18, d / 2 + 0.65 + i * 0.55, 4.2, 0.55 - i * 0.15, 0.6);
  }
  box(at, 'paint', 0, 4.48, 0, w, 0.6, d);
  roof(at, 0, 0, w, d, 4.5, 7.6, detail);
}
export function buildEarthTempleCeremony(face, detail, r, sampleTerrain) {
  const a = r.architecturalAngleRadians,
    c = Math.cos(a),
    s = Math.sin(a),
    grade = (u, v) => sampleTerrain(c * u - s * v, s * u + c * v),
    f = (role, ps, n) => {
      if (detail === 0 && n[1] < -0.5) return;
      face(
        role,
        ps.map(([u, y, v]) => [c * u - s * v, y, s * u + c * v]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      );
    };
  const ground = (role, ps, n) =>
    f(
      role,
      ps.map(([u, y, v]) => [u, grade(u, v) + y, v]),
      n,
    );
  for (const e of r.enclosures) {
    const H = e.half,
      w = 3.6,
      gates = [-7, 0, 7];
    for (const [k, angle] of [0, Math.PI / 2, Math.PI, -Math.PI / 2].entries()) {
      const offsets = k === 1 ? gates : [0],
        cuts = [-H, ...offsets.flatMap((v) => [v - w / 2, v + w / 2]), H];
      for (let i = 0; i < cuts.length; i += 2) {
        const lo = cuts[i],
          hi = cuts[i + 1],
          at = pose(ground, 0, 0, 0, angle);
        box(at, 'red', (lo + hi) / 2, -0.35, H, hi - lo, e.height + 0.35, 0.8);
        roof(at, (lo + hi) / 2, H, Math.max(0.2, hi - lo - 1.2), 0.2, e.height, e.height + 0.32, 0);
      }
      if (detail > 0 || k === 1)
        for (const off of detail === 0 ? [0] : offsets) {
          const u = Math.cos(angle) * off - Math.sin(angle) * H,
            v = Math.sin(angle) * off + Math.cos(angle) * H;
          gateway(f, u, v, grade(u, v) + 0.08, angle, detail);
        }
    }
  }
  const altar = r.altar,
    Y = altar.floorY;
  let top = Y;
  for (const [i, t] of altar.tiers.entries()) {
    const lo = top;
    top += t.height;
    prism(
      (role, ps, n) =>
        f(
          role,
          ps.map(([u, y, v]) => [u, i === 0 && y === lo ? grade(u, v) - 0.65 : y, v]),
          n,
        ),
      'brick',
      rect(0, 0, t.width, t.width),
      lo,
      top,
    );
    box(f, 'stone', 0, top - 0.18, 0, t.width + 0.16, 0.2, t.width + 0.16);
    if (detail >= 1)
      for (const u of [-1, 1])
        for (const v of [-1, 1])
          box(
            f,
            'stone',
            u * (t.width / 2 - 0.15),
            lo,
            v * (t.width / 2 - 0.15),
            0.34,
            t.height,
            0.34,
          );
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const at = pose(f, 0, 0, 0, angle),
        outer = t.width / 2 + t.stairRun,
        inner = t.width / 2 - 0.08,
        endGrade = i === 0 ? grade(-Math.sin(angle) * outer, Math.cos(angle) * outer) + 0.06 : lo,
        steps = [2, 6, 10, 12][detail];
      for (let k = 0; k < steps; k++) {
        const v = inner + ((k + 0.5) * t.stairRun) / steps,
          h = top - ((top - endGrade) * k) / steps;
        box(
          at,
          'stone',
          0,
          i === 0 ? grade(-Math.sin(angle) * v, Math.cos(angle) * v) - 0.55 : lo - 0.1,
          v,
          t.stairWidth,
          h - (i === 0 ? grade(-Math.sin(angle) * v, Math.cos(angle) * v) - 0.55 : lo - 0.1),
          t.stairRun / steps + 0.025,
        );
      }
      if (detail >= 1)
        for (const side of [-1, 1])
          prism(
            (role, ps, n) =>
              at(
                role,
                ps.map(([u, y, v]) => [
                  u,
                  y === 0
                    ? i === 0
                      ? Math.min(lo - 0.5, endGrade - 0.65)
                      : lo - 0.5
                    : top - ((v - inner) / t.stairRun) * (top - endGrade) + 0.15,
                  v,
                ]),
                n,
              ),
            'stone',
            rect(side * (t.stairWidth / 2 + 0.18), (inner + outer) / 2, 0.36, t.stairRun),
            0,
            1,
          );
    }
  }
  if (detail >= 1) {
    vessel(f, -3, 0, top + 0.03, false, detail);
    vessel(f, 7, 6, top + 0.03, true, detail);
    vessel(f, -7, -6, top + 0.03, true, detail);
  }
  for (const b of r.controls) {
    const ps = b.localPolygons;
    const floor =
      b.id === 35184749931995
        ? r.hall.floorY
        : Math.max(...ps.flatMap((p) => p.outline.map(([u, v]) => grade(u, v)))) + 0.4;
    for (const p of ps)
      prism(
        (role, points, n) =>
          f(
            role,
            points.map(([u, y, v]) => [u, y === 0 ? grade(u, v) - 0.65 : floor + y, v]),
            n,
          ),
        'stone',
        p,
        0,
        0.4,
      );
    if (b.id !== 35184749931995)
      for (const p of ps)
        prism(
          (role, points, n) =>
            f(
              role,
              points.map(([u, y, v]) => [u, floor + y, v]),
              n,
            ),
          'red',
          p,
          0.4,
          3.2,
        );
  }
  hall(f, r, detail);
  for (const w of r.wings) {
    const floor = grade(...w.center) + 0.55,
      along = w.length > 20;
    roof(
      f,
      w.center[0],
      w.center[1],
      w.length,
      w.width,
      floor + 3.1,
      floor + 5.7,
      detail,
      along ? 0 : Math.PI / 2,
    );
  }
  const gateY = grade(76.5, 0.8) + 0.1;
  if (detail >= 1) gateway(f, 76.5, 0.8, gateY, Math.PI / 2, detail, 5);
  if (detail >= 2)
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const at = pose(ground, 0, 0, 0, angle);
      for (let v = 23; v < 66; v += 6) box(at, 'paving', 0, -0.2, v, 3.4, 0.3, Math.min(6, 66 - v));
    }
}
