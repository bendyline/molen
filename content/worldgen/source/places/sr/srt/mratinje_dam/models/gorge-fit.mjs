import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import fit from './gorge-fit.json' with { type: 'json' };

export { fit };

const detail = {
  skyline: { stride: 30, divisions: [1, 1, 1, 2, 1] },
  district: { stride: 5, divisions: [1, 5, 2, 5, 1] },
  street: { stride: 3, divisions: [1, 12, 4, 12, 1] },
  closeup: { stride: 2, divisions: [1, 20, 8, 20, 1] },
  master: { stride: 1, divisions: [1, 26, 12, 26, 1] },
};
const { datum } = fit;
const color = {
  rock: [0.39, 0.36, 0.32],
  slab: [0.61, 0.6, 0.54],
  asphalt: [0.39, 0.4, 0.378],
  roof: [0.46, 0.107, 0.096],
  glass: [0.164, 0.218, 0.246],
};

function triangle(out, slot, points, facing, tint = color[slot]) {
  const normal = normalFor(...points);
  if (normal.every((n) => n === 0)) return;
  const reverse = normal.reduce((sum, n, i) => sum + n * facing[i], 0) < 0;
  out.addTriangle(
    slot,
    'palette:#ffffff',
    reverse ? points.toReversed() : points,
    reverse ? normal.map((n) => -n) : normal,
    undefined,
    tint,
  );
}

function quad(out, slot, a, b, c, d, facing) {
  triangle(out, slot, [a, b, c], facing);
  triangle(out, slot, [a, c, d], facing);
}

function gorge(out, level) {
  const lod = detail[level];
  const rows = fit.rows.filter(([z], i) => i % lod.stride === 0 || fit.anchors.includes(z));
  const bands = detail.master.divisions;
  const vertices = rows.map(([z, breaks, heights]) => {
    let offset = 0;
    return bands.flatMap((width, band) => {
      const count = lod.divisions[band];
      const row = Array.from({ length: count + (band === bands.length - 1 ? 1 : 0) }, (_, i) => {
        const step = Math.round((i * width) / count);
        const x = breaks[band] + ((breaks[band + 1] - breaks[band]) * step) / width;
        return [x, heights[offset + step], z];
      });
      offset += width;
      return row;
    });
  });
  for (let j = 1; j < vertices.length; j++) {
    const a = vertices[j - 1],
      b = vertices[j];
    for (let i = 1; i < a.length; i++) {
      for (const points of [
        [a[i - 1], b[i - 1], b[i]],
        [a[i - 1], b[i], a[i]],
      ]) {
        const [x, , z] = points[0];
        const up = normalFor(...points)[1];
        const moss = Math.min(1, Math.max(0, (up - 0.46) / 0.44));
        const strata = 0.022 * Math.sin(x * 0.35 + z * 0.083);
        const tint = [
          0.41 - 0.14 * moss + strata,
          0.39 - 0.08 * moss + strata,
          0.34 - 0.13 * moss + strata,
        ];
        triangle(out, 'rock', points, [0, 1, 0], tint);
      }
    }
  }
  if (level === 'skyline') return;
  // Close the cut slope below its overlap with the native ground. It can be
  // seen from below at the road grade where the original heightfield was high.
  for (const side of [0, vertices[0].length - 1]) {
    const facing = [side === 0 ? 1 : -1, 0, 0];
    for (let i = 1; i < vertices.length; i++) {
      const a = vertices[i - 1][side],
        b = vertices[i][side];
      quad(out, 'rock', a, b, [b[0], -193, b[2]], [a[0], -193, a[2]], facing);
    }
  }
}

function pavedApproach(out, line, width) {
  const edges = line.map(([x, z, height, halfWidth = width], i) => {
    const a = line[Math.max(0, i - 1)],
      b = line[Math.min(line.length - 1, i + 1)];
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const scale = halfWidth / Math.hypot(dx, dz);
    return [
      [x - dz * scale, height - datum, z + dx * scale],
      [x + dz * scale, height - datum, z - dx * scale],
    ];
  });
  for (let j = 1; j < edges.length; j++) {
    const a = edges[j - 1],
      b = edges[j];
    quad(out, 'asphalt', a[1], a[0], b[0], b[1], [0, 1, 0]);
  }
}

function westRockBench(out, level) {
  const rows = fit.westBench;
  if (!rows) return;
  const stride = level === 'skyline' ? 8 : level === 'district' ? 3 : 1;
  const [joinX, joinZ] = fit.approaches[0].points.at(-1);
  const selected = rows
    .filter((row, i) => {
      const x = (row[2][0] + row[3][0]) * 0.5;
      const z = (row[2][2] + row[3][2]) * 0.5;
      return i % stride === 0 || i === rows.length - 1 || Math.hypot(x - joinX, z - joinZ) < 5;
    })
    .map((row) => (level === 'skyline' ? [row[0], row[2], row[3], row.at(-1)] : row));
  for (let j = 1; j < selected.length; j++) {
    const previous = selected[j - 1];
    const next = selected[j];
    for (let i = 1; i < previous.length; i++) {
      quad(out, 'rock', previous[i - 1], next[i - 1], next[i], previous[i], [0, 1, 0]);
    }
  }
}

