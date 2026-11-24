import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const { default: earcut } = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut');
const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const parts = new Map(
  read('native-map/blois-native-building-parts').features.map((p) => [p.way.id, p]),
);
const part = (id) => parts.get(String(id));
const ringOf = (id) => outwardRing(part(id).outline);

const pale = rgb('c9c0a5');
const trim = rgb('d9cfb4');
const oldStone = rgb('9d947f');
const plinth = rgb('a99d86');
const red = rgb('a45d4e');
const darkBrick = rgb('705951');
const slate = rgb('4a4b51');
const slateSun = rgb('53555a');
const deep = rgb('48443a');
const door = rgb('514638');
const glass = rgb('4a4c49');
const shadow = rgb('62615a');

const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.91 },
  base: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.97 },
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.89 },
  void: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.9 },
};

const francois = 1034798237;
const hall = 1034798233;
const louis = 1034772454;
const gaston = 1034855454;
const chapel = 1034756253;

function clip(ring, distance) {
  const result = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const da = distance(...a);
    const db = distance(...b);
    if (da >= 0) result.push(a);
    if (da * db < 0) {
      const t = da / (da - db);
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result;
}

// Few-metre survey line fragments can be combined on long straight facades.
function simplified(ring) {
  return ring.filter((p, i) => {
    const a = ring[(i + ring.length - 1) % ring.length];
    const b = ring[(i + 1) % ring.length];
    const run = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const side = Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0]));
    return run < 0.75 || side > run * 0.16;
  });
}

