/** Bitexco: asymmetric curved tower, inclined crown, cantilever and six-level podium. */
import { CatmullRomCurve3, Vector3 } from 'three';
import { beam, loft, normalFor } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  localGeographic,
  mappedCap,
  mappedSolid,
  partsEvidence,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';

const metal = [0.63, 0.68, 0.7];
const silver = [0.78, 0.79, 0.77];
const glass = [0.32, 0.44, 0.49];
const dark = [0.075, 0.09, 0.095];
const white = [0.87, 0.87, 0.82];
const blend = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const height = 262.5;
const deckY = 191.4;
const center = [-17.2, -6.0];
const columns = 104;

// Reconstructed typical-floor outline follows the published pointed, asymmetric lens.
// The OSM southern projection includes the helipad, and must not be extruded as the shaft.
// The northern cusp, western return and podium boundary constrain the map registration.
const controls = [
  [-13.5, -30.8],
  [-10.8, -30.55],
  [-7.4, -26.0],
  [-2.9, -15.1],
  [-0.75, -4.2],
  [-2.05, 3.7],
  [-9.0, 11.0],
  [-18.8, 18.8],
  [-21.15, 19.2],
  [-24.5, 15.4],
  [-30.5, 4.1],
  [-32.4, -4.5],
  [-28.85, -14.55],
  [-20.9, -25.3],
];
const curve = new CatmullRomCurve3(
  controls.map(([x, z]) => new Vector3(x, 0, z)),
  true,
  'centripetal',
);
const outline = clockwise(
  curve
    .getSpacedPoints(columns)
    .slice(0, -1)
    .map((p) => [p.x, p.z]),
);

// These samples are explicit reconstruction values, not asserted as-built floor plans.
// The inward taper below the twentieth floor is documented by the facade engineer.
const profile = [
  [0, 0.82, 0.84, 0.9],
  [22.5, 0.88, 0.89, 0.4],
  [72, 0.985, 0.99, 0],
  [110, 1, 1, 0],
  [150, 0.965, 0.97, -0.1],
  [178, 0.915, 0.92, -0.6],
  [deckY, 0.895, 0.89, -0.8],
  [220, 0.825, 0.86, -1],
  [height, 0.75, 0.82, -1.2],
];
function shape(y) {
  for (let i = 1; i < profile.length; i++) {
    if (y <= profile[i][0]) {
      const [a, b] = [profile[i - 1], profile[i]];
      const t = Math.max(0, (y - a[0]) / (b[0] - a[0]));
      const ease = t * t * (3 - 2 * t);
      return blend(a.slice(1), b.slice(1), ease);
    }
  }
  return profile.at(-1).slice(1);
}
function at(p, y, offset = 0) {
  const [sx, sz, shift] = shape(y);
  const dx = p[0] - center[0],
    dz = p[1] - center[1];
  const r = Math.hypot(dx, dz),
    f = r ? offset / r : 0;
  return [center[0] + dx * (sx + f), y, center[1] + dz * (sz + f) + shift];
}
// The upper leaf is cut by an inclined plane; its exposed cut receives its own curtain wall.
// The tip is a finite narrow roof, with a small equipment mast reaching 264 m.
function crownY(p) {
  return Math.min(height, deckY + Math.max(0, 4.1 - p[1]) * 2.37);
}
function facadePanel(out, a, b, c, d, row, col) {
  const n = normalFor(a, b, c);
  const tint = ((col * 13 + row * 7) % 9) / 8;
  const color = glass.map((v, i) => v * (0.95 + 0.055 * tint) + (i === 2 ? 0.005 : 0));
  const raised = (p) => p.map((v, i) => v + n[i] * 0.065);
  beam(out, 'metal', raised(a), raised(d), 0.058, 0.073, metal);
  beam(out, 'metal', raised(a), raised(b), 0.11, 0.085, metal);
  // Thin horizontal intermediate transom is distinct from the opaque slab-edge spandrel.
  const h = Math.min(d[1] - a[1], c[1] - b[1]);
  if (h > 1.1) {
    const t = Math.min(0.24, 0.65 / h);
    face(out, 'glass', [blend(a, d, t), blend(b, c, t), c, d], color);
    face(out, 'glass', [a, b, blend(b, c, t), blend(a, d, t)], [0.235, 0.305, 0.335]);
    beam(out, 'metal', raised(blend(a, d, t)), raised(blend(b, c, t)), 0.043, 0.06, metal);
  } else face(out, 'glass', [a, b, c, d], color);
}
const levels = [0.25, 5.5, 9.75, 14, 18.25, 22.5];
for (let i = 1; i <= 43; i++) levels.push(22.5 + ((178 - 22.5) * i) / 43);
levels.push(181.9, 186.6, deckY);
for (let i = 1; i <= 16; i++) levels.push(deckY + ((height - deckY) * i) / 16);

