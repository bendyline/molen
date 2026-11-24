import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_ashlar', roughness: 1 },
  coping: { slot: 'trim', graph: 'stone_granite', roughness: 0.97 },
  rubble: { slot: 'foundation', graph: 'stone_drywall', roughness: 1 },
};

const wallShade = ['a89b87', 'ab9e8a', 'ad9f8b', 'b0a18d'].map(rgb);
const crownShade = ['a89d8c', 'b1a48f', 'aba08b', 'a59a87'].map(rgb);
const courtShade = ['9e917a', 'a1947d', 'a3957f'].map(rgb);
const ornament = rgb('b6ab96');
const { origin, interval, samples } = site.grades;

function ground([x, z]) {
  const u = (x - origin[0]) / interval;
  const v = (z - origin[1]) / interval;
  const i = Math.floor(u),
    j = Math.floor(v);
  const p = u - i,
    q = v - j;
  const north = samples[j][i] * (1 - p) + samples[j][i + 1] * p;
  const south = samples[j + 1][i] * (1 - p) + samples[j + 1][i + 1] * p;
  return north * (1 - q) + south * q;
}

function ccw(points) {
  const area = points.reduce((sum, [x, z], i) => {
    const [u, v] = points[(i + 1) % points.length];
    return sum + x * v - z * u;
  }, 0);
  return area < 0 ? points : points.toReversed();
}

function face(out, slot, points, color) {
  for (let i = 1; i < points.length - 1; i++) {
    const p = [points[0], points[i], points[i + 1]].map((p) => p.map(Math.fround));
    const n = normalFor(...p);
    if (Math.hypot(...n) > 0.9) out.addTriangle(slot, '', p, n, [], color);
  }
}

function cap(out, slot, outline, height, color, downward = false) {
  const scratch = new MeshBufferBuilder();
  const n = [0, downward ? -1 : 1, 0];
  if (!scratch.addCap('trim', 'palette:#ffffff', outline, [], height, n, (p) => p, color))
    throw Error('Invalid Great Enclosure wall outline');
  const { positions, indices } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const p = [0, 1, 2].map((j) => indices[i + j] * 3);
    face(
      out,
      slot,
      p.map((k) => positions.slice(k, k + 3)),
      color,
    );
  }
}

function wall(out, outline, bottom, top, detail, { principal = false, overhead = false } = {}) {
  const ring = ccw(outline);
  const levels = detail < 2 ? [0, 1] : [0, 0.38, 0.75, 0.94, 1];
  const colors = principal ? wallShade : courtShade;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const at = (p, t) => [p[0], bottom(p) + (top(p) - bottom(p)) * t, p[1]];
    for (let j = 1; j < levels.length; j++) {
      const low = levels[j - 1],
        high = levels[j];
      const slot = low >= 0.94 ? 'coping' : principal ? 'wall' : 'rubble';
      const color = colors[Math.min(j - 1, colors.length - 1)];
      face(out, slot, [at(a, low), at(b, low), at(b, high), at(a, high)], color);
    }
    if (principal && detail >= 2 && !overhead) chevrons(out, a, b, top, detail);
  }
  cap(out, 'coping', ring, top, crownShade[1]);
  if (overhead) cap(out, 'coping', ring, bottom, crownShade[2], true);
}

function chevrons(out, a, b, top, detail) {
  const [x, z] = a,
    [u, v] = b;
  const dx = u - x,
    dz = v - z,
    span = Math.hypot(dx, dz);
  const nx = -dz / span,
    nz = dx / span;
  if (Math.min(z, v) < 21 || (x + u) / 2 < 10 || nz < 0.05 || span < 1.4) return;
  const count = Math.max(1, Math.floor(span / 0.92));
  const lift = detail === 3 ? 0.24 : 0.2;
  const baseY = top(a) * 0.73 + top(b) * 0.27 - 1.08;
  const endY = top(a) * 0.27 + top(b) * 0.73 - 1.08;
  const at = (t, h) => [
    x + dx * t + nx * 0.045,
    baseY + (endY - baseY) * t + h,
    z + dz * t + nz * 0.045,
  ];
  for (let i = 0; i < count; i++) {
    const left = (i + 0.05) / count,
      middle = (i + 0.5) / count,
      right = (i + 0.95) / count;
    beam(out, 'coping', at(left, 0), at(middle, lift), 0.092, 0.12, ornament);
    beam(out, 'coping', at(middle, lift), at(right, 0), 0.092, 0.12, ornament);
  }
}

