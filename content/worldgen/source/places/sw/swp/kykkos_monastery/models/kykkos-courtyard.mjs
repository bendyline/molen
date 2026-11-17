/** Stone galleries and the lower well court documented in Kykkos's 2009 reference photos. */
import { loft } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const tone = {
  stone: rgb('a6a091'),
  edge: rgb('d6c1a4'),
  rib: rgb('bfab91'),
  floor: rgb('a69d8c'),
  recess: rgb('5a4b39'),
  timber: rgb('766045'),
};
const rect = (out, slot, x0, y0, x1, y1, z, color) =>
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    color,
  );

function profile(width, rise, fraction, pointed) {
  const theta = fraction * Math.PI;
  const x = (Math.cos(theta) * width) / 2;
  const y =
    rise *
    (pointed
      ? Math.sqrt(4 - Math.pow(1 + (2 * Math.abs(x)) / width, 2)) / Math.sqrt(3)
      : Math.sin(theta));
  return [x, y];
}

function arch(out, x, width, spring, rise, ceiling, lod, pointed) {
  const count = [4, 5, 10, 16][lod];
  const at = (i, z, trim) => {
    const [px, py] = profile(
      width + (trim ? 0.27 : 0),
      rise + (trim ? 0.15 : 0),
      i / count,
      pointed,
    );
    return [x + px, spring + py, z];
  };
  for (let i = 0; i < count; i++) {
    const a = at(i, 0.038, false),
      b = at(i + 1, 0.038, false);
    const aa = at(i, 0.042, true),
      bb = at(i + 1, 0.042, true);
    face(out, 'dress', [b, a, aa, bb], i % 3 === 1 && lod > 1 ? tone.rib : tone.edge);
    face(out, 'rubble', [bb, aa, [aa[0], ceiling, 0.025], [bb[0], ceiling, 0.025]], tone.stone);
    if (lod > 1) face(out, 'dress', [a, b, at(i + 1, -0.29, false), at(i, -0.29, false)], tone.rib);
  }
}

function masonryPier(out, x, floor, spring, width, lod) {
  const half = width / 2;
  if (lod < 2) {
    rect(out, 'rubble', x - half, floor, x + half, spring, 0.043, tone.stone);
    return;
  }
  box(out, 'rubble', [x - half, floor, -0.27], [x + half, spring, 0.043], tone.stone);
  box(
    out,
    'dress',
    [x - half - 0.075, spring - 0.105, -0.29],
    [x + half + 0.075, spring + 0.012, 0.1],
    tone.edge,
  );
}

function timberRail(out, a, b, y, lod) {
  const height = 0.72;
  rect(out, 'timber', a, y, b, y + 0.085, 0.059, tone.timber);
  rect(out, 'timber', a, y + height - 0.075, b, y + height, 0.059, tone.timber);
  const divisions = Math.max(2, Math.round((b - a) / [2, 1.4, 0.56, 0.36][lod]));
  for (let i = 0; i < divisions; i++) {
    const x = a + ((b - a) * (i + 0.5)) / divisions;
    if (lod > 2)
      box(out, 'timber', [x - 0.037, y + 0.048, -0.02], [x + 0.037, y + height, 0.06], tone.timber);
    else rect(out, 'timber', x - 0.03, y, x + 0.03, y + height, 0.06, tone.timber);
  }
}

function gallery(out, len, floor, height, bays, lod, { upper = false, pointed = false } = {}) {
  const spacing = len / bays;
  const pier = Math.min(0.56, spacing * 0.19);
  const spring = floor + (height < 3.4 ? 1.18 : 1.76);
  const rise = Math.min(
    height - (spring - floor) - 0.36,
    (spacing - pier) * (pointed ? 0.54 : 0.44),
  );
  for (let i = 0; i < bays; i++) {
    const x = (i + 0.5) * spacing;
    arch(out, x, spacing - pier, spring, rise, floor + height, lod, pointed);
    masonryPier(out, i * spacing, floor, spring, pier, lod);
    if (upper && lod > 0)
      timberRail(out, i * spacing + pier / 2, (i + 1) * spacing - pier / 2, floor, lod);
    if (i % 2 === 0 && lod > 1)
      rect(out, 'recess', x - 0.44, floor + 0.25, x + 0.44, floor + 1.92, -2.06, tone.recess);
  }
  masonryPier(out, len, floor, spring, pier, lod);
  if (lod > 1)
    box(
      out,
      'dress',
      [0, floor + height - 0.09, -2.21],
      [len, floor + height + 0.04, 0.19],
      tone.rib,
    );
}