function tower(out) {
  const low = outline.map((p) => at(p, 0.25));
  loft(out, 'stone', [low.map(([x, , z]) => [x, 0, z]), low], [0.52, 0.55, 0.53]);
  for (let row = 0; row < levels.length - 1; row++) {
    const y0 = levels[row],
      y1 = levels[row + 1];
    for (let col = 0; col < columns; col++) {
      const a = outline[col],
        b = outline[(col + 1) % columns];
      const topA = crownY(a),
        topB = crownY(b);
      if (Math.max(topA, topB) <= y0 + 0.0001) continue;
      // Split exactly where a sloping crown edge meets each floor. Skipping a whole
      // bay when just one corner is above the roof leaves a visible sawtooth hole.
      const splits = [0, 1];
      if (Math.abs(topA - topB) > 0.0001)
        for (const y of [y0, y1]) {
          const t = (y - topA) / (topB - topA);
          if (t > 0.00001 && t < 0.99999) splits.push(t);
        }
      splits.sort((a, b) => a - b);
      for (let j = 0; j < splits.length - 1; j++) {
        const t0 = splits[j],
          t1 = splits[j + 1];
        const aa = blend(a, b, t0),
          bb = blend(a, b, t1);
        const ya = Math.min(y1, topA + (topB - topA) * t0);
        const yb = Math.min(y1, topA + (topB - topA) * t1);
        if (Math.max(ya, yb) <= y0 + 0.0001) continue;
        const p = [at(aa, y0), at(bb, y0), at(bb, yb), at(aa, ya)];
        if (ya <= y0 + 0.0001 || yb <= y0 + 0.0001) {
          tri(out, 'glass', ya <= y0 + 0.0001 ? [p[0], p[1], p[2]] : [p[0], p[1], p[3]], glass);
          beam(out, 'metal', p[0], p[1], 0.085, 0.085, metal);
        } else if (y0 > 106 && y0 < 110) {
          face(out, 'recess', p, dark);
          for (let y = y0 + 0.16; y < y1; y += 0.18)
            beam(out, 'metal', at(aa, y, 0.06), at(bb, y, 0.06), 0.06, 0.09, [0.31, 0.36, 0.37]);
        } else facadePanel(out, ...p, row, col);
      }
    }
  }
  // Narrow cut-face mesh, split into actual floor rows and mullion bays.
  // Horizontal intersections of the two smooth outer edges define a closed curved front.
  const intersections = (y) => {
    const hits = [];
    for (let i = 0; i < columns; i++) {
      const a = outline[i],
        b = outline[(i + 1) % columns];
      const ya = crownY(a),
        yb = crownY(b);
      if ((ya <= y && yb > y) || (yb <= y && ya > y)) {
        const p = blend(a, b, (y - ya) / (yb - ya));
        hits.push(at(p, y));
      }
    }
    return hits.sort((a, b) => a[0] - b[0]);
  };
  const cuts = [deckY + 0.005, ...levels.filter((y) => y > deckY && y < height), height - 0.005];
  for (let j = 0; j < cuts.length - 1; j++) {
    const a = intersections(cuts[j]),
      b = intersections(cuts[j + 1]);
    if (a.length !== 2 || b.length !== 2)
      throw new Error('Bitexco crown intersection must have two edges');
    const count = Math.max(2, Math.ceil(Math.max(a[1][0] - a[0][0], b[1][0] - b[0][0]) / 1.4));
    for (let i = 0; i < count; i++) {
      const p = [
        blend(a[0], a[1], i / count),
        blend(a[0], a[1], (i + 1) / count),
        blend(b[0], b[1], (i + 1) / count),
        blend(b[0], b[1], i / count),
      ];
      facadePanel(out, ...p, j, i);
    }
    for (const side of [0, 1]) beam(out, 'metal', a[side], b[side], 0.22, 0.2, silver);
  }
  // Close the lower lobe under the pad; preserve its forward curve below level 52.
  const lobe = outline.map((p) => at(p, deckY));
  mappedCap(
    out,
    'metal',
    lobe.map(([x, , z]) => [x, z]),
    deckY,
    [0.49, 0.53, 0.55],
  );
  const roofZ = 4.1 - (height - deckY) / 2.37;
  const roofOutline = [];
  for (let i = 0; i < columns; i++) {
    const a = outline[i],
      b = outline[(i + 1) % columns];
    if (a[1] <= roofZ) roofOutline.push(a);
    if ((a[1] < roofZ && b[1] > roofZ) || (a[1] > roofZ && b[1] < roofZ))
      roofOutline.push(blend(a, b, (roofZ - a[1]) / (b[1] - a[1])));
  }
  const high = roofOutline.map((p) => at(p, height));
  const roof = clockwise(high.map(([x, , z]) => [x, z]));
  mappedCap(out, 'metal', roof, height, silver);
  // A simple surveyed-height equipment silhouette, with dimensions flagged as reconstructed.
  const roofCenter = high.reduce((s, p) => s.map((v, i) => v + p[i] / high.length), [0, 0, 0]);
  box(
    out,
    'metal',
    [roofCenter[0] - 0.6, 262.5, roofCenter[2] - 0.4],
    [roofCenter[0] + 0.6, 263.25, roofCenter[2] + 0.4],
    metal,
  );
  beam(
    out,
    'metal',
    [roofCenter[0], 263, roofCenter[2]],
    [roofCenter[0], 264, roofCenter[2]],
    0.075,
    0.075,
    dark,
  );
  beam(
    out,
    'metal',
    [roofCenter[0] - 3, 263.1, roofCenter[2]],
    [roofCenter[0] + 3, 263.1, roofCenter[2]],
    0.16,
    0.16,
    metal,
  );
}

