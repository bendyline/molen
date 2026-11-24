import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.87 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.92 },
  foundation: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.97 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.91 },
};
const plaster = rgb('e5e3d5');
const chalk = rgb('f2eee0');
const plasterShadow = rgb('cbc9be');
const tiles = rgb('575b64');
const ridge = rgb('40464d');
const recess = rgb('3c3932');
const wood = rgb('64584b');
const granite = rgb('988e78');
const stones = ['958975', 'a19881', '827864', '998f77', 'a69984'].map(rgb);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const basis = (site.planAngleDegrees * Math.PI) / 180;
const sin = Math.sin(basis),
  cos = Math.cos(basis);
const toMap = ([x, y, z]) => [x * cos - z * sin, y, x * sin + z * cos];

function transformed(out) {
  return {
    addTriangle(slot, ref, points, normal, uv, color) {
      out.addTriangle(slot, ref, points.map(toMap), toMap(normal), uv, color);
    },
    addQuad(slot, ref, points, normal, uv, color) {
      out.addQuad(slot, ref, points.map(toMap), toMap(normal), uv, color);
    },
    addConvexPolygon(slot, ref, points, normal, uv, color) {
      out.addConvexPolygon(slot, ref, points.map(toMap), toMap(normal), uv, color);
    },
  };
}

function face(out, slot, points, color, toward) {
  const n = normalFor(...points);
  const normal =
    toward && n.reduce((dot, v, i) => dot + v * toward[i], 0) < 0 ? n.map((v) => -v) : n;
  if (points.length === 4) out.addQuad(slot, '', points, normal, [], color);
  else out.addTriangle(slot, '', points, normal, [], color);
}

const ring = (cx, cz, hx, hz) => [
  [cx - hx, cz - hz],
  [cx + hx, cz - hz],
  [cx + hx, cz + hz],
  [cx - hx, cz + hz],
];

function cap(out, slot, outline, height, normal, color) {
  const builder = new MeshBufferBuilder();
  if (
    !builder.addCap(
      'foundation',
      'palette:#ffffff',
      outline,
      [],
      () => height,
      normal,
      (p) => p,
      color,
    )
  )
    throw Error('Could not triangulate Himeji footprint');
  const { indices, positions } = builder.finalize();
  for (let k = 0; k < indices.length; k += 3) {
    const points = Array.from({ length: 3 }, (_, j) =>
      Array.from(positions.slice(indices[k + j] * 3, indices[k + j] * 3 + 3)),
    );
    face(out, slot, points, color, normal);
  }
}

function batter(out, outline, center, bottom, top, inset, detail) {
  const courses = [1, 4, 7, 12][detail];
  const point = ([x, z], t) => {
    const q = inset * (2 * t - t * t);
    return [lerp(x, center[0], q), lerp(bottom, top, t), lerp(z, center[1], q)];
  };
  for (let j = 0; j < courses; j++) {
    const a = j / courses,
      b = (j + 1) / courses;
    for (const [i, p] of outline.entries()) {
      const r = outline[(i + 1) % outline.length];
      const divisions =
        detail < 2
          ? 1
          : Math.max(
              1,
              Math.floor(Math.hypot(p[0] - r[0], p[1] - r[1]) / (detail === 2 ? 5.8 : 3.5)),
            );
      for (let k = 0; k < divisions; k++) {
        const x = mix(p, r, k / divisions),
          y = mix(p, r, (k + 1) / divisions);
        const color = detail > 1 ? stones[(i + j * 2 + k * 3) % stones.length] : granite;
        face(out, 'foundation', [point(x, a), point(x, b), point(y, b), point(y, a)], color);
      }
    }
  }
  const crown = outline.map((p) => [lerp(p[0], center[0], inset), lerp(p[1], center[1], inset)]);
  cap(out, 'foundation', crown, top, [0, 1, 0], granite);
  cap(out, 'foundation', outline, bottom, [0, -1, 0], granite);
}

