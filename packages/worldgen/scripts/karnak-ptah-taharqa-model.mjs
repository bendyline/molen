/** Ptah's independent temple axis and the point-located lakeside Taharqa remnant. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';

export const karnakPtahTaharqaCandidateId = 'karnak_temple_complex';

function localFace(f, data) {
  const { origin, u, v } = data;
  return (role, points, n, tint) =>
    f(
      role,
      points.map(([x, y, z]) => [
        origin[0] + u[0] * x + v[0] * z,
        y,
        origin[1] + u[1] * x + v[1] * z,
      ]),
      [u[0] * n[0] + v[0] * n[2], n[1], u[1] * n[0] + v[1] * n[2]],
      tint,
    );
}

function floorSurface(f, ring, y) {
  const indices = earcut(ring.flat(), null, 2);
  for (let i = 0; i < indices.length; i += 3)
    f(
      'stone',
      indices.slice(i, i + 3).map((k) => [ring[k][0], y, ring[k][1]]),
      [0, 1, 0],
    );
}

/** A real axial doorway; coarse broad torus/cavetto silhouette at nearer levels. */
function doorway(f, box, x, width, height, opening, depth, floor, detail) {
  const side = (width - opening) / 2;
  for (const s of [-1, 1])
    box(f, 'wall', x, floor, (s * (opening + side)) / 2, depth, height, side);
  box(f, 'stone', x, floor + height * 0.68, 0, depth, height * 0.32, opening);
  if (detail > 0) box(f, 'stone', x, floor + height, 0, depth + 0.45, 0.45, width + 0.35);
  if (detail >= 2) {
    for (const s of [-1, 1])
      box(f, 'stone', x - depth / 2 - 0.1, floor, s * (opening / 2 + 0.2), 0.2, height * 0.68, 0.4);
    box(f, 'stone', x - depth / 2 - 0.1, floor + height * 0.68, 0, 0.2, 0.3, opening + 0.8);
  }
}

function ptah(f, detail, { box, lathe }, data, floor) {
  const g = localFace(f, data.frame),
    rear = 50.3;
  floorSurface(g, data.localOutline, floor);
  if (detail === 0) {
    doorway(g, box, 0.8, 10.1, 5.7, 3, 1.4, floor, 0);
    for (const z of [-4.6, 4.6]) box(g, 'wall', 16, floor, z, 31, 2.1, 1);
    box(g, 'wall', 42, floor, 2.6, 16.6, 6.1, 15.2);
    return;
  }
  for (const [x, w, h, open, depth] of [
    [0.8, 10.1, 5.7, 3, 1.4],
    [9.2, 6.1, 4.7, 2.75, 1.25],
    [20.7, 6.3, 4.9, 2.8, 1.35],
    [32, 10.2, 6.1, 3, 1.6],
  ]) {
    if (detail === 1 && x === 9.2) continue;
    doorway(g, box, x, w, h, open, depth, floor, detail);
  }
  // Low interrupted approach walls preserve the open courts between the portals.
  for (const z of [-4.6, 4.6]) {
    const count = detail === 1 ? 2 : 6;
    for (let i = 0; i < count; i++)
      box(
        g,
        'wall',
        2 + ((i + 0.5) * 29) / count,
        floor - 0.25,
        z,
        29 / count,
        1.6 + (i % 3) * 0.35,
        1,
      );
  }
  if (detail === 1) {
    // District retains the open portal sequence and a coarse separate eastern range.
    box(g, 'wall', 42, floor, 2.6, 16.6, 6.1, 15.2);
    return;
  }
  // The mapped eastern range widens southward; its separate side chapel is not centered.
  box(g, 'wall', 41.2, floor, -4.6, 18.2, 5.4, 1);
  box(g, 'wall', 41.2, floor, 10, 18.2, 5.1, 1);
  box(g, 'wall', rear - 0.65, floor, 2.7, 1.3, 5.5, 15.2);
  for (const z of [-2.1, 2.1]) box(g, 'wall', 44.7, floor, z, 8.6, 5.4, 0.85);
  doorway(g, box, 40.4, 5.1, 5.4, 2.5, 1, floor, detail);
  box(g, 'stone', 45, floor + 5.4, 0, 10.1, 0.6, 5.2);
  // Broad roof strips over the portico leave its central approach open to the sky.
  for (const z of [-3.5, 3.4]) box(g, 'stone', 36.2, floor + 5.4, z, 6.8, 0.6, 2.8);
  box(g, 'wall', 35.1, floor, 6.4, 1, 4.6, 6.2);
  box(g, 'wall', 42, floor, 3.6, 13, 4.6, 0.9);
  box(g, 'stone', 43, floor + 4.6, 6.8, 12, 0.65, 6.2);
  if (detail >= 2) {
    for (const x of [35.1, 38.7])
      for (const z of [-2.6, 2.6])
        lathe(
          g,
          x,
          z,
          detail < 3
            ? [
                [0, 0.7],
                [4.7, 0.55],
                [5.4, 0.85],
              ]
            : [
                [0, 0.82],
                [0.25, 0.82],
                [0.4, 0.68],
                [4.6, 0.55],
                [5.15, 0.85],
                [5.4, 0.7],
              ],
          detail < 3 ? 4 : 12,
        );
    // Broad remnant blocks at court edges, never loose random surface triangles.
    for (const [x, z, h] of [
      [4, -3.4, 0.65],
      [14.5, 3.2, 0.9],
      [25, -3.4, 0.8],
      [29.4, 3.2, 0.6],
    ])
      box(g, 'stone', x, floor, z, 1.5, h, 1.3);
  }
}