function padPoint(t, y, radius = 1) {
  return [-18.8 + Math.sin(t) * 16.45 * radius, y, 10.0 + Math.cos(t) * 22.0 * radius];
}
function padRing(out, slot, y, outer, inner, color) {
  for (let i = 0; i < 160; i++) {
    const a = (i * Math.PI) / 80,
      b = ((i + 1) * Math.PI) / 80;
    face(
      out,
      slot,
      [padPoint(a, y, inner), padPoint(a, y, outer), padPoint(b, y, outer), padPoint(b, y, inner)],
      color,
    );
  }
}
function helipad(out, mapped) {
  const n = 160;
  const rings = [
    [deckY - 2.0, 0.89],
    [deckY - 0.65, 1],
    [deckY - 0.06, 1],
  ];
  loft(
    out,
    'metal',
    rings.map(([y, r]) =>
      Array.from({ length: n }, (_, i) => padPoint((i * Math.PI * 2) / n, y, r)),
    ),
    silver,
    { cap: false },
  );
  mappedCap(
    out,
    'metal',
    Array.from({ length: n }, (_, i) => {
      const [x, , z] = padPoint((i * Math.PI * 2) / n, deckY - 2, 0.89);
      return [x, z];
    }),
    deckY - 2,
    [0.17, 0.2, 0.21],
    [],
    true,
  );
  // The covered soffit follows the visible radial form; exposed edge ribs close at the fascia.
  for (let i = 0; i < 40; i++) {
    const t = (i * Math.PI) / 20;
    beam(
      out,
      'metal',
      padPoint(t, deckY - 2.03, 0.12),
      padPoint(t, deckY - 2.03, 0.887),
      0.065,
      0.065,
      [0.27, 0.32, 0.34],
    );
  }
  const topPlan = Array.from({ length: n }, (_, i) =>
    padPoint((i * Math.PI * 2) / n, deckY).filter((_, j) => j !== 1),
  );
  mappedCap(out, 'metal', topPlan, deckY, [0.24, 0.29, 0.28]);
  padRing(out, 'metal', deckY + 0.005, 0.993, 0.965, white);
  const p = partsEvidence('n0209_bitexco_financial_tower').find((e) => e.id === 1231606415);
  const square = clockwise(
    p.geometry.slice(0, -1).map((g) => localGeographic(mapped, g.lon, g.lat)),
  );
  mappedCap(out, 'metal', square, deckY + 0.007, [0.2, 0.26, 0.235]);
  for (let i = 0; i < square.length; i++) {
    const a = square[i],
      b = square[(i + 1) % square.length];
    beam(
      out,
      'metal',
      [a[0], deckY + 0.018, a[1]],
      [b[0], deckY + 0.018, b[1]],
      0.13,
      0.018,
      white,
    );
  }
  const cx = square.reduce((s, p) => s + p[0], 0) / 4;
  const cz = square.reduce((s, p) => s + p[1], 0) / 4;
  for (let i = 0; i < 128; i++) {
    const a = (i * Math.PI) / 64,
      b = ((i + 1) * Math.PI) / 64;
    const p = (t, r) => [cx + Math.sin(t) * r, deckY + 0.023, cz + Math.cos(t) * r];
    face(out, 'metal', [p(a, 3.75), p(a, 4.0), p(b, 4.0), p(b, 3.75)], white);
  }
  // Individually modeled H, not a private label texture.
  for (const dx of [-1.1, 1.1])
    box(
      out,
      'metal',
      [cx + dx - 0.18, deckY + 0.019, cz - 1.6],
      [cx + dx + 0.18, deckY + 0.04, cz + 1.6],
      [0.89, 0.76, 0.12],
    );
  box(
    out,
    'metal',
    [cx - 1.1, deckY + 0.019, cz - 0.18],
    [cx + 1.1, deckY + 0.04, cz + 0.18],
    [0.89, 0.76, 0.12],
  );
  // Outward sloping safety net, radial supports and fine perimeter cable. The openings are geometry.
  for (let i = 0; i < 80; i++) {
    const a = (i * Math.PI) / 40,
      b = ((i + 1) * Math.PI) / 40;
    beam(
      out,
      'metal',
      padPoint(a, deckY - 0.35, 1),
      padPoint(a, deckY + 0.03, 1.074),
      0.04,
      0.04,
      metal,
    );
    beam(
      out,
      'metal',
      padPoint(a, deckY + 0.03, 1.074),
      padPoint(b, deckY + 0.03, 1.074),
      0.025,
      0.025,
      metal,
    );
    for (let s = 1; s <= 4; s++) {
      const f = s / 5;
      beam(
        out,
        'metal',
        padPoint(a, deckY - 0.35 + f * 0.38, 1 + f * 0.074),
        padPoint(b, deckY - 0.35 + f * 0.38, 1 + f * 0.074),
        0.009,
        0.009,
        dark,
      );
    }
    for (let j = 1; j < 4; j++) {
      const t = a + ((b - a) * j) / 4;
      beam(
        out,
        'metal',
        padPoint(t, deckY - 0.35, 1),
        padPoint(t, deckY + 0.03, 1.074),
        0.009,
        0.009,
        dark,
      );
    }
    if (i % 8 === 0) {
      const p = padPoint(a, deckY + 0.1, 0.985);
      box(
        out,
        'metal',
        [p[0] - 0.065, p[1], p[2] - 0.065],
        [p[0] + 0.065, p[1] + 0.09, p[2] + 0.065],
        [0.14, 0.42, 0.31],
      );
    }
  }
}

