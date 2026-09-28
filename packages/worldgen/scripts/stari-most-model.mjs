/** Original stone-by-stone exterior reconstruction from the bridge restoration report. */
import { normalFor } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const span = 28.71,
  half = span / 2,
  width = 3.95;
const cream = [0.79, 0.765, 0.685],
  pale = [0.86, 0.84, 0.76];
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// The published profile has separate crown, shoulder and springing curvature centers.
// Blending the documented radii avoids claiming the lost individual survey ordinates.
function arch(x) {
  const a = Math.min(half, Math.abs(x));
  const shoulder = Math.sqrt(Math.max(0, 14.89 ** 2 - a * a)) - 2.98;
  const crown = Math.sqrt(Math.max(0, 12.06 ** 2 - a * a));
  const end = Math.sqrt(Math.max(0, 5.956 ** 2 - (a - (half - 5.956)) ** 2));
  const profile = mix(mix(crown, shoulder, smooth(2.1, 4.2, a)), end, smooth(12.3, 13.5, a));
  return 6.72 + profile + 0.065 * (-x / half);
}
const archPoint = (t) => {
  const x = -half * Math.cos(Math.PI * t);
  return [x, arch(x)];
};
function archNormal(t) {
  const a = archPoint(Math.max(0, t - 1e-5)),
    b = archPoint(Math.min(1, t + 1e-5));
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    d = Math.hypot(dx, dy);
  return [-dy / d, dx / d];
}
const outer = Array.from({ length: 1001 }, (_, i) => {
  const t = i / 1000,
    p = archPoint(t),
    n = archNormal(t);
  return [p[0] + n[0] * 0.77, p[1] + n[1] * 0.77];
});
function extrados(x) {
  for (let i = 1; i < outer.length; i++)
    if (outer[i][0] >= x) {
      const a = outer[i - 1],
        b = outer[i];
      return mix(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
    }
  return outer.at(-1)[1];
}
const deck = (x) => 20.34 - (Math.abs(x) * (x < 0 ? 3.15 : 3.34)) / 16.2;
function solid(out, polygon, z0, z1, color, slot = 'stone') {
  polygon = polygon.filter((p, i) => {
    const previous = polygon[(i + polygon.length - 1) % polygon.length];
    return Math.hypot(p[0] - previous[0], p[1] - previous[1]) > 1e-6;
  });
  polygon = polygon.filter((p, i) => {
    const previous = polygon[(i + polygon.length - 1) % polygon.length];
    const next = polygon[(i + 1) % polygon.length];
    return (
      Math.abs((p[0] - previous[0]) * (next[1] - p[1]) - (p[1] - previous[1]) * (next[0] - p[0])) >
      1e-8
    );
  });
  if (polygon.length < 3) return;
  const area = polygon.reduce((sum, p, i) => {
    const q = polygon[(i + 1) % polygon.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);
  if (Math.abs(area) < 1e-8) return;
  const ring = area > 0 ? polygon : [...polygon].reverse();
  const front = ring.map((p) => [...p, z0]),
    back = ring.map((p) => [...p, z1]);
  out.addConvexPolygon(
    slot,
    'palette:#ffffff',
    [...front].reverse(),
    [0, 0, -1],
    (p) => [p[0], p[1]],
    color,
  );
  out.addConvexPolygon(slot, 'palette:#ffffff', back, [0, 0, 1], (p) => [p[0], p[1]], color);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length,
      ps = [front[i], front[j], back[j], back[i]];
    quad(out, slot, ps, normalFor(...ps), color);
  }
}
function clip(poly, axis, boundary, above) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      ia = above ? a[axis] >= boundary : a[axis] <= boundary,
      ib = above ? b[axis] >= boundary : b[axis] <= boundary;
    if (ia) result.push(a);
    if (ia !== ib) {
      const t = (boundary - a[axis]) / (b[axis] - a[axis]);
      result.push(a.map((v, k) => mix(v, b[k], t)));
    }
  }
  return result;
}
function wedge(out, x0, x1, y0, y1, top0, top1, z0, z1, color, slot = 'stone') {
  solid(
    out,
    [
      [x0, y0],
      [x1, y1],
      [x1, top1],
      [x0, top0],
    ],
    z0,
    z1,
    color,
    slot,
  );
}
export function buildStariMostDetailed(out) {
  // Recessed mortar closes the joints behind the dressed voussoirs. Without this
  // continuous core the hairline stone gaps reveal the sky through the arch.
  for (let i = 0; i < 444; i++) {
    const a = i / 444,
      b = (i + 1) / 444,
      A = archPoint(a),
      B = archPoint(b),
      na = archNormal(a),
      nb = archNormal(b);
    solid(
      out,
      [
        A.map((v, k) => v + na[k] * 0.014),
        B.map((v, k) => v + nb[k] * 0.014),
        B.map((v, k) => v + nb[k] * 0.756),
        A.map((v, k) => v + na[k] * 0.756),
      ],
      -width / 2 + 0.012,
      width / 2 - 0.012,
      [0.63, 0.62, 0.565],
    );
  }
  // 111 radial courses, with 2–5 separately jointed stones across each course.
  for (let row = 0; row < 111; row++) {
    const a = (row + 0.018) / 111,
      b = (row + 0.982) / 111,
      stones = 2 + (row % 4);
    for (let col = 0; col < stones; col++) {
      const z0 = -width / 2 + (width * col) / stones + 0.004,
        z1 = -width / 2 + (width * (col + 1)) / stones - 0.004;
      const color = cream.map((v) => v + (((row * 7 + col * 11) % 13) - 6) * 0.004);
      for (let k = 0; k < 4; k++) {
        const ta = mix(a, b, k / 4),
          tb = mix(a, b, (k + 1) / 4),
          A = archPoint(ta),
          B = archPoint(tb),
          na = archNormal(ta),
          nb = archNormal(tb);
        solid(
          out,
          [
            A,
            B,
            [B[0] + nb[0] * 0.77, B[1] + nb[1] * 0.77],
            [A[0] + na[0] * 0.77, A[1] + na[1] * 0.77],
          ],
          z0,
          z1,
          color,
        );
      }
    }
  }
  // Closed infill above the arch; individual ashlar faces are clipped against the curved ring.
  const extent = 16.2;
  for (let x = -extent; x < extent; x += 0.2) {
    const end = Math.min(extent, x + 0.2),
      lo = (p) => (Math.abs(p) > outer.at(-1)[0] ? 0 : extrados(p));
    wedge(
      out,
      x,
      end,
      lo(x),
      lo(end),
      deck(x) - 0.13,
      deck(end) - 0.13,
      -width / 2 + 0.085,
      width / 2 - 0.085,
      cream,
    );
  }
  for (const side of [-1, 1])
    for (let row = 0; row < 48; row++) {
      const y0 = row * 0.42 + 0.005,
        y1 = y0 + 0.408;
      for (let x = -extent - 0.8 + (row % 2) * 0.36; x < extent; x += 0.73) {
        const x0 = Math.max(-extent, x + 0.006),
          x1 = Math.min(extent, x + 0.723);
        if (x1 <= x0) continue;
        const low = (p) => (Math.abs(p) > outer.at(-1)[0] ? 0 : extrados(p) + 0.01);
        let poly = [
          [x0, low(x0)],
          [x1, low(x1)],
          [x1, deck(x1) - 0.16],
          [x0, deck(x0) - 0.16],
        ];
        poly = clip(clip(poly, 1, y0, true), 1, y1, false);
        if (poly.length < 3) continue;
        solid(
          out,
          poly,
          side < 0 ? -2.025 : 1.865,
          side < 0 ? -1.865 : 2.025,
          cream.map((v) => v + (((row * 3 + Math.round(x * 10) + 500) % 7) - 3) * 0.007),
        );
      }
    }
  // Projecting lower cornice follows the arch; the upper cornice follows the two deck grades.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 222; i++) {
      const a = i / 222,
        b = (i + 1) / 222,
        A = archPoint(a),
        B = archPoint(b),
        na = archNormal(a),
        nb = archNormal(b);
      const ring = [
        A.map((v, k) => v + na[k] * 0.78),
        B.map((v, k) => v + nb[k] * 0.78),
        B.map((v, k) => v + nb[k] * 0.93),
        A.map((v, k) => v + na[k] * 0.93),
      ];
      solid(out, ring, side < 0 ? -2.13 : 1.96, side < 0 ? -1.96 : 2.13, pale);
    }
    for (let x = -extent; x < extent; x += 0.65) {
      const end = Math.min(extent, x + 0.645),
        dy0 = deck(x),
        dy1 = deck(end);
      wedge(
        out,
        x,
        end,
        dy0 - 0.21,
        dy1 - 0.21,
        dy0,
        dy1,
        side < 0 ? -2.18 : 1.9,
        side < 0 ? -1.9 : 2.18,
        pale,
      );
      // Each parapet slab has a shallow weathered cap with an outward bevel.
      wedge(
        out,
        x + 0.005,
        end,
        dy0,
        dy1,
        dy0 + 0.91,
        dy1 + 0.91,
        side < 0 ? -2.015 : 1.765,
        side < 0 ? -1.765 : 2.015,
        cream,
      );
      wedge(
        out,
        x + 0.005,
        end,
        dy0 + 0.91,
        dy1 + 0.91,
        dy0 + 0.945,
        dy1 + 0.945,
        side < 0 ? -1.98 : 1.765,
        side < 0 ? -1.765 : 1.98,
        pale,
      );
    }
    // The raised iron guard is part of the reconstructed bridge's visible safety railing.
    for (let x = -extent; x < extent; x += 1.08) {
      const end = Math.min(extent, x + 1.08),
        z = side * 1.91;
      tube(
        out,
        'iron',
        [x, deck(x) + 0.92, z],
        [x, deck(x) + 1.34, z],
        0.016,
        [0.17, 0.18, 0.17],
        8,
      );
      tube(
        out,
        'iron',
        [x, deck(x) + 1.3, z],
        [end, deck(end) + 1.3, z],
        0.019,
        [0.17, 0.18, 0.17],
        10,
      );
    }
  }
  // Walkable stone paving, transverse traction strips and the gutters alongside the parapets.
  for (let x = -extent; x < extent; x += 0.46) {
    const end = Math.min(extent, x + 0.449);
    for (let lane = 0; lane < 5; lane++) {
      const z0 = -1.735 + lane * 0.694 + 0.005,
        z1 = z0 + 0.68;
      wedge(
        out,
        x,
        end,
        deck(x) - 0.035,
        deck(end) - 0.035,
        deck(x) + 0.012,
        deck(end) + 0.012,
        z0,
        z1,
        pale,
        'paving',
      );
    }
  }
  for (let x = -extent + 0.3; x < extent; x += 0.93)
    wedge(
      out,
      x,
      x + 0.115,
      deck(x) + 0.01,
      deck(x + 0.115) + 0.01,
      deck(x) + 0.075,
      deck(x + 0.115) + 0.075,
      -1.48,
      1.48,
      [0.74, 0.73, 0.68],
      'paving',
    );
  // Broad bank bearings anchor the arch springings; adjoining towers remain separate assets.
  for (const side of [-1, 1]) {
    const a = side < 0 ? -18.1 : 14.355,
      b = side < 0 ? -14.355 : 18.1;
    box(out, 'roughstone', [a, 0, -2.55], [b, 6.8, 2.55], [0.66, 0.65, 0.58]);
    for (let y = 0.4; y < 6.8; y += 0.42)
      for (let x = a; x < b; x += 0.83)
        box(
          out,
          'stone',
          [x + 0.006, y, -2.575],
          [Math.min(b, x + 0.824), y + 0.405, -2.48],
          cream.map((v) => v - 0.12),
        );
  }
}

