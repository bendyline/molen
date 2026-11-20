import {
  beam,
  beamPath,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  edge,
  face,
  mix,
  palette,
  panel,
  pavilion,
  rect,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  brick: surface('wall', 'brick_flemish'),
  stone: surface('trim', 'stone_ashlar'),
  glass: surface('window', 'window_grid', 0.33, 0.07),
  frame: surface('trim', 'metal_painted', 0.63, 0.14),
  roof: surface('roof', 'concrete_plain'),
};
const C = palette({
  buff: 'b7a184',
  pale: 'd0c3ab',
  light: 'd8cfbc',
  base: '928579',
  roof: '8b877b',
  back: 'ad9a82',
  cap: 'c6b9a4',
  glass: '536362',
  towerGlass: '526765',
  glint: '84948c',
  frame: '635e52',
  deep: '414948',
});
const roofLine = 12.55;
const entranceTop = 15.45;

function trim(out, wall, left, right, low, high, depth, color = C.pale) {
  trimBlock(out, 'stone', wall, left, right, low, high, 0, depth, color);
}

function stripWindows(out, wall, low, high, start, end, bays, lod) {
  if (end <= start) return;
  panel(out, 'glass', wall, start, end, low, high, 0.025, C.glass);
  panel(out, 'frame', wall, start, end, low, low + 0.075, 0.069, C.frame);
  panel(out, 'frame', wall, start, end, high - 0.075, high, 0.069, C.frame);
  const pitch = (end - start) / bays;
  for (let bay = 1; bay < bays; bay += lod === 0 ? 3 : 1) {
    const u = start + pitch * bay;
    const width = lod < 2 ? 0.1 : bay % 3 === 0 ? 0.12 : 0.065;
    panel(out, 'frame', wall, u - width, u + width, low, high, 0.071, C.frame);
    if (lod === 3 && bay % 3 !== 0)
      panel(out, 'frame', wall, u - width + 0.027, u + width - 0.025, low, high, 0.076, C.light);
  }
  if (lod >= 2)
    panel(
      out,
      'frame',
      wall,
      start,
      end,
      mix(low, high, 0.72),
      mix(low, high, 0.72) + 0.054,
      0.078,
      C.frame,
    );
}

function streetElevation(out, w, side, lod) {
  const ann = side === 'ann';
  const start = ann ? 1.95 : 0.95;
  const end = w.length - (ann ? 1.5 : 2.15);
  for (const y of [4.6, 8.05]) {
    stripWindows(out, w, y, y + 1.48, start, end, ann ? 19 : 13, lod);
    trim(out, w, start - 0.17, end + 0.18, y - 0.2, y - 0.02, 0.23, C.light);
    trim(out, w, 0.02, w.length - 0.035, y + 1.5, y + 1.71, 0.17);
  }
  trim(out, w, 0.01, w.length - 0.01, 12.22, roofLine, 0.16, C.light);
  if (lod > 0) {
    trim(out, w, start - 0.08, end + 0.12, 0.27, 0.51, 0.13, C.base);
    const a = ann ? 3.5 : 4.2;
    const b = ann ? 15.6 : 14.3;
    stripWindows(out, w, 1.52, 2.81, a, b, ann ? 7 : 6, lod);
    stripWindows(out, w, 1.52, 2.81, b + 4.4, end - 0.4, ann ? 8 : 4, lod);
  }
  if (lod >= 2)
    for (const y of [6.2, 9.65, 11.94])
      panel(out, 'stone', w, start - 0.22, end + 0.22, y, y + 0.072, 0.055, C.cap);
}

function angularPier(out, wall, t, top, lod) {
  trim(out, wall, t - 0.66, t + 0.66, 0.16, top - 0.25, 0.56, C.buff);
  trim(out, wall, t - 0.15, t + 0.15, 0.08, top, 0.66, C.light);
  if (lod > 0) {
    trim(out, wall, t - 0.8, t - 0.66, 0.06, top - 0.43, 0.37, C.pale);
    trim(out, wall, t + 0.4, t + 0.58, 0.07, top - 0.43, 0.61, C.pale);
  }
  if (lod >= 2) {
    trim(out, wall, t - 0.7, t + 0.7, top - 0.47, top - 0.27, 0.63, C.cap);
    for (const y of [3.37, 6.73, 10.18])
      panel(out, 'stone', wall, t - 0.64, t + 0.64, y, y + 0.062, 0.572, C.cap);
  }
}