function podium(out, mapped) {
  const part = partsEvidence('n0209_bitexco_financial_tower').find((e) => e.id === 1222241873);
  const plan = clockwise(
    part.geometry.slice(0, -1).map((g) => localGeographic(mapped, g.lon, g.lat)),
  );
  mappedSolid(out, 'stone', plan, 0, 0.22, [0.65, 0.62, 0.57]);
  const floors = [0.22, 4.5, 8.6, 12.7, 16.8, 20.9, 22.5];
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length];
    const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const count = Math.max(1, Math.round(distance / 1.5));
    const entranceBay = (k) => {
      if (k < 0 || k >= count) return false;
      const p0 = blend(a, b, k / count),
        p1 = blend(a, b, (k + 1) / count);
      const middleX = (p0[0] + p1[0]) / 2;
      return middleX > 7 && middleX < 17 && Math.min(p0[1], p1[1]) > 24;
    };
    for (let row = 0; row < floors.length - 1; row++) {
      for (let k = 0; k < count; k++) {
        const p0 = blend(a, b, k / count),
          p1 = blend(a, b, (k + 1) / count);
        const y0 = floors[row],
          y1 = floors[row + 1];
        const panel = [
          [p0[0], y0, p0[1]],
          [p1[0], y0, p1[1]],
          [p1[0], y1, p1[1]],
          [p0[0], y1, p0[1]],
        ];
        if (row === 0 && entranceBay(k)) {
          const n = normalFor(...panel);
          const inset = panel.map((p) => p.map((v, j) => v - n[j] * 0.65));
          facadePanel(out, ...inset, row, k);
          // One continuous recess: jambs only at its two ends, not at every door leaf.
          const returns = [0, 2];
          if (!entranceBay(k + 1)) returns.push(1);
          if (!entranceBay(k - 1)) returns.push(3);
          for (const edge of returns) {
            const next = (edge + 1) % 4;
            face(out, 'carved', [panel[edge], panel[next], inset[next], inset[edge]], white);
          }
          const lower = blend(inset[0], inset[1], 0.8);
          const handle = (y, d = 0.09) => [lower[0] + n[0] * d, y, lower[2] + n[2] * d];
          beam(out, 'stainless', handle(1.1), handle(2.0), 0.03, 0.03, silver);
          for (const y of [1.1, 2.0])
            beam(out, 'stainless', handle(y, 0.02), handle(y), 0.025, 0.025, silver);
        } else if (row === 1 || row === 3 || row === 5) {
          const h = row === 5 ? y1 - y0 : 1.15;
          face(
            out,
            'carved',
            [panel[0], panel[1], [p1[0], y0 + h, p1[1]], [p0[0], y0 + h, p0[1]]],
            white,
          );
          if (h < y1 - y0)
            facadePanel(
              out,
              [p0[0], y0 + h, p0[1]],
              [p1[0], y0 + h, p1[1]],
              panel[2],
              panel[3],
              row,
              k,
            );
        } else facadePanel(out, ...panel, row, k);
      }
    }
    for (const y of [4.5, 8.6, 12.7, 16.8, 20.9, 22.5])
      beam(out, 'metal', [a[0], y, a[1]], [b[0], y, b[1]], 0.14, 0.2, silver);
  }
  mappedCap(out, 'metal', plan, 22.5, [0.34, 0.38, 0.39]);
  // Long asymmetric butterfly canopy, reconstructed from the engineer's street photograph.
  const roof = [
    [2.2, 29.9, -25],
    [29, 25.4, -25],
    [34, 26.8, 20],
    [5.5, 31.1, 19],
  ];
  face(out, 'metal', roof.toReversed(), silver);
  const under = roof.map(([x, y, z]) => [x, y - 0.34, z]);
  face(out, 'metal', under, [0.33, 0.37, 0.37]);
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4;
    face(out, 'metal', [roof[i], roof[k], under[k], under[i]], white);
  }
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const a = blend(under[0], under[3], t),
      b = blend(under[1], under[2], t);
    beam(out, 'metal', a, b, 0.12, 0.24, metal);
    if (i % 4 === 0)
      for (const u of [0.17, 0.85]) {
        const p = blend(a, b, u);
        beam(out, 'metal', [p[0], 22.5, p[2]], p, 0.25, 0.25, silver);
        beam(
          out,
          'metal',
          [p[0], 22.5, p[2]],
          blend(a, b, u > 0.5 ? 0.6 : 0.4),
          0.14,
          0.14,
          silver,
        );
      }
  }
}

