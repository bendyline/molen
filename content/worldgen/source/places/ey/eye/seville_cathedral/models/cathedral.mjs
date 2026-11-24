import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { cleanRing } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  opening,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.97 },
  trim: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.94 },
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.97 },
  cap: { slot: 'roof', graph: 'stone_travertine', roughness: 0.94 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  copper: { slot: 'trim', graph: 'metal_copper', roughness: 0.83, metallic: 0.19 },
  gate: { slot: 'door', graph: 'wood_vertical', roughness: 0.97 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.75 },
};
const buff = rgb('b8a184'),
  pale = rgb('ccbb99'),
  cream = rgb('c4b08d'),
  roof = rgb('a49780');
const stoneTint = rgb('b3a289'),
  mortar = rgb('9c8665'),
  brick = rgb('b79476'),
  oxide = rgb('95684e');
const clay = rgb('9f674b'),
  glass = rgb('53584d'),
  oldDoor = rgb('4f5340'),
  cast = rgb('565950');
const angle = (site.planAngleDegrees * Math.PI) / 180;
const part = (id) => site.parts.find((p) => p.id === id);
const bounds = (r) =>
  [0, 1].flatMap((i) => [Math.min(...r.map((p) => p[i])), Math.max(...r.map((p) => p[i]))]);
const rect = (x, X, z, Z) => [
  [x, z],
  [x, Z],
  [X, Z],
  [X, z],
];
const midpoint = ([x, X, z, Z]) => [(x + X) / 2, (z + Z) / 2];
const floor = -2.15;

function placed(out) {
  const mesh = transform(out, -angle);
  mesh.addCap = (slot, ref, ring, holes, grade, n, uv, color) => {
    const scratch = new MeshBufferBuilder();
    if (!scratch.addCap('wall', ref, ring, holes, grade, n, uv, color)) return false;
    const { positions, indices } = scratch.finalize();
    for (let i = 0; i < indices.length; i += 3) {
      const p = [0, 1, 2].map((j) => positions.slice(3 * indices[i + j], 3 * indices[i + j] + 3));
      mesh.addTriangle(
        slot,
        ref,
        p,
        n,
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        color,
      );
    }
    return true;
  };
  return mesh;
}

function simple(r, tol) {
  const q = cleanRing(r);
  for (let i = q.length - 1; i >= 0 && q.length > 4; i--) {
    const a = q[(i + q.length - 1) % q.length],
      b = q[(i + 1) % q.length],
      p = q[i];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = Math.hypot(dx, dz) || 1;
    const along = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l;
    const d = Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / l;
    if (along >= 0 && along <= l && d < tol) q.splice(i, 1);
  }
  return q;
}

function panel(out, F, slot, a, b, y, h, d, tint) {
  const p = F.P;
  quad4(out, slot, p(a, y, d), p(b, y, d), p(b, h, d), p(a, h, d), tint);
}

function ringLoft(out, slot, x, z, levels, n, tint) {
  loft(
    out,
    slot,
    levels.map(([y, rx, rz = rx]) => radialRing(y, rx, rz, n, [x, z], Math.PI / 4)),
    tint,
  );
}

