import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

export const surfaces = {
  step: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  ashlar: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.98 },
  drum: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94 },
  floor: { slot: 'foundation', graph: 'earth_rammed', roughness: 0.98 },
};

const blockColors = ['b1a083', 'b8a98e', '998c73', 'aaa184', 'c4b496', 'a09179'].map(rgb);
const soil = [rgb('8c8067'), rgb('8f855f')];
const tau = 2 * Math.PI;
const xz = ([x, , z]) => [x, z];
const color = (i) => blockColors[Math.abs(i) % blockColors.length];

function slab(out, slot, ring, bottom, top, tint) {
  extrude(out, slot, ring, bottom, top, tint, { top: false });
  const mesh = new MeshBufferBuilder();
  if (
    !mesh.addCap(
      'roof',
      'palette:#ffffff',
      ring,
      [],
      () => top,
      [0, 1, 0],
      (p) => p,
      tint,
    )
  )
    throw new Error('The native temple footprint must triangulate');
  const { positions, indices } = mesh.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (j) => positions.slice(j * 3, j * 3 + 3));
    out.addTriangle(slot, 'palette:#ffffff', points, [0, 1, 0], points.map(xz), tint);
  }
}

function podium(out, f, site, detail) {
  const { width: W, depth: D } = site.frame;
  const { grade: g, kind } = site;
  const apollo = kind === 'apollo';
  slab(out, 'step', site.outline, apollo ? -16.3 : -3.27, g - 1.39, color(2));
  for (const [i, [inset, low, high]] of [
    [0.19, -1.41, -0.98],
    [0.61, -1.03, -0.52],
    [1.06, -0.57, 0],
  ].entries()) {
    fbox(out, 'step', f, inset, W - inset, g + low, g + high, inset, D - inset, color(i));
    if (detail > 1) {
      const length = W - inset * 2;
      const blocks = Math.round(length / (detail === 3 ? 1.67 : 3.14));
      for (let j = 0; j < blocks; j++) {
        const u = inset + (j * length) / blocks;
        const U = inset + ((j + 1) * length) / blocks;
        const top = g + high - 0.095 - (j % 5) * 0.006;
        for (const d of [inset - 0.034, D - inset + 0.041]) {
          fbox(
            out,
            'ashlar',
            f,
            u + 0.036,
            U - 0.034,
            g + low + 0.04,
            top,
            d - 0.011,
            d + 0.016,
            color(j + i * 4),
          );
        }
      }
    }
  }
}

function drumStack(out, f, column, base, detail, apollo) {
  const { x, z, height, radius, drums, capital } = column;
  const at = xz(f.P(x, 0, z));
  const free = height - (capital ? (apollo ? 0.59 : 0.77) : 0);
  const offset = apollo ? 0.16 : 0.11;
  const radial = (y) => radius * (1 - (offset * y) / free + 0.028 * Math.sin((Math.PI * y) / free));
  const sides = [6, 10, 20, 40][detail];
  const runs = [1, 3, Math.min(6, drums), drums][detail];
  const rung = (y, size, i, salt, broken) => {
    const angle = (i * tau) / sides;
    const flute = detail > 1 && i % 2 === 1 ? (apollo ? 0.962 : 0.924) : 1;
    const chip = broken ? 0.075 * Math.sin(angle * 3.0 + salt * 0.9) : 0;
    const r = size * flute * (1 + (apollo ? 0.042 : 0.014) * Math.cos(angle * 5 + salt * 0.67));
    return [at[0] + r * Math.cos(angle), base + y + chip, at[1] + r * Math.sin(angle)];
  };
  for (let j = 0; j < runs; j++) {
    const y = (free * j) / runs,
      Y = (free * (j + 1)) / runs;
    const broken = detail > 0 && !capital && j === runs - 1;
    const seam = detail === 0 ? 0 : apollo ? 0.037 : 0.014;
    const r = radial(y),
      R = radial(Y),
      tint = color(j + (apollo ? Math.round(z) : 1));
    const rings = (
      detail === 3 && apollo
        ? [
            [y, r * 0.94],
            [y + 0.08, r],
            [Y - 0.09, R],
            [Y - seam, R * 0.94],
          ]
        : [
            [y, r],
            [Y - seam, R],
          ]
    ).map(([yy, rr], k, layers) =>
      Array.from({ length: sides }, (_, i) =>
        rung(yy, rr, i, j, broken && k === layers.length - 1),
      ),
    );
    for (let k = 1; k < rings.length; k++) {
      for (let i = 0; i < sides; i++) {
        const end = (i + 1) % sides;
        const a = rings[k - 1][i],
          b = rings[k][i],
          c = rings[k][end],
          d = rings[k - 1][end];
        tri(out, 'drum', a, b, c, tint);
        tri(out, 'drum', a, c, d, tint);
      }
    }
    if (j + 1 === runs || detail > 1) {
      const top = rings.at(-1);
      const hub = [at[0], base + Y - seam - (broken ? 0.055 : 0), at[1]];
      for (let i = 0; i < sides; i++) tri(out, 'drum', hub, top[(i + 1) % sides], top[i], tint);
    }
    // Small interior joint beads leave a dark groove without separating drums.
    if (j + 1 < runs)
      lathe(
        out,
        'ashlar',
        at,
        [
          [base + Y - seam - 0.004, R * 0.88, R * 0.88],
          [base + Y + 0.004, R * 0.88, R * 0.88],
        ],
        detail === 3 ? 12 : 6,
        color(2),
        { capTop: false },
      );
  }
  if (capital) {
    const crown = base + height;
    const echinus = radial(free);
    lathe(
      out,
      'drum',
      at,
      [
        [base + free - 0.058, echinus, echinus],
        [crown - 0.23, echinus * 1.32, echinus * 1.32],
      ],
      sides,
      color(0),
      { capTop: false },
    );
    const half = echinus * 1.38;
    fbox(out, 'ashlar', f, x - half, x + half, crown - 0.27, crown, z - half, z + half, color(4));
  }
}