function cap(out, ring, height, color, slot = 'roof') {
  const points = ring.filter(
    (p, i) => ring.findIndex((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.00002) === i,
  );
  const faces = earcut(points.flat());
  for (let i = 0; i < faces.length; i += 3) {
    const [a, b, c] = faces.slice(i, i + 3).map((id) => {
      const [x, z] = points[id];
      return [x, height(x, z), z];
    });
    const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (Math.abs(up) < 1e-6) continue;
    if (up > 0) tri(out, slot, a, b, c, color);
    else tri(out, slot, a, c, b, color);
  }
}

function edges(ring) {
  return ring.map((p, i) => wallFace(p, ring[(i + 1) % ring.length]));
}

function roofFrame(ring) {
  const line = edges(ring).reduce((a, b) => (a.length > b.length ? a : b));
  const u = (x, z) => x * line.along[0] + z * line.along[1];
  const v = (x, z) => x * line.normal[0] + z * line.normal[1];
  const along = ring.map((p) => u(...p));
  const across = ring.map((p) => v(...p));
  return {
    u,
    v,
    u0: Math.min(...along),
    u1: Math.max(...along),
    v0: Math.min(...across),
    v1: Math.max(...across),
  };
}

function roofPlanes(frame, shape) {
  const { u, v, u0, u1, v0, v1 } = frame;
  const dv = (v1 - v0) / 2;
  const du = Math.min((u1 - u0) / 2, dv);
  const slopes = [(x, z) => (v(x, z) - v0) / dv, (x, z) => (v1 - v(x, z)) / dv];
  const ends = [(x, z) => (u(x, z) - u0) / du, (x, z) => (u1 - u(x, z)) / du];
  if (shape === 'pyramidal' || shape === 'dome') {
    const endScale = (2 * du) / (u1 - u0);
    return [...slopes, ...ends.map((slope) => (x, z) => slope(x, z) * endScale)];
  }
  if (shape === 'hipped') return [...slopes, ...ends];
  if (shape === 'mansard' || shape === 'gambrel') {
    const runs = shape === 'mansard' ? [...slopes, ...ends] : slopes;
    return runs.flatMap((slope) => [
      (x, z) => slope(x, z) * 2.15,
      (x, z) => 0.59 + slope(x, z) * 0.41,
    ]);
  }
  if (shape === 'skillion') return [(x, z) => (v(x, z) - v0) / (2 * dv)];
  return slopes;
}

function roof(out, ring, eaves, rise, shape, wallSlot, wallTone, level) {
  if (rise <= 0.05 || shape === 'flat') {
    cap(out, ring, () => eaves, slate);
    return;
  }
  const planes = roofPlanes(roofFrame(ring), shape);
  const facets = planes.map((plane) => ({
    plane,
    ring: planes.reduce(
      (result, other) =>
        plane === other ? result : clip(result, (x, z) => other(x, z) - plane(x, z)),
      ring,
    ),
  }));
  for (const [i, { plane, ring: poly }] of facets.entries()) {
    cap(out, poly, (x, z) => eaves + rise * plane(x, z), i % 2 ? slateSun : slate);
  }
  const height = (x, z) => eaves + rise * Math.min(...planes.map((p) => p(x, z)));
  for (const f of edges(ring)) {
    if (f.length < 0.12) continue;
    const split = [0, f.length];
    for (const facet of facets)
      for (const [x, z] of facet.ring) {
        const X = x - f.origin[0];
        const Z = z - f.origin[1];
        const u = X * f.along[0] + Z * f.along[1];
        if (Math.abs(X * f.normal[0] + Z * f.normal[1]) < 0.0001 && u > 0.03 && u < f.length - 0.03)
          split.push(u);
      }
    split.sort((a, b) => a - b);
    for (let i = 1; i < split.length; i++) {
      const a = split[i - 1];
      const b = split[i];
      if (b - a < 0.02) continue;
      const [x, , z] = f.P(a, 0);
      const [X, , Z] = f.P(b, 0);
      const h0 = height(x, z);
      const h1 = height(X, Z);
      if (Math.max(h0, h1) > eaves + 0.03)
        quad4(
          out,
          wallSlot,
          f.P(a, eaves - 0.024),
          f.P(b, eaves - 0.024),
          f.P(b, h1),
          f.P(a, h0),
          wallTone,
        );
      if (level === 3 && b - a > 1.25)
        beam(out, 'roof', f.P(a, h0 + 0.025, 0.085), f.P(b, h1 + 0.025, 0.085), 0.14, 0.13, slate);
    }
  }
}

function band(out, f, y, height, depth = 0.12, color = trim, slot = 'trim') {
  fbox(out, slot, f, 0, f.length, y, y + height, -0.065, depth, color);
}

function aperture(out, f, u, y, w, h, level, options = {}) {
  const { head = 'flat', tone = glass, depth = 0.025, frame = trim, cross = false } = options;
  if (level === 0 && head === 'flat') return;
  opening(out, f, u, y, w, h, {
    head,
    glassSlot: 'void',
    frameSlot: 'trim',
    glass: tone,
    frame,
    d: depth,
    sill: level === 3 && depth > 0,
    frameWidth: level === 3 ? 0.12 : 0,
    frameDepth: 0.16,
    mullions: level > 1 && cross ? 1 : 0,
    transoms: level > 2 && cross ? 1 : 0,
  });
}

function buildMajorPart(out, id, level, style = {}) {
  const p = part(id);
  const { tags } = p;
  const outline = ringOf(id);
  const ring = level < 2 ? simplified(outline) : outline;
  const brick = tags['building:material'] === 'brick';
  const wallSlot = brick ? 'brick' : 'wall';
  const wallTone = brick ? red : pale;
  const base = style.base ?? 1.0;
  const roofRise = style.rise ?? +(tags['roof:height'] ?? 0);
  const fullHeight = style.height ?? +tags.height;
  const eave = base + fullHeight - roofRise;
  const bottom = style.bottom ?? (tags.min_height ? base + Number(tags.min_height) : -1.7);
  if (bottom < eave && !style.openFace) {
    extrude(out, wallSlot, ring, bottom, eave, wallTone, { top: false });
  } else if (bottom < eave) {
    for (const f of edges(ring)) {
      if (f.length < 0.065 || style.openFace(f)) continue;
      quad4(
        out,
        wallSlot,
        f.P(0, bottom),
        f.P(f.length, bottom),
        f.P(f.length, eave),
        f.P(0, eave),
        wallTone,
      );
    }
  }
  roof(out, ring, eave, roofRise, tags['roof:shape'], wallSlot, wallTone, level);
  return { eave, base, ring };
}

function chimneys(out, face, locations, y, level, offset) {
  if (level === 0) return;
  for (const u of locations) {
    const [x, , z] = face.P(u, 0, offset);
    abox(out, 'brick', [x - 0.44, y - 2.8, z - 0.57], [x + 0.44, y, z + 0.57], darkBrick);
    abox(out, 'trim', [x - 0.51, y - 0.27, z - 0.65], [x + 0.51, y + 0.08, z + 0.65], oldStone);
  }
}

function dormer(out, f, u, y, level, depth = -1.08) {
  const a = u - 0.63;
  const b = u + 0.63;
  fbox(out, 'wall', f, a, b, y, y + 1.5, depth - 1.14, depth, pale);
  const apex = f.P(u, y + 2.26, depth);
  const backApex = f.P(u, y + 2.26, depth - 1.32);
  tri(out, 'trim', f.P(a, y + 1.5, depth), f.P(b, y + 1.5, depth), apex, trim);
  quad4(out, 'roof', f.P(a, y + 1.5, depth - 1.32), f.P(a, y + 1.5, depth), apex, backApex, slate);
  quad4(
    out,
    'roof',
    f.P(b, y + 1.5, depth),
    f.P(b, y + 1.5, depth - 1.32),
    backApex,
    apex,
    slateSun,
  );
  aperture(out, f, u, y + 0.36, 0.64, 0.94, level, { depth: depth + 0.025, cross: true });
}

function arcade(out, face, u, step, bottom, top, width, height, level) {
  const left = u - width / 2;
  const right = u + width / 2;
  fbox(out, 'wall', face, u - step / 2, left, bottom, top, -0.74, 0, pale);
  fbox(out, 'wall', face, right, u + step / 2, bottom, top, -0.74, 0, pale);
  const spring = bottom + height - width / 2;
  const points = roundArch(width / 2, level === 1 ? 4 : 9);
  for (let i = 1; i < points.length; i++) {
    const [a, b] = points[i - 1];
    const [c, d] = points[i];
    const y0 = spring + b;
    const y1 = spring + d;
    quad4(
      out,
      'wall',
      face.P(u + a, y0),
      face.P(u + c, y1),
      face.P(u + c, top),
      face.P(u + a, top),
      pale,
    );
    if (level > 1)
      quad4(
        out,
        'base',
        face.P(u + c, y1),
        face.P(u + a, y0),
        face.P(u + a, y0, -0.74),
        face.P(u + c, y1, -0.74),
        plinth,
      );
    if (level === 3)
      beam(out, 'trim', face.P(u + a, y0, 0.04), face.P(u + c, y1, 0.04), 0.14, 0.16, trim);
  }
}

function renaissance(out, level) {
  const { eave } = buildMajorPart(out, francois, level, {
    bottom: -5.5,
    base: 2.25,
    height: 18.8,
    openFace: level ? (f) => f.normal[1] < -0.95 && f.origin[1] < -38 : undefined,
  });
  const outer = wallFace([41.428, -38.448], [-11.404, -38.493]);
  const inner = wallFace([-11.351, -20.426], [42.035, -19.798]);
  if (level) {
    fbox(out, 'base', outer, 0, outer.length, -5.5, 0.82, -0.82, 0.03, plinth);
    fbox(out, 'wall', outer, 0, outer.length, 0.82, 12.56, -1.08, -0.99, shadow);
    fbox(out, 'wall', outer, 0, outer.length, 12.56, eave, -1.08, 0, pale);
  }
  for (const y of level ? [0.78, 4.53, 8.64, 12.46] : [0.78, 8.64]) band(out, outer, y, 0.23, 0.19);
  for (const y of level ? [2.55, 6.49, 10.59, eave - 0.31] : [eave - 0.31])
    band(out, inner, y, 0.17, 0.13);
  const count = 13;
  const step = outer.length / count;
  for (let j = 0; j < count; j++) {
    const u = step * (j + 0.5);
    if (level > 0) {
      arcade(out, outer, u, step, 0.82, 4.63, 1.78, 2.89, level);
      arcade(out, outer, u, step, 4.63, 8.76, 2.14, 3.35, level);
      arcade(out, outer, u, step, 8.76, 12.56, 2.14, 3.06, level);
      if (level > 1 && j % 2 === 0)
        aperture(out, outer, u, -2.35, 0.82, 1.46, level, {
          head: 'round',
          tone: deep,
          depth: 0.07,
        });
    }
    const inside = inner.length - u;
    if (Math.abs(inside - 19.4) > 3.9 && level > 0)
      for (const y of [3.25, 7.1, 11.04])
        aperture(out, inner, inside, y, 1.54, 2.55, level, { cross: true, depth: 0.19 });
    if (level > 1 && j < count - 1) {
      const a = u + step / 2 - 0.18;
      const b = a + 0.36;
      fbox(out, 'trim', outer, a, b, 4.72, 12.46, -0.04, 0.23, pale);
      for (const y of [4.75, 8.61, 12.09])
        fbox(out, 'trim', outer, a - 0.08, b + 0.08, y, y + 0.28, -0.06, 0.3, trim);
    }
    if (level > 1 && j % 2 === 1) dormer(out, outer, u, eave + 0.53, level);
  }
  chimneys(out, outer, [6.2, 16, 29.3, 42.6, 48.7], 21.35, level, -8.3);
}

function courtStair(out, level) {
  const outline = ringOf(1034798239);
  if (level === 0) {
    extrude(out, 'wall', outline, 0.56, 15.62, pale, { top: false });
    roof(out, outline, 15.62, 0.88, 'pyramidal', 'trim', trim, level);
    return;
  }
  const exposed = edges(outline).filter(
    (f) => f.origin[1] > -20.15 && f.P(f.length, 0)[2] > -20.15,
  );
  const cx = 8.21;
  const cz = -18.75;
  const core = (radius, y) =>
    Array.from({ length: 12 }, (_, i) => {
      const angle = (-2 * Math.PI * i) / 12;
      return [cx + radius * Math.cos(angle), y, cz + radius * Math.sin(angle)];
    });
  loft(out, 'wall', [core(1.14, 1.28), core(0.96, 16.18)], pale);
  extrude(out, 'wall', outline, 0.56, 2.95, pale, { top: false });
  roof(out, outline, 15.62, 0.88, 'pyramidal', 'trim', trim, level);
  for (const [i, f] of exposed.entries()) {
    for (const u of [0.23, f.length - 0.23])
      fbox(out, 'trim', f, u - 0.29, u + 0.29, 1.78, 15.98, -0.47, 0.37, trim);
    for (const y of [3.05, 6.63, 10.21, 13.79]) {
      const rise = (i % 2) * 0.27;
      const a = f.P(0.12, y + rise, 0.31);
      const b = f.P(f.length - 0.12, y + rise + 0.82, 0.31);
      beam(out, 'trim', a, b, 0.43, 0.38, pale);
      if (level > 1) {
        for (let n = 1; n <= 3; n++) {
          const t = n / 4;
          const u = f.length * t;
          fbox(
            out,
            'trim',
            f,
            u - 0.073,
            u + 0.073,
            y + rise + t * 0.82,
            y + rise + t * 0.82 + 0.78,
            0.12,
            0.32,
            trim,
          );
        }
        const c = f.P(0.17, y + rise + 0.81, 0.3);
        const d = f.P(f.length - 0.17, y + rise + 1.62, 0.3);
        beam(out, 'trim', c, d, 0.1, 0.1, trim);
      }
    }
  }
}

function gateArch(out, f, u, width, bottom, maxY, level, fill) {
  const points = roundArch(width / 2, level > 1 ? 9 : 5);
  const spring = bottom + 2.07;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i - 1];
    const [X, Y] = points[i];
    const a = f.P(u + x, spring + y);
    const b = f.P(u + X, spring + Y);
    quad4(out, fill, a, b, f.P(u + X, maxY), f.P(u + x, maxY), red);
    if (level > 0)
      beam(
        out,
        'trim',
        f.P(u + x, spring + y, 0.15),
        f.P(u + X, spring + Y, 0.15),
        0.19,
        0.22,
        trim,
      );
  }
}

