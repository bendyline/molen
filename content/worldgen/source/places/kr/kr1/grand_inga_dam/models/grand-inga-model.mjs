import { createRequire } from 'node:module';
import { ShapeUtils, Vector2 } from 'three';
import { pointInRing, ringArea } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earthSiteFit from './earth-site-fit.json' with { type: 'json' };
import data from './landscape.json' with { type: 'json' };

const req = createRequire(
  new URL('../../../../../../../../packages/terrain/package.json', import.meta.url),
);
const { difference } = req('polygon-clipping');
export const surfaces = {
  ground: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.98, metallic: 0 },
  barrier: { slot: 'wall', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.86, metallic: 0.09 },
  river: { slot: 'trim', localRef: 'palette:#48667c', name: 'Mapped Congo River', roughness: 0.57 },
  reservoir: {
    slot: 'trim',
    localRef: 'palette:#398488',
    name: 'Proposed Bundi reservoir and channels',
    roughness: 0.56,
  },
};

const {
  origin,
  size,
  stepMeters: step,
  elevationScaleMeters,
  elevationsDecimeters,
  scenario,
} = data;
const extent = size.map((n, index) => origin[index] + (n - 1) * step);
const ref = 'palette:#ffffff';
const concrete = [0.68, 0.64, 0.52];
const aprons = [0.42, 0.42, 0.36];
const metal = [0.38, 0.42, 0.39];
const waterColor = [0.09, 0.2, 0.29];
const conceptColor = [0.08, 0.28, 0.3];
const blend = (a, b, t) => a.map((n, i) => n + t * (b[i] - n));
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const shiftInga8 = (point) => point.map((n, i) => n + earthSiteFit.phase8.translationMeters[i]);
export const earthScenario = {
  sites: scenario.sites.map((site) =>
    site.phase === 8
      ? { ...site, front: site.front.map(shiftInga8), outlet: shiftInga8(site.outlet) }
      : site,
  ),
  channels: scenario.channels.map((route) =>
    route.phase === 8 ? { ...route, path: earthSiteFit.phase8.channelPath } : route,
  ),
};

function sample(x, z) {
  const [u, v] = [x, z].map((n, i) => clamp((n - origin[i]) / step, 0, size[i] - 1));
  const col = Math.min(size[0] - 2, Math.floor(u));
  const row = Math.min(size[1] - 2, Math.floor(v));
  const n = row * size[0] + col;
  const heights = elevationsDecimeters;
  const a = u - col;
  const b = v - row;
  const north = heights[n] + a * (heights[n + 1] - heights[n]);
  const south = heights[n + size[0]] + a * (heights[n + size[0] + 1] - heights[n + size[0]]);
  return (north + b * (south - north)) * elevationScaleMeters;
}

function dist2(p, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dz) ** 2;
}

function simplifyLine(points, tolerance2) {
  let index = 0,
    distance = tolerance2;
  const a = points[0],
    b = points.at(-1);
  for (let i = 1; i < points.length - 1; i++) {
    const d = dist2(points[i], a, b);
    if (d > distance) {
      distance = d;
      index = i;
    }
  }
  if (!index) return [a, b];
  return [
    ...simplifyLine(points.slice(0, index + 1), tolerance2).slice(0, -1),
    ...simplifyLine(points.slice(index), tolerance2),
  ];
}

function simplifyRings(polys, tolerance) {
  if (!tolerance) return polys;
  const minIsland = tolerance ** 2 * 3;
  return polys.map((p) =>
    p
      .filter((r, index) => index === 0 || ringArea(r) > minIsland)
      .map((r) => {
        const middle = Math.floor(r.length / 2);
        const a = simplifyLine(r.slice(0, middle + 1), tolerance ** 2);
        const b = simplifyLine(r.slice(middle), tolerance ** 2);
        return a.length + b.length < 5 ? r : [...a.slice(0, -1), ...b];
      }),
  );
}

function triangles([outer, ...holes], emit) {
  const [outline, ...voids] = [outer, ...holes].map((r) =>
    r.slice(0, -1).map(([x, z]) => new Vector2(x, z)),
  );
  const positions = [outline, ...voids].flat().map((p) => [p.x, p.y]);
  for (const indices of ShapeUtils.triangulateShape(outline, voids))
    emit(indices.map((i) => positions[i]));
}

