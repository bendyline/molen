import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.96 },
  bed: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.98 },
  mosaic: { slot: 'trim', graph: 'tile_mosaic', roughness: 0.75 },
  glaze: { slot: 'roof', graph: 'tile_glazed', roughness: 0.64 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.94 },
};

const sand = rgb('b59b77');
const sandDark = rgb('a88965');
const sill = rgb('a29681');
const roofClay = rgb('9b8771');
const cyan = rgb('469aa4');
const teal = rgb('527b83');
const lapis = rgb('36586c');
const blue = rgb('386677');
const cream = rgb('c3ab82');
const wood = rgb('625144');
const angle = (site.planAngleDegrees * Math.PI) / 180;
const c = Math.cos(angle),
  s = Math.sin(angle);
const plan = (x, y, z) => [c * x - s * z, y, s * x + c * z];
const part = (id) => site.parts.find((item) => item.id === id);
const wingHeight = 34.1;
const eaves = 18.92;
const frontX = (z) => 30.07575 + 0.008273 * z;
const rearX = (z) => -34.63148 + 0.00454 * z;

function face(out, slot, points, color, toward) {
  let ring = points.map((p) => plan(...p).map(Math.fround));
  const [a, b, d] = ring;
  if (toward && normalFor(a, b, d).reduce((sum, n, i) => sum + n * toward[i], 0) < 0)
    ring = ring.toReversed();
  for (let i = 1; i < ring.length - 1; i++) {
    const tri = [ring[0], ring[i], ring[i + 1]];
    const normal = normalFor(...tri);
    if (Math.hypot(...normal) > 0.9) out.addTriangle(slot, '', tri, normal, [], color);
  }
}

function cap(out, slot, polygon, height, color) {
  const scratch = new MeshBufferBuilder();
  if (
    !scratch.addCap(
      'wall',
      'palette:#ffffff',
      polygon,
      [],
      () => height,
      [0, 1, 0],
      (p) => p,
      color,
    )
  )
    throw Error('Invalid mausoleum roof outline');
  const { positions, indices } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = [0, 1, 2].map((offset) => {
      const j = indices[i + offset] * 3;
      return positions.slice(j, j + 3);
    });
    face(out, slot, points, color, [0, 1, 0]);
  }
}

function course(out, slot, polygon, floor, ceiling, color, top = color) {
  const area = polygon.reduce((sum, [x, z], i) => {
    const [a, b] = polygon[(i + 1) % polygon.length];
    return sum + x * b - a * z;
  }, 0);
  const ring = area < 0 ? polygon : polygon.toReversed();
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i];
    const [a, b] = ring[(i + 1) % ring.length];
    face(
      out,
      slot,
      [
        [x, floor, z],
        [a, floor, b],
        [a, ceiling, b],
        [x, ceiling, z],
      ],
      color,
    );
  }
  cap(out, slot, ring, ceiling, top);
}

function pointedArch(t, spring, height, offset = 0.19) {
  const d = (Math.abs(t - 0.5) + offset) / (0.5 + offset);
  return (
    spring +
    ((height - spring) * Math.sqrt(Math.max(0, 1 - d * d))) /
      Math.sqrt(1 - Math.pow(offset / (0.5 + offset), 2))
  );
}