function taharqa(f, detail, { box }, data, floor) {
  const g = localFace(f, data.frame),
    halfX = data.length / 2,
    halfZ = data.width / 2,
    bottom = floor - 1.8;
  if (detail === 0) {
    // At skyline scale the low collapsed plinth covers its below-grade pockets.
    box(g, 'wall', 0, floor, 0, data.length, 2.8, data.width);
    return;
  }
  box(g, 'stone', 0, bottom - 0.4, 0, data.length, 0.4, data.width);
  const broken = (x, z, w, d, h, seed) => {
    const count = detail === 1 ? 1 : detail === 2 ? 3 : 5;
    for (let i = 0; i < count; i++) {
      const isX = w > d,
        amount = isX ? w : d,
        y = h * (detail === 1 ? 1 : 0.85 + ((i + seed) % 4) * 0.055),
        section = amount / count;
      box(
        g,
        'wall',
        x + (isX ? (i + 0.5) * section - w / 2 : 0),
        bottom,
        z + (isX ? 0 : (i + 0.5) * section - d / 2),
        isX ? section : w,
        y + 1.8,
        isX ? d : section,
      );
    }
  };
  for (const sign of [-1, 1]) broken(0, sign * (halfZ - 1), data.length, 2, 2.6, sign + 1);
  broken(halfX - 1, 0, 2, data.width - 4, 2.8, 3);
  for (const sign of [-1, 1])
    broken(-halfX + 1, sign * (halfZ / 2 + 1.1), 2, halfZ - 2.2, 2.25, sign + 2);
  // Three open lower pockets share an axial walk-through, with no reconstructed roof.
  for (const x of detail === 1 ? [] : [-4.5, 4.5])
    for (const sign of [-1, 1])
      broken(x, sign * (halfZ / 2 + 1), 1.4, halfZ - 2.5, 1.65, x < 0 ? 1 : 3);
  const count = detail === 1 ? 1 : 7,
    start = -halfX - 2,
    end = -halfX + 6,
    width = 3.2;
  for (let i = 0; i < count; i++) {
    const y = floor - (1.8 * (i + 0.5)) / count,
      x0 = start + ((end - start) * i) / count,
      x1 = start + ((end - start) * (i + 1)) / count;
    box(g, 'stone', (x0 + x1) / 2, bottom - 0.4, 0, x1 - x0, y - bottom + 0.4, width);
  }
  if (detail >= 3)
    for (const [x, z, h, w, d, support] of [
      [-10, 9, 0.5, 2.4, 1.6, 2.496],
      [-2, -9, 0.7, 2, 1.6, 2.496],
      [9, 9, 0.8, 2.7, 1.7, 2.496],
      [13, -6.4, 0.55, 1.6, 1.8, 2.842],
    ]) {
      const streetSupport =
        x > 12
          ? 2.8 * (0.85 + ((Math.floor(((z + 8) / 16) * 3) + 3) % 4) * 0.055)
          : 2.6 * (0.85 + ((Math.floor(((x + 14) / 28) * 3) + (z > 0 ? 2 : 0)) % 4) * 0.055);
      box(g, 'stone', x, floor + (detail === 2 ? streetSupport : support) - 0.07, z, w, h, d);
    }
}

export function buildKarnakPtahTaharqa(f, detail, primitives, rec) {
  const data = rec.ptahTaharqa;
  if (!data) throw new Error('Karnak Ptah/Taharqa source parameters missing');
  ptah(f.withGrade('ptah'), detail, primitives, data.ptah, rec.floorY);
  taharqa(f.withGrade('taharqa'), detail, primitives, data.taharqa, rec.floorY);
}
