/** N0508: surviving ancillary monuments and the eroded precinct, in the mapped frame. */
import { denderaBox as box, denderaCavetto as cavetto } from './dendera-temple-model.mjs';
export const denderaComplexCandidateId = 'N0508';

function placed(face, part) {
  const co = Math.cos(part.rotation ?? 0),
    si = Math.sin(part.rotation ?? 0);
  return (role, ps, n) =>
    face(
      role,
      ps.map(([x, y, z]) => [
        part.center[0] + x * co - z * si,
        part.baseY + y,
        part.center[1] + x * si + z * co,
      ]),
      [n[0] * co - n[2] * si, n[1], n[0] * si + n[2] * co],
    );
}

function shaft(face, x, z, height, radius, detail, floral = false) {
  if (detail === 0) {
    box(face, 'stone', x, 0, z, radius * 2, height, radius * 2);
    return;
  }
  const n = detail === 1 ? 4 : detail === 2 ? 8 : 12;
  const levels = floral
    ? detail === 1
      ? [
          [0, radius],
          [height - 0.75, radius * 0.87],
          [height, radius * 1.6],
        ]
      : [
          [0, radius * 1.22],
          [0.25, radius],
          [height - 1.2, radius * 0.87],
          [height - 0.35, radius * 1.6],
          [height, radius * 1.6],
        ]
    : [
        [0, radius * 1.14],
        [height, radius * 0.9],
      ];
  const rings = levels.map(([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n;
      return [x + r * Math.cos(a), y, z + r * Math.sin(a)];
    }),
  );
  for (let k = 1; k < rings.length; k++)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n,
        a = ((i + 0.5) * Math.PI * 2) / n;
      face(
        'stone',
        [rings[k - 1][i], rings[k - 1][j], rings[k][j], rings[k][i]],
        [Math.cos(a), 0, Math.sin(a)],
      );
    }
  face('stone', rings[0], [0, -1, 0]);
  face('stone', rings.at(-1), [0, 1, 0]);
  if (floral) {
    // Broad, damaged abacus blocks; individual Bes portraits are not reconstructed.
    box(face, 'stone', x, height, z, radius * 3.4, 0.75, radius * 3.4);
    if (detail >= 2)
      for (const side of [-1, 1])
        box(face, 'carved', x + side * radius * 1.7, height + 0.1, z, 0.06, 0.5, radius * 1.6);
  }
}

function doorway(face, x, z, w, h, width, height, thickness, detail) {
  for (const side of [-1, 1])
    box(face, 'stone', x + side * (w / 4 + width / 4), 0, z, (w - width) / 2, h, thickness);
  box(face, 'stone', x, height, z, width, h - height, thickness);
  if (detail >= 2) {
    box(face, 'stone', x - width / 2 - 0.18, 0, z + thickness / 2, 0.36, height, 0.3);
    box(face, 'stone', x + width / 2 + 0.18, 0, z + thickness / 2, 0.36, height, 0.3);
  }
}

function roman(face, detail, p) {
  const f = placed(face, p),
    w = p.width,
    d = p.depth;
  box(f, 'stone', 0, -p.foundationDepth, 0, w, p.foundationDepth + 0.45, d);
  // The east-facing cella remains roofed; the front has broken screen walls.
  box(f, 'stone', 0, 0.45, -d * 0.18, w - 4.2, 8.5, d * 0.6);
  box(f, 'stone', 0, 8.95, -d * 0.08, w + 0.45, 0.8, d * 0.87);
  if (detail === 0) {
    for (const side of [-1, 1]) box(f, 'stone', side * (w / 2 - 1), 0.45, 0, 1.2, 8.5, d * 0.8);
    doorway(f, 0, d / 2 - 1, w - 3, 7.6, 2.8, 5.8, 1.5, detail);
    return;
  }
  for (const side of [-1, 1])
    for (let i = 0; i < (detail === 1 ? 4 : 7); i++) {
      const z = -d * 0.37 + (i * d * 0.72) / ((detail === 1 ? 4 : 7) - 1);
      shaft(
        (role, ps, n) =>
          f(
            role,
            ps.map(([x, y, z]) => [x, y + 0.45, z]),
            n,
          ),
        side * (w / 2 - 1),
        z,
        7.7,
        0.62,
        detail,
        true,
      );
    }
  doorway(f, 0, d / 2 - 1.5, w - 5.2, 7.9, 2.6, 5.7, 1.5, detail);
  for (const side of [-1, 1]) {
    box(f, 'stone', side * (w / 4 + 0.6), 0.45, d / 2 - 0.6, w / 2 - 1.5, 2.1, 1.2);
    box(f, 'stone', side * (w / 2 - 1), 0.45, d * 0.34, 1.2, 3.2, 4.2);
  }
  cavetto(f, 0, 9.75, -d * 0.08, w + 0.45, d * 0.87, detail === 1 ? 0 : 1);
  if (detail >= 2)
    for (const side of [-1, 1]) {
      box(f, 'carved', side * (w / 2 - 2.08), 2.5, -d * 0.2, 0.06, 0.2, d * 0.55);
      box(f, 'carved', side * (w / 2 - 2.08), 5.4, -d * 0.2, 0.06, 0.2, d * 0.55);
    }
}

