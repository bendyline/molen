import { readFileSync } from 'node:fs';
import {
  beamPath,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  cap,
  closed,
  edge,
  face,
  mix,
  opening,
  palette,
  pairs,
  panel,
  pavilion,
  shell,
  surface,
  trimBlock,
  up,
  xz,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const surfaces = {
  plaster: surface('wall', 'plaster_lime'),
  stone: surface('foundation', 'stone_limestone_raw'),
  roof: surface('roof', 'stone_limestone_raw'),
  window: surface('window', 'window_punched', 0.54, 0.04),
  trim: surface('trim', 'plaster_lime'),
  garden: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.91, metallic: 0 },
};
const C = palette({
  plaster: 'e1ddce',
  warmWhite: 'd7d2c2',
  shade: 'b5ae9b',
  cream: 'e8e0ce',
  stone: 'b8aa91',
  base: 'afaa9a',
  roof: 'b9b6a9',
  glazing: '4d524a',
  blind: 'ccc9ba',
  metal: '777b6d',
  court: 'b7ada0',
  brick: 'a98778',
  dirt: '767152',
  foliage: '6f784d',
  leaf: '818459',
});

const ranges = {
  north: { color: C.plaster },
  east: { height: 13.05, color: C.plaster },
  southEast: { height: 5.22, color: C.warmWhite },
  southCourt: { height: 5.36, color: C.warmWhite },
  southWest: { height: 5.62, color: C.warmWhite },
  northAnnex: { height: 10.15, color: C.warmWhite },
};

function arc(half, spring, rise, segments) {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const theta = (Math.PI * i) / segments;
    return [-half * Math.cos(theta), spring + rise * Math.sin(theta)];
  });
}

function archWindow(out, wall, u, width, sill, spring, top, offset, lod) {
  const path = arc(width * 0.5, spring, top - spring, lod > 2 ? 12 : 6);
  const padded = [[-width * 0.5, sill], ...path, [width * 0.5, sill]];
  face(
    out,
    'window',
    padded.map(([x, y]) => wall.p(u + x, y, offset)),
    wall.normal,
    C.glazing,
  );
  if (lod < 2) return;
  trimBlock(
    out,
    'trim',
    wall,
    u - width * 0.58,
    u + width * 0.58,
    sill - 0.06,
    sill + 0.045,
    offset + 0.005,
    offset + 0.065,
    C.warmWhite,
  );
  panel(out, 'trim', wall, u - 0.029, u + 0.029, sill, top - 0.045, offset + 0.018, C.metal);
  panel(
    out,
    'trim',
    wall,
    u - width * 0.48,
    u + width * 0.48,
    spring - 0.15,
    spring - 0.09,
    offset + 0.018,
    C.metal,
  );
}

function outerWindows(out, wall, floor, top, lod, hall) {
  if (lod === 0 || wall.length < 8.8) return;
  const rows = hall === 'north' || hall === 'east' ? 2 : 1;
  const count = Math.max(2, Math.round(wall.length / 4.15));
  for (let row = 0; row < rows; row++) {
    const base = rows === 2 ? floor + 2.3 + row * 4.0 : top - 2.75;
    for (let i = 1; i < count; i++) {
      const x = (i * wall.length) / count;
      opening(
        out,
        wall,
        x - 0.54,
        x + 0.54,
        base,
        base + (rows === 2 ? 1.85 : 1.32),
        'trim',
        C.glazing,
        'window',
        C.shade,
        lod,
        0.016,
      );
    }
  }
}

function finishRange(out, id, footprint, grade, floor, top, lod, courtEdges) {
  const underside = (p) => Math.min(grade(p) - 0.2, floor - 0.65);
  const parapet = id === 'north' ? 0.15 : 0.3;
  shell(
    out,
    footprint,
    underside,
    top - parapet,
    {
      wall: 'plaster',
      color: ranges[id].color,
      roof: 'roof',
      roofColor: C.roof,
    },
    (i) => !courtEdges.includes(i),
  );
  const normal = areaSign(footprint);
  for (const [[a, b], i] of pairs(closed(footprint)).map((p, i) => [p, i])) {
    const wall = edge(a, b, normal);
    if (wall.length > 1.3)
      panel(out, 'trim', wall, 0, wall.length, top - parapet, top, 0.012, C.cream);
    if (courtEdges.includes(i)) continue;
    const left = Math.min(grade(a) + 0.57, floor + 0.38);
    const right = Math.min(grade(b) + 0.57, floor + 0.38);
    face(
      out,
      'stone',
      [
        wall.p(0, underside(a), 0.018),
        wall.p(wall.length, underside(b), 0.018),
        wall.p(wall.length, right, 0.018),
        wall.p(0, left, 0.018),
      ],
      wall.normal,
      C.base,
    );
    if (lod > 0) panel(out, 'trim', wall, 0, wall.length, top - 0.47, top - 0.31, 0.043, C.cream);
    outerWindows(out, wall, floor, top, lod, id);
  }
}

