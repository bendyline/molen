/** Parliament Hill's standing Centre, East and West blocks, including the Peace Tower. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const mapped = read('map-frame.json').geometry;
const d = plan.dimensions;
const palette = 'palette:#ffffff';
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.93, metallic: 0 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.83, metallic: 0.22 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.9, metallic: 0 },
  glass: { slot: 'window', localRef: palette, roughness: 0.35, metallic: 0.08 },
  dial: { slot: 'trim', localRef: palette, roughness: 0.74, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    centre: 'a69b87',
    west: '958774',
    east: 'a39073',
    trim: 'c1b29a',
    shade: '8f816e',
    arch: 'ad856a',
    copper: '668679',
    oldCopper: '507367',
    slate: '474d52',
    black: '374041',
    glass: '455156',
    court: '879da4',
    ribs: '737e80',
    dial: 'e4ddc1',
    gold: 'b19660',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const up = [0, 1, 0];

function face(out, slot, p, n, color) {
  if (p.length === 4) quad(out, slot, p, n, color);
  else out.addConvexPolygon(slot, palette, p, n, ([x, y, z]) => [x + z, y], color);
}

function planar(out, slot, ring, holes, y, n, color) {
  const base = new MeshBufferBuilder();
  if (
    !base.addCap(
      slot,
      palette,
      ring,
      holes,
      () => y,
      n,
      (p) => p,
      color,
    )
  )
    throw new Error('Cannot triangulate mapped Parliament Hill outline');
  const mesh = base.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = Array.from(mesh.indices.slice(i, i + 3), (j) =>
      Array.from(mesh.positions.slice(j * 3, j * 3 + 3)),
    );
    out.addTriangle(
      slot,
      palette,
      points,
      n,
      points.map(([x, , z]) => [x, z]),
      color,
    );
  }
}

function stableRing(ring, level) {
  if (level > 0) return ring;
  const outline = [...ring];
  const points = Math.max(8, Math.round(ring.length / 3.7));
  while (outline.length > points) {
    let least = Infinity;
    let remove = 0;
    for (const [i, [x, z]] of outline.entries()) {
      const [ax, az] = outline.at(i - 1);
      const [bx, bz] = outline[(i + 1) % outline.length];
      const area = Math.abs((bx - ax) * (z - az) - (bz - az) * (x - ax));
      if (area < least) {
        least = area;
        remove = i;
      }
    }
    outline.splice(remove, 1);
  }
  return outline;
}

function block(out, slot, x, z, w, depth, bottom, top, color) {
  box(out, slot, [x - w / 2, bottom, z - depth / 2], [x + w / 2, top, z + depth / 2], color);
}

function edges(ring, inside = false) {
  const area = ring.reduce((sum, [x, z], i) => {
    const [nx, nz] = ring[(i + 1) % ring.length];
    return sum + x * nz - nx * z;
  }, 0);
  const sign = Math.sign(area) * (inside ? -1 : 1);
  return ring.map(([ax, az], i) => {
    const [bx, bz] = ring[(i + 1) % ring.length];
    const length = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / length;
    const uz = (bz - az) / length;
    const n = [uz * sign, 0, -ux * sign];
    return {
      length,
      n,
      point: (u, y, offset = 0) => [ax + ux * u + n[0] * offset, y, az + uz * u + n[2] * offset],
    };
  });
}

function panel(out, slot, edge, u0, u1, y0, y1, offset, color) {
  const { point: p, n } = edge;
  face(
    out,
    slot,
    [p(u0, y0, offset), p(u1, y0, offset), p(u1, y1, offset), p(u0, y1, offset)],
    n,
    color,
  );
}

function lancet(out, edge, u, y, width, height, detail, surround = c.trim, offset = 0) {
  const shape = (slot, w, bottom, h, depth, color) => {
    const { point: p, n } = edge;
    face(
      out,
      slot,
      [
        p(u - w / 2, bottom, depth),
        p(u + w / 2, bottom, depth),
        p(u + w / 2, bottom + h * 0.69, depth),
        p(u, bottom + h, depth),
        p(u - w / 2, bottom + h * 0.69, depth),
      ],
      n,
      color,
    );
  };
  shape('trim', width + 0.26, y - 0.12, height + 0.31, offset + 0.044, surround);
  shape('glass', width, y, height, offset + 0.072, c.glass);
  if (detail < 3) return;
  panel(out, 'trim', edge, u - 0.051, u + 0.051, y, y + height * 0.89, offset + 0.103, c.shade);
  panel(
    out,
    'trim',
    edge,
    u - width * 0.5,
    u + width * 0.5,
    y + height * 0.55,
    y + height * 0.55 + 0.09,
    offset + 0.107,
    c.shade,
  );
  panel(
    out,
    'trim',
    edge,
    u - width * 0.63,
    u + width * 0.63,
    y - 0.2,
    y - 0.1,
    offset + 0.12,
    c.trim,
  );
}

function envelope(out, ring, holes, district, level) {
  const { floor, eaves, tint, rows, roof } = district;
  planar(out, roof, ring, holes, eaves, up, roof === 'slate' ? c.slate : c.oldCopper);
  if (level > 0) planar(out, 'wall', ring, [], floor, [0, -1, 0], tint);
  const perimeter = edges(ring);
  for (const hole of holes) perimeter.push(...edges(hole, true));
  for (const edge of perimeter) {
    const length = edge.length;
    panel(out, 'wall', edge, 0, length, floor, eaves, 0, tint);
    if (level < 1) continue;
    panel(out, 'trim', edge, 0, length, eaves - 0.62, eaves - 0.12, 0.055, c.trim);
    if (level < 2 || length < 2.8) continue;
    panel(out, 'trim', edge, 0, length, floor + 3.45, floor + 3.9, 0.045, c.shade);
    const bays = Math.max(1, Math.round(length / (level === 2 ? 4.9 : 3.8)));
    for (let i = 0; i < bays; i++) {
      const u = ((i + 0.5) * length) / bays;
      const width = Math.min(1.68, (length / bays) * 0.48);
      for (const [y, h] of rows) lancet(out, edge, u, y, width, h, level, district.arch);
    }
  }
}

function roof(out, slot, bounds, y, apex, tint, hip = true) {
  const [x0, z0, x1, z1] = bounds;
  const x = (x0 + x1) / 2;
  const z = (z0 + z1) / 2;
  const alongX = x1 - x0 >= z1 - z0;
  const endInset = hip ? Math.min(x1 - x0, z1 - z0) * 0.4 : 0;
  const a = alongX ? [x0 + endInset, apex, z] : [x, apex, z0 + endInset];
  const b = alongX ? [x1 - endInset, apex, z] : [x, apex, z1 - endInset];
  const p = [
    [x0, y, z0],
    [x1, y, z0],
    [x1, y, z1],
    [x0, y, z1],
  ];
  const faces = alongX
    ? [
        [p[0], p[1], b, a],
        [p[1], p[2], b],
        [p[2], p[3], a, b],
        [p[3], p[0], a],
      ]
    : [
        [p[0], p[1], a],
        [p[1], p[2], b, a],
        [p[2], p[3], b],
        [p[3], p[0], a, b],
      ];
  for (const [i, points] of faces.entries()) {
    const gable = !hip && points.length === 3;
    const normal = normalFor(...points);
    const direction = gable
      ? [
          [0, 0, -1],
          [1, 0, 0],
          [0, 0, 1],
          [-1, 0, 0],
        ][i]
      : up;
    const flip = normal.reduce((sum, component, j) => sum + component * direction[j], 0) < 0;
    face(
      out,
      gable ? 'wall' : slot,
      points,
      flip ? normal.map((v) => -v) : normal,
      gable ? c.centre : tint,
    );
  }
}

function square(x, z, w, depth = w) {
  return [
    [x - w / 2, z - depth / 2],
    [x + w / 2, z - depth / 2],
    [x + w / 2, z + depth / 2],
    [x - w / 2, z + depth / 2],
  ];
}

function pointedRoof(out, slot, x, z, y, w, height, tint) {
  const ring = square(x, z, w);
  for (const edge of edges(ring)) {
    const points = [edge.point(0, y), edge.point(edge.length, y), [x, y + height, z]];
    const normal = normalFor(...points);
    face(out, slot, points, normal[1] < 0 ? normal.map((v) => -v) : normal, tint);
  }
}

function turret(out, x, z, w, base, shoulder, peak, slot, level, wall = c.centre) {
  block(out, 'wall', x, z, w, w, base, shoulder, wall);
  if (level > 0) {
    block(out, 'trim', x, z, w + 0.4, w + 0.4, shoulder - 0.67, shoulder + 0.05, c.trim);
  }
  pointedRoof(
    out,
    slot,
    x,
    z,
    shoulder + 0.04,
    w + 0.5,
    peak - shoulder,
    slot === 'slate' ? c.slate : c.copper,
  );
  if (level > 1 && w > 2.5)
    for (const edge of edges(square(x, z, w)))
      lancet(out, edge, w / 2, shoulder - 3.8, w * 0.37, 2.9, level);
}

const districts = [
  {
    floor: d.centreFootY,
    eaves: d.centreMainEavesY,
    tint: c.centre,
    arch: c.trim,
    roof: 'copper',
    rows: [
      [1.3, 2.8],
      [5.8, 3.5],
      [11.2, 4.35],
      [17.35, 4.3],
      [23, 1.92],
    ],
    roofs: [
      [-85, -75, -65, -27, 35.1],
      [47, -74, 67, -26, 35.2],
      [-75, -84.9, 60, -64.5, d.centreRidgeY],
      [-66, -36, 50, -19, 35.9],
      [-66, -72, -48, -16.5, 36.6],
      [32, -71, 50, -16, 36.6],
      [-19, -63, 1.4, -26.5, 36.7],
    ],
    towers: [
      [-60, -19.8, 9.3, 23, 34.9, 44.2],
      [42.7, -19.8, 9.3, 23, 34.9, 44.2],
      [-79, -69, 6.8, 24, 32.1, 40.3],
      [61.3, -69.2, 6.5, 24, 32.1, 40.3],
    ],
  },
  {
    floor: -4.4,
    eaves: d.westEavesY,
    tint: c.west,
    arch: c.arch,
    roof: 'slate',
    rows: [
      [0.45, 2.5],
      [4.7, 3.5],
      [10.4, 4.25],
      [16.3, 2.8],
    ],
    roofs: [
      [-194.7, 23.4, -176.8, 74.2, d.westRidgeY],
      [-194.3, 69, -174, 130.3, d.westRidgeY],
      [-194.2, 116.5, -115.2, 131.7, 28.9],
      [-133.8, 68, -115.1, 124.2, 29.2],
      [-177.5, 67.2, -114.3, 81.8, 28.6],
    ],
    towers: [
      [-191.9, 128.2, 9.0, 15, 30.8, 41.2],
      [-118.9, 123, 8.5, 14, 33.3, 49.1],
      [-126.2, 74.4, 9.1, 14, 36.6, 53.1],
      [-152.4, 125, 6.3, 17, 26.0, 33.7],
    ],
  },
  {
    floor: -4.2,
    eaves: d.eastEavesY,
    tint: c.east,
    arch: c.arch,
    roof: 'copper',
    rows: [
      [0.95, 2.6],
      [5.6, 3.6],
      [11, 4.25],
      [16.4, 1.85],
    ],
    roofs: [
      [101.0, 42.5, 117.4, 120.8, d.eastRidgeY],
      [102.5, 35.6, 134.8, 46.5, 27.1],
      [154.5, 84.1, 166.4, 129.3, 27.6],
      [106.4, 116.8, 169.5, 129.3, d.eastRidgeY],
      [145.3, 48.0, 155.6, 94.8, 26.4],
    ],
    towers: [
      [103.2, 112.5, 9.7, 13.2, 26.3, 42.0],
      [104.3, 58.0, 8.8, 10, 26.5, 37.5],
      [168.1, 120.6, 8.6, 14, 27.1, 41.0],
      [157.4, 68.1, 8.3, 15, 26.2, 38.2],
    ],
  },
];

function dormers(out, district, level) {
  if (level < 2) return;
  const tint = district.roof === 'slate' ? c.slate : c.oldCopper;
  for (const [x0, z0, x1, z1, peak] of district.roofs) {
    const horizontal = x1 - x0 > z1 - z0;
    const span = horizontal ? x1 - x0 : z1 - z0;
    if (span < 30) continue;
    const count = Math.floor(span / (level === 2 ? 12 : 8.5));
    const y = district.eaves + (peak - district.eaves) * 0.23;
    for (const side of [-1, 1]) {
      for (let i = 0; i < count; i++) {
        const along = (i + 1) / (count + 1);
        const offset = side < 0 ? 0.13 : 0.87;
        const x = x0 + (x1 - x0) * (horizontal ? along : offset);
        const z = z0 + (z1 - z0) * (horizontal ? offset : along);
        const bounds = horizontal
          ? [x - 1.28, z - 1.1, x + 1.28, z + 1.1]
          : [x - 1.1, z - 1.28, x + 1.1, z + 1.28];
        block(
          out,
          'wall',
          x,
          z,
          bounds[2] - bounds[0],
          bounds[3] - bounds[1],
          y - 0.8,
          y + 1.22,
          district.tint,
        );
        roof(out, district.roof, bounds, y + 1.2, y + 2.33, tint, false);
        const index = horizontal ? (side < 0 ? 0 : 2) : side < 0 ? 3 : 1;
        const dormerEdge = edges(square(x, z, bounds[2] - bounds[0], bounds[3] - bounds[1]))[index];
        lancet(out, dormerEdge, dormerEdge.length / 2, y - 0.06, 0.86, 1.14, 2);
      }
    }
  }
}

function courtRoof(out, level) {
  const [x0, z0, x1, z1] = [-174.3, 80.4, -132.1, 116.5];
  const bottom = 21;
  const ridge = 24.8;
  roof(out, 'glass', [x0, z0, x1, z1], bottom, ridge, c.court, false);
  if (level === 0) return;
  const zm = (z0 + z1) / 2;
  const ribs = level === 3 ? 14 : 8;
  for (let i = 0; i <= ribs; i++) {
    const x = x0 + ((x1 - x0) * i) / ribs;
    const w = 0.12;
    for (const end of [z0, z1]) {
      const p = [
        [x - w, bottom + 0.04, end],
        [x + w, bottom + 0.04, end],
        [x + w, ridge + 0.04, zm],
        [x - w, ridge + 0.04, zm],
      ];
      const n = normalFor(...p);
      face(out, 'glass', p, n[1] < 0 ? n.map((v) => -v) : n, c.ribs);
    }
  }
}

function mackenzieTower(out, level) {
  const [x, z] = [-186, 33.0];
  const w = 16;
  const shoulder = 51.1;
  const peak = d.mackenzieTowerHeight;
  block(out, 'wall', x, z, w, w, -4.4, shoulder, c.west);
  block(out, 'trim', x, z, w + 0.77, w + 0.77, 49.8, 51.3, c.trim);
  const roofBase = square(x, z, w + 0.8);
  const waist = square(x, z, 4.2);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const p = [[...roofBase[i]], [...roofBase[j]], [...waist[j]], [...waist[i]]].map(
      ([px, pz], k) => [px, k < 2 ? shoulder : 72.6, pz],
    );
    const n = normalFor(...p);
    face(out, 'slate', p, n[1] < 0 ? n.map((v) => -v) : n, c.slate);
  }
  pointedRoof(out, 'slate', x, z, 72.6, 4.2, peak - 72.6, c.slate);
  for (const [px, pz] of square(x, z, w - 1.45))
    turret(out, px, pz, 2.2, 34.4, 52.6, 57.8, 'slate', level, c.west);
  if (level > 0)
    for (const edge of edges(square(x, z, w))) {
      lancet(out, edge, w / 2, 34.2, 5.8, 13.0, level);
      if (level > 1) {
        for (const u of [3.1, 12.9]) lancet(out, edge, u, 24.3, 1.54, 6.5, level, c.arch);
      }
    }
}

function clock(out, edge, middle, y, level) {
  const n = edge.n;
  const p = (u, h, offset) => edge.point(middle + u, y + h, offset);
  const sides = [12, 18, 26, 36][level];
  for (const [r, offset, tint] of [
    [2.84, 0.11, c.shade],
    [2.47, 0.17, c.dial],
  ]) {
    face(
      out,
      'dial',
      Array.from({ length: sides }, (_, i) => {
        const angle = (i * 2 * Math.PI) / sides;
        return p(Math.cos(angle) * r, Math.sin(angle) * r, offset);
      }),
      n,
      tint,
    );
  }
  if (level < 1) return;
  const hand = (angle, inner, outer, width, depth) => {
    const a = Math.sin(angle);
    const b = Math.cos(angle);
    face(
      out,
      'dial',
      [
        p(a * inner - b * width, b * inner + a * width, depth),
        p(a * inner + b * width, b * inner - a * width, depth),
        p(a * outer + b * width, b * outer - a * width, depth),
        p(a * outer - b * width, b * outer + a * width, depth),
      ],
      n,
      c.black,
    );
  };
  hand(Math.PI * 0.18, -0.12, 1.78, 0.105, 0.19);
  hand(-Math.PI * 0.31, -0.11, 1.33, 0.13, 0.2);
  if (level > 1) for (let i = 0; i < 12; i++) hand((i * Math.PI) / 6, 1.88, 2.25, 0.062, 0.199);
}

function peaceTower(out, level) {
  const [x, z] = [-8.73, -14.41];
  const foot = stableRing(mapped.peaceTower, level);
  const front = {
    length: 13,
    n: [0, 0, 1],
    point: (u, y, offset = 0) => [x - 6.5 + u, y, -8.01 + offset],
  };
  envelope(
    out,
    foot,
    [],
    { floor: -4.25, eaves: 17.1, tint: c.centre, rows: [], roof: 'copper' },
    level,
  );
  block(out, 'wall', x, z, 10.6, 10.65, 15.25, 60.1, c.centre);
  block(out, 'wall', x, z, 11.32, 11.32, 59.9, 70.65, c.centre);
  for (const [px, pz] of square(x, z, 9.6))
    turret(out, px, pz, 1.77, 15.4, 72.6, 78.3, 'copper', level);
  if (level > 0)
    for (const [y, w, h] of [
      [16.1, 13.0, 0.7],
      [29.1, 11.14, 0.71],
      [42.4, 11.25, 0.82],
      [58.6, 11.42, 0.8],
      [60, 11.76, 0.78],
      [69.6, 12.07, 0.95],
    ])
      block(out, 'trim', x, z, w, w, y, y + h, c.trim);
  pointedRoof(out, 'copper', x, z, 70.63, 11.66, 20.63, c.copper);
  block(out, 'dial', x, z, 0.25, 0.25, 90.95, d.peaceTowerHeight, c.gold);
  for (const edge of edges(square(x, z, 11.32))) clock(out, edge, edge.length / 2, 65.05, level);
  if (level > 0) {
    for (const edge of edges(square(x, z, 10.6, 10.65))) {
      for (const off of [-2.32, 0, 2.32])
        lancet(out, edge, edge.length / 2 + off, 45.3, 1.32, 11.5, level, c.shade);
      if (level > 1) {
        for (const y of [33.48, 38.18]) lancet(out, edge, edge.length / 2, y, 0.77, 2.7, level);
      }
    }
    lancet(out, front, 6.5, 0.65, 5.55, 10.35, level, c.trim);
  }
}

function eastPortal(out, level) {
  const x = 97.25;
  const z = 85.25;
  block(out, 'wall', x, z, 8.7, 10.8, -4.2, 16.4, c.east);
  roof(out, 'copper', [x - 4.47, z - 5.53, x + 4.47, z + 5.53], 16.36, 24.3, c.oldCopper, false);
  if (level < 1) return;
  const edge = edges(square(x, z, 8.7, 10.8))[3];
  lancet(out, edge, 5.4, 0.15, 3.3, 8.3, level);
  lancet(out, edge, 5.4, 10.0, 2.0, 4.3, level);
}

function draw(out, level) {
  for (const [i, district] of districts.entries()) {
    const ring = stableRing(mapped.polygons[i], level);
    const holes = i === 2 ? [stableRing(mapped.eastCourt, level)] : [];
    envelope(out, ring, holes, district, level);
    const tint = district.roof === 'slate' ? c.slate : c.copper;
    for (const [x0, z0, x1, z1, peak] of district.roofs)
      roof(out, district.roof, [x0, z0, x1, z1], district.eaves + 0.012, peak, tint);
    for (const tower of district.towers) turret(out, ...tower, district.roof, level, district.tint);
    dormers(out, district, level);
  }
  courtRoof(out, level);
  mackenzieTower(out, level);
  eastPortal(out, level);
  peaceTower(out, level);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [113, 146, 380];
const lookAt = [-12, 24, 37];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  wikidataId: plan.wikidataId,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Ottawa’s Parliament Hill precinct with the Centre Block, the 92.2 m Peace Tower, and the separate East and West blocks.',
  camera,
  lookAt,
  sunDirection: [113, 172, 185],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: ['stone_sandstone_raw', 'stone_sandstone', 'metal_copper', 'slate'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.27,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'centre-block-and-peace-tower', position: [32, 42, 131], lookAt: [-8.7, 43, -21] },
    { name: 'peace-tower-clock-and-pinnacles', position: [28, 78, 37], lookAt: [-8.7, 65.6, -15] },
    { name: 'west-block-and-glazed-court', position: [-85, 80, 178], lookAt: [-155, 33, 85] },
    { name: 'east-block-portal-and-courtyard', position: [67, 57, 188], lookAt: [132, 20, 79] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.7,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.06, surfaces },
      street: { export: 'street', errorMeters: 0.35, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.11, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original reconstruction from the CC0 Qualla photo, three verified public-domain exterior references, mapped footprints, official dimensions, and original NRCan elevation data.',
};