function courses(out, f, site, detail) {
  const [left, right, near, far] = site.cella;
  const g = site.grade;
  fbox(
    out,
    'floor',
    f,
    left + 0.07,
    right - 0.07,
    g + 0.025,
    g + 0.16,
    near,
    far,
    soil[site.kind === 'apollo' ? 0 : 1],
  );
  const length = right - left;
  const sections = Math.ceil(length / (detail === 0 ? 7.1 : 2.62));
  const stride = length / sections;
  for (const [side, z] of [near, far].entries()) {
    for (let j = 0; j < sections; j++) {
      if (j % 7 === (side ? 5 : 2)) continue;
      const x = left + j * stride;
      const inset = detail === 0 ? 0.12 : 0.079 + (j % 3) * 0.056;
      const h = 0.32 + 0.097 * ((j * 7 + side * 3) % 5);
      fbox(
        out,
        'ashlar',
        f,
        x + inset,
        x + stride - inset,
        g,
        g + h,
        z - 0.78,
        z + 0.51,
        color(j + side),
      );
      if (detail > 0 && j % 5 !== 4 && j % 6 !== 1) {
        fbox(
          out,
          'ashlar',
          f,
          x + inset * 1.8,
          x + stride - inset * 1.6,
          g + h - 0.015,
          g + h + (j % 3 === 0 ? 0.61 : 0.34),
          z - 0.69,
          z + 0.46,
          color(j + side + 2),
        );
      }
    }
  }
  for (const x of [left + 0.15, right - 1.08]) {
    for (const [a, b] of [
      [near + 0.31, (near + far) / 2 - 1.36],
      [(near + far) / 2 + 1.4, far - 0.11],
    ]) {
      fbox(out, 'ashlar', f, x, x + 0.88, g, g + 0.68, a, b, color(1));
    }
  }
  if (detail === 0) return;
  const wide = site.frame.width,
    deep = site.frame.depth;
  const isApollo = site.kind === 'apollo';
  const count = isApollo ? 15 : 17;
  const remnants = [];
  for (let i = 0; i < count; i++) {
    const u = 3.17 + (i * (wide - 6.26)) / (count - 1);
    remnants.push([u, 2.77, i]);
    if (!isApollo || u < wide - 17.1) remnants.push([u, deep - 2.82, i + 2]);
  }
  for (let i = 1; i < 5; i++) {
    const z = 2.77 + (i * (deep - 5.54)) / 5;
    remnants.push([3.13, z, i + 6]);
    if (!isApollo || z < deep - 12.6) remnants.push([wide - 3.13, z, i + 9]);
  }
  for (const [u, z, i] of remnants) {
    if (site.columns.some((c) => Math.hypot(u - c.x, z - c.z) < 2.45) || i % 6 === 3) continue;
    const at = xz(f.P(u, g, z));
    const radius = 0.62 + 0.067 * (i % 6);
    lathe(
      out,
      'drum',
      at,
      [
        [g, radius, radius],
        [g + 0.22 + (i % 4) * 0.135, radius * 0.91, radius * 0.94],
      ],
      detail === 1 ? 6 : 11,
      color(i + 1),
    );
  }
}

