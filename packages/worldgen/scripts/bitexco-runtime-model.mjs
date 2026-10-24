/** Reviewed Bitexco exterior. Original bitexcoStudy remains the detailed source master. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
import { structureSourcePath } from './structure-source-paths.mjs';

const metal = [0.63, 0.68, 0.7];
const silver = [0.78, 0.79, 0.77];
const glass = [0.32, 0.44, 0.49];
const dark = [0.075, 0.09, 0.095];
const white = [0.87, 0.87, 0.82];
const blend = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const height = 262.5;
const deckY = 191.4;
const center = [-17.2, -6.0];
function buildBitexco(out, mapped) {
  const detail = out.detail,
    near = detail === 'closeup',
    street = detail === 'street',
    district = detail === 'district',
    far = detail === 'skyline';
  const columns = near ? 72 : street ? 48 : district ? 32 : 20;
  const padSides = near ? 64 : street ? 48 : district ? 24 : 16;

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
    const p = [a, b, c, d],
      n = normalFor(a, b, c),
      h = Math.min(d[1] - a[1], c[1] - b[1]),
      w = Math.hypot(...b.map((v, i) => v - a[i]));
    const tint = ((col * 13 + row * 7) % 9) / 8,
      color = glass.map((v, i) => v * (0.95 + 0.055 * tint) + (i === 2 ? 0.005 : 0));
    const at = (u, v) => blend(blend(a, b, u), blend(d, c, u), v).map((x, i) => x + n[i] * 0.018);
    const strip = (u0, u1, v0, v1, color) =>
      face(out, 'metal', [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)], color);
    if (far) {
      face(out, 'glass', p, glass);
      return;
    }
    if ((near || street) && h > 1.1) {
      const t = Math.min(0.24, 0.65 / h);
      face(out, 'glass', [blend(a, d, t), blend(b, c, t), c, d], color);
      face(out, 'glass', [a, b, blend(b, c, t), blend(a, d, t)], [0.235, 0.305, 0.335]);
      if (near) strip(0, 1, t, Math.min(1, t + 0.043 / h), metal);
    } else face(out, 'glass', p, color);
    strip(0, Math.min(0.2, 0.058 / w), 0, 1, metal);
    if (h > 0.001 && !district) strip(0, 1, 0, Math.min(0.2, 0.11 / h), metal);
  }
  let levels = [0.25, 5.5, 9.75, 14, 18.25, 22.5];
  for (let i = 1; i <= 43; i++) levels.push(22.5 + ((178 - 22.5) * i) / 43);
  levels.push(181.9, 186.6, deckY);
  for (let i = 1; i <= 16; i++) levels.push(deckY + ((height - deckY) * i) / 16);

  if (!near)
    levels = [
      ...new Set([
        ...(street
          ? levels.filter((_, i) => i % 3 === 0)
          : district
            ? [0.25, 5.5, 181.9, 186.6]
            : [0.25]),
        ...profile.map((p) => p[0]).filter((y) => y >= 0.25),
        109.29069767441861,
        112.90697674418605,
      ]),
    ].sort((a, b) => a - b);
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
            if (near) beam(out, 'metal', p[0], p[1], 0.085, 0.085, metal);
          } else if (y0 >= 109.29069767441861 && y0 < 112.90697674418605) {
            face(out, 'recess', p, dark);
            if (!far)
              for (let y = y0 + 0.16; y < y1; y += near ? 0.36 : street ? 0.9 : 1.8)
                face(
                  out,
                  'metal',
                  [
                    at(aa, y, 0.018),
                    at(bb, y, 0.018),
                    at(bb, Math.min(y + 0.05, y1), 0.018),
                    at(aa, Math.min(y + 0.05, y1), 0.018),
                  ],
                  [0.31, 0.36, 0.37],
                );
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
      const count = Math.max(
        2,
        Math.ceil(
          Math.max(a[1][0] - a[0][0], b[1][0] - b[0][0]) /
            (near ? 1.4 : street ? 3 : district ? 6 : 14),
        ),
      );
      for (let i = 0; i < count; i++) {
        const p = [
          blend(a[0], a[1], i / count),
          blend(a[0], a[1], (i + 1) / count),
          blend(b[0], b[1], (i + 1) / count),
          blend(b[0], b[1], i / count),
        ];
        facadePanel(out, ...p, j, i);
      }
      if (!far) for (const side of [0, 1]) beam(out, 'metal', a[side], b[side], 0.22, 0.2, silver);
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
    for (let i = 0; i < padSides; i++) {
      const a = (i * Math.PI * 2) / padSides,
        b = ((i + 1) * Math.PI * 2) / padSides;
      face(
        out,
        slot,
        [
          padPoint(a, y, inner),
          padPoint(a, y, outer),
          padPoint(b, y, outer),
          padPoint(b, y, inner),
        ],
        color,
      );
    }
  }
  function helipad(out, mapped) {
    const n = padSides;
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
    for (let i = 0; i < (near ? 32 : street ? 16 : district ? 8 : 0); i++) {
      const t = (i * Math.PI * 2) / (near ? 32 : street ? 16 : 8);
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
    if (!far) padRing(out, 'metal', deckY + 0.005, 0.993, 0.965, white);
    if (far) return;
    const p = partsEvidence('bitexco_financial_tower').find((e) => e.id === 1231606415);
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
    for (let i = 0; i < (near ? 48 : street ? 32 : 16); i++) {
      const a = (i * Math.PI * 2) / (near ? 48 : street ? 32 : 16),
        b = ((i + 1) * Math.PI * 2) / (near ? 48 : street ? 32 : 16);
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
    for (let i = 0; i < (near ? 32 : street ? 16 : 8); i++) {
      const a = (i * Math.PI * 2) / (near ? 32 : street ? 16 : 8),
        b = ((i + 1) * Math.PI * 2) / (near ? 32 : street ? 16 : 8);
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
      for (let s = 1; s <= (near ? 2 : street ? 1 : 0); s++) {
        const f = s / (near ? 3 : 2);
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
      for (let j = 1; j < (near ? 2 : 1); j++) {
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
      if (near && i % 4 === 0) {
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
    const part = partsEvidence('bitexco_financial_tower').find((e) => e.id === 1222241873);
    const plan = clockwise(
      part.geometry.slice(0, -1).map((g) => localGeographic(mapped, g.lon, g.lat)),
    );
    if (!far) mappedSolid(out, 'stone', plan, 0, 0.22, [0.65, 0.62, 0.57]);
    const floors = far
      ? [0, 4.5, 22.5]
      : district
        ? [0.22, 4.5, 12.7, 22.5]
        : [0.22, 4.5, 8.6, 12.7, 16.8, 20.9, 22.5];
    for (let i = 0; i < plan.length; i++) {
      const a = plan[i],
        b = plan[(i + 1) % plan.length];
      const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const count = Math.max(1, Math.round(distance / (near ? 1.5 : street ? 3 : 6)));
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
            if (near) {
              const lower = blend(inset[0], inset[1], 0.8);
              const handle = (y, d = 0.09) => [lower[0] + n[0] * d, y, lower[2] + n[2] * d];
              beam(out, 'stainless', handle(1.1), handle(2.0), 0.03, 0.03, silver);
              for (const y of [1.1, 2.0])
                beam(out, 'stainless', handle(y, 0.02), handle(y), 0.025, 0.025, silver);
            }
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
      if (!far)
        for (const y of floors.slice(1))
          face(
            out,
            'metal',
            [
              [a[0], y - 0.07, a[1]],
              [b[0], y - 0.07, b[1]],
              [b[0], y + 0.07, b[1]],
              [a[0], y + 0.07, a[1]],
            ],
            silver,
          );
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
    for (let i = 0; i <= (near ? 16 : street ? 8 : 4); i++) {
      const t = i / (near ? 16 : street ? 8 : 4);
      const a = blend(under[0], under[3], t),
        b = blend(under[1], under[2], t);
      if (!far) beam(out, 'metal', a, b, 0.12, 0.24, metal);
      if (far ? i === 1 || i === 3 : i % (near ? 4 : street ? 2 : 1) === 0)
        for (const u of [0.17, 0.85]) {
          const p = blend(a, b, u);
          beam(out, 'metal', [p[0], 22.5, p[2]], p, 0.25, 0.25, silver);
          if (!far)
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

  tower(out);
  helipad(out, mapped);
  podium(out, mapped);
}

function build(out, detail, m) {
  m ??= JSON.parse(
    readFileSync(resolve(structureSourcePath('bitexco_financial_tower'), 'map-frame.json'), 'utf8'),
  );
  const target = { detail },
    means = {
      stone: 0.886354,
      carved: 0.886354,
      metal: 0.908889,
      recess: 0.908889,
      stainless: 0.821579,
    };
  for (const method of ['addQuad', 'addTriangle', 'addConvexPolygon'])
    target[method] = (slot, ref, p, n, uv, c) =>
      out[method](
        slot,
        ref,
        p,
        n,
        uv,
        detail === 'skyline' ? c.map((v) => v * (means[slot] ?? 1)) : c,
      );
  buildBitexco(target, m);
}
export const buildBitexcoReviewedMaster = (out, m) => build(out, 'closeup', m);
export const buildBitexcoSkyline = (out) => build(out, 'skyline');
export const buildBitexcoDistrict = (out) => build(out, 'district');
export const buildBitexcoStreet = (out) => build(out, 'street');
export const buildBitexcoCloseup = (out) => build(out, 'closeup');