function surface(out, slot, positions, color, upward = false) {
  const row = positions.map((p) => p.map(Math.fround));
  const [a, b, c] = row;
  const u = b.map((n, i) => n - a[i]);
  const v = c.map((n, i) => n - a[i]);
  const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const area2 = Math.hypot(...cross);
  if (area2 < 1e-6) return;
  const sign = upward && cross[1] < 0 ? -1 : 1;
  const normal = cross.map((n) => (n * sign) / area2);
  out.addTriangle(
    slot,
    ref,
    row,
    normal,
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    color,
  );
}

function quad(out, slot, [a, b, c, d], color, upward = false) {
  surface(out, slot, [a, b, c], color, upward);
  surface(out, slot, [a, c, d], color, upward);
}

// A visual profile sampled across the mapped river reach, with the rapids between the two pools.
function riverSurface(x, z) {
  const north = 103 + clamp((-z - 3000) / 10000, 0, 1) * 49;
  return 48 + (north - 48) * clamp((-z - 400) / (x > 6200 ? 1500 : 4400), 0, 1);
}

function covers(polys, [x, z]) {
  return polys.some(
    ([outer, ...holes]) => pointInRing([x, z], outer) && !holes.some((r) => pointInRing([x, z], r)),
  );
}

function terrain(out, stride, tolerance) {
  const proposed = simplifyRings(data.proposalWater, tolerance * 0.6);
  const river = simplifyRings(data.river, tolerance);
  const waters = [
    { slot: 'river', polys: river, height: riverSurface, color: waterColor },
    {
      slot: 'reservoir',
      polys: proposed,
      height: () => scenario.presentationWaterElevation,
      color: conceptColor,
    },
  ];
  const boundaries = waters.flatMap((w) =>
    w.polys.flatMap((p) =>
      p.flatMap((r) =>
        r.slice(0, -1).map((a, i) => {
          const b = r[i + 1];
          return {
            a,
            b,
            height: w.height,
            bounds: [
              Math.min(a[0], b[0]),
              Math.min(a[1], b[1]),
              Math.max(a[0], b[0]),
              Math.max(a[1], b[1]),
            ],
          };
        }),
      ),
    ),
  );
  const polygons = waters.flatMap((w) => w.polys);
  const soft = step * 1.5;
  function renderGround(points, edges) {
    const locations = points.map(([x, z]) => {
      const natural = sample(x, z);
      let d2 = soft ** 2,
        y = natural;
      for (const edge of edges) {
        const candidate = dist2([x, z], edge.a, edge.b);
        if (candidate >= d2) continue;
        d2 = candidate;
        y = edge.height(x, z);
      }
      const t = Math.sqrt(d2) / soft;
      return [x, y + (natural - y) * t * t * (3 - 2 * t), z];
    });
    const average = locations.reduce((sum, p) => sum + p[1], 0) / locations.length;
    const color = blend([0.36, 0.43, 0.24], [0.55, 0.54, 0.31], clamp((average - 80) / 405, 0, 1));
    surface(out, 'ground', locations, color, true);
  }
  const spacing = stride * step;
  for (let z = origin[1]; z < extent[1]; z += spacing) {
    const z1 = Math.min(extent[1], z + spacing);
    const band = boundaries.filter(({ bounds: [, a, , b] }) => a <= z1 + soft && b >= z - soft);
    for (let x = origin[0]; x < extent[0]; x += spacing) {
      const x1 = Math.min(extent[0], x + spacing);
      const edges = band.filter(({ bounds: [a, , b] }) => a <= x1 + soft && b >= x - soft);
      const intersects = edges.some(
        ({ bounds: [a, b, c, d] }) => a <= x1 && c >= x && b <= z1 && d >= z,
      );
      const nw = [x, z],
        ne = [x1, z],
        se = [x1, z1],
        sw = [x, z1];
      if (intersects) {
        for (const polygon of difference([[nw, ne, se, sw, nw]], polygons))
          triangles(polygon, (pts) => renderGround(pts, edges));
      } else if (!covers(polygons, [(x + x1) / 2, (z + z1) / 2])) {
        renderGround([nw, ne, se], edges);
        renderGround([nw, se, sw], edges);
      }
    }
  }
  for (const { slot, polys, height, color } of waters) {
    for (const polygon of polys) {
      triangles(polygon, (points) =>
        surface(
          out,
          slot,
          points.map(([x, z]) => [x, height(x, z), z]),
          color,
          true,
        ),
      );
    }
  }
}