function buildingPart(out, p, detail) {
  const r = simple(p.ring, [0.95, 0.35, 0.09, 0.045][detail]);
  const [x, X, z, Z] = bounds(r),
    [cx, cz] = midpoint([x, X, z, Z]);
  const bottom = p.base || floor;
  let rise = p.rise;
  if (p.roof === 'pyramidal')
    rise = rise || Math.min(6, p.height - bottom - 0.45, (X - x + Z - z) * 0.77);
  if (p.roof === 'dome') rise = rise || Math.min(p.height - bottom - 0.28, (X - x + Z - z) * 0.29);
  if (p.roof === 'gabled') rise = rise || Math.min(p.height * 0.25, (X - x + Z - z) * 0.13);
  const top = p.height - rise;
  extrude(out, 'stone', r, bottom, top, buff, { topSlot: 'cap', topColor: roof });
  if (!rise) return;
  if (p.roof === 'dome') {
    const n = [6, 8, 12, 16][detail],
      rx = (X - x) * 0.495,
      rz = (Z - z) * 0.495;
    ringLoft(
      out,
      'cap',
      cx,
      cz,
      [
        [top, rx, rz],
        [top + rise * 0.49, rx * 0.83, rz * 0.83],
        [top + rise * 0.83, rx * 0.55, rz * 0.55],
        [p.height, rx * 0.09, rz * 0.09],
      ],
      n,
      roof,
    );
    return;
  }
  const axis = X - x > Z - z;
  if (p.roof === 'gabled') {
    const ridgeA = axis ? [x + (X - x) * 0.11, p.height, cz] : [cx, p.height, z + (Z - z) * 0.11];
    const ridgeB = axis ? [X - (X - x) * 0.11, p.height, cz] : [cx, p.height, Z - (Z - z) * 0.11];
    const shell = rect(x, X, z, Z).map(([x, z]) => [x, top, z]);
    if (axis) {
      tri(out, 'tile', shell[0], shell[1], ridgeA, clay);
      quad4(out, 'tile', shell[1], shell[2], ridgeB, ridgeA, clay);
      tri(out, 'tile', shell[2], shell[3], ridgeB, clay);
      quad4(out, 'tile', shell[3], shell[0], ridgeA, ridgeB, clay);
    } else {
      tri(out, 'tile', shell[1], shell[2], ridgeB, clay);
      quad4(out, 'tile', shell[2], shell[3], ridgeA, ridgeB, clay);
      tri(out, 'tile', shell[3], shell[0], ridgeA, clay);
      quad4(out, 'tile', shell[0], shell[1], ridgeB, ridgeA, clay);
    }
    return;
  }
  const points = outwardRing(r).map(([x, z]) => [x, top, z]);
  for (let i = 0; i < points.length; i++)
    tri(out, 'trim', points[i], points[(i + 1) % points.length], [cx, p.height, cz], pale);
}

function portals(out, detail) {
  if (!detail) return;
  for (const [x, z, w, h, arch] of [
    [-73.2, 3.5, 5.8, 12.8, 2.3],
    [-73.06, -16.1, 4.6, 10.9, 1.95],
    [-69.49, 28, 3.95, 9.8, 1.65],
    [7.1, -49.93, 5.75, 13.4, 2.55],
    [36.87, 60.01, 4.88, 9.35, 1.97],
  ]) {
    const F =
      z > 53 ? facade([x, z], [1, 0]) : z < -47 ? facade([x, z], [-1, 0]) : facade([x, z], [0, 1]);
    fbox(out, 'stone', F, -w * 0.71, w * 0.71, -0.2, h + 1.77, -1.03, 0.71, buff);
    opening(out, F, 0, 0.2, w, h, {
      head: 'pointed',
      rise: arch,
      glassSlot: 'gate',
      frameSlot: 'trim',
      frameWidth: 0.26,
      frameDepth: 0.24,
      frame: pale,
      glass: oldDoor,
      d: 0.82,
      sill: false,
      mullions: 0,
    });
    const p = F.P;
    tri(
      out,
      'trim',
      p(-w * 0.79, h + 1.21, 0.68),
      p(w * 0.79, h + 1.21, 0.68),
      p(0, h + 4.55, 0.68),
      pale,
    );
    if (detail >= 2 && w > 5) {
      const p = F.P,
        spring = h * 0.685,
        count = detail === 2 ? 3 : 5,
        segments = detail === 2 ? 5 : 9;
      // Stepped archivolts keep the portal readable from the street.
      for (let i = 0; i < count; i++) {
        const r = w * 0.44 + i * w * 0.042,
          rise = h * 0.32 + i * 0.42,
          d = 0.9 + i * 0.105,
          band = 0.18;
        const inner = pointedArch(r, rise, segments),
          outer = pointedArch(r + band, rise + band, segments);
        for (let j = 1; j < inner.length; j++) {
          const [a, y] = inner[j - 1],
            [b, Y] = inner[j],
            [c, H] = outer[j],
            [e, L] = outer[j - 1];
          quad4(
            out,
            'trim',
            p(a, spring + y, d),
            p(b, spring + Y, d),
            p(c, spring + H, d),
            p(e, spring + L, d),
            i % 2 ? cream : pale,
          );
        }
        for (const sign of [-1, 1])
          fbox(
            out,
            'trim',
            F,
            Math.min(sign * r, sign * (r + band)),
            Math.max(sign * r, sign * (r + band)),
            0.28,
            spring,
            -0.02,
            d,
            cream,
          );
      }
    }
    if (detail >= 2)
      for (const side of [-1, 1]) {
        const u = side * (w * 0.58),
          [x, , z] = p(u, 0, 0.86);
        ringLoft(
          out,
          'trim',
          x,
          z,
          [
            [0.14, 0.27],
            [h + 0.92, 0.22],
            [h + 2.08, 0.39],
            [h + 3.67, 0.075],
          ],
          detail === 3 ? 8 : 4,
          pale,
        );
      }
  }
}