function alongPosition(face, [x, z]) {
  return (x - face.origin[0]) * face.along[0] + (z - face.origin[1]) * face.along[1];
}

function louisWing(out, level) {
  const outer = wallFace([41.74, 45.425], [63.728, -1.491]);
  const inner = wallFace([48.795, -6.812], [28.419, 39.394]);
  const { eave } = buildMajorPart(out, louis, level, {
    base: 0.54,
    bottom: -1.12,
    rise: 6.85,
    height: 17.07,
    openFace: (f) => Math.abs(f.normal[0]) > 0.8 && f.length < 55,
  });
  const gatePosition = [55.563, 15.932];
  for (const [i, face] of [outer, inner].entries()) {
    const g = alongPosition(face, gatePosition);
    const w = 3.26;
    for (const [a, b] of [
      [0, g - w / 2],
      [g + w / 2, face.length],
    ]) {
      fbox(out, 'brick', face, a, b, -1.13, eave, -0.45, 0.04, red);
      fbox(out, 'base', face, a, b, -1.34, 0.95, -0.48, 0.15, plinth);
    }
    gateArch(out, face, g, w, 0.52, eave, level, 'brick');
    for (const y of level ? [4.71, 8.38, eave - 0.27] : [eave - 0.27])
      band(out, face, y, 0.18, 0.17);
    for (let bay = 0; bay < 11; bay++) {
      const u = (face.length * (bay + 0.5)) / 11;
      if (Math.abs(u - g) < 2.2) continue;
      if (level > 0) {
        aperture(out, face, u, 1.33, i ? 2.48 : 1.45, 2.94, level, {
          head: i ? 'round' : 'flat',
          cross: !i,
          tone: i ? deep : glass,
        });
        aperture(out, face, u, 5.26, 1.53, 2.71, level, { cross: true });
      }
      if (level > 1 && bay % 2 === 0) dormer(out, face, u, eave + 0.31, level);
      if (level === 3 && i === 0) {
        const v = u + 1.5;
        for (const y of [2.0, 3.25, 5.49, 6.77, 8.02]) {
          quad4(
            out,
            'brick',
            face.P(v - 0.23, y, 0.056),
            face.P(v, y - 0.16, 0.056),
            face.P(v + 0.23, y, 0.056),
            face.P(v, y + 0.16, 0.056),
            darkBrick,
          );
        }
      }
    }
    if (i === 0 && level > 0) {
      aperture(out, face, g, 4.85, 2.41, 3.39, level, { head: 'pointed', tone: deep, depth: 0.17 });
      // Low-relief silhouette in the documented position above the entrance.
      fbox(out, 'brick', face, g - 0.95, g + 0.95, 5.08, 5.43, 0.18, 0.21, red);
      if (level > 1) {
        beam(
          out,
          'trim',
          face.P(g - 0.52, 5.93, 0.22),
          face.P(g + 0.41, 5.94, 0.22),
          0.3,
          0.15,
          pale,
        );
        beam(
          out,
          'trim',
          face.P(g + 0.37, 5.9, 0.22),
          face.P(g + 0.71, 6.34, 0.22),
          0.19,
          0.12,
          pale,
        );
        beam(
          out,
          'trim',
          face.P(g - 0.03, 5.98, 0.22),
          face.P(g + 0.14, 6.63, 0.22),
          0.24,
          0.13,
          trim,
        );
        for (const k of [-0.42, 0.42])
          beam(
            out,
            'trim',
            face.P(g + k, 5.86, 0.22),
            face.P(g + k + 0.07, 5.46, 0.22),
            0.09,
            0.095,
            pale,
          );
      }
    }
  }
  chimneys(out, outer, [5, 13, 24, 37, 44.4], 18.65, level, -5.9);
}