const base = (p) => Math.min(-0.88, ground(p) - 1.04);

function mainTop(p) {
  const [x, z] = p;
  // Highest surviving stonework is on the southeastern curve.
  const d = ((x - 34) / 26) ** 2 + ((z - 30) / 24) ** 2;
  const height = 5.65 + 5.0 * Math.exp(-d) + 0.16 * Math.sin(x * 0.51 + z * 0.34);
  return ground(p) + height;
}

function passageRing(line, width) {
  const edge = (p, sign) => {
    return p.map(([x, z], i) => {
      const a = p[Math.max(0, i - 1)],
        b = p[Math.min(p.length - 1, i + 1)];
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        scale = (sign * width) / (2 * Math.hypot(dx, dz));
      return [x - dz * scale, z + dx * scale];
    });
  };
  return [...edge(line, 1), ...edge(line, -1).reverse()];
}

function tower(out, detail) {
  const {
    center: [x, z],
    relativeGround,
    height,
    baseRadius,
    crownRadius,
  } = site.tower;
  const n = [16, 24, 36, 48][detail];
  const levels = detail < 2 ? [0, 0.18, 0.57, 0.92, 1] : [0, 0.1, 0.27, 0.49, 0.72, 0.89, 0.97, 1];
  const ring = (h) => {
    const radius = crownRadius + (baseRadius - crownRadius) * (1 - h) * (1 + 0.12 * h);
    const y = h === 0 ? -0.88 : relativeGround + h * height;
    return Array.from({ length: n }, (_, i) => {
      const a = (-2 * Math.PI * i) / n;
      const edge = radius + (detail > 1 ? 0.026 * Math.cos(a * 7 + h * 3) : 0);
      const wear = h === 1 ? -0.16 + 0.15 * Math.cos(a * 6) : 0;
      return [x + edge * Math.cos(a), y + wear, z + edge * Math.sin(a)];
    });
  };
  const rings = levels.map(ring);
  for (let i = 1; i < rings.length; i++) {
    const high = rings[i],
      low = rings[i - 1];
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      face(
        out,
        i === rings.length - 1 ? 'coping' : 'wall',
        [low[j], low[k], high[k], high[j]],
        wallShade[Math.min(Math.floor(i / 2), wallShade.length - 1)],
      );
    }
  }
  const high = rings.at(-1);
  for (let i = 0; i < n; i++) {
    face(
      out,
      'coping',
      [[x, relativeGround + height - 0.03, z], high[i], high[(i + 1) % n]],
      crownShade[i % crownShade.length],
    );
  }
}

function enclosure(out, detail) {
  for (const ring of site.wallSpans) wall(out, ring, base, mainTop, detail, { principal: true });
  const entry = site.westernPassage;
  const threshold = ground([entry.thresholdX, entry.centerZ]);
  wall(out, entry.lintel, () => threshold + entry.height, mainTop, detail, {
    principal: true,
    overhead: true,
  });
  for (const { outline } of site.northWalls)
    wall(out, outline, base, (p) => ground(p) + 3.1 + 0.25 * Math.sin(p[0]), detail);
  wall(
    out,
    site.court.outline,
    base,
    (p) => ground(p) + 1.25 + 0.34 * Math.sin(0.24 * p[0] + 0.16 * p[1]),
    detail,
  );
  const inner = site.innerPassage;
  const ring = passageRing(inner.centerline, inner.width);
  wall(out, ring, base, (p) => ground(p) + 2.55 + 0.5 * Math.sin(0.093 * p[1]), detail);
  tower(out, detail);
}

export const buildSkyline = (out) => enclosure(out, 0);
export const buildDistrict = (out) => enclosure(out, 1);
export const buildStreet = (out) => enclosure(out, 2);
export const buildCloseup = (out) => enclosure(out, 3);
export const buildMaster = buildCloseup;