function buttresses(out, detail) {
  const runs = [-59.5, -44.8, -30.15, -15.25, 18.33, 32.16, 45.61];
  const segments = detail >= 2 ? 9 : 3;
  for (const side of [-1, 1])
    for (const x of runs) {
      const z = side * 23.63,
        h = side > 0 ? 26.19 : 26.47;
      const innerZ = side > 0 ? 3.21 : -13.49,
        innerY = x > 43.4 ? 31.05 : 34.71;
      const w = detail >= 2 ? 1.42 : 1.13;
      abox(
        out,
        'trim',
        [x - w * 0.52, h - 1.2, z - w * 0.58],
        [x + w * 0.52, h + 3.48, z + w * 0.58],
        pale,
        { bottom: false },
      );
      ringLoft(
        out,
        'trim',
        x,
        z,
        [
          [h + 3.46, 0.75],
          [h + 6.64, 0.11],
        ],
        detail === 3 ? 6 : 4,
        pale,
      );
      for (let i = 1; i <= segments; i++) {
        const p = (t) => [
          x,
          h + (innerY - h) * t + Math.sin(t * Math.PI) * 2.23,
          z + (innerZ - z) * t,
        ];
        beam(out, 'stone', p((i - 1) / segments), p(i / segments), 0.94, 1.04, buff);
      }
    }
}

function clerestory(out, detail) {
  for (const id of [378332102, 378332103, 378332104, 378332106, 378332092, 378332094]) {
    const p = part(id),
      r = outwardRing(simple(p.ring, 0.36));
    for (const [i, a] of r.entries()) {
      const F = wallFace(a, r[(i + 1) % r.length]);
      if (F.length < 18) continue;
      const count = Math.ceil(F.length / 11.1);
      for (let j = 0; j < count; j++) {
        const u = (F.length * (j + 0.5)) / count,
          y = p.height - 7.32,
          w = 2.26;
        if (detail === 2) {
          panel(out, F, 'glass', u - w / 2, u + w / 2, y, y + 4.6, 0.068, glass);
          continue;
        }
        opening(out, F, u, y, w, 5.65, {
          head: 'pointed',
          rise: 1.25,
          frameSlot: 'trim',
          glass,
          frame: pale,
          mullions: 2,
          frameWidth: 0.14,
          frameDepth: 0.09,
          d: 0.077,
        });
      }
    }
  }
}