function classic(out, level) {
  const { eave } = buildMajorPart(out, gaston, level, { bottom: -1.5, base: 2.05 });
  const court = wallFace([-16.19, -25.95], [-24.727, 35.217]);
  // This face lies toward the court, on the opposite side of the directed survey line.
  const f = wallFace(
    court.P(court.length, 0).filter((_, i) => i !== 1),
    court.origin,
  );
  for (const y of [2.1, 5.62, 9.45, eave - 0.28]) band(out, f, y, 0.21, 0.2);
  for (let bay = 0; bay < 13; bay++) {
    const u = f.length * ((bay + 0.5) / 13);
    if (Math.abs(u - f.length / 2) < 3.3) continue;
    if (level > 0)
      for (const y of [3, 6.45, 10.2])
        aperture(out, f, u, y, 1.32, y > 9 ? 1.94 : 2.19, level, { cross: true });
    if (level > 1 && bay % 2 === 0) dormer(out, f, u, eave + 0.84, level, -1.14);
  }
  const centerRing = ringOf(1034855457);
  const front = edges(centerRing)
    .filter((face) => face.normal[0] > 0.75)
    .sort((a, b) => b.length - a.length)[0];
  const m = front.length / 2;
  const w = Math.min(4.7, front.length / 2);
  band(out, front, 13.54, 0.33, 0.42);
  tri(
    out,
    'trim',
    front.P(0, 13.87, 0.37),
    front.P(front.length, 13.87, 0.37),
    front.P(m, 16.05, 0.37),
    trim,
  );
  if (level > 0) {
    aperture(out, front, m, 2.36, 2.14, 3.26, level, { head: 'round', tone: door, depth: 0.09 });
    for (const du of [-0.64, 0, 0.64]) {
      aperture(out, front, m + w * du, 6.39, 1.25, 2.55, level, { head: 'round', cross: true });
      aperture(out, front, m + w * du, 10.43, 1.22, 2.02, level, { cross: true });
    }
    for (const du of [-0.94, -0.38, 0.38, 0.94]) {
      const u = m + w * du;
      fbox(out, 'trim', front, u - 0.27, u + 0.27, 2.38, 13.57, -0.05, 0.31, pale);
      if (level > 1)
        for (const y of [2.4, 5.54, 9.43, 13.24])
          fbox(out, 'trim', front, u - 0.33, u + 0.33, y, y + 0.21, 0.04, 0.41, trim);
    }
  }
}

