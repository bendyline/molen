/** Al Hamra: fixed glass envelope, moving southern cut, limestone flares and north lamella. */
import { readFileSync } from 'node:fs';
import { beam } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  lerp,
  mappedCap,
  mappedSolid,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const scope = JSON.parse(
  readFileSync(structureSourcePath('n0180_al_hamra_tower', 'review-scope.json')),
);
const settings = {
  skyline: { angles: 32, mult: 0, rows: 0, columns: 0, branches: 4, wing: 2, step: 43.75 },
  district: { angles: 64, mult: 16, rows: 20, columns: 6, branches: 6, wing: 4, step: 21.875 },
  street: { angles: 96, mult: 16, rows: 80, columns: 12, branches: 12, wing: 4, step: 8.4 },
  closeup: { angles: 176, mult: 1, rows: 80, columns: 12, branches: 28, wing: 18, step: 4.2 },
};
function hamraOuter(angle) {
  const c = Math.cos(angle),
    s = Math.sin(angle),
    hx = 30,
    hz = 29.3,
    r = 8.4;
  let low = 0,
    high = 44;
  for (let k = 0; k < 38; k++) {
    const d = (low + high) / 2,
      x = Math.abs(c * d),
      z = Math.abs(s * d);
    const dx = Math.max(x - (hx - r), 0),
      dz = Math.max(z - (hz - r), 0);
    if (x <= hx && z <= hz && dx * dx + dz * dz <= r * r) low = d;
    else high = d;
  }
  return [c * low, s * low].map((v) => Math.round(v * 1e7) / 1e7);
}
function hamraCleanPlan(plan) {
  return plan.filter((b, i) => {
    const a = plan[(i + plan.length - 1) % plan.length],
      c = plan[(i + 1) % plan.length];
    return Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) > 1e-5;
  });
}
function hamraCut(y) {
  return (Math.PI / 2) * (1 - Math.min(1, Math.max(0, y / 350)));
}
function hamraGlassPoint(u, y) {
  const p = hamraOuter(hamraCut(y) - u * Math.PI * 1.5);
  return [p[0], y, p[1]];
}
function hamraWingPoint(side, u, y) {
  const angle = hamraCut(y) + (side < 0 ? Math.PI / 2 : 0),
    outer = hamraOuter(angle);
  const core = [side * 17, 2.1];
  // A ruled sheet between the fixed core edge and moving rounded-square edge.
  return [lerp(core, outer, u)[0], y, lerp(core, outer, u)[1]];
}
function hamraRoofHeight(u) {
  return 412.49 - 55.8 * u;
}
function hamraClippedPane(out, polygon, glass) {
  // Clip a fixed-angle curtain-wall cell against the two moving courtyard edges.
  // The glazing mullions stay vertical while only the cut edge sweeps across them.
  for (const distance of [
    (p) => hamraCut(p[1]) - p[0],
    (p) => p[0] - hamraCut(p[1]) + Math.PI * 1.5,
  ]) {
    const clipped = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length],
        da = distance(a),
        db = distance(b);
      if (da >= -1e-10) clipped.push(a);
      if ((da > 0 && db < 0) || (da < 0 && db > 0)) clipped.push(lerp(a, b, da / (da - db)));
    }
    polygon = clipped.filter(
      (p, i) =>
        Math.hypot(...p.map((v, k) => v - clipped[(i + clipped.length - 1) % clipped.length][k])) >
        1e-7,
    );
    if (polygon.length < 3) return;
  }
  const p = polygon.map(([angle, y]) => {
    const q = hamraOuter(angle);
    return [q[0], y, q[1]];
  });
  for (let i = 1; i < p.length - 1; i++) tri(out, 'glass', [p[0], p[i], p[i + 1]], glass);
}
function buildHamra(out, level) {
  const cfg = settings[level];
  const limestone = [0.79, 0.735, 0.62],
    glass = [0.23, 0.35, 0.42],
    trim = [0.68, 0.7, 0.67];
  const segments = (cfg.angles * 3) / 4,
    occupiedTop = 351.2;
  // Matching fixed-angle/cut intersections keep the glazing and flares joined.
  const levels = [
    ...new Set([
      0,
      24,
      350,
      occupiedTop,
      ...Array.from({ length: Math.ceil(350 / cfg.step) }, (_, i) => i * cfg.step).filter(
        (y) => y < 350,
      ),
      ...Array.from({ length: cfg.angles / 4 + 1 }, (_, i) => (350 * i) / (cfg.angles / 4)),
    ]),
  ].sort((a, b) => a - b);
  const plan = [];
  for (let i = 0; i <= segments; i++) {
    const p = hamraGlassPoint(i / segments, 0);
    plan.push([p[0], p[2]]);
  }
  plan.push([-17, 2.1], [17, 2.1]);
  mappedSolid(out, 'foundation', clockwise(hamraCleanPlan(plan)), 0, 0.16, [0.6, 0.57, 0.5]);
  const lobby = {
    ...out,
    addTriangle(slot, ...args) {
      out.addTriangle(slot === 'glass' ? 'clear_glass' : slot, ...args);
    },
    addQuad(slot, ...args) {
      out.addQuad(slot === 'glass' ? 'clear_glass' : slot, ...args);
    },
  };
  const cells = (target, y0, y1, width, color) => {
    for (let i = 0; i < cfg.angles; i++) {
      const a0 = -Math.PI * 1.5 + (i * Math.PI * 2) / cfg.angles,
        a1 = a0 + (width ?? (Math.PI * 2) / cfg.angles);
      hamraClippedPane(
        target,
        [
          [a1, y0],
          [a0, y0],
          [a0, y1],
          [a1, y1],
        ],
        color,
      );
    }
  };
  const coverage = 0.055 / 2 + 0.055 / 4.2,
    mean = scope.sourceFacts.surfaceMeans.metal_painted;
  const bodyGlass = cfg.mult
    ? glass
    : glass.map((v, i) => v * (1 - coverage) + trim[i] * mean[i] * coverage);
  for (const [y0, y1] of [
    [0, 24],
    [24, 350],
    [350, occupiedTop],
  ])
    cells(y1 <= 24 ? lobby : out, y0, y1, null, bodyGlass);
  if (cfg.mult) {
    const metal = {
        ...out,
        addTriangle(_s, ...a) {
          out.addTriangle('metal', ...a);
        },
      },
      strip = {
        ...metal,
        addTriangle(slot, ref, p, n, uv, c) {
          metal.addTriangle(
            slot,
            ref,
            p.map((q) => [q[0] * 1.00035, q[1], q[2] * 1.00035]),
            n,
            uv,
            c,
          );
        },
      };
    for (let y = 4.2 * cfg.mult; y < occupiedTop; y += 4.2 * cfg.mult)
      cells(strip, y - 0.028, y + 0.028, null, trim);
    const every = Math.max(1, Math.round(cfg.mult));
    for (let i = 0; i < cfg.angles; i += every) {
      const a = -Math.PI * 1.5 + (i * Math.PI * 2) / cfg.angles;
      hamraClippedPane(
        strip,
        [
          [a + 0.001, 0],
          [a - 0.001, 0],
          [a - 0.001, occupiedTop],
          [a + 0.001, occupiedTop],
        ],
        trim,
      );
    }
  }
  // The limestone flares are separate continuous ruled surfaces, never windowed.
  for (const side of [-1, 1])
    for (let j = 1; j < levels.length; j++)
      for (let i = 0; i < cfg.wing; i++) {
        const p = [
          hamraWingPoint(side, i / cfg.wing, levels[j - 1]),
          hamraWingPoint(side, (i + 1) / cfg.wing, levels[j - 1]),
          hamraWingPoint(side, (i + 1) / cfg.wing, levels[j]),
          hamraWingPoint(side, i / cfg.wing, levels[j]),
        ];
        face(out, 'limestone', side < 0 ? p.toReversed() : p, limestone);
      }
  // Each south core window is cut through the stone plane with an angled deep reveal.
  // There is no full wall laid over the glass. Alternate bevels produce the photographed
  // changing shadows without baking the lighting into textures.
  const columns = cfg.columns,
    rows = cfg.rows,
    z = 2.1,
    wallColor =
      level === 'district' || level === 'skyline'
        ? limestone.map(
            (v, i) =>
              v * 0.82 +
              (0.18 * [0.12, 0.2, 0.23][i]) / scope.sourceFacts.surfaceMeans.stone_limestone[i],
          )
        : limestone,
    pierWidth = level === 'district' ? (34 / columns - (34 / 12 - 1.68)) / 2 : 0.84;
  if (!rows)
    face(
      out,
      'limestone',
      [
        [-17, 0.16, z],
        [17, 0.16, z],
        [17, occupiedTop, z],
        [-17, occupiedTop, z],
      ],
      wallColor,
    );
  else
    for (let row = 0; row < rows; row++) {
      const y0 = 0.16 + ((occupiedTop - 0.16) * row) / rows,
        y1 = 0.16 + ((occupiedTop - 0.16) * (row + 1)) / rows;
      const b = level === 'district' ? (y0 + y1) / 2 - (351.04 / 80 - 2.27) / 2 : y0 + 0.97,
        t = level === 'district' ? b + (351.04 / 80 - 2.27) : y1 - 1.3;
      for (const [low, high] of [
        [y0, b],
        [t, y1],
      ])
        face(
          out,
          'limestone',
          [
            [-17, low, z],
            [17, low, z],
            [17, high, z],
            [-17, high, z],
          ],
          wallColor,
        );
      // Adjacent cells share continuous stone piers rather than overlapping strips.
      for (let col = 0; col <= columns; col++) {
        const x = -17 + (34 * col) / columns,
          l = col ? x - pierWidth : -17,
          r = col < columns ? x + pierWidth : 17;
        face(
          out,
          'limestone',
          [
            [l, b, z],
            [r, b, z],
            [r, t, z],
            [l, t, z],
          ],
          wallColor,
        );
      }
      for (let col = 0; col < columns; col++) {
        const x0 = -17 + (34 * col) / columns,
          x1 = -17 + (34 * (col + 1)) / columns,
          l = x0 + pierWidth,
          r = x1 - pierWidth,
          inset = (col + row) % 2 === 0 ? 0.23 : -0.23;
        const outer = [
            [l, b, z],
            [r, b, z],
            [r, t, z],
            [l, t, z],
          ],
          inner = [
            [l + 0.12 + inset, b + 0.15, z - 1.02],
            [r - 0.12 + inset, b + 0.15, z - 1.02],
            [r - 0.12 + inset, t - 0.1, z - 1.02],
            [l + 0.12 + inset, t - 0.1, z - 1.02],
          ];
        for (let k = 0; k < 4; k++) {
          const n = (k + 1) % 4;
          face(out, 'limestone', [outer[k], outer[n], inner[n], inner[k]], limestone);
        }
        face(out, 'glass', inner, [0.12, 0.2, 0.23]);
      }
    }
  // Sloping crown: the east blade reaches412.6m while the western glass edge is lower.
  // No imaginary cylindrical cap or centered spire is added.
  const roofPlan = [],
    roofHeights = [];
  for (let i = 0; i <= segments; i++) {
    const p = hamraGlassPoint(i / segments, occupiedTop);
    roofPlan.push([p[0], p[2]]);
    roofHeights.push(hamraRoofHeight(i / segments));
    if (i === segments) break;
    const q = hamraGlassPoint((i + 1) / segments, occupiedTop),
      h0 = hamraRoofHeight(i / segments),
      h1 = hamraRoofHeight((i + 1) / segments);
    face(out, 'glass', [p, q, [q[0], h1, q[2]], [p[0], h0, p[2]]], bodyGlass);
    if (cfg.mult) {
      const at = (u, t) => {
        const base = lerp(p, q, u),
          height = h0 + (h1 - h0) * u;
        return [base[0] * 1.00035, occupiedTop + (height - occupiedTop) * t, base[2] * 1.00035];
      };
      if (i % Math.max(1, Math.round(cfg.mult)) === 0)
        face(out, 'metal', [at(0, 0), at(0.02, 0), at(0.02, 1), at(0, 1)], trim);
      const n = Math.max(1, Math.round((Math.max(h0, h1) - occupiedTop) / (4.2 * cfg.mult)));
      for (let j = 1; j < n; j++) {
        const t = j / n,
          w = 0.028 / Math.max(1, Math.max(h0, h1) - occupiedTop);
        face(out, 'metal', [at(0, t - w), at(1, t - w), at(1, t + w), at(0, t + w)], trim);
      }
    }
  }
  const westTop = 351.2,
    eastTop = 368.2;
  for (const side of [-1, 1])
    for (let i = 0; i < 1; i++) {
      const p = hamraWingPoint(side, i / 1, occupiedTop),
        q = hamraWingPoint(side, (i + 1) / 1, occupiedTop),
        innerHeight = side < 0 ? westTop : eastTop;
      const outerHeight = hamraRoofHeight(side < 0 ? 1 : 0);
      const a = [p[0], innerHeight + ((outerHeight - innerHeight) * i) / 1, p[2]],
        b = [q[0], innerHeight + ((outerHeight - innerHeight) * (i + 1)) / 1, q[2]];
      const quad = [p, q, b, a];
      // The first western corner intentionally meets the core at351.2m; omit its
      // zero-length edge while retaining the triangular start of the rising parapet.
      if (i === 0 && side < 0) tri(out, 'limestone', [p, b, q], limestone);
      else face(out, 'limestone', side < 0 ? quad.toReversed() : quad, limestone);
    }
  tri(
    out,
    'limestone',
    [
      [-17, occupiedTop, 2.1],
      [17, occupiedTop, 2.1],
      [17, eastTop, 2.1],
    ],
    limestone,
  );
  // Tessellate the same concave roof outline in plan, then lift its vertices to the
  // local sloping datum. A thin exposed coping gives the stone blade a real edge.
  roofPlan.push([-17, 2.1], [17, 2.1]);
  roofHeights.push(westTop, eastTop);
  // A fixed triangulation retains the non-planar roof at every viewing level.
  // Simplifying a plan before lifting it can change the height of its interior.
  const capPlan = Array.from({ length: 133 }, (_, i) => {
    const p = hamraGlassPoint(i / 132, occupiedTop);
    return [p[0], p[2]];
  });
  const capHeights = Array.from({ length: 133 }, (_, i) => hamraRoofHeight(i / 132));
  capPlan.push([-17, 2.1], [17, 2.1]);
  capHeights.push(westTop, eastTop);
  const roofProxy = {
    ...out,
    addTriangle(slot, _ref, p, _n, _uv, color) {
      const lifted = p.map((v) => {
        let best = 0,
          d = Infinity;
        capPlan.forEach((q, i) => {
          const e = Math.hypot(q[0] - v[0], q[1] - v[2]);
          if (e < d) {
            d = e;
            best = i;
          }
        });
        return [v[0], capHeights[best] - 0.22, v[2]];
      });
      tri(out, slot, lifted, color);
    },
  };
  mappedCap(roofProxy, 'metal', hamraCleanPlan(capPlan), 0, [0.62, 0.63, 0.6]);
  for (let i = 0; i < roofPlan.length; i++) {
    const k = (i + 1) % roofPlan.length,
      a = [roofPlan[i][0], roofHeights[i], roofPlan[i][1]],
      b = [roofPlan[k][0], roofHeights[k], roofPlan[k][1]];
    if (level !== 'closeup') {
      const dx = b[0] - a[0],
        dz = b[2] - a[2],
        len = Math.hypot(dx, dz),
        nx = (-dz / len) * 0.08,
        nz = (dx / len) * 0.08;
      face(
        out,
        'limestone',
        [
          [a[0] - nx, a[1] + 0.10231567, a[2] - nz],
          [b[0] - nx, b[1] + 0.10231567, b[2] - nz],
          [b[0] + nx, b[1] + 0.10231567, b[2] + nz],
          [a[0] + nx, a[1] + 0.10231567, a[2] + nz],
        ],
        limestone,
      );
    } else beam(out, 'limestone', a, b, 0.16, 0.22, limestone);
    face(out, 'limestone', [a, b, [b[0], b[1] - 0.28, b[2]], [a[0], a[1] - 0.28, a[2]]], limestone);
  }
  //24m north lobby lamella: inclined paired columns, nested diamond lattice and
  // horizontal ties sit behind the transparent facade, visible from outside.
  if (level !== 'skyline')
    for (let x = -14; x <= 14; x += 7)
      for (const sign of [-1, 1]) {
        const end = x + sign * 7.6;
        beam(out, 'limestone', [x, 0.45, -27.5], [end, 12, -28.2], 0.66, 0.82, [0.84, 0.81, 0.72]);
        beam(
          out,
          'limestone',
          [end, 12, -28.2],
          [x + sign * 3.7, 23.8, -27.7],
          0.64,
          0.82,
          [0.84, 0.81, 0.72],
        );
      }
  if (level !== 'skyline')
    for (const y of [6, 12, 18, 23.8])
      beam(out, 'limestone', [-24, y, -27.6], [24, y, -27.6], 0.25, 0.34, [0.84, 0.81, 0.72]);
  // Two rising curved metal branches carry the rectangular entrance canopy.
  for (const x of [-7.8, 7.8]) {
    box(out, 'metal', [x - 0.65, 0, -29.9], [x + 0.65, 0.26, -28.1], [0.69, 0.66, 0.6]);
    for (let i = 1; i <= cfg.branches; i++) {
      const point = (t) => [x, 0.4 + 7.6 * (1 - (1 - t) ** 2), -29 - 12 * t];
      beam(
        out,
        'metal',
        point((i - 1) / cfg.branches),
        point(i / cfg.branches),
        0.75,
        1.05,
        [0.69, 0.66, 0.6],
      );
    }
  }
  for (const zc of [-31, -34, -37, -40.5])
    beam(out, 'metal', [-13, 8.15, zc], [13, 8.15, zc], 0.21, 0.42, [0.7, 0.68, 0.62]);
  for (const x of [-13, 13])
    beam(out, 'metal', [x, 8.15, -29], [x, 8.15, -41], 0.36, 0.58, [0.7, 0.68, 0.62]);
  face(
    out,
    'clear_glass',
    [
      [-13, 8.1, -29],
      [13, 8.1, -29],
      [13, 8.1, -41],
      [-13, 8.1, -41],
    ],
    [0.82, 0.87, 0.88],
  );
  if (level !== 'skyline')
    for (const x of [-9, -3, 3, 9]) {
      for (const side of [-1, 1])
        beam(
          out,
          'metal',
          [x + side * 1.1, 0.18, -29.32],
          [x + side * 1.1, 3.6, -29.32],
          0.1,
          0.13,
          [0.42, 0.45, 0.43],
        );
      beam(
        out,
        'metal',
        [x - 1.1, 3.6, -29.32],
        [x + 1.1, 3.6, -29.32],
        0.1,
        0.13,
        [0.42, 0.45, 0.43],
      );
    }
}

function build(out, level) {
  const target =
    level === 'skyline'
      ? Object.fromEntries(
          ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
            name,
            (slot, _ref, p, n, uv, c) => {
              const mean = slot.includes('glass')
                ? null
                : scope.sourceFacts.surfaceMeans[
                    slot === 'metal' ? 'metal_painted' : 'stone_limestone'
                  ];
              out[name](
                'silhouette',
                'palette:#ffffff',
                p,
                n,
                uv,
                mean ? c.map((v, i) => v * mean[i]) : c,
              );
            },
          ]),
        )
      : out;
  buildHamra(target, level);
}
export const buildHamraReviewedMaster = (out) => build(out, 'closeup');
export const buildHamraSkyline = (out) => build(out, 'skyline');
export const buildHamraDistrict = (out) => build(out, 'district');
export const buildHamraStreet = (out) => build(out, 'street');
export const buildHamraCloseup = (out) => build(out, 'closeup');