function tower(out, outline, walls, corner, grade, lod) {
  const last = corner.at(-1);
  const path = [...corner.map((i) => outline[i]), outline[last + 1]];
  const inside = [path[0][0] + 4.9, path[0][1] - 2.7];
  shell(out, [...path, inside], () => roofLine - 0.08, entranceTop, {
    wall: 'brick',
    color: C.buff,
    roof: 'roof',
    roofColor: C.roof,
  });
  for (const i of corner) {
    const w = walls[i];
    const y0 = i === 4 || i === 5 ? 0.25 : 3.25;
    const inset = i === 2 || i === last ? 0.17 : 0.04;
    panel(out, 'glass', w, inset, w.length - inset, y0, 12.93, 0.029, C.towerGlass);
    for (const y of [3.12, 6.95, 10.74, 12.91]) {
      if (y < y0) continue;
      panel(out, 'frame', w, 0.02, w.length - 0.02, y, y + 0.095, 0.083, C.frame);
    }
    panel(out, 'stone', w, 0.012, w.length - 0.012, 13.08, 13.38, 0.046, C.cap);
    panel(out, 'stone', w, 0.012, w.length - 0.012, 15.12, entranceTop, 0.058, C.light);
    if (lod > 0) {
      panel(out, 'frame', w, w.length * 0.48, w.length * 0.51, y0, 12.93, 0.078, C.frame);
      panel(out, 'glass', w, w.length * 0.19, w.length * 0.3, 3.82, 12.55, 0.055, C.glint);
      for (const mid of [0.3, 0.71]) {
        const x = w.length * mid;
        beamPath(
          out,
          'stone',
          [w.p(x - 0.19, 14.0, 0.095), w.p(x, 13.85, 0.095), w.p(x + 0.19, 14.0, 0.095)],
          0.092,
          0.058,
          C.light,
        );
      }
    }
    if (lod >= 2 && y0 < 1) {
      const middle = w.length * 0.52;
      panel(out, 'frame', w, middle - 0.075, middle + 0.075, 0.25, 3.12, 0.091, C.deep);
      panel(out, 'frame', w, middle - 0.29, middle - 0.13, 1.16, 1.24, 0.103, C.light);
    }
  }
  const canopy = corner
    .map((i) => walls[i].p(0, 3.22, 0.84))
    .concat([walls[last].p(walls[last].length, 3.22, 0.84)]);
  beamPath(out, 'stone', canopy, 1.44, 0.26, C.pale);
  angularPier(out, walls[1], walls[1].length - 0.79, 14.89, lod);
  angularPier(out, walls[last + 1], 0.8, 14.73, lod);

  const entry = walls[5];
  const length = entry.length;
  const front = [
    entry.p(-0.15, 0.12, -0.03),
    entry.p(length + 0.12, 0.12, -0.03),
    entry.p(length + 0.12, 0.12, 1.39),
    entry.p(-0.15, 0.12, 1.39),
  ];
  const plinth = front.map(([x, , z]) => [x, z]);
  shell(out, plinth, (p) => Math.min(grade(p) - 0.2, -0.28), 0.12, {
    wall: 'stone',
    color: C.base,
    roof: 'stone',
    roofColor: C.pale,
  });
}

function secondaryEntrance(out, wall, grade, lod) {
  const left = 17.45;
  const right = 21.4;
  const threshold = 1.0;
  panel(out, 'glass', wall, left + 0.41, right - 0.41, threshold, 3.85, 0.096, C.deep);
  trim(out, wall, left + 0.24, left + 0.41, threshold, 3.9, 0.21);
  trim(out, wall, right - 0.41, right - 0.24, threshold, 3.9, 0.21);
  const canopy = [wall.p(left - 0.12, 3.95, 1.32), wall.p(right + 0.15, 3.95, 1.32)];
  beam(out, 'stone', ...canopy, 2.56, 0.29, C.pale);
  if (lod === 0) return;
  const [sx, , sz] = wall.p(left - 4.2, 0, 2.0);
  const y = Math.min(threshold - 0.13, grade([sx, sz]) + 0.11);
  const ramp = [
    wall.p(left - 4.2, y, 0.15),
    wall.p(right, threshold, 0.15),
    wall.p(right, threshold, 2.04),
    wall.p(left - 4.2, y, 2.04),
  ];
  face(out, 'roof', ramp, up, C.cap);
  beam(out, 'stone', ramp[3], ramp[2], 0.15, 0.18, C.pale);
  if (lod >= 2) {
    const r = [wall.p(left - 3.96, y + 0.82, 1.99), wall.p(right - 0.17, threshold + 0.82, 1.99)];
    beam(out, 'frame', ...r, 0.054, 0.055, C.frame);
    for (const t of [0.02, 0.24, 0.49, 0.73, 0.99]) {
      const p = r[0].map((v, i) => mix(v, r[1][i], t));
      beam(out, 'frame', [p[0], p[1] - 0.81, p[2]], p, 0.042, 0.042, C.frame);
    }
  }
}

