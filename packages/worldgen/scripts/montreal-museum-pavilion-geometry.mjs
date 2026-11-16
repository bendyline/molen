/** Shared geometry for the independent Montreal museum pavilions. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import earcut from './polygon-triangulation.mjs';
import { box } from './structure-mesh.mjs';

export const up = [0, 1, 0];
export const south = [0, 0, 1];
export const north = [0, 0, -1];
export const east = [1, 0, 0];
export const west = [-1, 0, 0];
export const at = ([x, z], y) => [x, y, z];
export const xz = ([x, , z]) => [x, z];
export const pairs = (points) => points.slice(1).map((b, i) => [points[i], b]);
export const closed = (points) => [...points, points[0]];
export const mix = (a, b, t) => a + (b - a) * t;
export const planarMid = (points) =>
  [0, 1].map((i) => points.reduce((s, p) => s + p[i], 0) / points.length);
export const palette = (values) =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, rgb(value)]));
export const rect = (left, front, right, back) => [
  [left, front],
  [right, front],
  [right, back],
  [left, back],
];
export function areaSign(points) {
  return Math.sign(pairs(closed(points)).reduce((s, [[x, z], [a, b]]) => s + x * b - z * a, 0));
}
export function floorSampler(grid) {
  return ([x, z]) => {
    const u = (x - grid.origin[0]) / grid.stepMeters;
    const v = (z - grid.origin[1]) / grid.stepMeters;
    const i = Math.floor(u),
      j = Math.floor(v);
    const a = grid.heightsMeters[j],
      b = grid.heightsMeters[j + 1];
    return (
      mix(mix(a[i], a[i + 1], u - i), mix(b[i], b[i + 1], u - i), v - j) -
      grid.modelDatumElevationMeters
    );
  };
}
export function surface(slot, graph, roughness = 0.86, metallic = 0) {
  return { slot, graph, roughness, metallic };
}
export function block(out, slot, x, y, z, width, height, depth, color) {
  box(out, slot, [x, y, z], [x + width, y + height, z + depth], color);
}
export function edge(a, b, sign = 1) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const x = (b[0] - a[0]) / length,
    z = (b[1] - a[1]) / length;
  const normal = [z * sign, 0, -x * sign];
  return {
    length,
    normal,
    p: (u, y, d = 0) => [a[0] + u * x + d * normal[0], y, a[1] + u * z + d * normal[2]],
  };
}
export function face(out, slot, points, target, color) {
  const n = normalFor(...points);
  const dot = n.reduce((s, x, i) => s + x * target[i], 0);
  out.addConvexPolygon(
    slot,
    'palette:#ffffff',
    points,
    dot < 0 ? n.map((v) => -v) : n,
    ([x, y, z]) => (Math.abs(n[1]) > 0.61 ? [x, z] : [x - z * 0.53, y]),
    color,
  );
}
export function panel(out, slot, wall, u, v, low, high, offset, color) {
  face(
    out,
    slot,
    [
      wall.p(u, low, offset),
      wall.p(v, low, offset),
      wall.p(v, high, offset),
      wall.p(u, high, offset),
    ],
    wall.normal,
    color,
  );
}
export function cap(out, slot, outline, y, color) {
  const tri = earcut(outline.flat());
  for (let i = 0; i < tri.length; i += 3)
    face(
      out,
      slot,
      tri.slice(i, i + 3).map((k) => at(outline[k], y)),
      up,
      color,
    );
}
export function shell(out, outline, bottom, top, style, selected = () => true) {
  const s = areaSign(outline);
  for (const [[a, b], i] of pairs(closed(outline)).map((p, i) => [p, i])) {
    if (!selected(i, a, b)) continue;
    const w = edge(a, b, s);
    face(
      out,
      style.wall,
      [at(a, bottom(a)), at(b, bottom(b)), at(b, top), at(a, top)],
      w.normal,
      style.color,
    );
  }
  cap(out, style.roof ?? style.wall, outline, top, style.roofColor ?? style.color);
}
export function plane(z, facing) {
  return { normal: [0, 0, facing], p: (x, y, d = 0) => [x, y, z + facing * d] };
}
export function opening(out, w, l, r, base, top, trim, color, fill, trimColor, lod, depth = 0) {
  panel(out, fill, w, l, r, base, top, depth, color);
  if (lod === 0) return;
  const line = depth + 0.025;
  panel(out, trim, w, l - 0.063, r + 0.063, base - 0.09, base + 0.016, line, trimColor);
  panel(out, trim, w, l - 0.063, r + 0.063, top - 0.016, top + 0.1, line, trimColor);
  for (const x of [l, r]) panel(out, trim, w, x - 0.033, x + 0.033, base, top, line, trimColor);
  if (lod > 1) {
    const x = (l + r) * 0.5;
    panel(out, trim, w, x - 0.022, x + 0.022, base, top, line, trimColor);
  }
}
export function bands(out, w, left, right, levels, slot, color, offset = 0.09) {
  for (const [low, high] of levels) panel(out, slot, w, left, right, low, high, offset, color);
}
export function stairs(out, grade, slot, left, right, z0, z1, top, n, color) {
  for (let i = 0; i < n; i++) {
    const a = mix(z0, z1, i / n),
      b = mix(z0, z1, (i + 1) / n);
    const y = mix(Math.max(grade([left, z0]), grade([right, z0])) + 0.08, top, (i + 1) / n);
    const floor = Math.min(y - 0.1, grade([left, b]) - 0.22, grade([right, b]) - 0.22);
    block(out, slot, left, floor, Math.min(a, b), right - left, y - floor, Math.abs(b - a), color);
  }
}
export function ring(out, slot, pos, ys, segments, color) {
  for (const [[y, r], [top, width]] of pairs(ys)) {
    for (let i = 0; i < segments; i++) {
      const a = (i * 2 * Math.PI) / segments,
        b = ((i + 1) * 2 * Math.PI) / segments;
      const pt = (angle, Y, R) => [pos[0] + Math.cos(angle) * R, Y, pos[1] + Math.sin(angle) * R];
      const normal = [
        Math.cos((a + b) * 0.5),
        Math.abs(top - y) < 0.01 ? 1 : 0.1,
        Math.sin((a + b) * 0.5),
      ];
      face(
        out,
        slot,
        [pt(a, y, r), pt(b, y, r), pt(b, top, width), pt(a, top, width)],
        normal,
        color,
      );
    }
  }
}
export function arch(out, w, cx, base, spring, rx, ry, depth, lod, colors, slots) {
  const n = [5, 8, 12, 16][lod];
  const point = (i, outer = false) => {
    const ang = (Math.PI * i) / n;
    const pad = outer ? colors.width : 0;
    return [cx + (rx + pad) * Math.cos(ang), spring + (ry + pad) * Math.sin(ang)];
  };
  panel(out, slots.inner, w, cx - rx, cx + rx, base, spring, depth, colors.inner);
  const archway = Array.from({ length: n + 1 }, (_, i) => point(i));
  face(
    out,
    slots.inner,
    archway.map(([u, y]) => w.p(u, y, depth)),
    w.normal,
    colors.inner,
  );
  if (lod === 0) return;
  for (const [a, b] of pairs(archway.map((_, i) => i))) {
    const [x, y] = point(a),
      [u, v] = point(b),
      [p, q] = point(a, true),
      [r, s] = point(b, true);
    face(
      out,
      slots.trim,
      [
        w.p(x, y, depth + 0.04),
        w.p(u, v, depth + 0.04),
        w.p(r, s, depth + 0.075),
        w.p(p, q, depth + 0.075),
      ],
      w.normal,
      colors.trim,
    );
  }
  for (const dir of [-1, 1]) {
    const u = cx + dir * rx,
      v = cx + dir * (rx + colors.width);
    panel(
      out,
      slots.trim,
      w,
      Math.min(u, v),
      Math.max(u, v),
      base,
      spring,
      depth + 0.08,
      colors.trim,
    );
  }
}
export function trimBlock(out, slot, w, a, b, low, high, inner, outer, color) {
  const q = (u, y, d) => w.p(u, y, d);
  face(
    out,
    slot,
    [q(a, low, outer), q(b, low, outer), q(b, high, outer), q(a, high, outer)],
    w.normal,
    color,
  );
  face(
    out,
    slot,
    [q(a, high, inner), q(b, high, inner), q(b, high, outer), q(a, high, outer)],
    up,
    color,
  );
  const span = [w.normal[2], 0, -w.normal[0]];
  for (const [u, n] of [
    [a, span],
    [b, span.map((v) => -v)],
  ])
    face(
      out,
      slot,
      [q(u, low, inner), q(u, low, outer), q(u, high, outer), q(u, high, inner)],
      n,
      color,
    );
}

export function pavilion(url, config, build) {
  const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, url)));
  const plan = read('plan-controls.json'),
    grid = read('terrain-grid.json');
  const grade = floorSampler(grid);
  const { surfaces, camera, lookAt, views, brief, yaw = 0.7, sun } = config;
  const { model: id, title, cell, wikidataId } = plan,
    slug = id.replaceAll('_', '-');
  const module = `content/worldgen/source/places/${cell}/${id}/models/${slug}-model.mjs`;
  const levels = ['skyline', 'district', 'street', 'closeup'];
  const draw = (lod) => (out) => build(out, lod, plan.dimensions, grade);
  const [skyline, district, street, closeup] = levels.map((_, lod) => draw(lod));
  const model = {
    id,
    key: id,
    title,
    cell,
    wikidataId,
    category: 'museum',
    recipe: `${slug}-model.mjs`,
    recipeDependencies: [
      'generate-motat-building.mjs',
      'montreal-museum-pavilion-geometry.mjs',
      'polygon-triangulation.mjs',
    ],
    surfaces,
    build: closeup,
    quality: 'medium-fi-exterior',
    reviewStatus: 'review-in-qa.json',
    geographicStatus: 'geographic-preview',
    orientationPolicy: 'mapped-footprint',
    groundContactBasis: plan.sectionBasis,
    progressLedger: 'qualla-003.PROGRESS.md',
    brief,
    camera,
    lookAt,
    sunDirection: sun ?? [-280, 520, 640],
    embeddedCanonicalGraphs: [...new Set(Object.values(surfaces).map((v) => v.graph))],
    mediumFiContext: {
      scale: 1,
      cameraYaw: yaw,
      focus: { center: lookAt },
      groundY: 0,
      terrain: {
        descriptor: 'terrain-review.terrain.json',
        heightmap: 'terrain-review.height.png',
      },
    },
    qaCameras: views,
    qaLodCameras: levels.map((reviewLod) => ({
      name: `${slug}-${reviewLod}`,
      position: camera,
      lookAt,
      reviewLod,
    })),
    runtimeLodOverlay: {
      module,
      level: 'skyline',
      export: 'skyline',
      errorMeters: 2.2,
      surfaces,
      authoredLevels: {
        district: { export: 'district', errorMeters: 0.9, surfaces },
        street: { export: 'street', errorMeters: 0.36, surfaces },
        closeup: { export: 'closeup', errorMeters: 0.12, surfaces },
      },
    },
    limitations: plan.limitations,
    sourceDocuments: plan.requiredSourceDocuments,
    sourceLicense:
      'Independent geometric reconstruction from original OpenStreetMap outlines, Terrarium terrain and the documented appearance sources.',
  };
  return { model, skyline, district, street, closeup };
}