function olderMammisi(face, detail, p) {
  const f = placed(face, p),
    w = p.width,
    d = p.depth;
  box(f, 'stone', 0, -p.foundationDepth, 0, w, p.foundationDepth + 0.2, d);
  box(f, 'stone', 0, 0.2, -d / 2 + 0.6, w, 4.2, 1.2);
  for (const side of [-1, 1]) {
    box(f, 'stone', side * (w / 2 - 0.6), 0.2, -d * 0.15, 1.2, 1.7, d * 0.65);
    if (detail) box(f, 'stone', side * (w / 2 - 0.6), 0.2, d * 0.35, 1.2, 0.9, d * 0.3);
  }
  if (!detail) return;
  doorway(f, 0, -d * 0.16, w - 2.4, 3.5, 2.4, 2.5, 0.9, detail);
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++)
      shaft(f, side * (w / 2 - 2.5), 1.0 + i * 3.4, [2.5, 1.15, 0.55][i], 0.65, detail);
  box(f, 'stone', -w / 2 + 3.2, 0.2, -d * 0.2, 1.1, 4.0, 1.1);
}

function basilica(face, detail, p) {
  const f = placed(face, p),
    w = p.width,
    d = p.depth;
  box(f, 'stone', 0, -p.foundationDepth, 0, w, p.foundationDepth + 0.15, d);
  for (const side of [-1, 1]) {
    box(f, 'stone', side * (w / 2 - 0.55), 0.15, -d * 0.15, 1.1, side === 1 ? 2.6 : 1.4, d * 0.7);
    if (detail) box(f, 'stone', side * (w / 2 - 0.55), 0.15, d * 0.35, 1.1, 0.8, d * 0.3);
  }
  // Polygonal open apse, rather than a restored church roof.
  const n = detail ? 6 : 3,
    radius = w * 0.26;
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * i) / n,
      b = (Math.PI * (i + 1)) / n;
    const aa = [radius * Math.cos(a), 0.15, -d / 2 + radius * Math.sin(a)],
      bb = [radius * Math.cos(b), 0.15, -d / 2 + radius * Math.sin(b)];
    const mid = [(aa[0] + bb[0]) / 2, (aa[2] + bb[2]) / 2];
    const seg = placed(f, {
      center: mid,
      baseY: 0,
      rotation: Math.atan2(bb[2] - aa[2], bb[0] - aa[0]),
    });
    box(seg, 'stone', 0, 0.15, 0, Math.hypot(bb[0] - aa[0], bb[2] - aa[2]) + 0.3, 2.7, 1.0);
  }
  if (!detail) return;
  for (const side of [-1, 1])
    for (let i = 0; i < 6; i++)
      shaft(f, side * w * 0.22, -d * 0.27 + i * d * 0.12, 0.7 + (i % 3) * 0.55, 0.48, detail);
  for (const side of [-1, 1])
    box(f, 'stone', side * (w / 4 + 0.6), 0.15, d / 2 - 0.5, w / 2 - 1.3, 1.1, 1);
}

function sanatorium(face, detail, p) {
  const f = placed(face, p),
    w = p.width,
    d = p.depth;
  box(f, 'stone', 0, -p.foundationDepth, 0, w, p.foundationDepth + 0.18, d);
  for (const side of [-1, 1]) {
    box(f, 'stone', side * (w / 2 - 0.5), 0.18, 0, 1, 1.6, d);
    box(f, 'stone', 0, 0.18, side * (d / 2 - 0.5), w, 1.3, 1);
  }
  if (!detail) return;
  for (const x of [-w / 6, w / 6]) box(f, 'stone', x, 0.18, 0, 0.8, 1.2, d);
  for (const z of [-d / 6, d / 6]) box(f, 'stone', 0, 0.18, z, w, 0.9, 0.8);
  if (detail >= 2)
    for (const x of [-w / 3, 0, w / 3]) {
      for (const side of [-1, 1]) box(f, 'stone', x + side * 1.2, 0.2, 0, 0.35, 0.45, 3);
      for (const side of [-1, 1]) box(f, 'stone', x, 0.2, side * 1.5, 2.75, 0.45, 0.35);
    }
}