function portal(out, p, nearX, detail, front) {
  const segments = [8, 12, 20, 28][detail];
  const direction = front ? 1 : -1;
  const [inner, exterior] = [plan(-direction, 0, 0), plan(direction, 0, 0)];
  const center = 0;
  const left = center - p.width / 2;
  const coords = (i) => {
    const z = left + (p.width * i) / segments;
    return [z, pointedArch(i / segments, p.spring, p.height, front ? 0.55 : 0.19)];
  };
  const chamfer = front ? 0.46 : 0.31;
  const wide = p.width / 2 + p.pierWidth;
  const crest = (z) => (front ? p.crown - Math.abs(z) * 0.45 : p.crown);
  const outerBack = p.back - direction * 0.56;
  for (let i = 0; i < segments; i++) {
    const [z, y] = coords(i),
      [b, h] = coords(i + 1);
    const outerArch = [
      [nearX(z), y, z],
      [nearX(b), h, b],
    ];
    const backArch = [
      [p.back, y, z],
      [p.back, h, b],
    ];
    face(
      out,
      'brick',
      [outerArch[0], outerArch[1], [nearX(b), crest(b), b], [nearX(z), crest(z), z]],
      sand,
      exterior,
    );
    face(out, 'brick', [outerArch[1], outerArch[0], ...backArch], sandDark, [0, -1, 0]);
    if (front)
      face(
        out,
        'brick',
        [
          [p.back, y + 0.02, z],
          [p.back, h + 0.02, b],
          [p.back, eaves, b],
          [p.back, eaves, z],
        ],
        sandDark,
        exterior,
      );
    if (detail > 0) {
      const x = nearX(z) + direction * 0.045,
        a = nearX(b) + direction * 0.045;
      const z0 = z + ((z - center) * chamfer) / (p.width / 2);
      const z1 = b + ((b - center) * chamfer) / (p.width / 2);
      face(
        out,
        front ? 'brick' : 'mosaic',
        [
          [x, y, z],
          [a, h, b],
          [a, h + chamfer, z1],
          [x, y + chamfer, z0],
        ],
        front ? cream : blue,
        exterior,
      );
    }
  }
  for (const side of [-1, 1]) {
    const z = center + (side * p.width) / 2;
    const outer = center + side * wide;
    const edge = plan(0, 0, -side);
    if (p.spring > eaves)
      face(
        out,
        'brick',
        [
          [nearX(z), eaves, z],
          [p.back, eaves, z],
          [p.back, p.spring, z],
          [nearX(z), p.spring, z],
        ],
        sandDark,
        edge,
      );
    const base = front ? eaves : p.spring;
    face(
      out,
      'brick',
      [
        [nearX(z), base, z],
        [nearX(outer), base, outer],
        [nearX(outer), crest(outer), outer],
        [nearX(z), crest(z), z],
      ],
      sand,
      exterior,
    );
    if (front) {
      face(
        out,
        'brick',
        [
          [nearX(outer), wingHeight, outer],
          [outerBack, wingHeight, outer],
          [outerBack, crest(outer), outer],
          [nearX(outer), crest(outer), outer],
        ],
        sandDark,
        plan(0, 0, side),
      );
      face(
        out,
        'brick',
        [
          [p.back, eaves, z],
          [p.back, eaves, outer],
          [p.back, crest(outer), outer],
          [p.back, crest(z), z],
        ],
        sand,
        inner,
      );
    }
    if (detail > 0) {
      const z2 = z + side * chamfer;
      face(
        out,
        front ? 'brick' : 'mosaic',
        [
          [nearX(z) + direction * 0.055, 0.2, z],
          [nearX(z2) + direction * 0.055, 0.2, z2],
          [nearX(z2) + direction * 0.055, p.spring + chamfer, z2],
          [nearX(z) + direction * 0.055, p.spring, z],
        ],
        front ? cream : blue,
        exterior,
      );
    }
  }
  if (front) {
    for (const side of [-1, 1]) {
      const z = side * wide;
      face(
        out,
        'brick',
        [
          [nearX(0), crest(0), 0],
          [nearX(z), crest(z), z],
          [outerBack, crest(z), z],
          [outerBack, crest(0), 0],
        ],
        roofClay,
        [0, 1, 0],
      );
      face(
        out,
        'brick',
        [
          [outerBack, eaves, 0],
          [outerBack, eaves, z],
          [outerBack, crest(z), z],
          [outerBack, crest(0), 0],
        ],
        sand,
        inner,
      );
    }
    return;
  }
  cap(
    out,
    'brick',
    [
      [nearX(-wide), -wide],
      [nearX(wide), wide],
      [p.back, wide],
      [p.back, -wide],
    ],
    p.crown,
    roofClay,
  );
}

function insetPanel(out, x, sign, z, width, floor, spring, crown, color, slot, detail) {
  const n = detail < 2 ? 8 : 14;
  const direction = plan(sign, 0, 0);
  const edge = (i) => [x, pointedArch(i / n, spring, crown), z + (i / n - 0.5) * width];
  face(
    out,
    slot,
    [
      [x, floor, z - width / 2],
      [x, floor, z + width / 2],
      [x, spring, z + width / 2],
      [x, spring, z - width / 2],
    ],
    color,
    direction,
  );
  for (let i = 0; i < n; i++) {
    const a = edge(i),
      b = edge(i + 1);
    face(out, slot, [[x, spring, a[2]], [x, spring, b[2]], b, a], color, direction);
  }
}