function courtyardArcade(out, wall, floor, top, lod) {
  const n = 12;
  const step = wall.length / n;
  const half = step * 0.43;
  const spring = floor + 2.33;
  const ridge = floor + 4.49;
  const depth = 2.35;
  const points = [
    [0, 0],
    [wall.length, 0],
    [wall.length, -depth],
    [0, -depth],
  ].map(([u, d]) => xz(wall.p(u, 0, d)));
  cap(out, 'stone', points, floor + 0.032, C.stone);
  panel(out, 'plaster', wall, 0, wall.length, floor + 0.03, ridge, -depth, C.shade);
  panel(out, 'plaster', wall, 0, wall.length, ridge, top - 0.05, 0, C.plaster);
  if (lod === 0) {
    panel(out, 'plaster', wall, 0, wall.length, floor, ridge, 0, C.warmWhite);
    return;
  }
  trimBlock(out, 'trim', wall, 0, wall.length, ridge, ridge + 0.19, 0.02, 0.17, C.cream);
  panel(out, 'trim', wall, 0, wall.length, ridge + 0.2, ridge + 0.26, 0.08, C.shade);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) * step;
    const p = (x, y, d = 0) => wall.p(u + x, y, d);
    const crown = arc(half, spring, 1.65, [4, 6, 8, 12][lod]);
    for (const sign of [-1, 1]) {
      const [x, v] = [sign * half, sign * step * 0.5].sort((a, b) => a - b);
      panel(out, 'plaster', wall, u + x, u + v, floor + 0.02, ridge, 0, C.plaster);
      if (lod > 1)
        face(
          out,
          'plaster',
          [
            p(sign * half, floor + 0.032),
            p(sign * half, floor + 0.032, -depth),
            p(sign * half, spring, -depth),
            p(sign * half, spring),
          ],
          [-sign, 0, 0],
          C.warmWhite,
        );
    }
    for (const [[x, y], [xx, yy]] of pairs(crown)) {
      face(out, 'plaster', [p(x, y), p(xx, yy), p(xx, ridge), p(x, ridge)], wall.normal, C.plaster);
      if (lod > 1)
        face(
          out,
          'plaster',
          [p(x, y), p(x, y, -depth), p(xx, yy, -depth), p(xx, yy)],
          [0, -1, 0],
          C.shade,
        );
    }
    archWindow(out, wall, u, 1.35, floor + 0.64, floor + 2.26, floor + 2.89, -depth + 0.025, lod);
    for (const row of [0, 1]) {
      const windowBase = ridge + 0.78 + row * 3.42;
      const l = u - 0.49,
        r = u + 0.49;
      if (row === 1 && i % 2 === 1) {
        panel(out, 'trim', wall, l, r, windowBase, windowBase + 1.83, 0.014, C.blind);
      } else {
        opening(
          out,
          wall,
          l,
          r,
          windowBase,
          windowBase + 1.83,
          'trim',
          C.glazing,
          'window',
          C.shade,
          lod,
          0.022,
        );
      }
    }
    if (lod === 3) {
      const capital = u - step * 0.5;
      const l = Math.max(0, capital - 0.26),
        r = capital + 0.26;
      trimBlock(out, 'trim', wall, l, r, floor + 0.03, floor + 0.54, 0, 0.15, C.warmWhite);
      trimBlock(out, 'trim', wall, l, r, spring - 0.095, spring + 0.11, 0, 0.12, C.cream);
    }
  }
}

function eastCourt(out, wall, floor, top, lod) {
  panel(out, 'plaster', wall, 0, wall.length, floor - 0.39, top, 0, C.plaster);
  if (lod === 0) return;
  const n = 10;
  const step = wall.length / n;
  const crown = (u, y, h) => arc(step * 0.45, y, h, 10).map(([x, y]) => wall.p(u + x, y, 0.045));
  trimBlock(out, 'trim', wall, 0, wall.length, floor + 5.63, floor + 5.86, 0.018, 0.145, C.cream);
  trimBlock(out, 'trim', wall, 0, wall.length, top - 0.56, top - 0.29, 0.012, 0.12, C.cream);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) * step;
    archWindow(out, wall, u, 1.21, floor + 0.95, floor + 3.28, floor + 4.24, 0.015, lod);
    opening(
      out,
      wall,
      u - 0.53,
      u + 0.53,
      floor + 6.65,
      floor + 10.04,
      'trim',
      C.glazing,
      'window',
      C.shade,
      lod,
      0.018,
    );
    if (lod > 1) {
      for (const [base, rise] of [
        [floor + 3.49, 1.45],
        [floor + 8.98, 2.08],
      ]) {
        beamPath(out, 'trim', crown(u, base, rise), 0.14, 0.1, C.warmWhite);
        const uprights = [u - step * 0.45, u + step * 0.45];
        for (const x of uprights)
          panel(out, 'trim', wall, x - 0.073, x + 0.073, base - 1.83, base, 0.042, C.warmWhite);
      }
    }
  }
}

