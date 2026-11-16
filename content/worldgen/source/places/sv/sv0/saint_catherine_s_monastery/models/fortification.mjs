/** Granite curtain walls, rounded tower faces and a narrow vaulted entry. */
import {
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const granite = rgb('b98c62');
const darker = rgb('a27952');
const dressed = rgb('c0a383');
const dusky = rgb('72533b');
const wood = rgb('624531');
const mix = (a, b, t) => a + (b - a) * t;
const point = (p, y) => [p[0], y, p[1]];
const between = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
const direction = (a, b) => {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
};

function quad(out, slot, a, b, c, d, color) {
  triangle(out, slot, [a, b, c], color);
  triangle(out, slot, [a, c, d], color);
}

function wallCrown(z, profile) {
  const entry = profile.findIndex(([v]) => v > z);
  if (entry === 0) return profile[0][1];
  if (entry < 0) return profile.at(-1)[1];
  const [a, y0] = profile[entry - 1],
    [b, y1] = profile[entry];
  return mix(y0, y1, (z - a) / (b - a));
}

function offset(path, distance) {
  return path.map(([x, z], i) => {
    const a = direction(path.at(i - 1), path[i]),
      b = direction(path[i], path[(i + 1) % path.length]);
    const dot = a[0] * b[0] + a[1] * b[1];
    const m = distance / Math.max(0.42, 1 + dot);
    return [x - (a[1] + b[1]) * m, z + (a[0] + b[0]) * m];
  });
}

function wallEdge(out, a, b, ground, crown, gate, lod) {
  const at = (t) => between(a.center, b.center, t);
  const len = Math.hypot(b.center[0] - a.center[0], b.center[1] - a.center[1]);
  const isGate =
    Math.abs(a.center[1] + 28.6) < 1 &&
    Math.abs(b.center[1] + 28.6) < 1 &&
    Math.min(a.center[0], b.center[0]) < gate.x - gate.width / 2 &&
    Math.max(a.center[0], b.center[0]) > gate.x + gate.width / 2;
  const n = lod === 0 ? 1 : Math.ceil(len / (lod === 1 ? 13 : 7));
  const tParts = Array.from({ length: n + 1 }, (_, i) => i / n);
  let openingMin = -1,
    openingMax = -1,
    entryFloor = 0;
  if (isGate) {
    const t = (x) => (x - a.center[0]) / (b.center[0] - a.center[0]);
    const [u, v] = [t(gate.x - gate.width / 2), t(gate.x + gate.width / 2)].sort((x, y) => x - y);
    openingMin = u;
    openingMax = v;
    entryFloor = ground(at((u + v) / 2)) + 0.12;
    const count = [3, 5, 8, 12][lod];
    tParts.push(...Array.from({ length: count + 1 }, (_, i) => mix(u, v, i / count)));
  }
  const segments = [...new Set(tParts)].sort((u, v) => u - v);
  const outer = (t) => between(a.outer, b.outer, t);
  const inner = (t) => between(a.inner, b.inner, t);
  const base = (t) => between(a.base, b.base, t);
  const archY = (t) => {
    const u = (2 * (t - openingMin)) / (openingMax - openingMin) - 1;
    return entryFloor + gate.spring + Math.sqrt(Math.max(0, 1 - u * u)) * gate.archRise;
  };
  for (let i = 1; i < segments.length; i++) {
    const u = segments[i - 1],
      v = segments[i];
    const overOpening = isGate && u >= openingMin && v <= openingMax;
    const half = (p) => mix(crown(a.center), crown(b.center), p);
    const onSide = (coord, t, y) => point(coord(t), y);
    const highOuter = (t) => onSide(outer, t, half(t));
    const highInner = (t) => onSide(inner, t, half(t));
    const outerLow = (t) =>
      onSide(overOpening ? outer : base, t, overOpening ? archY(t) : ground(base(t)) - 0.85);
    const innerLow = (t) => onSide(inner, t, overOpening ? archY(t) : ground(inner(t)) - 0.83);
    quad(out, 'granite', outerLow(v), outerLow(u), highOuter(u), highOuter(v), granite);
    if (lod > 0 || overOpening)
      quad(out, 'granite', innerLow(u), innerLow(v), highInner(v), highInner(u), darker);
    quad(out, 'dress', highOuter(u), highInner(u), highInner(v), highOuter(v), dressed);
    if (overOpening)
      quad(out, 'dress', outerLow(u), outerLow(v), innerLow(v), innerLow(u), dressed);
  }
  if (isGate) {
    for (const t of [openingMin, openingMax]) {
      const near = outer(t),
        far = inner(t);
      const q = [
        point(near, entryFloor),
        point(far, entryFloor),
        point(far, archY(t)),
        point(near, archY(t)),
      ];
      if (t === openingMax) q.reverse();
      quad(out, 'dress', ...q, dressed);
    }
    quad(
      out,
      'dress',
      point(outer(openingMin), entryFloor),
      point(inner(openingMin), entryFloor),
      point(inner(openingMax), entryFloor),
      point(outer(openingMax), entryFloor),
      dressed,
    );
  }
  if (lod < 2 || len < 10 || Math.abs(a.center[1] - b.center[1]) > 4) return;
  for (let d = 4; d < len - 2; d += 4.25) {
    const t = d / len;
    if (isGate && t >= openingMin - 0.05 && t <= openingMax + 0.05) continue;
    const [x, z] = outer(t);
    const offsetT = Math.min(0.013, 0.13 / len);
    const l = outer(t - offsetT),
      r = outer(t + offsetT);
    const [inX, inZ] = inner(t);
    const nrm = direction([inX, inZ], [x, z]);
    const gap = 0.15;
    const back = (p) => [p[0] + nrm[0] * gap, p[1] + nrm[1] * gap];
    const y = crown([x, z]) - 1.65 - (Math.round(d / 4) % 4) * 0.17;
    quad(
      out,
      'timber',
      point(back(r), y - 0.38),
      point(back(l), y - 0.38),
      point(back(l), y),
      point(back(r), y),
      dusky,
    );
  }
}

function buttress(out, control, ground, lod) {
  const { x, z, width, depth, height } = control;
  const low = ground([x, z - depth * 0.32]) - 1.09;
  const w = width / 2,
    d = depth / 2;
  const plan = (widthScale, innerDepth, frontDepth, y) => [
    [x - w * widthScale, y, z - frontDepth],
    [x + w * widthScale, y, z - frontDepth],
    [x + w * widthScale, y, z + innerDepth],
    [x - w * widthScale, y, z + innerDepth],
  ];
  const bottom = plan(1.08, d, d + 0.65, low);
  const top = plan(0.87, d, d * 0.78, height);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(out, 'granite', bottom[j], bottom[i], top[i], top[j], i === 0 ? granite : darker);
  }
  quad(out, 'dress', top[3], top[2], top[1], top[0], dressed);
  if (lod > 1) {
    const band = plan(1.09, d + 0.015, d + 0.67, low + 0.64);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      quad(out, 'granite', bottom[j], bottom[i], band[i], band[j], darker);
    }
  }
}