function build(out, mapped) {
  tower(out);
  helipad(out, mapped);
  podium(out, mapped);
}

export const bitexcoStudy = {
  id: 'N0209',
  key: 'bitexco_financial_tower',
  title: 'Bitexco Financial Tower',
  wikidataId: 'Q638512',
  height: 264,
  build,
  brief:
    'Carlos Zapata’s asymmetric lotus tower with a floor-by-floor curved glazed exterior, inclined upper leaf, projecting oval helipad with open safety net, lower mechanical belt and glazed retail podium under its floating steel canopy.',
  sourceFacts: {
    architecturalHeightMeters: 262.5,
    tipHeightMeters: 264,
    occupiedHeightMeters: 240.1,
    helipadHeightMeters: 191.4,
    helipadCantileverMeters: 22,
    floors: 68,
    facadePanelsReported: 6000,
    constructionCompleted: 2010,
    heightSource: 'Council on Vertical Urbanism / Skyscraper Center',
    facadeSource:
      'Meinhardt Facade Technology: inward taper at lower 20 floors, bespoke panels, 22 m helipad cantilever.',
    sourceDiscrepancies:
      'Turner describes five retail stories and the deck at 178 m; the facade consultant and built-use descriptions count six retail levels. CVU lists 181.9 m for the observation height. Both height datums are retained as different levels; the 269 m OSM part tag is not adopted.',
  },
  reconstruction: {
    plan: 'Northern tower cusp, podium outline and rooftop landing marking are registered in the exact-QID map frame. The outer mapped southern lobe contains the helipad projection and is not blindly used as a shaft footprint. Smooth typical-floor lens controls and profile samples reconstruct the published plan and public engineering photographs; dimensioned floor drawings remain unavailable.',
    towerControlsXZ: controls,
    towerProfileSamples: profile,
    facadeColumns: columns,
    levelDatumsMeters: levels,
    upperLeaf:
      'Inclined cut across the changing floor perimeter, closed by a separate framed front; crown plane and profile are reconstructed.',
    helipad: {
      deckY,
      ellipseCenterXZ: [-18.8, 10],
      radiiXZ: [16.45, 22],
      note: 'Oval deck plan and soffit thickness are reconstructed around the mapped landing square; cantilever and orientation need comparison with construction drawings.',
    },
    footprintEvidence:
      'map-parts.json: exact parent way/804073951; five constituent mapped parts, including rooftop landing square way/1231606415.',
  },
  refs: [
    'https://bitexco.com.vn/en/project/bitexco-financial-tower/',
    'https://www.turnerconstruction.com/projects/bitexco-financial-tower',
    'https://www.skyscrapercenter.com/building/bitexco-financial-tower/736',
    'https://www.mfacade.com/projects/bitexco-financial-tower/',
    'https://www.lera.com/bitexco-tower',
    'https://doi.org/10.1051/e3sconf/20183301018',
    'https://www.openstreetmap.org/way/804073951',
    'https://www.openstreetmap.org/way/1231606415',
  ],
  nativeAxes: {
    up: '+Y',
    longitudinal: '+Z toward the mapped southern helipad projection',
    front: '+X toward the retail podium',
    origin:
      'Exact-QID mapped outer envelope center; tower center is offset to the west of the podium.',
  },
  geographic: (m) => ({
    heading: m.heading,
    notes:
      'The source-local map parts distinguish the northern crown, southern helipad and eastern retail podium, resolving the signed plan. Ground is terrain-contact at Y0. Exact facade and podium fit, crown reconstruction and street datum await geographic review.',
  }),
  limitations: [
    'This is an exterior architectural draft. Tower plan/profile, floor datums, crown inclination, podium canopy, entrances and equipment require closer comparison with measured/as-built drawings before maximum-fidelity approval.',
    'The mapped outline includes upper projections. No podium or tower floor plate is claimed to be a survey. The helipad and its net are modeled independently, with landing markings traced from map geometry.',
    'Opaque PBR glazing approximates the exterior; tenant interiors, branding, operating lights and underground floors are not modeled. No flight or structural-engineering certification is implied.',
  ],
  camera: { position: [-235, 170, 320], lookAt: [-12, 125, 0], fov: 42 },
  qaCameras: [
    { name: 'curved-shaft', position: [-57, 75, 67], lookAt: [-17, 72, 2] },
    { name: 'helipad-above', position: [-67, 225, 91], lookAt: [-18, 191, 10] },
    { name: 'helipad-soffit', position: [-62, 170, 76], lookAt: [-19, 190, 10] },
    { name: 'inclined-crown', position: [-94, 274, 105], lookAt: [-16, 237, -17] },
    { name: 'crown-reverse', position: [43, 286, -87], lookAt: [-13, 244, -24] },
    { name: 'podium-canopy', position: [85, 53, 69], lookAt: [13, 19, 0] },
    { name: 'ground-entrance', position: [31, 6, 55], lookAt: [12, 4, 27] },
    { name: 'mechanical-belt', position: [-66, 117, 48], lookAt: [-18, 108, 0] },
    { name: 'far-lotus', position: [-540, 300, 620], lookAt: [-15, 125, 0] },
  ],
};