function detachedDrum(out, f, x, z, g, index, detail) {
  const r = 0.59 + 0.1 * (index % 5);
  const L = 0.69 + 0.14 * (index % 4);
  const yaw = index * 1.756 + 0.1;
  const side = Math.cos(yaw),
    forward = Math.sin(yaw);
  const tilt = 0.13 - 0.045 * (index % 8),
    cy = g + r * 0.91;
  const sides = detail === 3 ? 16 : 10;
  const ring = (end) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (i * tau) / sides;
      const d = r * (1 - end * 0.108) * (1 + 0.075 * Math.sin(5 * a + index));
      return f.P(
        x + end * L * side - d * Math.cos(a) * forward,
        cy + end * tilt + d * Math.sin(a),
        z + end * L * forward + d * Math.cos(a) * side,
      );
    });
  const A = ring(-0.5),
    B = ring(0.5);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    tri(out, 'drum', A[i], B[i], B[j], color(index));
    tri(out, 'drum', A[i], B[j], A[j], color(index));
  }
  const end = (t) => f.P(x + t * L * side, cy + t * tilt, z + t * L * forward);
  const a = end(-0.5),
    b = end(0.5);
  for (let i = 0; i < sides; i++) {
    const k = (i + 1) % sides;
    tri(out, 'ashlar', a, A[i], A[k], color(index + 1));
    tri(out, 'ashlar', b, B[k], B[i], color(index + 2));
  }
}

function porticoPaving(out, f, site, detail) {
  const { width, depth } = site.frame;
  const apollo = site.kind === 'apollo';
  const ends = apollo ? [width - 8.74] : [4.96, width - 9.16];
  const rows = detail === 3 ? 9 : 6;
  const spacing = (depth - 8.7) / rows;
  for (const edge of ends)
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < 3; j++) {
        if ((i + j * 4) % 11 === 3) continue;
        const v = 4.4 + (i + (j % 2) * 0.21) * spacing;
        const u = edge + j * 1.26 + 0.06 * Math.sin(j + i * 2.4);
        const h = 0.038 + ((i + j) % 3) * 0.047;
        fbox(
          out,
          'step',
          f,
          u,
          u + 1.19,
          site.grade - 0.018,
          site.grade + h,
          v,
          v + spacing * 0.91,
          color(i * 3 + j),
        );
      }
}

function scatteredStone(out, f, site, detail) {
  const { width: W, depth: D } = site.frame;
  const apollo = site.kind === 'apollo';
  const fields = apollo
    ? [
        [W - 24, D - 6, 6.9, 1.85],
        [12.0, 5.42, 5.9, 1.46],
        [29, 8.27, 3.91, 1.12],
      ]
    : [
        [7.16, 6.62, 4.56, 2.62],
        [24.75, D - 5.63, 8.71, 2.28],
        [W - 9.45, D - 8.11, 6.85, 3.23],
        [W - 11.29, 5.35, 6.91, 2.52],
      ];
  const n = detail === 1 ? 3 : detail === 2 ? 8 : 15;
  for (const [j, [x, z, rx, rz]] of fields.entries()) {
    for (let i = 0; i < n; i++) {
      const a = 2.39996 * i;
      const scale = Math.sqrt((i + 0.5) / n);
      const u = x + Math.cos(a) * rx * scale,
        d = z + Math.sin(a) * rz * scale;
      const roll = i + j * 7;
      if (!apollo && detail > 1 && i % 3 !== 2) {
        detachedDrum(out, f, u, d, site.grade, roll, detail);
      } else {
        const plan = facade(xz(f.P(u, 0, d)), [Math.cos(roll * 1.33), Math.sin(roll * 1.33)]);
        const w = 0.37 + 0.122 * (roll % 4),
          h = 0.25 + 0.105 * (roll % 4);
        fbox(
          out,
          'ashlar',
          plan,
          -w,
          w,
          site.grade - 0.024,
          site.grade + h,
          -w * 0.73,
          w * 0.61,
          color(roll),
        );
      }
    }
  }
}

export function buildTempleRuin(out, site, detail) {
  const f = facade(site.frame.origin, site.frame.along);
  podium(out, f, site, detail);
  courses(out, f, site, detail);
  const apollo = site.kind === 'apollo';
  for (const column of site.columns) {
    const { x, z, radius } = column;
    fbox(
      out,
      'step',
      f,
      x - radius * 1.12,
      x + radius * 1.12,
      site.grade - 0.027,
      site.grade + 0.14,
      z - radius * 1.11,
      z + radius * 1.1,
      color(4),
    );
    drumStack(out, f, column, site.grade + 0.14, detail, apollo);
  }
  if (detail > 0) scatteredStone(out, f, site, detail);
  if (detail > 1) porticoPaving(out, f, site, detail);
}
