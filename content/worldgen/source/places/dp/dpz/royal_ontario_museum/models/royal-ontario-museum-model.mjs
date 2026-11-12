/** The Crystal, historic stone wings and former planetarium in the 2015 ROM complex. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  cross,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const requireFromWorldgen = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = requireFromWorldgen('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  s = plan.section,
  frame = read('map-frame');
const terrain = read('terrain-grid');
const [outline] = frame.geometry.polygons;
const features = frame.features.filter((item) => item.outline);
const get = (role) => features.find((item) => item.role === role);
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.92, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.88, metallic: 0 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  aluminum: { slot: 'wall', graph: 'metal_standing_seam', roughness: 0.73, metallic: 0.24 },
  roof: { slot: 'roof', graph: 'metal_copper', roughness: 0.82, metallic: 0.14 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.39, metallic: 0.08 },
};
const c = Object.fromEntries(
  Object.entries({
    stone: 'c5b69a',
    pale: 'cbbf9e',
    dressed: 'c9b89a',
    band: 'b0a487',
    concrete: 'a9a395',
    low: '989487',
    dome: 'd3d1c4',
    weathered: 'c5c5b9',
    roof: '77726b',
    copper: '887263',
    silver: 'c4c9cc',
    silverShade: 'aab2b8',
    bright: 'd1d6d7',
    glass: '344754',
    blue: '4d697b',
    shadow: '292f32',
    mullion: '49515a',
    seam: '949da5',
    glazingStone: '515048',
    stair: 'c4beb1',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const white = 'palette:#ffffff',
  up = [0, 1, 0],
  down = [0, -1, 0];

function face(out, slot, points, expected, tint) {
  if (points.length === 4) {
    const [a, b, d, e] = points;
    face(out, slot, [a, b, d], expected, tint);
    face(out, slot, [a, d, e], expected, tint);
    return;
  }
  const [a, b, d] = points;
  const n = cross(
    b.map((v, i) => v - a[i]),
    d.map((v, i) => v - a[i]),
  );
  if (Math.hypot(...n) < 0.00008) return;
  const oriented =
    n.reduce((sum, v, i) => sum + v * expected[i], 0) < 0 ? [...points].reverse() : points;
  const normal = normalFor(...oriented);
  out.addTriangle(
    slot,
    white,
    oriented,
    normal,
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    tint,
  );
}

function cap(out, slot, ring, height, expected, tint) {
  const triangles = earcut(ring.flat());
  if (!triangles.length) throw Error('Museum polygon could not be triangulated');
  for (let i = 0; i < triangles.length; i += 3) {
    const points = triangles.slice(i, i + 3).map((index) => {
      const [x, z] = ring[index];
      return [x, height(x, z), z];
    });
    face(out, slot, points, expected, tint);
  }
}
function signedRing(points) {
  const area = points.reduce((sum, [x, z], i) => {
    const [u, v] = points[(i + 1) % points.length];
    return sum + x * v - z * u;
  }, 0);
  return area > 0 ? points : [...points].reverse();
}

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    dx = u - i,
    dz = v - j;
  const [a, b] = terrain.heightsMeters.slice(j, j + 2);
  return (
    (a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dz) +
    (b[i] * (1 - dx) + b[i + 1] * dx) * dz -
    terrain.modelDatumElevationMeters
  );
}
const foot = (x, z) => Math.min(-0.24, ground(x, z) - 0.25);

function edgeBasis(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const tangent = [dx / length, dz / length],
    normal = [tangent[1], 0, -tangent[0]];
  const at = (u, h, offset = 0) => [
    a[0] + tangent[0] * u + normal[0] * offset,
    h,
    a[1] + tangent[1] * u + normal[2] * offset,
  ];
  return { a, b, length, normal, at };
}
function rectangle(out, slot, edge, lo, hi, low, top, d, tint) {
  if (hi - lo < 0.03 || top - low < 0.03) return;
  const { at, normal } = edge;
  face(out, slot, [at(lo, low, d), at(hi, low, d), at(hi, top, d), at(lo, top, d)], normal, tint);
}

function masonryOpening(out, edge, u, y, w, h, lod, accent = false) {
  const left = u - w / 2,
    right = u + w / 2;
  rectangle(out, 'glass', edge, left, right, y, y + h, 0.023, c.glazingStone);
  if (lod < 2) return;
  const { at } = edge;
  if (lod === 3) {
    beam(
      out,
      'trim',
      at(left - 0.1, y - 0.12, 0.087),
      at(right + 0.1, y - 0.12, 0.087),
      0.22,
      0.15,
      c.dressed,
    );
    beam(
      out,
      'trim',
      at(left - 0.13, y + h + 0.13, 0.075),
      at(right + 0.13, y + h + 0.13, 0.075),
      0.16,
      0.2,
      c.pale,
    );
  } else {
    rectangle(out, 'trim', edge, left - 0.1, right + 0.1, y - 0.17, y - 0.02, 0.039, c.dressed);
    rectangle(
      out,
      'trim',
      edge,
      left - 0.13,
      right + 0.13,
      y + h + 0.03,
      y + h + 0.24,
      0.035,
      c.pale,
    );
  }
  const columns = accent ? 3 : 2;
  for (let j = 1; j < columns; j++) {
    const p = left + ((right - left) * j) / columns;
    rectangle(out, 'trim', edge, p - 0.035, p + 0.035, y, y + h, 0.061, c.band);
  }
  rectangle(out, 'trim', edge, left, right, y + h * 0.63, y + h * 0.63 + 0.061, 0.062, c.band);
}

function heritageRange(out, feature, lod) {
  const ring = signedRing(feature.outline),
    h = Number(feature.properties.height);
  const floor = s.stoneFoundationTop;
  for (let i = 0; i < ring.length; i++) {
    const edge = edgeBasis(ring[i], ring[(i + 1) % ring.length]);
    if (edge.length < 0.025) continue;
    const { length, at, normal, a, b } = edge;
    face(
      out,
      'trim',
      [at(0, foot(...a)), at(length, foot(...b)), at(length, floor), at(0, floor)],
      normal,
      c.band,
    );
    rectangle(out, 'stone', edge, 0, length, floor, h, 0, i % 6 === 3 ? c.pale : c.stone);
    const midpoint = at(length / 2, 0);
    const visible = midpoint[2] < -10 || midpoint[0] > 42 || midpoint[0] < -20;
    if (!lod || !visible || length < 5.3) continue;
    const levels = lod >= 2 ? [3.04, 13.86, h - 1.39, h - 0.34] : [3.04, h - 0.42];
    for (const y of levels) {
      if (lod === 3)
        beam(out, 'trim', at(0, y, 0.038), at(length, y, 0.038), 0.22, 0.16, c.dressed);
      else rectangle(out, 'trim', edge, 0, length, y - 0.072, y + 0.072, 0.042, c.dressed);
    }
    const count = Math.max(1, Math.round(length / [11.0, 7.1, 5.5, 4.4][lod]));
    for (let j = 0; j < count; j++) {
      const pos = (length * (j + 0.5)) / count;
      const floors = lod === 1 ? [8.8, 15.0, 20.38] : s.heritageWindowFloors;
      for (const [k, y] of floors.entries()) {
        masonryOpening(out, edge, pos, y, k === 3 ? 1.3 : 1.66, k === 3 ? 1.98 : 2.71, lod);
      }
      if (lod === 3) {
        const position = at(pos + (length * 0.43) / count, floor, 0.12);
        const top = [position[0], h - 0.57, position[2]];
        beam(out, 'stone', position, top, 0.24, 0.29, c.pale);
      }
    }
  }
  cap(out, 'roof', ring, () => h, up, c.roof);
}

function annex(out, feature, lod, stonePart) {
  const ring = signedRing(feature.outline),
    p = feature.properties;
  const top = Number(p.height ?? 5.2);
  const low = p.min_height === undefined ? foot : () => Number(p.min_height);
  const slot = stonePart ? 'stone' : 'concrete',
    tint = stonePart ? c.stone : c.concrete;
  const span = ring.map(([, z]) => z);
  const extent = Math.max(...span) - Math.min(...span);
  const alongZ = extent < Math.max(...ring.map(([x]) => x)) - Math.min(...ring.map(([x]) => x));
  const run = ring.map((point) => point[alongZ ? 1 : 0]);
  const mid = (Math.max(...run) + Math.min(...run)) / 2;
  const half = (Math.max(...run) - Math.min(...run)) / 2;
  const rise =
    p['roof:shape'] === 'gabled' || p['roof:shape'] === 'pyramidal' ? Number(p['roof:height']) : 0;
  const wallTop = top - rise;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const edge = edgeBasis(a, b);
    const { at, normal, length } = edge;
    if (length < 0.035) continue;
    face(
      out,
      slot,
      [at(0, low(...a)), at(length, low(...b)), at(length, wallTop), at(0, wallTop)],
      normal,
      tint,
    );
    if (wallTop < 3 || length < 7.0) continue;
    if (lod) {
      rectangle(
        out,
        stonePart ? 'trim' : 'concrete',
        edge,
        0,
        length,
        wallTop - 0.42,
        wallTop - 0.2,
        0.052,
        stonePart ? c.dressed : c.low,
      );
    }
    if (
      stonePart &&
      lod &&
      length > 8.1 &&
      wallTop > 13 &&
      p.min_height === undefined &&
      (normal[0] < -0.45 || normal[2] < -0.5)
    ) {
      const count = Math.max(1, Math.round(length / (lod >= 2 ? 6.4 : 8.1)));
      for (let j = 0; j < count; j++)
        for (const y of lod === 1 ? [8.0, 14.3] : [3.7, 9.0, 14.3]) {
          if (y + 2.6 < wallTop)
            masonryOpening(out, edge, (length * (j + 0.5)) / count, y, 1.65, 2.32, lod);
        }
    }
    if (!stonePart && wallTop > 20 && (normal[2] < -0.3 || normal[0] < -0.35)) {
      for (const y of lod ? [7, 11.6, 16.2, 21] : [12, 20]) {
        rectangle(out, 'glass', edge, 0.58, length - 0.58, y, y + 1.04, 0.025, c.glazingStone);
      }
    }
  }
  if (!rise) {
    cap(out, 'roof', ring, () => top, up, c.roof);
    return;
  }
  if (p['roof:shape'] === 'pyramidal') {
    const center = ring.reduce(
      ([x, z], [u, v]) => [x + u / ring.length, z + v / ring.length],
      [0, 0],
    );
    for (let i = 0; i < ring.length; i++) {
      const [x, z] = ring[i],
        [u, v] = ring[(i + 1) % ring.length];
      face(
        out,
        'roof',
        [
          [x, wallTop, z],
          [u, wallTop, v],
          [center[0], top, center[1]],
        ],
        up,
        c.copper,
      );
    }
    return;
  }
  const roofPoint = (p) => [
    p[0],
    top - rise * Math.min(1, Math.abs(p[alongZ ? 1 : 0] - mid) / half),
    p[1],
  ];
  const index = alongZ ? 2 : 0;
  const triangles = earcut(ring.flat());
  for (let i = 0; i < triangles.length; i += 3) {
    const points = triangles.slice(i, i + 3).map((j) => [ring[j][0], wallTop, ring[j][1]]);
    for (const sign of [-1, 1]) {
      const side = clip(points, (p) => sign * (p[index] - mid));
      polygon(
        out,
        'roof',
        side.map((p) => roofPoint([p[0], p[2]])),
        up,
        c.copper,
      );
    }
  }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const edge = edgeBasis(a, b);
    const ends = [
      [a[0], wallTop, a[1]],
      [b[0], wallTop, b[1]],
    ];
    for (const sign of [-1, 1]) {
      const segment = clipLine(ends[0], ends[1], (p) => sign * (p[index] - mid));
      if (segment.length !== 2) continue;
      const [p, q] = segment,
        hi = roofPoint([p[0], p[2]]),
        high = roofPoint([q[0], q[2]]);
      face(out, 'stone', [p, q, high, hi], edge.normal, c.stone);
    }
  }
}

function clipLine(a, b, signed) {
  const p = signed(a),
    q = signed(b);
  if (p < 0 && q < 0) return [];
  if (p >= 0 && q >= 0) return [a, b];
  const t = p / (p - q),
    point = a.map((v, i) => v + (b[i] - v) * t);
  return p < 0 ? [point, b] : [a, point];
}

function clip(points, signed) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      p = signed(a),
      q = signed(b);
    if (p >= 0) out.push(a);
    if (p < 0 === q < 0) continue;
    const t = p / (p - q);
    if (t > 0.000001 && t < 0.999999) out.push(a.map((v, j) => v + (b[j] - v) * t));
  }
  return out;
}

function polygon(out, slot, points, expected, tint) {
  for (let i = 1; i + 1 < points.length; i++)
    face(out, slot, [points[0], points[i], points[i + 1]], expected, tint);
}

const diagonals = [
  { lo: -36, hi: -29.3, value: ([x, y, z]) => x - 0.45 * y + (z - 58) * 0.23, minX: -33, maxX: 7 },
  { lo: -10.0, hi: -4.4, value: ([x, y, z]) => x - 0.64 * y + (z - 57) * 0.11, minX: -8, maxX: 26 },
  { lo: 15.7, hi: 20.0, value: ([x, y, z]) => x - 0.58 * y + (z - 61) * 0.19, minX: 13, maxX: 49 },
  { lo: 35.0, hi: 36.65, value: ([x, y, z]) => x + 0.51 * y - (z - 61) * 0.2, minX: 12, maxX: 49 },
];

function crystalFacet(out, points, expected, tint, lod, decorate) {
  const normal = normalFor(...points);
  face(out, 'aluminum', points, expected, tint);
  if (!decorate || Math.abs(normal[2]) < 0.16 || points.every((p) => p[2] < 50)) return;
  const outward =
    normal.reduce((a, v, i) => a + v * expected[i], 0) < 0 ? normal.map((v) => -v) : normal;
  if (outward[2] < 0.16) return;
  const lift = (p, meters) => p.map((v, i) => v + outward[i] * meters);
  if (lod >= 2) {
    const projection = ([x, y, z]) => x + 0.39 * y + 0.12 * z;
    const values = points.map(projection);
    const spacing = lod === 3 ? 0.66 : 1.32;
    for (
      let p = Math.ceil(Math.min(...values) / spacing) * spacing;
      p < Math.max(...values);
      p += spacing
    ) {
      const band = clip(
        clip(points, (point) => projection(point) - p),
        (point) => p + 0.047 - projection(point),
      );
      polygon(
        out,
        'aluminum',
        band.map((point) => lift(point, 0.017)),
        outward,
        c.seam,
      );
    }
  }
  for (const ribbon of diagonals) {
    let aperture = clip(points, (p) => p[0] - ribbon.minX);
    aperture = clip(aperture, (p) => ribbon.maxX - p[0]);
    aperture = clip(aperture, (p) => ribbon.value(p) - ribbon.lo);
    aperture = clip(aperture, (p) => ribbon.hi - ribbon.value(p));
    if (aperture.length < 3) continue;
    polygon(
      out,
      'glass',
      aperture.map((p) => lift(p, 0.041)),
      outward,
      c.glass,
    );
    if (lod < 2) continue;
    const yValues = aperture.map((p) => p[1]);
    const bottom = Math.min(...yValues),
      top = Math.max(...yValues);
    const step = lod === 3 ? 1.74 : 2.67;
    for (let y = Math.ceil(bottom / step) * step; y < top; y += step) {
      const bar = clip(
        clip(aperture, (p) => p[1] - y),
        (p) => y + 0.055 - p[1],
      );
      polygon(
        out,
        'glass',
        bar.map((p) => lift(p, 0.071)),
        outward,
        c.mullion,
      );
    }
    const middle = (ribbon.lo + ribbon.hi) / 2;
    const bar = clip(
      clip(aperture, (p) => ribbon.value(p) - middle),
      (p) => middle + 0.073 - ribbon.value(p),
    );
    polygon(
      out,
      'glass',
      bar.map((p) => lift(p, 0.069)),
      outward,
      c.mullion,
    );
  }
}

function crystal(out, lod) {
  const base = get('crystal-ground-base');
  const ring = signedRing(base.outline),
    top = Number(base.properties.height);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      edge = edgeBasis(a, b);
    if (edge.length < 0.04) continue;
    const { at, length, normal } = edge;
    face(
      out,
      'glass',
      [at(0, foot(...a)), at(length, foot(...b)), at(length, top), at(0, top)],
      normal,
      normal[2] > 0.52 ? c.blue : c.shadow,
    );
    if (lod && normal[2] > 0.33 && length > 1.1) {
      beam(out, 'glass', at(0, 0.69, 0.08), at(length, 0.69, 0.08), 0.11, 0.13, c.mullion);
      beam(out, 'glass', at(0, 3.96, 0.08), at(length, 3.96, 0.08), 0.08, 0.1, c.mullion);
      const spacing = lod === 3 ? 1.23 : lod === 2 ? 1.85 : 2.74;
      for (let u = spacing; u < length - 0.18; u += spacing) {
        beam(out, 'glass', at(u, 0.62, 0.07), at(u, top - 0.05, 0.07), 0.079, 0.08, c.mullion);
      }
    }
  }
  cap(out, 'aluminum', ring, () => top, up, c.silverShade);
  const parts = features.filter((item) => item.role === 'mapped-crystal-skillion-part');
  for (const [index, part] of parts.entries()) {
    const ring = signedRing(part.outline),
      prop = part.properties,
      id = part.id.slice(4);
    const max = Number(prop.height),
      rise = Number(prop['roof:height']);
    const floor = Number(prop.min_height ?? s.crystalGroundPlane);
    const bearing = (Number(prop['roof:direction']) * Math.PI) / 180;
    const east = Math.sin(bearing),
      south = -Math.cos(bearing);
    const cH = Math.cos(frame.heading),
      sH = Math.sin(frame.heading);
    const xDir = east * cH - south * sH,
      zDir = east * sH + south * cH;
    const project = (x, z) => x * xDir + z * zDir;
    const samples = ring.map(([x, z]) => project(x, z));
    const lo = Math.min(...samples),
      hi = Math.max(...samples);
    const roofHeight = (x, z) =>
      Math.max(floor + 0.19, max - (rise * (project(x, z) - lo)) / (hi - lo));
    const center = ring.reduce(
      ([x, z], [u, v]) => [x + u / ring.length, z + v / ring.length],
      [0, 0],
    );
    const floorAt = (x, z) => {
      const onNorth = Math.min(1, Math.max(0, (z - 38) / 23));
      const weight = s.crystalInwardLeanMeters[id] * onNorth;
      const dx = (center[0] - x) * (floor >= 20 ? 0.024 : 0.096) * onNorth;
      return [x + dx, floor > 0.5 ? floor : foot(x + dx, z - weight), z - weight];
    };
    const topAt = (x, z) => [x, roofHeight(x, z), z];
    const bodyColor = index % 3 === 0 ? c.silverShade : c.silver;
    const tris = earcut(ring.flat());
    for (let i = 0; i < tris.length; i += 3) {
      const points = tris.slice(i, i + 3).map((j) => topAt(...ring[j]));
      crystalFacet(out, points, up, index % 4 === 0 ? c.bright : c.silver, lod, lod > 0);
    }
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        edge = edgeBasis(a, b);
      const lowA = floorAt(...a),
        lowB = floorAt(...b),
        highA = topAt(...a),
        highB = topAt(...b);
      crystalFacet(out, [lowA, lowB, highB], edge.normal, bodyColor, lod, lod > 0);
      crystalFacet(out, [lowA, highB, highA], edge.normal, bodyColor, lod, lod > 0);
    }
    if (floor > 0.5) {
      const low = ring.map((p) => floorAt(...p));
      cap(
        out,
        'aluminum',
        low.map(([x, , z]) => [x, z]),
        () => floor,
        down,
        c.silverShade,
      );
    }
  }
}

function entranceArches(out, lod) {
  if (!lod) return;
  const northEdge = edgeBasis([-52.44, 7.0], [-52.44, -11.7]);
  const southEdge = edgeBasis([-46.0, -73.34], [-33.6, -73.34]);
  for (const [edge, center, archWidth] of [
    [northEdge, 9.0, 7.55],
    [southEdge, 6.18, 6.72],
  ]) {
    const { at, normal } = edge;
    const spring = 14.5,
      rise = 3.15,
      base = 10.04,
      depth = 0.04;
    const count = lod === 3 ? 19 : lod === 2 ? 14 : 9;
    const ring = Array.from({ length: count + 1 }, (_, i) => {
      const a = (Math.PI * i) / count;
      return at(center - (archWidth / 2) * Math.cos(a), spring + rise * Math.sin(a), depth);
    });
    for (let i = 1; i < ring.length; i++) {
      face(
        out,
        'trim',
        [at(center, spring - 0.025, depth), ring[i - 1], ring[i]],
        normal,
        c.dressed,
      );
    }
    rectangle(
      out,
      'trim',
      edge,
      center - archWidth / 2,
      center + archWidth / 2,
      base,
      spring,
      depth,
      c.dressed,
    );
    const path = [
      at(center - archWidth / 2, base, depth + 0.055),
      ...ring.map((p) => [p[0] + normal[0] * 0.055, p[1], p[2] + normal[2] * 0.055]),
      at(center + archWidth / 2, base, depth + 0.055),
    ];
    beamPath(out, 'trim', path, 0.3, 0.28, c.pale);
    for (const shift of [-2.04, 0, 2.04])
      masonryOpening(out, edge, center + shift, 10.74, 1.65, 3.44, Math.min(2, lod), true);
    for (const shift of [-2.02, 0, 2.02]) {
      rectangle(
        out,
        'glass',
        edge,
        center + shift - 0.76,
        center + shift + 0.76,
        4.23,
        8.18,
        0.16,
        c.glazingStone,
      );
    }
    rectangle(out, 'glass', edge, center - 2.94, center + 2.94, 0.52, 3.23, 0.14, c.shadow);
    if (lod >= 2) {
      for (const shift of [-2.2, 0, 2.2]) {
        const diamond = [
          at(center + shift - 0.42, 15.16, 0.12),
          at(center + shift, 15.78, 0.12),
          at(center + shift + 0.42, 15.16, 0.12),
          at(center + shift, 14.53, 0.12),
        ];
        beamPath(out, 'trim', diamond, 0.12, 0.12, c.band, true);
      }
    }
  }
}

function planetarium(out, lod) {
  const feature = get('archived-mclaughlin-planetarium-envelope');
  const ring = signedRing(feature.outline);
  const { center, domeRadius, domeSpring, domeTop, podiumTop } = s.planetarium;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      edge = edgeBasis(a, b);
    const { length, at, normal } = edge;
    const h = normal[0] < -0.44 ? 3.58 : 1.25;
    face(
      out,
      'concrete',
      [at(0, foot(...a)), at(length, foot(...b)), at(length, h), at(0, h)],
      normal,
      c.low,
    );
    rectangle(out, 'concrete', edge, 0, length, h, podiumTop, 0, c.concrete);
    if (normal[0] < -0.44) {
      rectangle(out, 'glass', edge, 0.48, length - 0.49, 0.64, h - 0.08, 0.06, c.shadow);
      if (lod) {
        for (let u = 1.4; u < length - 0.81; u += lod >= 2 ? 1.77 : 2.8) {
          beam(out, 'glass', at(u, 0.63, 0.13), at(u, h - 0.09, 0.13), 0.078, 0.083, c.mullion);
        }
        beam(out, 'concrete', at(0, h, 0.12), at(length, h, 0.12), 0.33, 0.24, c.stair);
      }
    }
  }
  cap(out, 'concrete', ring, () => podiumTop, up, c.concrete);
  const segments = [12, 20, 30, 42][lod],
    layers = [4, 7, 10, 15][lod];
  loft(
    out,
    'glass',
    [
      radialRing(podiumTop - 0.18, domeRadius * 0.994, domeRadius * 0.994, segments, center),
      radialRing(domeSpring, domeRadius, domeRadius, segments, center),
    ],
    c.shadow,
  );
  const point = (i, j) => {
    const a = (-Math.PI * 2 * i) / segments,
      t = ((Math.PI / 2) * j) / layers;
    const r = domeRadius * Math.cos(t);
    return [
      center[0] + r * Math.cos(a),
      domeSpring + (domeTop - domeSpring) * Math.sin(t),
      center[1] + r * Math.sin(a),
    ];
  };
  for (let j = 0; j < layers; j++) {
    for (let i = 0; i < segments; i++) {
      const a = point(i, j),
        b = point(i + 1, j),
        v = point(i + 1, j + 1);
      const ring = j + 1 === layers ? [a, b, v] : [a, b, v, point(i, j + 1)];
      const angle = (-Math.PI * 2 * (i + 0.5)) / segments;
      face(
        out,
        'concrete',
        ring,
        [Math.cos(angle), j / layers, Math.sin(angle)],
        lod >= 2 && (i + j * 3) % 11 === 4 ? c.weathered : c.dome,
      );
    }
  }
}

function build(out, lod) {
  for (const part of features) {
    if (part.role.startsWith('historic-stone-range')) heritageRange(out, part, lod);
    else if (part.role === 'heritage-roof-and-masonry-part') {
      if (
        lod ||
        [
          'way/992716646',
          'way/992716648',
          'way/992716650',
          'way/992716653',
          'way/992716654',
          'way/992716655',
          'way/992716656',
        ].includes(part.id)
      )
        annex(out, part, lod, true);
    } else if (
      part.role.includes('connection') ||
      part.role === 'south-annex-base-part' ||
      part.role === 'queen-park-south-one-storey-range'
    )
      annex(out, part, lod, false);
    else if (lod && part.role === 'museum-steps-and-platform') annex(out, part, lod, false);
  }
  entranceArches(out, lod);
  crystal(out, lod);
  planetarium(out, lod);
}

export const museumSkyline = (out) => build(out, 0);
export const museumDistrict = (out) => build(out, 1);
export const museumStreet = (out) => build(out, 2);
export const museumCloseup = (out) => build(out, 3);

const recipe = 'royal-ontario-museum-model.mjs';
const camera = [135, 110, 177],
  lookAt = [0, 12.5, -11.3];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'museumDistrict', 0.52],
    ['street', 'museumStreet', 0.21],
    ['closeup', 'museumCloseup', 0.07],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);

export const museumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: museumCloseup,
  category: 'museum',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Toronto’s Royal Ontario Museum in 2015 with the sloping aluminum and glass Crystal, the two limestone wings, Queen’s Park entrance and the former planetarium.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'Named museum envelope and archived planetarium footprint from OpenStreetMap.',
    outlines: [outline, get('archived-mclaughlin-planetarium-envelope').outline],
  },
  mediumFiContext: {
    scale: 1.05,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_limestone_weathered',
    'stone_limestone',
    'concrete_plain',
    'metal_standing_seam',
    'metal_copper',
  ],
  qaCameras: [
    {
      name: 'bloor-crystal-cantilevers-and-glazing',
      position: [-13, 8.5, 145],
      lookAt: [4.1, 15.3, 60.2],
    },
    {
      name: 'queens-park-stone-entrance-and-tower',
      position: [-127, 22, 10],
      lookAt: [-43.7, 12.1, -8.7],
    },
    {
      name: 'mclaughlin-planetarium-and-south-wing',
      position: [-100, 11, -150],
      lookAt: [-29, 12.5, -79.5],
    },
    {
      name: 'whole-museum-heritage-wings-and-crystal',
      position: [-160, 113, 155],
      lookAt: [-4, 12.4, -9.5],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-royal-ontario-museum-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 1.25,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and two exact first-party CC0 Qualla photographs.',
};