function draw(out, lod, { outline, annStreetSide, boundaryStreetSide, roundedCornerEdges }, grade) {
  const sign = areaSign(outline);
  const walls = outline.map((point, i) => edge(point, outline[(i + 1) % outline.length], sign));
  shell(out, outline, (p) => Math.min(grade(p) - 0.29, -0.22), roofLine, {
    wall: 'brick',
    color: C.buff,
    roof: 'roof',
    roofColor: C.roof,
  });
  tower(out, outline, walls, roundedCornerEdges, grade, lod);
  streetElevation(out, walls[annStreetSide], 'ann', lod);
  streetElevation(out, walls[boundaryStreetSide], 'boundary', lod);
  secondaryEntrance(out, walls[annStreetSide], grade, lod);
  for (const i of [0, 9, 10, 11]) {
    const w = walls[i];
    if (w.length > 7) {
      for (const y of [4.68, 8.01])
        stripWindows(out, w, y, y + 1.29, 1.45, w.length - 1.27, Math.round(w.length / 2.75), lod);
      if (lod > 0 && w.length > 18) {
        for (const u of [4.4, 9.4, 14.4])
          panel(out, 'frame', w, u, u + 3.15, 0.58, 3.6, 0.056, C.deep);
      }
    }
    trim(out, w, 0.035, w.length - 0.035, 12.3, roofLine, 0.14, C.cap);
  }
  for (const x of [-2, 18.9]) {
    block(out, 'brick', x, roofLine - 0.06, 6.95, 6.2, 1.21, 4.72, C.back);
    block(out, 'roof', x - 0.1, roofLine + 1.14, 6.85, 6.4, 0.17, 4.92, C.cap);
    if (lod >= 2)
      for (const z of [8.0, 9.1, 10.15])
        block(out, 'frame', x + 0.67, roofLine + 1.3, z, 4.9, 0.24, 0.33, C.frame);
  }
  if (lod === 3) {
    shell(out, rect(2.5, -4.65, 17.5, -2.8), () => roofLine, roofLine + 0.23, {
      wall: 'stone',
      color: C.base,
      roof: 'glass',
      roofColor: C.glass,
    });
    for (let x = 3.5; x <= 16.5; x += 1)
      block(out, 'frame', x, roofLine + 0.22, -4.62, 0.07, 0.065, 1.8, C.frame);
  }
}

const brewery = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-58, 28, -46],
    lookAt: [0, 6.2, 4],
    yaw: -2.25,
    sun: [-510, 410, -640],
    brief:
      'The former Queensland Brewery headquarters at 501 Ann Street, with a curved glazed corner turret, angular piers, buff brick and two long bands of ribbon windows.',
    views: [
      {
        name: 'rounded-entry-turret-and-chevron-frieze',
        position: [-34, 12, -24],
        lookAt: [-12, 7.3, -3],
      },
      { name: 'ann-street-ribbon-windows-and-ramp', position: [8, 11, -43], lookAt: [5, 6, -6] },
      { name: 'boundary-street-and-angular-piers', position: [-46, 14, 25], lookAt: [-8, 7, 12] },
      { name: 'standing-footprint-and-service-rear', position: [52, 32, 48], lookAt: [8, 7, 6] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = brewery;
export const model = {
  ...brewery.model,
  category: 'civic',
  recipeDependencies: [...brewery.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  sourceLicense:
    'Independent geometry from the mapped OpenStreetMap building footprint, Queensland Government elevation data, written records and the original public-domain State Library photograph.',
};