function frame(a, b, downstream) {
  const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / span,
    tz = (b[1] - a[1]) / span;
  const sign = (downstream[0] - a[0]) * -tz + (downstream[1] - a[1]) * tx < 0 ? -1 : 1;
  return {
    span,
    at: (u, y, v) => [a[0] + tx * u - tz * v * sign, y, a[1] + tz * u + tx * v * sign],
  };
}

function prism(out, at, slot, min, max, color) {
  const [x, y, z] = min,
    [x1, y1, z1] = max;
  const a = at(x, y, z),
    b = at(x1, y, z),
    c = at(x1, y, z1),
    d = at(x, y, z1);
  const e = at(x, y1, z),
    f = at(x1, y1, z),
    g = at(x1, y1, z1),
    h = at(x, y1, z1);
  for (const points of [
    [a, b, f, e],
    [b, c, g, f],
    [c, d, h, g],
    [d, a, e, h],
    [e, f, g, h],
  ]) {
    // The frame may be reflected depending on which side of the planned axis contains the apron.
    const center = at((x + x1) / 2, (y + y1) / 2, (z + z1) / 2);
    const origin = points[0];
    const norm = normalFor(...points.slice(0, 3));
    const outward = norm.reduce((s, n, i) => s + n * (origin[i] - center[i]), 0);
    quad(out, slot, outward < 0 ? points.toReversed() : points, color);
  }
}

function displayHeight(x, z) {
  if (covers(data.proposalWater, [x, z])) return scenario.presentationWaterElevation;
  if (covers(data.river, [x, z])) return riverSurface(x, z);
  return sample(x, z);
}

function station(out, site, detail) {
  const {
    front: [a, b],
    depthMeters,
    heightMeters,
    phase,
    outlet,
  } = site;
  const { at, span } = frame(a, b, outlet);
  const foot = [-18, span / 2, span + 18].flatMap((u) =>
    [0, depthMeters].map((v) => {
      const [x, , z] = at(u, 0, v);
      return displayHeight(x, z);
    }),
  );
  const datum = Math.max(...foot) + 3;
  const height = heightMeters + (phase === 3 ? 12 : 8);
  prism(
    out,
    at,
    'barrier',
    [-18, Math.min(...foot) - 8, -20],
    [span + 18, datum, depthMeters + 16],
    aprons,
  );
  prism(out, at, 'barrier', [0, datum, 0], [span, datum + height, depthMeters * 0.59], concrete);
  prism(
    out,
    at,
    'roof',
    [-2, datum + height, -3],
    [span + 2, datum + height + 3.6, depthMeters * 0.59 + 3],
    metal,
  );
  const [ox, oz] = outlet;
  const outletY = displayHeight(ox, oz) + 6;
  const [dx, dz] = [(b[0] - a[0]) / span, (b[1] - a[1]) / span];
  const lip = span * 0.21;
  quad(
    out,
    'barrier',
    [
      at(span * 0.1, datum + 1, depthMeters * 0.84),
      at(span * 0.9, datum + 1, depthMeters * 0.84),
      [ox + lip * dx, outletY, oz + lip * dz],
      [ox - lip * dx, outletY, oz - lip * dz],
    ],
    aprons,
    true,
  );
  if (detail === 0) return;
  const bays = phase === 3 ? 11 : 8;
  for (let bay = 0; bay < bays; bay++) {
    const u = (span * (bay + 0.19)) / bays,
      u1 = (span * (bay + 0.77)) / bays;
    prism(
      out,
      at,
      'roof',
      [u, datum + 4, depthMeters * 0.591],
      [u1, datum + height - 4, depthMeters * 0.607],
      metal,
    );
    if (detail > 1)
      prism(
        out,
        at,
        'barrier',
        [u - 2, datum, depthMeters * 0.61],
        [u + 5, datum + height + 1, depthMeters * 0.74],
        concrete,
      );
  }
  if (detail > 1) {
    prism(
      out,
      at,
      'roof',
      [span * 0.12, datum + height + 3.4, depthMeters * 0.11],
      [span * 0.84, datum + height + 8.7, depthMeters * 0.24],
      metal,
    );
    prism(
      out,
      at,
      'barrier',
      [span * 0.8, datum, depthMeters * 0.67],
      [span + 13, datum + 11, depthMeters * 0.9],
      concrete,
    );
  }
}