function dome(out, id, levels, slot, color, steps, ribs = 0) {
  const {
    center: [x, z],
    radius: r,
    height,
  } = part(id);
  const point = (i, [y, fraction]) => {
    const a = (2 * Math.PI * (i % steps)) / steps;
    const radius = (r + (ribs && y >= 20.7 ? 0.19 * Math.cos(ribs * a) : 0)) * fraction;
    return [x + radius * Math.cos(a), y, z + radius * Math.sin(a)];
  };
  for (let k = 1; k < levels.length; k++) {
    const lower = levels[k - 1],
      upper = levels[k];
    for (let i = 0; i < steps; i++) {
      const a = point(i, lower),
        b = point(i + 1, lower);
      const d = point(i, upper),
        f = point(i + 1, upper);
      const outward = plan(a[0] + b[0] - 2 * x, 0.3, a[2] + b[2] - 2 * z);
      const tint = Array.isArray(color[0]) ? color[(i + Math.floor(i / 5)) % color.length] : color;
      const drum = id === 1375026087 && lower[0] < 20.7;
      face(
        out,
        drum ? 'mosaic' : slot,
        [a, b, f, d],
        drum ? (lower[0] >= 20.05 ? lapis : cream) : tint,
        outward,
      );
    }
  }
  const last = levels.at(-1);
  for (let i = 0; i < steps; i++) {
    const a = point(i, last),
      b = point(i + 1, last);
    face(out, slot, [a, b, [x, height, z]], Array.isArray(color[0]) ? color[0] : color, [0, 1, 0]);
  }
}

function bands(out, detail) {
  for (const sign of [-1, 1]) {
    const at = (x, y, d = 0) => [x, y, sign * ((sign > 0 ? 22.998 : 22.89) + d)];
    const n = plan(0, 0, sign);
    const strip = (l, r, b, t, color) =>
      face(out, 'mosaic', [at(l, b), at(r, b), at(r, t), at(l, t)], color, n);
    strip(-32.21, 24.8, 15.96, 17.98, lapis);
    strip(-32.21, 24.8, 18.15, 18.42, blue);
    strip(-32.21, 24.8, 2.11, 2.7, teal);
    strip(-32.21, 24.8, 0.96, 1.31, blue);
    if (detail < 2) continue;
    for (let x = -29.5; x < 24; x += 3.55) {
      for (const y of [5.25, 9.15, 13.05]) {
        const points = [
          [x - 1.35, y],
          [x, y - 1.36],
          [x + 1.35, y],
          [x, y + 1.36],
        ];
        const core = [
          [x - 0.96, y],
          [x, y - 0.94],
          [x + 0.96, y],
          [x, y + 0.94],
        ];
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4;
          face(
            out,
            'mosaic',
            [points[i], points[j], core[j], core[i]].map(([a, b]) => at(a, b, 0.058)),
            i % 2 ? teal : blue,
            n,
          );
        }
        if (detail >= 3)
          face(
            out,
            'mosaic',
            [
              [x - 0.48, y],
              [x, y - 0.45],
              [x + 0.48, y],
              [x, y + 0.45],
            ].map(([a, b]) => at(a, b, 0.067)),
            sandDark,
            n,
          );
      }
      face(
        out,
        'mosaic',
        [
          [x - 1.3, 16.9],
          [x, 16.2],
          [x + 1.3, 16.9],
          [x, 17.68],
        ].map(([a, b]) => at(a, b, 0.055)),
        cream,
        n,
      );
    }
  }
  const outward = plan(-1, 0, 0);
  const rearStrip = (lo, hi, y, h, tint) =>
    face(
      out,
      'mosaic',
      [
        [-32.26, y, lo],
        [-32.26, y, hi],
        [-32.26, h, hi],
        [-32.26, h, lo],
      ],
      tint,
      outward,
    );
  for (const [lo, hi] of [
    [-22.8, -5.68],
    [5.68, 22.92],
  ]) {
    rearStrip(lo, hi, 15.67, 18.21, blue);
    rearStrip(lo, hi, 1.03, 3.22, teal);
    if (detail < 2) continue;
    for (let z = lo + 2; z < hi - 1.5; z += 3.4) {
      insetPanel(out, -32.28, -1, z, 1.14, 5.15, 8.38, 9.28, sandDark, 'brick', detail);
      for (const y of [3.65, 11.05, 13.52, 16.92]) {
        face(
          out,
          'mosaic',
          [
            [-32.29, y, z - 1.15],
            [-32.29, y - 0.78, z],
            [-32.29, y, z + 1.15],
            [-32.29, y + 0.78, z],
          ],
          y > 16 ? cream : teal,
          outward,
        );
      }
    }
  }
}

