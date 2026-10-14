/** Oriental Pearl budgeted exterior, with picture-led buttress joint spheres. */
import './install-deterministic-math.mjs';
import {
  beam,
  cross,
  radialRing as fullRing,
  torus as fullTorus,
  loft,
  normalFor,
} from './authored-structure-mesh.mjs';
import { tube as fullTube, quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  aluminum = [0.69, 0.73, 0.75],
  concrete = [0.76, 0.75, 0.71],
  mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  MEANS = {
    stone: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
    concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    pink: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    glass: [1, 1, 1],
  };
function writer(out, far) {
  const tri = (s, p, c) => {
    p = p.map((v) => v.map(Math.fround));
    const a = p[1].map((v, i) => v - p[0][i]),
      b = p[2].map((v, i) => v - p[0][i]);
    if (Math.hypot(...cross(a, b)) < 1e-10) return;
    out.addTriangle(
      s,
      'palette:#ffffff',
      p,
      normalFor(...p),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      far ? c.map((v, i) => v * (MEANS[s]?.[i] ?? 1)) : c,
    );
  };
  return {
    addTriangle(s, r, p, n, u, c) {
      tri(s, p, c);
    },
    addQuad(s, r, p, n, u, c) {
      tri(s, p.slice(0, 3), c);
      tri(s, [p[0], p[2], p[3]], c);
    },
    addConvexPolygon(s, r, p, n, u, c) {
      for (let i = 1; i < p.length - 1; i++) tri(s, [p[0], p[i], p[i + 1]], c);
    },
  };
}

function build(target, tier) {
  const out = writer(target, tier === 0),
    segments = [4, 8, 16, 32][tier],
    radialRing = (y, rx, rz, n, center) => fullRing(y, rx, rz, segments, center),
    tube = (o, s, a, b, r, c, n) => fullTube(o, s, a, b, r, c, segments),
    torus = (o, s, p, r, t, c, n, m) => {
      if (tier > 1 && (tier === 3 || r > 6)) fullTorus(o, s, p, r, t, c, segments, 3);
    };
  function spherePanel(out, p, color, slot) {
    const normal = normalFor(p[0], p[1], p[2]);
    out.addTriangle(
      slot,
      ref,
      p,
      normal,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
  }

  /** Individual triangular shell plates with real gaps and inserted observation glazing belts. */
  function pearl(
    out,
    center,
    radius,
    bands,
    { segments = 72, latitudes = 36, tint = [0.47, 0.225, 0.32] } = {},
  ) {
    segments = radius < 10 ? [6, 8, 8, 16][tier] : [6, 12, 20, 32][tier];
    latitudes = radius < 10 ? [4, 4, 4, 8][tier] : [4, 6, 10, 16][tier];
    const point = (j, i, r = radius) => {
      const t = -Math.PI / 2 + (Math.PI * j) / latitudes;
      const a = (-2 * Math.PI * (i + (j % 2) * 0.5)) / segments;
      return [
        center[0] + Math.cos(t) * Math.cos(a) * r,
        center[1] + Math.sin(t) * r,
        center[2] + Math.cos(t) * Math.sin(a) * r,
      ];
    };
    const triangle = (p, row, column) => {
      const y = p.reduce((s, p) => s + p[1], 0) / 3;
      const glazing = bands.some(([a, b]) => y >= a && y <= b);
      const n = normalFor(p[0], p[1], p[2]);
      const color = glazing
        ? [0.17, 0.23, 0.29]
        : tint.map((v) => v * (0.91 + ((row * 3 + column * 5) % 9) / 90));
      // Large pearls have pale metal polar caps surrounding their ruby faceted belts.
      if (radius >= 20) {
        const ruby = radius === 25 ? y >= 82.5 && y <= 103.5 : y >= 264 && y <= 287;
        if (!ruby && !glazing) color.splice(0, 3, 0.65, 0.66, 0.63);
      }
      const centroid = p[0].map((_, i) => p.reduce((s, p) => s + p[i], 0) / 3);
      const inset = tier > 1 ? p.map((p) => mix(p, centroid, 0.035)) : p;
      // Build joints around the plate instead of drawing a full metal triangle behind
      // a near-coplanar colored overlay. This remains stable at geographic far planes.
      for (let edge = 0; tier > 1 && edge < 3; edge++) {
        const next = (edge + 1) % 3;
        quad(out, 'metal', [p[edge], p[next], inset[next], inset[edge]], n, [0.52, 0.56, 0.58]);
      }
      spherePanel(out, inset, color, glazing ? 'glass' : 'pink');
    };
    for (let j = 0; j < latitudes; j++) {
      for (let i = 0; i < segments; i++) {
        if (j === 0) triangle([point(0, 0), point(1, i + 1), point(1, i)], j, i);
        else if (j === latitudes - 1)
          triangle([point(j, i), point(j, i + 1), point(latitudes, 0)], j, i);
        else {
          const p = [point(j, i), point(j, i + 1), point(j + 1, i + 1), point(j + 1, i)];
          triangle([p[0], p[1], p[2]], j, i);
          triangle([p[0], p[2], p[3]], j, i);
        }
      }
    }
    for (const [a, b] of bands) {
      for (const y of [a, b]) {
        const d = y - center[1];
        if (Math.abs(d) < radius - 0.1)
          torus(
            out,
            'metal',
            [center[0], y, center[2]],
            Math.sqrt(radius * radius - d * d) + 0.035,
            0.075,
            aluminum,
            96,
            6,
          );
      }
    }
  }

  const angles = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
  // Three stepped entry disks and inclined buttresses, aligned with the three mapped radial arms.
  for (const a of angles) {
    const foot = [57 * Math.cos(a), 0, 57 * Math.sin(a)];
    const shaft = [9.25 * Math.cos(a), 0, 9.25 * Math.sin(a)];
    loft(
      out,
      'stone',
      [
        radialRing(0, 9.4, 9.4, 48, [foot[0], foot[2]]),
        radialRing(0.45, 9.4, 9.4, 48, [foot[0], foot[2]]),
      ],
      [0.56, 0.57, 0.55],
    );
    tube(out, 'concrete', [foot[0], 3, foot[2]], [shaft[0], 86, shaft[2]], 3.5, concrete, 40);
    tube(out, 'concrete', [foot[0], 0.45, foot[2]], [foot[0], 4.2, foot[2]], 4.2, concrete, 40);
    const vertical = [-shaft[0], 0, -shaft[2]];
    tube(out, 'concrete', vertical, [vertical[0], 287, vertical[2]], 4.5, concrete, 48);
    for (let y = 16; tier > 1 && y < 250; y += tier === 3 ? 9 : 18)
      torus(
        out,
        'concrete',
        [vertical[0], y, vertical[2]],
        4.507,
        0.025,
        [0.67, 0.68, 0.64],
        48,
        5,
      );
    pearl(
      out,
      [foot[0] + (shaft[0] - foot[0]) * 0.47, 42, foot[2] + (shaft[2] - foot[2]) * 0.47],
      4.4,
      [],
      {
        segments: 36,
        latitudes: 18,
        tint: [0.65, 0.66, 0.63],
      },
    );
  }
  loft(
    out,
    'stone',
    [radialRing(0, 24.6, 24.6, 72), radialRing(1.2, 24.6, 24.6, 72), radialRing(1.8, 23, 23, 72)],
    [0.55, 0.56, 0.54],
  );
  // Circular glazed lift in the space between the columns, with its segmented steel enclosure.
  tube(out, 'glass', [0, 2, 0], [0, 90, 0], 2.45, [0.23, 0.34, 0.39], 48);
  for (let y = 3; tier > 1 && y < 89; y += tier === 3 ? 8 : 24)
    torus(out, 'metal', [0, y, 0], 2.47, 0.055, aluminum, 48, 6);
  pearl(out, [0, 93, 0], 25, [[88.5, 98.5]]);
  pearl(out, [0, 272.5, 0], 22.5, [[258.5, 268.2]], { tint: [0.49, 0.22, 0.31] });
  // Seven groups of deep concrete cross-beams visibly join the three independent columns.
  const columns = angles.map((a) => [-9.25 * Math.cos(a), -9.25 * Math.sin(a)]);
  for (const y of tier === 0 ? [122.5, 190, 257.5] : [122.5, 145, 167.5, 190, 212.5, 235, 257.5]) {
    for (let i = 0; i < 3; i++) {
      const a = columns[i],
        b = columns[(i + 1) % 3];
      beam(out, 'concrete', [a[0], y, a[1]], [b[0], y, b[1]], 2.9, 6, concrete);
    }
  }
  // Five hotel pearls use the central shaft and leave the three concrete columns legible.
  for (const y of [128, 150, 172, 194, 216])
    pearl(out, [0, y, 0], 6.5, [[y - 1.2, y + 1.4]], {
      segments: 36,
      latitudes: 18,
      tint: [0.43, 0.235, 0.3],
    });
  tube(out, 'concrete', [0, 286, 0], [0, 350, 0], 3.0, concrete, 48);
  pearl(out, [0, 342, 0], 7, [[340.3, 344.5]], {
    segments: 48,
    latitudes: 24,
    tint: [0.44, 0.22, 0.3],
  });
  for (const [y0, y1, r0, r1] of [
    [350, 376, 2.8, 2.0],
    [376, 402, 2.0, 1.25],
    [402, 430, 1.25, 0.75],
    [430, 454, 0.75, 0.42],
    [454, 468, 0.42, 0.18],
  ]) {
    loft(out, 'metal', [radialRing(y0, r0, r0, 24), radialRing(y1, r1, r1, 24)], aluminum);
    for (let y = y0 + 2; tier > 1 && y < y1; y += tier === 3 ? 8 : 16) {
      const r = r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
      torus(out, 'metal', [0, y, 0], r + 0.04, 0.045, [0.51, 0.54, 0.55], 32, 6);
    }
  }
  for (const y of tier > 1 ? [350, 376, 402, 430] : []) {
    const radius = y === 350 ? 3.7 : y === 376 ? 2.7 : y === 402 ? 1.8 : 1.2;
    torus(out, 'metal', [0, y, 0], radius, 0.14, aluminum, 48, 8);
    torus(out, 'metal', [0, y + 1.1, 0], radius, 0.035, aluminum, 48, 6);
    for (let i = 0; i < (tier === 3 ? 12 : 4); i++) {
      const a = (i * Math.PI) / (tier === 3 ? 6 : 2);
      tube(
        out,
        'metal',
        [radius * Math.cos(a), y, radius * Math.sin(a)],
        [radius * Math.cos(a), y + 1.1, radius * Math.sin(a)],
        0.032,
        aluminum,
        6,
      );
    }
  }
}
export const buildPearlSkyline = (o) => build(o, 0),
  buildPearlDistrict = (o) => build(o, 1),
  buildPearlStreet = (o) => build(o, 2),
  buildPearlCloseup = (o) => build(o, 3);
