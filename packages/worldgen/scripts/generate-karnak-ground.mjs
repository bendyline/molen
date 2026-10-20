import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import './install-deterministic-math.mjs';
import { fileURLToPath } from 'node:url';
import { buildKarnakBody, buildKarnakUnposed, karnakGround } from './karnak-model.mjs';

const dir = fileURLToPath(
    new URL(
      '../../../content/worldgen/source/places/ss/ssx/n0489_karnak_temple_complex',
      import.meta.url,
    ),
  ),
  read = async (p) => JSON.parse(await readFile(p, 'utf8')),
  scope = await read(`${dir}/review-scope.json`);
const candidateId = 'N0489';
if ((await read(`${dir}/map-frame.json`)).candidateId !== candidateId)
  throw new Error('Karnak ground identity changed');
const collect = (build) => {
  const triangles = [];
  build({
    addTriangle(_role, _ref, points) {
      triangles.push(points);
    },
  });
  return triangles;
};
const old = collect(buildKarnakUnposed),
  posed = collect((out) => buildKarnakBody(out, 4));
assert.equal(old.length, posed.length);
const cell = (x, z) => `${Math.floor(x / 16)},${Math.floor(z / 16)}`,
  cells = new Map();
for (let i = 0; i < old.length; i++) {
  const t = old[i],
    q = posed[i];
  for (let k = 0; k < 3; k++) {
    assert.equal(t[k][0], q[k][0]);
    assert.equal(t[k][2], q[k][2]);
  }
  const [a, b, c] = t,
    cross = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  if (cross < 0.0001 || Math.max(...t.map((p) => p[1])) > 3.1) continue;
  for (
    let z = Math.floor(Math.min(...t.map((p) => p[2])) / 16);
    z <= Math.floor(Math.max(...t.map((p) => p[2])) / 16);
    z++
  )
    for (
      let x = Math.floor(Math.min(...t.map((p) => p[0])) / 16);
      x <= Math.floor(Math.max(...t.map((p) => p[0])) / 16);
      x++
    ) {
      const key = `${x},${z}`,
        a = cells.get(key) ?? [];
      a.push(i);
      cells.set(key, a);
    }
}
export function sampleKarnakSourceFloor(x, z) {
  let hit;
  for (const i of cells.get(cell(x, z)) ?? []) {
    const [a, b, c] = old[i],
      det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]),
      u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det,
      v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
    if (
      u >= (-0.004 * Math.hypot(b[0] - c[0], b[2] - c[2])) / Math.abs(det) &&
      v >= (-0.004 * Math.hypot(c[0] - a[0], c[2] - a[2])) / Math.abs(det) &&
      u + v <= 1 + (0.004 * Math.hypot(a[0] - b[0], a[2] - b[2])) / Math.abs(det)
    ) {
      const y = u * a[1] + v * b[1] + (1 - u - v) * c[1],
        q = posed[i],
        height = u * q[0][1] + v * q[1][1] + (1 - u - v) * q[2][1] + Math.min(y, 0.15) - y,
        score = Math.abs(y - 0.15);
      if (
        !hit ||
        score < hit.score - 1e-5 ||
        (Math.abs(score - hit.score) < 1e-5 && height > hit.height)
      )
        hit = { original: y, height, score };
    }
  }
  return hit;
}
const floor = sampleKarnakSourceFloor;
const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0),
  sub = (a, b) => a.map((x, i) => x - b[i]);
function index(triangles) {
  const cells = new Map();
  for (const t of triangles) {
    for (
      let z = Math.floor(Math.min(...t.map((p) => p[2])) / 16);
      z <= Math.floor(Math.max(...t.map((p) => p[2])) / 16);
      z++
    )
      for (
        let x = Math.floor(Math.min(...t.map((p) => p[0])) / 16);
        x <= Math.floor(Math.max(...t.map((p) => p[0])) / 16);
        x++
      ) {
        const key = `${x},${z}`,
          a = cells.get(key) ?? [];
        a.push(t);
        cells.set(key, a);
      }
  }
  return cells;
}
const district = index(collect((out) => buildKarnakBody(out, 1))),
  street = index(collect((out) => buildKarnakBody(out, 2)));