function medievalAndChapel(out, level) {
  const medieval = buildMajorPart(out, hall, level, { base: 2.03, bottom: -2.54 });
  const church = buildMajorPart(out, chapel, level, { base: 1.2, bottom: -1.9 });
  if (level > 0) {
    for (const [body, kind] of [
      [medieval, 'hall'],
      [church, 'chapel'],
    ])
      for (const f of edges(body.ring)) {
        if (f.length < (kind === 'hall' ? 8 : 2.5)) continue;
        const n = Math.max(1, Math.round(f.length / 5.2));
        for (let i = 0; i < n; i++) {
          const u = (f.length * (i + 0.5)) / n;
          aperture(out, f, u, body.eave - 4.63, kind === 'hall' ? 1.16 : 1.0, 3.57, level, {
            head: 'pointed',
            cross: true,
          });
        }
      }
  }
  const towerRing = outwardRing(frame.features.find((f) => f.id === 'way/766747661').points);
  const outline = level ? towerRing : towerRing.filter((_, i) => i % 2 === 0);
  extrude(out, 'base', outline, -8.1, 6.67, oldStone, { top: false });
  cap(out, outline, () => 6.67, plinth, 'base');
  if (level > 0)
    for (const [i, f] of edges(outline).entries()) {
      if (i % 4 === 0 && f.length > 0.3) band(out, f, 6.18, 0.49, 0.13, pale);
      if (i % 6 === 2 && f.length > 0.4)
        aperture(out, f, f.length / 2, 3.13, 0.4, 1.17, level, { head: 'round', tone: deep });
    }
}