/** Closed upturned tiled hip with plaster fascia and sloped soffit. */
function roof(out, cx, cz, hx, hz, eave, rise, detail, { ridgeAlongX = true, skirt = 0.94 } = {}) {
  const divisions = [1, 2, 3, 7][detail],
    spans = [1, 3, 4, 6][detail];
  const tx = ridgeAlongX ? hx * 0.72 : hx * 0.19;
  const tz = ridgeAlongX ? hz * 0.23 : hz * 0.74;
  const sections = Array.from({ length: divisions + 1 }, (_, j) => {
    const t = j / divisions;
    const x = lerp(hx, tx, t),
      z = lerp(hz, tz, t),
      c = ring(cx, cz, x, z);
    return c.flatMap((a, i) =>
      Array.from({ length: spans }, (_, n) => {
        const u = n / spans,
          [px, pz] = mix(a, c[(i + 1) % 4], u);
        const corner = Math.pow(Math.abs(2 * u - 1), 3.3);
        const curl = (1 - t) * (1 - t) * (0.08 + 0.58 * skirt * corner) + 0.1 * t * corner;
        return [px, eave + rise * Math.pow(t, 1.59) + curl, pz];
      }),
    );
  });
  for (let j = 1; j < sections.length; j++) {
    for (const [i, a] of sections[j - 1].entries()) {
      const k = (i + 1) % sections[j].length;
      face(out, 'tile', [a, sections[j][i], sections[j][k], sections[j - 1][k]], tiles, [0, 1, 0]);
    }
  }
  const top = sections.at(-1);
  for (let i = 0; i < top.length; i++)
    face(
      out,
      'tile',
      [top[(i + 1) % top.length], top[i], [cx, eave + rise + 0.12, cz]],
      ridge,
      [0, 1, 0],
    );
  const lip = sections[0];
  for (const [i, a] of lip.entries()) {
    const b = lip[(i + 1) % lip.length];
    const down = (p) => [p[0], p[1] - 0.22, p[2]];
    const inboard = (p) => [lerp(p[0], cx, 0.25), eave - 0.42, lerp(p[2], cz, 0.25)];
    face(out, 'plaster', [a, b, down(b), down(a)], chalk);
    face(out, 'plaster', [down(a), down(b), inboard(b), inboard(a)], plasterShadow, [0, -1, 0]);
    if (detail > 1) {
      const p = mix(a, b, 0.5),
        q = inboard(p),
        width = detail === 2 ? 0.13 : 0.18;
      beam(out, 'plaster', [q[0], eave - 0.4, q[2]], [p[0], p[1] - 0.28, p[2]], width, 0.2, chalk);
    }
  }
  if (detail > 0) {
    const endpoints = ridgeAlongX
      ? [
          [cx - tx, eave + rise + 0.12, cz],
          [cx + tx, eave + rise + 0.12, cz],
        ]
      : [
          [cx, eave + rise + 0.12, cz - tz],
          [cx, eave + rise + 0.12, cz + tz],
        ];
    beam(out, 'tile', ...endpoints, 0.23, 0.24, ridge);
  }
}

function gable(out, cx, z, eave, width, rise, direction, curved, detail) {
  const segments = detail === 0 ? 2 : curved ? 10 : 6;
  const at = (u) => {
    const arch = curved
      ? 0.65 + 0.24 * Math.cos(u * Math.PI) + 0.11 * Math.cos(2 * u * Math.PI)
      : Math.max(0, 1 - Math.abs(u));
    return [cx + (u * width) / 2, eave + rise * arch, z];
  };
  for (let i = 0; i < segments; i++) {
    const a = at((2 * i) / segments - 1),
      b = at((2 * (i + 1)) / segments - 1);
    const [x, y] = a,
      [xx, yy] = b;
    const behind = (p) => [p[0], p[1] - 0.09, z - direction * 1.65];
    face(out, 'tile', [a, b, behind(b), behind(a)], tiles, [0, 1, 0]);
    face(out, 'plaster', [a, b, [xx, yy - 0.2, z], [x, y - 0.2, z]], chalk, [0, 0, direction]);
    const lo = eave - 0.08;
    face(
      out,
      'plaster',
      [
        [x, lo, z],
        [xx, lo, z],
        [xx, Math.max(lo + 0.014, yy - 0.2), z],
        [x, Math.max(lo + 0.014, y - 0.2), z],
      ],
      plaster,
      [0, 0, direction],
    );
    if (detail > 1) beam(out, 'tile', [x, y + 0.02, z], [xx, yy + 0.02, z], 0.115, 0.14, ridge);
  }
}