function roofParapets(out, detail) {
  for (const id of [
    378332092, 378332094, 378332102, 378332103, 378332104, 378332106, 378737971, 378737972,
  ]) {
    const p = part(id),
      r = outwardRing(simple(p.ring, 0.29));
    for (let i = 0; i < r.length; i++) {
      const F = wallFace(r[i], r[(i + 1) % r.length]);
      if (F.length < 8.57) continue;
      fbox(
        out,
        'trim',
        F,
        0.17,
        F.length - 0.18,
        p.height - 0.013,
        p.height + 0.21,
        -0.43,
        0.048,
        cream,
      );
      fbox(
        out,
        'trim',
        F,
        0.17,
        F.length - 0.18,
        p.height + 0.8,
        p.height + 1.02,
        -0.39,
        0.063,
        pale,
      );
      const n = Math.ceil(F.length / (detail === 3 ? 1.92 : 3.07));
      for (let j = 0; j < n; j++) {
        const u = (F.length * (j + 0.5)) / n;
        if (detail === 2) {
          panel(
            out,
            F,
            'trim',
            u - 0.143,
            u + 0.143,
            p.height + 0.201,
            p.height + 0.81,
            0.041,
            pale,
          );
          continue;
        }
        fbox(
          out,
          'trim',
          F,
          u - 0.143,
          u + 0.143,
          p.height + 0.201,
          p.height + 0.81,
          -0.43,
          0.041,
          pale,
        );
      }
    }
  }
}

function cornice(out, F, y, h, detail, d = 0.38) {
  fbox(out, 'trim', F, -0.13, F.length + 0.13, y, y + h, -0.18, d, pale);
  if (detail >= 2)
    fbox(
      out,
      'trim',
      F,
      -0.22,
      F.length + 0.22,
      y + h - 0.15,
      y + h + 0.11,
      -0.21,
      d + 0.18,
      cream,
    );
}

function arches(out, F, detail, length, start, y, top, depth, n, w, spring, slot = 'trim') {
  const p = F.P,
    step = length / n,
    seg = [2, 4, 8, 12][detail];
  for (let i = 0; i < n; i++) {
    const u = start + step * (i + 0.5),
      a = u - w / 2,
      b = u + w / 2,
      l = start + step * i,
      r = l + step;
    if (detail >= 2) {
      fbox(out, slot, F, l, a, y, top, -depth, 0, stoneTint);
      fbox(out, slot, F, b, r, y, top, -depth, 0, stoneTint);
    } else {
      panel(out, F, slot, l, a, y, top, 0, stoneTint);
      panel(out, F, slot, b, r, y, top, 0, stoneTint);
    }
    const arc = roundArch(w / 2, seg).map(([x, h]) => [u + x, spring + h]);
    for (let j = 1; j < arc.length; j++) {
      const [l, y] = arc[j - 1],
        [r, h] = arc[j];
      quad4(out, slot, p(l, y), p(r, h), p(r, top), p(l, top), cream);
      if (detail) quad4(out, slot, p(l, y, -depth), p(r, h, -depth), p(r, h), p(l, y), mortar);
    }
  }
}

function lozengePanel(out, F, left, right, bottom, top, detail) {
  const p = F.P;
  panel(out, F, 'brick', left, right, bottom, top, 0.066, mortar);
  for (const x of [left - 0.14, right + 0.14])
    panel(out, F, 'trim', x - 0.126, x + 0.126, bottom - 0.1, top + 0.15, 0.091, cream);
  if (detail < 2) return;
  const width = right - left,
    row = detail === 2 ? 1.07 : 0.82,
    cols = detail === 2 ? 3 : 4;
  const dx = width / cols,
    radius = detail === 2 ? 0.094 : 0.13;
  const segment = (a, b, y, Y) =>
    quad4(
      out,
      'brick',
      p(a - radius, y, 0.128),
      p(a + radius, y, 0.128),
      p(b + radius, Y, 0.128),
      p(b - radius, Y, 0.128),
      cream,
    );
  for (let y = bottom + 0.17; y + 2 * row < top; y += 2 * row)
    for (let j = 0; j < cols; j++) {
      const l = left + j * dx,
        r = l + dx,
        h = (l + r) / 2;
      segment(l, h, y + row, y + row * 2);
      segment(h, r, y + row * 2, y + row);
      segment(r, h, y + row, y);
      segment(h, l, y, y + row);
    }
}