function exteriorApproach(out, route, ground, lod) {
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.ceil(len / (lod > 1 ? 4.3 : 9));
    for (let j = 0; j < n; j++) {
      const p = between(a, b, j / n),
        q = between(a, b, (j + 1) / n),
        y = Math.min(ground(p), ground(q));
      const at = transform(out, -Math.atan2(q[1] - p[1], q[0] - p[0]), [p[0], 0, p[1]]);
      box(at, 'granite', [0, y - 0.6, -0.42], [len / n + 0.025, y + 1.35, 0.43], darker);
      if (lod > 1)
        box(at, 'dress', [0, y + 1.31, -0.47], [len / n + 0.025, y + 1.57, 0.49], dressed);
    }
  }
}

export function buildFortification(out, { path, ground, controls }, lod) {
  const half = controls.width / 2;
  if (lod === 0)
    path = path.filter((p, i) => {
      const previous = path.at(i - 1);
      return Math.hypot(p[0] - previous[0], p[1] - previous[1]) > 1.48;
    });
  const tower = controls.gateTowerCrown;
  const crown = ([x, z]) =>
    wallCrown(z, controls.crownProfile) +
    (x >= tower.xMin && x <= tower.xMax && z <= tower.zMax ? tower.rise : 0);
  const outer = offset(path, -half),
    inner = offset(path, half),
    base = offset(path, -half - 0.42);
  const rings = path.map((center, i) => ({
    center,
    outer: outer[i],
    inner: inner[i],
    base: base[i],
  }));
  for (let i = 0; i < rings.length; i++)
    wallEdge(out, rings[i], rings[(i + 1) % rings.length], ground, crown, controls.gate, lod);
  for (const entry of controls.buttresses) buttress(out, entry, ground, lod);
  if (lod > 0) exteriorApproach(out, controls.forecourt, ground, lod);
  if (lod > 1) {
    const x = -6.14,
      z = -30.15,
      y = crown([x, z]) - 5.17;
    box(out, 'timber', [x - 0.75, y, z - 0.55], [x + 0.75, y + 1.85, z + 0.24], wood);
    box(out, 'timber', [x - 0.41, y + 0.29, z - 0.58], [x + 0.41, y + 1.51, z - 0.52], dusky);
    box(out, 'dress', [x - 0.92, y + 1.78, z - 0.85], [x + 0.92, y + 2.04, z + 0.27], dressed);
  }
}