function retainingGrid(out, level) {
  const {
    center: [x, z],
    facing: [nx, nz],
  } = fit.portals[0];
  const base = 684.7;
  const top = [
    [-22, 703],
    [-17, 711],
    [-10, 718],
    [-3, 717],
    [4, 711],
    [11, 704],
    [17, 697],
    [23, 692],
    [29, 687],
  ];
  const p = (along, absolute, lip = 0) => {
    const depth = 0.8 + (absolute - base) * 0.14 - lip;
    return [x - nz * along - nx * depth, absolute - datum, z + nx * along - nz * depth];
  };
  const normal = [nx, 0, nz];
  for (let i = 1; i < top.length; i++) {
    const [a, h] = top[i - 1],
      [b, k] = top[i];
    quad(out, 'rock', p(a, base), p(b, base), p(b, k), p(a, h), normal);
    if (level === 'skyline') continue;
    beam(out, 'slab', p(a, base, 0.21), p(a, h, 0.21), 0.38, 0.44, color.slab);
    for (let v = base + 1.45; v < Math.max(h, k); v += level === 'district' ? 8.7 : 4.4) {
      const fraction = (v - h) / (k - h);
      const cutoff = a + (b - a) * fraction;
      const left = v > h ? cutoff : a;
      const right = v > k ? cutoff : b;
      beam(out, 'slab', p(left, v, 0.21), p(right, v, 0.21), 0.4, 0.44, color.slab);
    }
  }
}

function splitRoof(out, ring, point, height, ridge) {
  for (const side of [-1, 1]) {
    const face = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      const left = side * (a[0] - ridge) >= 0,
        right = side * (b[0] - ridge) >= 0;
      if (left) face.push(a);
      if (left !== right)
        face.push([ridge, a[1] + ((b[1] - a[1]) * (ridge - a[0])) / (b[0] - a[0])]);
    }
    const indices = earcut(face.flat());
    for (let i = 0; i < indices.length; i += 3) {
      const points = indices.slice(i, i + 3).map((j) => point(face[j], height(face[j][0])));
      triangle(out, 'roof', points, [0, 1, 0]);
    }
  }
}

function serviceHouse(out, level) {
  const {
    outline,
    facing: [ux, uz],
    floor,
  } = fit.serviceHouse;
  const ring = outline.map(([x, z]) => [x * ux + z * uz, -x * uz + z * ux]);
  const west = Math.min(...ring.map(([u]) => u)),
    east = Math.max(...ring.map(([u]) => u));
  const eaves = floor + 8,
    ridge = (west + east) / 2;
  const height = (x) => eaves + 2.15 * (1 - (2 * Math.abs(x - ridge)) / (east - west));
  const point = ([u, v], h) => [u * ux - v * uz, h - datum, u * uz + v * ux];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const A = point(a, floor),
      B = point(b, floor);
    const normal = [B[2] - A[2], 0, A[0] - B[0]];
    if ((a[0] - ridge) * (b[0] - ridge) < 0) {
      const middle = [ridge, a[1] + ((b[1] - a[1]) * (ridge - a[0])) / (b[0] - a[0])];
      quad(
        out,
        'slab',
        A,
        point(middle, floor),
        point(middle, height(ridge)),
        point(a, height(a[0])),
        normal,
      );
      quad(
        out,
        'slab',
        point(middle, floor),
        B,
        point(b, height(b[0])),
        point(middle, height(ridge)),
        normal,
      );
    } else {
      quad(out, 'slab', A, B, point(b, height(b[0])), point(a, height(a[0])), normal);
    }
    const length = Math.hypot(normal[0], normal[2]);
    if (level === 'skyline' || length < 3.5) continue;
    const pane = (t, h) => {
      const p = point([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], h);
      return p.map((v, k) => v + (normal[k] * 0.035) / length);
    };
    for (const t of [0.27, 0.72]) {
      for (const sill of [floor + 1.6, floor + 5.1]) {
        const w = Math.min(0.085, 0.68 / length);
        quad(
          out,
          'glass',
          pane(t - w, sill),
          pane(t + w, sill),
          pane(t + w, sill + 1.35),
          pane(t - w, sill + 1.35),
          normal,
        );
      }
    }
  }
  splitRoof(out, ring, point, height, ridge);
}

export function buildMratinjeSite(out, level) {
  gorge(out, level);
  westRockBench(out, level);
  for (const { points, halfWidth } of fit.approaches) pavedApproach(out, points, halfWidth);
  retainingGrid(out, level);
  serviceHouse(out, level);
}