function giralda(out, detail) {
  const [x, X, z, Z] = bounds(site.tower.ring),
    [cx, cz] = midpoint([x, X, z, Z]);
  const shaft = detail ? simple(site.tower.ring, 0.16) : rect(x, X, z, Z);
  const outline = outwardRing(rect(x - 0.035, X + 0.035, z - 0.035, Z + 0.035));
  extrude(out, 'brick', shaft, floor, 60.45, brick, { topSlot: 'trim', topColor: cream });
  if (detail)
    for (let i = 0; i < 4; i++) {
      const F = wallFace(outline[i], outline[(i + 1) % 4]),
        L = F.length;
      for (const f of [0.235, 0.765])
        lozengePanel(out, F, L * (f - 0.128), L * (f + 0.128), 22.0, 56.75, detail);
      for (const y of [24.9 + i * 0.65, 34.4 + i * 0.55, 43.9 + i * 0.42, 51.4 + i * 0.3]) {
        if (detail === 1) panel(out, F, 'glass', L * 0.391, L * 0.609, y, y + 4.85, 0.09, glass);
        else
          opening(out, F, L * 0.5, y, L * 0.26, 4.86, {
            head: 'round',
            rise: 1.24,
            glass: glass,
            frame: pale,
            frameSlot: 'trim',
            frameWidth: 0.24,
            frameDepth: 0.21,
            mullions: detail === 3 ? 2 : 0,
            sill: true,
            d: 0.19,
          });
      }
      cornice(out, F, 57.68, 0.67, detail, 0.32);
      if (detail >= 2)
        for (let j = 1; j <= 10; j++) {
          const u = (j * L) / 11,
            p = F.P;
          tri(out, 'trim', p(u - 0.5, 58.51, 0.2), p(u + 0.5, 58.51, 0.2), p(u, 59.79, 0.2), pale);
        }
    }
  const R = rect(x - 0.33, X + 0.29, z - 0.23, Z + 0.22),
    sides = outwardRing(R);
  abox(out, 'trim', [x - 0.45, 60.42, z - 0.44], [X + 0.43, 61.78, Z + 0.42], pale, {
    bottom: false,
  });
  abox(out, 'trim', [x - 0.48, 71.96, z - 0.47], [X + 0.46, 74.31, Z + 0.46], pale, {
    bottom: false,
  });
  for (let i = 0; i < 4; i++) {
    const e = wallFace(sides[i], sides[(i + 1) % 4]);
    arches(
      out,
      e,
      detail,
      e.length,
      0,
      61.73,
      72.08,
      0.53,
      detail ? 5 : 3,
      detail ? 1.71 : 2.53,
      69.57,
    );
    if (detail >= 2)
      for (let j = 0; j < 3; j++) {
        const [u, , v] = e.P(((j + 0.5) * e.length) / 3, 0, -0.73);
        ringLoft(
          out,
          'copper',
          u,
          v,
          [
            [64.88, 0.76],
            [65.43, 0.51],
            [67.1, 0.44],
            [67.38, 0.19],
          ],
          detail === 3 ? 10 : 6,
          cast,
        );
      }
  }
  const mid = part(378015536),
    narrow = part(378015535);
  const M = outwardRing(simple(mid.ring, 0.09)),
    nw = outwardRing(simple(narrow.ring, 0.09));
  abox(out, 'trim', [cx - 4.14, 74.28, cz - 4.11], [cx + 4.14, 75.18, cz + 4.11], pale);
  for (let i = 0; i < M.length; i++) {
    const e = wallFace(M[i], M[(i + 1) % M.length]);
    arches(out, e, detail, e.length, 0, 74.91, 82.52, 0.52, 1, 3.18, 79.51);
    if (detail >= 2) cornice(out, e, 82.24, 0.64, detail, 0.42);
  }
  extrude(out, 'trim', nw, 82.52, 83.43, cream);
  ringLoft(
    out,
    'trim',
    cx,
    cz,
    detail
      ? [
          [83.37, 2.89],
          [84.0, 2.96],
          [87.73, 2.64],
          [88.3, 2.92],
          [88.83, 2.63],
          [90.88, 1.8],
          [91.6, 1.89],
          [93.29, 0.59],
        ]
      : [
          [83.37, 2.89],
          [87.73, 2.64],
          [88.3, 2.92],
          [90.88, 1.8],
          [93.29, 0.59],
        ],
    [6, 8, 12, 16][detail],
    pale,
  );
  if (detail >= 2) {
    const count = detail === 3 ? 10 : 8;
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count;
      ringLoft(
        out,
        'trim',
        cx + 2.65 * Math.cos(a),
        cz + 2.65 * Math.sin(a),
        [
          [84.02, 0.19],
          [87.64, 0.16],
          [87.82, 0.22],
        ],
        6,
        cream,
      );
    }
  }
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      ringLoft(
        out,
        'trim',
        cx + sx * 6.11,
        cz + sz * 6.15,
        detail
          ? [
              [73.3, 0.65],
              [74.44, 0.43],
              [75.27, 0.27],
              [76.15, 0.09],
            ]
          : [
              [73.3, 0.65],
              [76.15, 0.09],
            ],
        detail >= 2 ? 8 : 4,
        pale,
      );
  ringLoft(
    out,
    'copper',
    cx,
    cz,
    detail
      ? [
          [site.tower.roofHeight, 0.47],
          [94.23, 0.49],
          [95.25, 0.37],
          [96.56, 0.52],
          [96.8, 0.28],
          [97.52, 0.15],
        ]
      : [
          [site.tower.roofHeight, 0.47],
          [96.56, 0.52],
          [97.52, 0.15],
        ],
    detail >= 2 ? 10 : 5,
    cast,
  );
  const banner = [
    [cx + 0.32, 96.95, cz + 0.02],
    [cx + 2.92, 97.16, cz + 0.31],
    [cx + 3.16, 95.95, cz + 0.35],
    [cx + 0.37, 95.55, cz + 0.02],
  ];
  quad4(out, 'copper', ...banner, cast);
  quad4(out, 'copper', ...banner.toReversed(), cast);
  if (detail >= 2)
    beam(out, 'copper', [cx - 1.7, 96.91, cz], [cx + 0.43, 96.42, cz], 0.087, 0.095, cast);
}

const skylineIds = new Set([
  378332092, 378332093, 378332094, 378332099, 378332102, 378332103, 378332104, 378332105, 378332106,
  378332108, 378538890, 378538894, 378538901, 378538911, 378737964, 378737965, 378737966, 378737968,
  378737971, 378737972, 378737975, 378737984, 378737985, 928784394,
]);
const towerIds = new Set([site.tower.id, ...site.tower.mappedTiers]);
function build(out, detail) {
  const m = placed(out);
  if (detail)
    extrude(m, 'stone', simple(site.plan, 0.08), floor, 5.27, buff, {
      holes: site.courts,
      topSlot: 'cap',
      topColor: roof,
    });
  for (const p of site.parts)
    if (!towerIds.has(p.id) && (detail || skylineIds.has(p.id))) buildingPart(m, p, detail);
  giralda(m, detail);
  if (detail >= 1) portals(m, detail);
  if (detail >= 2) {
    buttresses(m, detail);
    clerestory(m, detail);
    roofParapets(m, detail);
  }
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