function galleryDeck(out, length, floor) {
  face(
    out,
    'pave',
    [
      [-2.25, floor, 0.018],
      [length + 2.25, floor, 0.018],
      [length + 2.25, floor, -2.25],
      [-2.25, floor, -2.25],
    ],
    tone.floor,
  );
}

export function buildKykkosCourtyard(out, points, floor, top, lod, { well = null } = {}) {
  const total = points.reduce((value, [x, z], i) => {
    const [xx, zz] = points[(i + 1) % points.length];
    return value + x * zz - xx * z;
  }, 0);
  const ring = total > 0 ? points : [...points].reverse();
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i];
    const [xx, zz] = ring[(i + 1) % ring.length];
    const length = Math.hypot(xx - x, zz - z);
    if (length < 0.1) continue;
    const facade = transform(out, -Math.atan2(zz - z, xx - x), [x, 0, z]);
    if (length < 2.2 || lod === 0) {
      rect(facade, 'rubble', 0, floor, length, top, 0, tone.stone);
      continue;
    }
    const count = Math.max(1, Math.round(length / (lod === 1 ? 7.5 : 3.65)));
    const tiersAboveWall = well && i === 1;
    const first = tiersAboveWall ? floor + 2.24 : floor;
    const mid = first + (top - first) * 0.53;
    rect(facade, 'rubble', -2.27, floor - 0.42, length + 2.27, top + 0.03, -2.09, tone.stone);
    galleryDeck(facade, length, floor - 0.008);
    if (lod > 1) galleryDeck(facade, length, mid + 0.015);
    if (tiersAboveWall) {
      rect(facade, 'rubble', 0, floor - 0.16, length, first, 0.022, tone.stone);
      for (let j = 0; j < count; j++) {
        const xDoor = ((j + 0.5) * length) / count;
        rect(facade, 'timber', xDoor - 0.43, floor, xDoor + 0.43, floor + 1.89, 0.05, tone.timber);
      }
    }
    gallery(facade, length, first, mid - first, count, lod, {
      upper: Boolean(tiersAboveWall),
      pointed: !well,
    });
    gallery(
      facade,
      length,
      mid,
      top - mid,
      Math.max(1, Math.round(count / (well ? 1.4 : 1))),
      lod,
      {
        upper: true,
        pointed: Boolean(well),
      },
    );
    if (lod > 1)
      box(facade, 'timber', [0, top - 0.13, 0.02], [length, top + 0.02, 0.35], tone.timber);
  }
  if (well) {
    const [x, z] = well;
    const rim = (y, r) =>
      [
        [-1, -1],
        [-1, 1],
        [1, 1],
        [1, -1],
      ].map(([u, v]) => [x + u * r, y, z + v * r]);
    const rings = [rim(floor, 0.76), rim(floor + 0.81, 0.7), rim(floor + 0.93, 0.8)];
    loft(out, 'dress', rings, tone.floor);
    if (lod > 1) {
      const y = floor + 0.93;
      box(out, 'recess', [x - 0.49, y, z - 0.49], [x + 0.49, y + 0.015, z + 0.49], tone.recess);
      for (const dx of [-0.54, 0.54])
        box(
          out,
          'recess',
          [x + dx - 0.025, y, z - 0.025],
          [x + dx + 0.025, y + 1.66, z + 0.025],
          tone.recess,
        );
      box(
        out,
        'recess',
        [x - 0.59, y + 1.62, z - 0.028],
        [x + 0.59, y + 1.68, z + 0.028],
        tone.recess,
      );
    }
  }
}