function facade(out, cx, cz, hx, hz, lo, hi, detail, bays) {
  const corners = ring(cx, cz, hx, hz);
  for (const [i, p] of corners.entries()) {
    const q = corners[(i + 1) % 4],
      dx = q[0] - p[0],
      dz = q[1] - p[1];
    const normal = [dz, 0, -dx].map((v) => v / Math.hypot(dx, dz));
    const count = detail ? bays[i % 2] : 0;
    const at = (u, y, depth = 0) => [
      p[0] + u * dx - normal[0] * depth,
      y,
      p[1] + u * dz - normal[2] * depth,
    ];
    const panel = (a, b, y, z, slot = 'plaster', color = plaster, depth = 0) =>
      face(
        out,
        slot,
        [at(a, y, depth), at(b, y, depth), at(b, z, depth), at(a, z, depth)],
        color,
        normal,
      );
    if (!count) {
      panel(0, 1, lo, hi);
      continue;
    }
    const bottom = lerp(lo, hi, 0.26),
      top = lerp(lo, hi, 0.66);
    if (detail === 1) {
      panel(0, 1, lo, hi);
      for (let j = 0; j < count; j++) {
        const center = (j + 0.65) / (count + 0.3);
        const halfWidth = 0.23 / (count + 0.5);
        panel(center - halfWidth, center + halfWidth, bottom, top, 'timber', recess, -0.021);
      }
      continue;
    }
    panel(0, 1, lo, bottom);
    panel(0, 1, top, hi);
    let last = 0;
    for (let j = 0; j < count; j++) {
      const middle = (j + 0.65) / (count + 0.3),
        span = 0.23 / (count + 0.5);
      const a = middle - span,
        b = middle + span,
        depth = 0.23;
      panel(last, a, bottom, top);
      panel(a, b, bottom, top, 'timber', recess, depth);
      for (const side of [a, b])
        face(
          out,
          'plaster',
          [at(side, bottom), at(side, top), at(side, top, depth), at(side, bottom, depth)],
          plasterShadow,
          [dx / Math.hypot(dx, dz), 0, dz / Math.hypot(dx, dz)].map((v) => (side === a ? v : -v)),
        );
      face(
        out,
        'plaster',
        [at(a, bottom), at(b, bottom), at(b, bottom, depth), at(a, bottom, depth)],
        chalk,
        [0, 1, 0],
      );
      if (detail > 1) {
        const bars = detail === 3 ? 4 : 1;
        for (let k = 1; k <= bars; k++) {
          const u = lerp(a, b, k / (bars + 1));
          beam(
            out,
            'plaster',
            at(u, bottom, 0.085),
            at(u, top, 0.085),
            detail === 3 ? 0.075 : 0.115,
            0.08,
            chalk,
          );
        }
      }
      last = b;
    }
    panel(last, 1, bottom, top);
  }
  cap(out, 'plaster', corners, hi, [0, 1, 0], plaster);
}

function ridgeFigures(out, y, hx, detail) {
  if (!detail) return;
  for (const side of [-1, 1]) {
    const x = side * hx;
    const p = [
      [x, y, 0],
      [x + side * 0.21, y + 0.41, 0],
      [x + side * 0.05, y + 0.76, 0],
      [x - side * 0.23, y + 0.9, 0],
    ];
    for (let j = 1; j < p.length; j++)
      beam(out, 'tile', p[j - 1], p[j], 0.3 - 0.045 * j, 0.31 - 0.05 * j, ridge);
  }
}

