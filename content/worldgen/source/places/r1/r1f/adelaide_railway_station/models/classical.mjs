import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  fan,
  fbox,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

export const surfaces = {
  sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.94 },
  ashlar: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.91 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.81 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.56 },
};
export const sandstone = rgb('bdab91');
export const mortar = rgb('a49a83');
export const trim = rgb('d3bfa2');
export const black = rgb('4b4b43');
export const glass = rgb('596367');
export const weatheredRoof = rgb('8c8a79');

export const edges = (ring) =>
  outwardRing(ring).map((a, i, r) => wallFace(a, r[(i + 1) % r.length]));

export function cap(out, slot, ring, y, color) {
  const mesh = new MeshBufferBuilder();
  if (
    !mesh.addCap(
      'roof',
      'palette:#ffffff',
      ring,
      [],
      () => y,
      [0, 1, 0],
      (p) => p,
      color,
    )
  )
    throw new Error('Could not triangulate the surveyed roof');
  const { positions, indices } = mesh.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (j) => positions.slice(j * 3, j * 3 + 3));
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      [0, 1, 0],
      points.map((p) => [p[0], p[2]]),
      color,
    );
  }
}

export function cornice(out, face, start, end, y, width, depth, detail) {
  fbox(out, 'sandstone', face, start, end, y, y + width, 0, depth, trim);
  if (detail > 0)
    fbox(out, 'sandstone', face, start, end, y - 0.12, y + 0.06, 0.008, depth * 0.64, mortar);
}

export function clock(out, face, u, y, radius, detail, depth = 0.29) {
  const p = (r, az, d) => face.P(u + r * Math.cos(az), y + r * Math.sin(az), d);
  const n = [12, 18, 28, 36][detail];
  const rim = (r, d) => Array.from({ length: n }, (_, i) => p(r, (Math.PI * 2 * i) / n, d));
  fan(out, 'metal', rim(radius + 0.1, depth), black);
  fan(out, 'glazing', rim(radius, depth + 0.015), rgb('dadbd1'));
  for (let i = 0; i < 12; i++) {
    if (detail === 1 && i % 3 !== 0) continue;
    const a = (Math.PI * 2 * i) / 12;
    beam(
      out,
      'metal',
      p(radius * 0.93, a, depth + 0.028),
      p(radius * (i % 3 === 0 ? 0.72 : 0.82), a, depth + 0.028),
      0.043,
      0.027,
      black,
    );
  }
  for (const [a, w, r] of [
    [Math.PI * 0.79, 0.07, 0.54],
    [Math.PI * 0.18, 0.044, 0.79],
  ])
    beam(out, 'metal', p(0.03, a, depth + 0.044), p(radius * r, a, depth + 0.044), w, 0.036, black);
}

export function archOver(out, face, center, radius, spring, top, inset, detail) {
  const start = detail === 1 ? 6 : 10;
  for (let i = 0; i < start; i++) {
    const a = Math.PI - (Math.PI * i) / start,
      b = Math.PI - (Math.PI * (i + 1)) / start;
    const x = center + radius * Math.cos(a),
      z = center + radius * Math.cos(b);
    const y = spring + radius * Math.sin(a),
      h = spring + radius * Math.sin(b);
    const p = face.P;
    quad4(out, 'sandstone', p(x, y, 0), p(z, h, 0), p(z, top, 0), p(x, top, 0), sandstone);
    quad4(
      out,
      'sandstone',
      p(z, h, -inset),
      p(x, y, -inset),
      p(x, top, -inset),
      p(z, top, -inset),
      sandstone,
    );
    quad4(out, 'sandstone', p(x, y, -inset), p(z, h, -inset), p(z, h, 0), p(x, y, 0), mortar);
  }
}