function isis(face, detail, p) {
  const f = placed(face, p),
    w = p.width,
    d = p.depth;
  box(f, 'stone', 0, -p.foundationDepth, 0, w, p.foundationDepth + 0.35, d);
  // Standing western chamber and partial roof; the east forecourt stays open.
  box(f, 'stone', 0, 0.35, -d * 0.32, w, 5.4, d * 0.32);
  for (const side of [-1, 1])
    box(f, 'stone', side * (w / 2 - 0.6), 0.35, -d * 0.13, 1.2, 5.4, d * 0.4);
  box(f, 'stone', 0, 5.75, -d * 0.23, w + 0.4, 0.75, d * 0.53);
  if (!detail) return;
  doorway(f, 0, d * 0.05, w, 5.4, 2.5, 4.3, 1.1, detail);
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++)
      shaft(f, side * (w / 2 - 2), d * 0.15 + i * d * 0.12, 0.8 + (i % 2) * 0.8, 0.6, detail);
  cavetto(f, 0, 6.5, -d * 0.23, w + 0.4, d * 0.53, detail === 1 ? 0 : 1);
  if (detail >= 2)
    for (const y of [1.5, 3.8]) box(f, 'carved', w / 2 + 0.025, y, -d * 0.28, 0.05, 0.18, d * 0.4);
}

function lake(face, detail, p) {
  const f = placed(face, p),
    w = p.width,
    d = p.depth,
    h = p.rimY - p.baseY;
  box(f, 'stone', 0, -0.4, 0, w, 0.4, d);
  for (const side of [-1, 1]) {
    box(f, 'stone', side * (w / 2 - 0.55), 0, 0, 1.1, h, d);
    box(f, 'stone', 0, 0, side * (d / 2 - 0.55), w, h, 1.1);
  }
  if (!detail) return;
  const count = detail === 1 ? 4 : 9;
  for (let i = 0; i < count; i++)
    box(
      f,
      'stone',
      -w / 2 + 2.7,
      0,
      -d / 2 + 2 + ((i + 0.5) * 7) / count,
      3,
      (h * (count - i)) / count,
      7 / count,
    );
  if (detail >= 2)
    for (const side of [-1, 1])
      for (let i = 0; i < 6; i++)
        box(f, 'stone', side * (w / 2 - 0.5), h, -d * 0.4 + i * d * 0.16, 0.55, 0.9, 0.55);
}

function gate(face, detail, p) {
  const f = placed(face, p);
  doorway(f, 0, 0, p.width, 8.8, 4.6, 7.1, 2.2, detail);
  if (detail) cavetto(f, 0, 8.8, 0, p.width, 2.2, detail === 1 ? 0 : 1);
}

function enclosure(face, detail, r) {
  for (const wall of r.precinctWalls ?? []) {
    const f = placed(face, wall),
      length = wall.length,
      n = detail === 0 ? 1 : detail === 1 ? 3 : detail === 2 ? 7 : 12;
    const levels = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n,
        a = -length / 2 + length * t;
      const y =
        wall.crestY +
        (detail
          ? Math.sin(t * Math.PI * 3 + wall.phase) * 2.2 + Math.sin(t * Math.PI * 7) * 0.8
          : 0);
      return { x: a, y, thickness: wall.thickness * (0.48 + 0.08 * Math.sin(t * Math.PI * 4)) };
    });
    for (let i = 0; i < n; i++) {
      const a = levels[i],
        b = levels[i + 1],
        bottom = wall.bottomY;
      for (const side of [-1, 1])
        face(
          'adobe',
          [
            [a.x, bottom, (side * wall.thickness) / 2],
            [b.x, bottom, (side * wall.thickness) / 2],
            [b.x, b.y, (side * b.thickness) / 2],
            [a.x, a.y, (side * a.thickness) / 2],
          ].map(([x, y, z]) => [
            wall.center[0] + x * Math.cos(wall.rotation) - z * Math.sin(wall.rotation),
            wall.baseY + y,
            wall.center[1] + x * Math.sin(wall.rotation) + z * Math.cos(wall.rotation),
          ]),
          [side * -Math.sin(wall.rotation), 0, side * Math.cos(wall.rotation)],
        );
      f(
        'adobe',
        [
          [a.x, a.y, -a.thickness / 2],
          [b.x, b.y, -b.thickness / 2],
          [b.x, b.y, b.thickness / 2],
          [a.x, a.y, a.thickness / 2],
        ],
        [0, 1, 0],
      );
    }
    for (const endpoint of [levels[0], levels.at(-1)])
      f(
        'adobe',
        [
          [endpoint.x, wall.bottomY, -wall.thickness / 2],
          [endpoint.x, wall.bottomY, wall.thickness / 2],
          [endpoint.x, endpoint.y, endpoint.thickness / 2],
          [endpoint.x, endpoint.y, -endpoint.thickness / 2],
        ],
        [endpoint.x < 0 ? -1 : 1, 0, 0],
      );
  }
}

export function buildDenderaComplex(face, detail, r) {
  const builders = { roman, olderMammisi, basilica, sanatorium, isis, lake, gate };
  for (const part of r.components ?? []) builders[part.kind](face, detail, part);
  enclosure(face, detail, r);
}