function mausoleum(out, detail) {
  course(out, 'bed', site.plan, -0.77, 0.055, sill);
  course(out, 'brick', site.shell[0], 0.056, eaves, sand, roofClay);
  for (const id of [1375026084, 1375026085]) {
    const polygon = part(id).outline;
    const turret = polygon.slice(2, 15);
    course(out, 'brick', polygon, eaves, wingHeight, sand, roofClay);
    course(out, 'brick', turret, wingHeight, 37.5, sandDark, roofClay);
  }
  portal(out, site.front, frontX, detail, true);
  // The tiled rear portal joins the lower roof and opens onto a short recessed chamber.
  portal(out, site.rear, rearX, detail, false);
  const main = [
    [18.65, 0.87],
    [20.55, 0.91],
    [22.5, 1],
    [24.35, 0.97],
    [26.6, 0.85],
    [28.9, 0.58],
    [30.56, 0.21],
  ];
  const ribbed = [
    [18.6, 0.91],
    [20.05, 0.91],
    [20.7, 0.91],
    [22.25, 0.99],
    [23.77, 0.86],
    [25.15, 0.54],
    [25.76, 0.25],
  ];
  const small = [
    [18.82, 1],
    [19.35, 0.94],
    [20.15, 0.72],
    [20.74, 0.43],
  ];
  dome(
    out,
    1375026088,
    detail > 0 ? main : [main[0], main[2], main[4], main[6]],
    'glaze',
    detail > 1 ? [cyan, cyan, rgb('509ca6')] : cyan,
    [12, 26, 48, 64][detail],
  );
  dome(
    out,
    1375026087,
    detail > 0 ? ribbed : [ribbed[0], ribbed[2], ribbed[3], ribbed[5]],
    'glaze',
    detail > 1 ? [teal, cyan, cyan] : cyan,
    [10, 20, 64, 96][detail],
    detail >= 2 ? 32 : 0,
  );
  dome(out, 1375026086, small, 'brick', sandDark, [8, 12, 24, 32][detail]);
  if (detail === 0) return;
  insetPanel(out, 21.915, 1, 0, 6.54, 0.1, 7.58, 10.23, cream, 'brick', detail);
  insetPanel(out, 21.945, 1, 0, 5.94, 0.1, 7.51, 9.87, sandDark, 'brick', detail);
  insetPanel(out, 21.968, 1, 0, 2.51, 0.1, 3.5, 4.13, wood, 'timber', detail);
  insetPanel(out, 21.915, 1, 0, 6.16, 13.11, 19.3, 22.1, cream, 'brick', detail);
  insetPanel(out, 21.941, 1, 0, 5.45, 13.33, 19.18, 21.66, sandDark, 'brick', detail);
  for (const z of [-1.55, 0, 1.55])
    insetPanel(out, 21.963, 1, z, 0.85, 16.05, 18.04, 19.28, wood, 'timber', detail);
  insetPanel(out, -31.88, -1, 0, 3.56, 0.1, 3.48, 5.25, wood, 'timber', detail);
  bands(out, detail);
  if (detail < 2) return;
  const span = detail === 3 ? 4.2 : 6.1;
  for (let z = -15.3; z < 17; z += span) {
    for (const y of [15.22, 22.06, 28.01, 32.21]) {
      if (
        Math.abs(z) < 7.69 &&
        y >= pointedArch(z / site.front.width + 0.5, site.front.spring, site.front.height, 0.55)
      )
        continue;
      const x = Math.abs(z) < 7.69 ? 21.9 : frontX(z);
      beam(
        out,
        'timber',
        plan(x - 0.12, y, z),
        plan(x + 0.56 + (Math.cos(y + z) + 1) * 0.43, y + 0.04, z),
        0.13,
        0.19,
        wood,
      );
    }
  }
}

export const buildSkyline = (out) => mausoleum(out, 0);
export const buildDistrict = (out) => mausoleum(out, 1);
export const buildStreet = (out) => mausoleum(out, 2);
export const buildCloseup = (out) => mausoleum(out, 3);
export const buildMaster = buildCloseup;