const auxiliaryParts = [
  1034781371, 1034772453, 1034781372, 1034798243, 1034798242, 1034798241, 1034798245, 1034798246,
  1034855452, 1034855450, 1034855453, 1034855455, 1034855457, 1034756254, 1034756255, 1034756256,
];
const annexParts = [1034781369, 1034798235, 1034855449, 1034855451, 1034756257];
const smallRoofSections = new Set([
  1034798241, 1034798242, 1034798246, 1034756254, 1034756255, 1034756256, 1034781371,
]);
function wings(out, level) {
  for (const id of auxiliaryParts) {
    if (level === 0 && smallRoofSections.has(id)) continue;
    const low = id === 1034756255 || id === 1034756256;
    const result = buildMajorPart(out, id, level, low ? {} : { bottom: -2.06 });
    if (level < 2 || low) continue;
    for (const f of edges(simplified(result.ring))) {
      if (f.length < 8) continue;
      band(out, f, result.eave - 0.34, 0.21, 0.17);
      const bays = Math.floor(f.length / 4.8);
      for (let i = 0; i < bays; i++) {
        const u = f.length * ((i + 0.5) / bays);
        aperture(out, f, u, result.eave - 3.1, 1.22, 2.17, level, { cross: true });
      }
    }
  }
  if (level > 0) for (const id of annexParts) buildMajorPart(out, id, level);
}

function build(out, level) {
  renaissance(out, level);
  louisWing(out, level);
  wings(out, level);
  classic(out, level);
  medievalAndChapel(out, level);
  courtStair(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'chateau-of-blois-model.mjs';
const camera = [128, 83, 127];
const lookAt = [4, 6.5, 6];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Château of Blois',
  wikidataId: plan.wikidataId,
  category: 'castle',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Royal Château of Blois with its four historic wings, François I loggias and open court stair, brick Louis XII entrance, Gaston d’Orléans frontage, chapel and Foix tower.',
  camera,
  lookAt,
  sunDirection: [58, 62, -36],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.8,
    basis:
      'Named château volume, with a genuine uncovered court and separately mapped chapel and defensive tower.',
  },
  embeddedCanonicalGraphs: ['stone_limestone', 'stone_limestone_raw', 'brick_flemish', 'slate'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'francois-outer-loggias', position: [9, 5.2, -104], lookAt: [8, 6.8, -31] },
    { name: 'courtyard-stair-and-classical-wing', position: [23, 7.4, 18], lookAt: [-2, 8.9, -14] },
    { name: 'louis-xii-brick-gate', position: [96, 8, 33], lookAt: [53, 7.1, 15] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'blois-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.91,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.48, surfaces },
      street: { export: 'street', errorMeters: 0.18, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.07, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