function courtPaving(out, north, east, south, floor, lod) {
  const outline = [north[0], north[1], east[3], south[0], [-38.5, 26.56], [-38.5, -20.75]];
  const center = [-6.2, 5.6];
  const bed = radialRing(0, 10.8, 7.1, 12, center).map(xz);
  const border = radialRing(0, 12.06, 8.26, 12, center).map(xz);
  const mesh = (outer, hole, slot, y, color) => {
    const points = [...outer, ...hole];
    const tris = earcut(points.flat(), [outer.length]);
    for (let i = 0; i < tris.length; i += 3)
      face(
        out,
        slot,
        tris.slice(i, i + 3).map((j) => at(points[j], y)),
        up,
        color,
      );
  };
  mesh(outline, border, 'stone', floor, C.court);
  mesh(border, bed, 'garden', floor + 0.04, C.brick);
  cap(out, 'garden', bed, floor + 0.13, C.dirt);
  if (lod === 0) return;
  const n = [0, 14, 26, 46][lod];
  for (let i = 0; i < n; i++) {
    const angle = i * 2.399963;
    const r = Math.sqrt((i + 0.5) / n) * 0.91;
    const spot = [center[0] + 10.25 * r * Math.cos(angle), center[1] + 6.55 * r * Math.sin(angle)];
    const size = 0.32 + ((i * 17) % 13) / 15;
    const ring = radialRing(0, size, size * 0.82, lod === 3 ? 8 : 5, spot).map(xz);
    for (const [a, b] of pairs(closed(ring)))
      face(
        out,
        'garden',
        [at(a, floor + 0.12), at(b, floor + 0.12), at(spot, floor + size * 0.75)],
        up,
        i % 3 === 0 ? C.leaf : C.foliage,
      );
  }
}

function draw(out, lod, controls, grade) {
  const { parts, northTop } = controls;
  const floor = 0.94;
  for (const [id, footprint] of Object.entries(parts)) {
    const courtEdges = id === 'north' ? [0] : id === 'east' ? [2] : [];
    finishRange(out, id, footprint, grade, floor, ranges[id].height ?? northTop, lod, courtEdges);
  }
  const north = parts.north,
    east = parts.east;
  const northFacade = edge(north[0], north[1], areaSign(north));
  const eastFacade = edge(east[2], east[3], areaSign(east));
  courtyardArcade(out, northFacade, floor, northTop, lod);
  eastCourt(out, eastFacade, floor, ranges.east.height, lod);
  courtPaving(out, north, east, parts.southCourt, floor, lod);
}

const museum = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-101, 52, 84],
    lookAt: [-10, 4.4, -4],
    sun: [-480, 580, 350],
    yaw: -0.85,
    brief:
      'Carthage National Museum in the former White Fathers seminary above Byrsa, with white arcades and a planted cloister court.',
    views: [
      {
        name: 'white-north-arcade-and-east-wing',
        position: [-28, 8.6, 14],
        lookAt: [-1, 5.5, -15],
      },
      { name: 'flat-roofs-and-byrsa-court', position: [-52, 92, 66], lookAt: [-8, 4, -1] },
      { name: 'south-range-above-hill', position: [46, 23, 92], lookAt: [-14, 4, 11] },
      { name: 'north-and-east-museum-exterior', position: [83, 35, -68], lookAt: [6, 6, -21] },
    ],
  },
  draw,
);

export const { skyline, district, street, closeup } = museum;
const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const model = {
  ...museum.model,
  embeddedCanonicalGraphs: museum.model.embeddedCanonicalGraphs.filter(Boolean),
  recipeDependencies: [...museum.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  buildingCutout: {
    outline: plan.dimensions.outline,
    outlines: Object.values(plan.dimensions.parts),
    minimumCoverage: 0.9,
    basis:
      'Separate mapped ranges replace the former seminary without suppressing the independent cathedral or the open court.',
  },
};