function hit(cells, p, d) {
  for (const [a, b, c] of cells.get(cell(p[0], p[2])) ?? []) {
    const e1 = sub(b, a),
      e2 = sub(c, a),
      v = cross(d, e2),
      det = dot(e1, v);
    if (det <= 1e-10) continue;
    const q = sub(p, a),
      u = dot(q, v) / det;
    if (u < 0 || u > 1) continue;
    const w = cross(q, e1),
      s = dot(d, w) / det;
    if (s < 0 || u + s > 1) continue;
    const t = dot(e2, w) / det;
    if (t > 0.000001 && t < 0.12) return true;
  }
  return false;
}
export async function generateKarnakGround() {
  const levels = { district: [], street: [], closeup: [], source: [] };
  for (const [pi, ring] of scope.geographic.groundCutout.outlines.entries()) {
    const area = ring.reduce(
        (n, p, i) =>
          n + p[0] * ring[(i + 1) % ring.length][1] - p[1] * ring[(i + 1) % ring.length][0],
        0,
      ),
      sign = area > 0 ? 1 : -1;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        normal = [(sign * (b[1] - a[1])) / len, (-sign * (b[0] - a[0])) / len],
        count = Math.ceil(len / 12);
      for (let k = 0; k < count; k++) {
        const ends = [k / count, (k + 1) / count].map((t) => [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
          ]),
          floors = ends.map((p) => floor(p[0] - normal[0] * 0.003, p[1] - normal[1] * 0.003));
        assert(floors.every(Boolean), `No original floor at pocket ${pi} edge ${i}`);
        const terrain = ends.map((p) => karnakGround(...p)),
          mid = ends[0].map((x, j) => (x + ends[1][j]) / 2),
          floorMid = floor(mid[0] - normal[0] * 0.003, mid[1] - normal[1] * 0.003).height,
          groundMid = karnakGround(...mid),
          above = groundMid > floorMid,
          direction = above ? 1 : -1,
          n = normal.map((x) => (above ? -x : x));
        if (Math.max(...terrain.map((g, j) => Math.abs(g - floors[j].height))) < 0.05) continue;
        const top = ends.map((p, j) => [p[0], Math.max(floors[j].height, terrain[j] + 0.02), p[1]]),
          bottom =
            Math.min(
              ...Array.from({ length: 5 }, (_, i) =>
                karnakGround(
                  ends[0][0] + ((ends[1][0] - ends[0][0]) * i) / 4,
                  ends[0][1] + ((ends[1][1] - ends[0][1]) * i) / 4,
                ),
              ),
              ...floors.map((f) => f.height),
            ) - 0.25,
          facet = {
            points: [
              top[0],
              top[1],
              [ends[1][0], bottom, ends[1][1]],
              [ends[0][0], bottom, ends[0][1]],
            ],
            normal: [n[0], 0, n[1]],
            pocket: pi,
          };
        levels.source.push(facet);
        levels.closeup.push(facet);
        for (const [name, cells] of [
          ['district', district],
          ['street', street],
        ]) {
          let covered = true;
          for (const t of [0.15, 0.5, 0.85])
            for (const y of [0.2, 0.5, 0.8]) {
              const p = ends[0].map((x, j) => x + (ends[1][j] - x) * t),
                f = floors[0].height + (floors[1].height - floors[0].height) * t,
                g = karnakGround(...p),
                height = f + (g - f) * y;
              if (
                !hit(
                  cells,
                  [
                    p[0] - direction * normal[0] * 0.04,
                    height,
                    p[1] - direction * normal[1] * 0.04,
                  ],
                  [direction * normal[0], 0, direction * normal[1]],
                )
              )
                covered = false;
            }
          if (!covered) levels[name].push(facet);
        }
      }
    }
  }
  const result = {
    format: 'molen/structure-grade-foundations@1',
    candidateId: 'N0489',
    basis:
      'Boundary panels join the original occupied floor/basin pockets to the retained unmodified DEM. Below-floor panels face outward;excavation faces point inward. Twelve-meter maximum segments sample the terrain between their ends. Distant variants reuse their extended slab skirts where verified present. Skyline omits subpixel below-grade faces under its20m error allowance.',
    levels,
  };
  const bytes = `${JSON.stringify(result, null, 2)}\n`;
  if (process.argv.includes('--check'))
    assert.equal(
      await readFile(`${dir}/grade-foundations.json`, 'utf8'),
      bytes,
      'Karnak ground joins are stale;run this script before generating N0489',
    );
  else {
    await writeFile(`${dir}/grade-foundations.json`, bytes);
    scope.sourceDocuments = [...new Set([...scope.sourceDocuments, 'grade-foundations.json'])];
    await writeFile(`${dir}/review-scope.json`, `${JSON.stringify(scope, null, 2)}\n`);
  }
  console.log(
    JSON.stringify({
      candidateId,
      facets: Object.fromEntries(Object.entries(levels).map(([name, fs]) => [name, fs.length])),
      triangles: Object.fromEntries(
        Object.entries(levels).map(([name, fs]) => [name, fs.length * 2]),
      ),
    }),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]))
  await generateKarnakGround();