function pathSections(path, spacing) {
  const points = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i];
    const count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / spacing);
    for (let step = 1; step <= count; step++) points.push(blend(a, b, step / count));
  }
  return points.map(([x, z], i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = (a[1] - b[1]) / length,
      nz = (b[0] - a[0]) / length;
    return { center: [x, z], edge: (offset) => [x + nx * offset, z + nz * offset] };
  });
}

const point3 = ([x, z], y) => [x, y, z];

function barrier(out, detail) {
  const sections = pathSections(scenario.dam, detail === 0 ? 260 : 120);
  const crest = Math.max(
    scenario.presentationWaterElevation + 22,
    ...sections.map(({ center }) => displayHeight(...center) + 13),
  );
  const rows = sections.map(({ center, edge }) => {
    const foot = displayHeight(...center) - 8;
    return [
      point3(edge(-14), crest - 2),
      point3(edge(14), crest),
      point3(edge(82), foot),
      point3(edge(-23), foot),
    ];
  });
  for (let j = 1; j < rows.length; j++) {
    const [a, b, c, g] = rows[j - 1],
      [d, e, f, h] = rows[j];
    quad(out, 'barrier', [a, d, e, b], concrete, true);
    quad(out, 'barrier', [b, e, f, c], j % 2 ? concrete : blend(concrete, aprons, 0.16), true);
    quad(out, 'barrier', [a, g, h, d], blend(concrete, aprons, 0.18), true);
  }
}

function channel(out, route, detail, fittedToTerrain) {
  const { path, widthMeters: width } = route;
  const sections = pathSections(path, detail === 0 ? 260 : 115);
  const rows = sections.map(({ center, edge }) => {
    const left = edge(-width / 2),
      right = edge(width / 2);
    const stage =
      Math.max(displayHeight(...center), displayHeight(...left), displayHeight(...right)) + 10;
    const leftBank = edge(-width / 2 - 22);
    const rightBank = edge(width / 2 + 22);
    const bank = (point) =>
      point3(point, fittedToTerrain ? Math.min(stage - 1, sample(...point) - 2) : stage - 9);
    return [point3(left, stage), point3(right, stage), bank(leftBank), bank(rightBank)];
  });
  for (let i = 1; i < rows.length; i++) {
    const [a, b, g, h] = rows[i - 1],
      [c, d, j, k] = rows[i];
    quad(out, 'reservoir', [a, c, d, b], conceptColor, true);
    if (detail > 0 || fittedToTerrain) {
      quad(out, 'barrier', [a, g, j, c], aprons, true);
      quad(out, 'barrier', [b, d, k, h], aprons, true);
    }
  }
}

function structures(out, detail, fittedToTerrain) {
  const layout = fittedToTerrain ? earthScenario : scenario;
  barrier(out, detail);
  for (const site of layout.sites) station(out, site, detail);
  for (const route of layout.channels) channel(out, route, detail, fittedToTerrain);
}

function buildEarth(out, tolerance, detail) {
  for (const polygon of simplifyRings(data.proposalWater, tolerance)) {
    triangles(polygon, (points) =>
      surface(
        out,
        'reservoir',
        points.map((point) => point3(point, scenario.presentationWaterElevation)),
        conceptColor,
        true,
      ),
    );
  }
  structures(out, detail, true);
}

export const buildSkyline = (out) => buildEarth(out, 68, 0);
export const buildDistrict = (out) => buildEarth(out, 28, 1);
export const buildStreet = (out) => buildEarth(out, 10, 2);
export const buildCloseup = (out) => buildEarth(out, 2, 3);
export function buildMaster(out) {
  terrain(out, 1, 0);
  structures(out, 3, false);
}