export const stariMostStudy = {
  id: 'N0001',
  key: 'stari_most',
  title: 'Stari Most',
  wikidataId: 'Q188528',
  category: 'bridge',
  build: buildStariMostDetailed,
  brief:
    'Narrow humpbacked Tenelija-stone arch with 111 individually jointed radial courses, ashlar spandrels, shaped cornices, stone parapets, iron guards and transverse walkway traction strips.',
  refs: [
    'https://www.mostarbridge.org/starimost/01_intro/orig_des/orig_des.htm',
    'https://www.mostarbridge.org/starimost/02_techdata/stone_cut04/st_cut04.htm',
    'https://www.mostarbridge.org/starimost/01_intro/hist_most/hist02.htm',
    'https://whc.unesco.org/en/activities/349',
  ],
  sourceFacts: {
    northSpanMeters: 28.71,
    southSpanMeters: 28.62,
    northRiseMeters: 12.06,
    widthMeters: 3.95,
    archRingMeters: 0.77,
    voussoirRows: 111,
    stonesAcrossRowRange: [2, 5],
    deckCrownMetersASL: 60.39,
    historicalSummerRiverMetersASL: 40.05,
    parapetHeightMeters: 0.945,
    parapetThicknessRangeMeters: [0.2, 0.26],
  },
  reconstruction: {
    archShoulderRadiusMeters: 14.89,
    archSpringingRadiusMeters: 5.956,
    walkLengthMeters: 32.4,
    note: 'Smooth reconstruction from the restoration report’s multi-center profile, span, rise and course count. Stone positions and widths vary deterministically within the documented ranges; these are not a transcription of individual survey ordinates.',
  },
  nativeAxes: {
    x: 'west to east along the main straight bridge centerline',
    y: 'up; Y0 is historical low-water datum40.05m ASL',
    z: 'south',
  },
  geographic: () => ({
    anchor: [17.8150293, 43.3372672],
    heading: -0.004339929494839471,
    elevationMode: 'sea-level',
    elevationMeters: 40.05,
    source: 'https://www.openstreetmap.org/way/33924615',
    featureIds: ['way/33924615'],
    notes:
      'Exact-QID pedestrian centerline fixes west→east main axis; bent approaches are excluded from axis fit. LocalY0 at historical low-water40.05m ASL gives crown60.39m. Host terrain and current river stage may differ.',
  }),
  limitations: [
    'Detailed exterior reconstruction of the rebuilt bridge; historical survey dimensions guide its silhouette, without claiming exact current stone-by-stone survey coordinates.',
    'Tara and Halebija towers, adjacent town buildings, rocky riverbanks and the bent public streets beyond bridge bearings are separate scene features.',
    'The absolute vertical placement uses the published historical low-water datum; terrain datasets and seasonal river surfaces can vary.',
  ],
  camera: { position: [30, 29, 44], lookAt: [0, 11, 0], fov: 43 },
  qaCameras: [
    { name: 'arch-stones', position: [6, 12, 23], lookAt: [1, 17, 0] },
    { name: 'walkway', position: [-13, 20.8, 0.2], lookAt: [0, 21, 0.1], fov: 58 },
    { name: 'cornices', position: [-10, 21, 10], lookAt: [-4, 19, 1.8] },
    { name: 'intrados', position: [0, 8, 11], lookAt: [0, 18.4, 0], fov: 52 },
    { name: 'far-crossing', position: [-4, 18, 62], lookAt: [0, 11, 0] },
  ],
};