function mainKeep(out, detail) {
  const main = site.mainOutline;
  batter(out, main, [0, 0], -1.2, 14.85, 0.129, detail);
  const floors = [
    [14.82, 19.52, 12.93, 10.87, 3.28, [9, 7]],
    [19.23, 24.16, 11.11, 9.54, 3.56, [8, 6]],
    [23.99, 29.52, 9.62, 8.14, 3.68, [7, 5]],
    [29.38, 34.95, 8.19, 6.86, 3.1, [5, 4]],
    [34.8, 41.38, 6.36, 5.43, 4.13, [4, 3]],
  ];
  for (const [i, [lo, hi, hx, hz, rise, bays]] of floors.entries()) {
    facade(
      out,
      0,
      0,
      hx,
      hz,
      lo,
      hi + 0.21,
      detail,
      detail === 1 ? bays.map((n) => Math.max(2, Math.floor(n * 0.65))) : bays,
    );
    const dx = 1.38 - i * 0.08,
      dz = 1.49 - i * 0.086;
    roof(out, 0, 0, hx + dx, hz + dz, hi, rise, detail);
    if (i === 1) gable(out, 0, hz + dz - 0.08, hi + 0.12, hx * 1.05, 1.81, 1, true, detail);
    if (i === 2) {
      gable(out, -hx * 0.45, hz + dz - 0.13, hi + 0.18, hx * 0.72, 2.34, 1, false, detail);
      gable(out, hx * 0.36, hz + dz - 0.13, hi + 0.18, hx * 0.75, 2.2, 1, false, detail);
      if (detail) gable(out, 0, -hz - dz + 0.12, hi, 8.2, 2.25, -1, true, detail);
    }
    if (i === 3) gable(out, 0.35, hz + dz - 0.13, hi + 0.15, hx * 1.06, 1.95, 1, false, detail);
    if (i === 4) {
      gable(out, 0, hz + dz - 0.12, hi + 0.13, hx * 1.04, 1.23, 1, true, detail);
      if (detail) gable(out, 0, -hz - dz + 0.12, hi + 0.13, hx * 1.0, 1.14, -1, true, detail);
      ridgeFigures(out, hi + rise + 0.08, (hx + dx) * 0.69, detail);
    }
  }
}

function smallKeep(out, cx, cz, hx, hz, base, height, detail) {
  const levels = 3;
  for (let i = 0; i < levels; i++) {
    const x = hx * (1 - 0.18 * i),
      z = hz * (1 - 0.17 * i),
      lo = base + (height * i) / levels - 0.13;
    const hi = base + (height * (i + 1)) / levels - (i === 2 ? 2.35 : 1.75);
    facade(out, cx, cz, x, z, lo, hi + 0.52, detail, i === 2 ? [3, 2] : [4, 3]);
    roof(out, cx, cz, x + 0.86, z + 0.93, hi, i === 2 ? 2.36 : 2.37, detail, {
      ridgeAlongX: hx >= hz,
    });
    if (i === 2)
      gable(out, cx, cz + z + 0.85, hi + 0.06, Math.min(x * 1.36, 5), 1.36, 1, false, detail);
  }
}

function gallery(out, [cx, cz, hx, hz, base], detail) {
  facade(out, cx, cz, hx, hz, base, base + 3.16, detail, hx > hz ? [6, 1] : [1, 4]);
  roof(out, cx, cz, hx + 0.72, hz + 0.65, base + 3.12, 1.88, detail, {
    ridgeAlongX: hx >= hz,
    skirt: 0.45,
  });
}

function build(destination, detail) {
  const out = transformed(destination);
  const westernSeat = 12.26;
  mainKeep(out, detail);
  batter(out, site.linkOutline, [-15.6, -19.0], -1.25, westernSeat, 0, detail > 1 ? 2 : 0);
  batter(out, site.eastOutline, [6.1, -17.2], -0.96, 12.2, 0.025, detail > 1 ? 2 : 0);
  for (const a of [
    [-31.27, -20.96, 4.67, 5.63, westernSeat, 14.1],
    [-27.7, -5.68, 5.16, 6.45, westernSeat, 12.1],
    [6.12, -17.04, 3.12, 3.03, 12.18, 13.3],
  ])
    smallKeep(out, ...a, detail);
  for (const g of [
    [-11.2, -25.54, 19.7, 2.76, westernSeat - 0.02],
    [-28.24, -12.87, 4.97, 2.57, westernSeat - 0.02],
    [-16.62, -18.32, 3.83, 3.69, westernSeat - 0.02],
    [5.93, -13.38, 2.55, 1.03, 12.19],
  ])
    gallery(out, g, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
