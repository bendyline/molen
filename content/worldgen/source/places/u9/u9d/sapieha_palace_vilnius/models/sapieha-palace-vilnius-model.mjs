import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  edge,
  face,
  mix,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  plane,
  rect,
  ring,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import controls from '../plan-controls.json' with { type: 'json' };

const surfaces = {
  wall: surface('wall', 'plaster_lime'),
  stucco: surface('trim', 'plaster_lime'),
  base: surface('foundation', 'stone_ashlar'),
  greenRoof: surface('roof', 'metal_standing_seam', 0.85, 0.15),
  tiledRoof: surface('roof', 'tile_ceramic', 0.87),
  glass: surface('window', 'window_punched'),
  timber: surface('door', 'wood_plain'),
  bronze: surface('trim', 'metal_bronze_cast', 0.85, 0.1),
};
const C = palette({
  wall: 'c8b69c',
  east: 'b8aa96',
  base: '9d8d7e',
  cream: 'e0cead',
  cornice: 'd6bda0',
  pale: 'd5c2a7',
  shade: '7c7162',
  dark: '64594f',
  roof: '8e7267',
  roofShade: '79685d',
  green: '778c7e',
  greenDark: '64796e',
  glass: '6b7371',
  wood: '716257',
  leaf: 'baab7c',
});
const floor = 2.61;
const eave = 14.52;
const front = -21.49382;
const center = -2.77151;

function sills(out, w, start, end, y, lod) {
  if (lod < 2) panel(out, 'stucco', w, start, end, y, y + 0.22, 0.064, C.cream);
  else trimBlock(out, 'stucco', w, start, end, y, y + 0.22, -0.048, 0.21, C.cream);
}
function axisWindow(out, lod, w, x, low, high, radius, draped = false) {
  if (lod < 2) {
    panel(out, 'glass', w, x - radius, x + radius, low, high, 0.04, C.glass);
    if (lod === 1)
      panel(
        out,
        'stucco',
        w,
        x - radius - 0.11,
        x + radius + 0.11,
        low - 0.11,
        low,
        0.073,
        C.cream,
      );
    return;
  }
  opening(
    out,
    w,
    x - radius,
    x + radius,
    low,
    high,
    'stucco',
    C.glass,
    'glass',
    C.cream,
    lod,
    0.04,
  );
  panel(
    out,
    'stucco',
    w,
    x - radius - 0.21,
    x + radius + 0.21,
    low - 0.15,
    low - 0.048,
    0.084,
    C.cream,
  );
  if (lod > 1) {
    panel(
      out,
      'stucco',
      w,
      x - radius - 0.13,
      x + radius + 0.13,
      low + (high - low) * 0.57,
      low + (high - low) * 0.57 + 0.05,
      0.072,
      C.cream,
    );
    panel(out, 'timber', w, x - 0.035, x + 0.035, low, high, 0.092, C.wood);
  }
  if (!draped) return;
  const arch = archRim(x, high + 0.13, radius + 0.24, 0.44, 8);
  beamPath(
    out,
    'stucco',
    arch.map(([u, y]) => w.p(u, y, 0.085)),
    0.125,
    0.17,
    C.cream,
  );
  if (lod === 3) {
    const d = 0.13;
    face(
      out,
      'stucco',
      [
        w.p(x - 0.21, high + 0.38, d),
        w.p(x, high + 0.7, d),
        w.p(x + 0.21, high + 0.38, d),
        w.p(x, high + 0.26, d),
      ],
      w.normal,
      C.cornice,
    );
  }
}

function archRim(center, y, width, rise, count) {
  return Array.from({ length: count + 1 }, (_, i) => {
    const u = (2 * i) / count - 1;
    return [center + width * u, y + rise * Math.sqrt(Math.max(0, 1 - u * u))];
  });
}

function sideArcade(out, lod, w, lower) {
  const count = 4;
  const step = w.length / count;
  const bottom = lower ? 2.18 : 7.13;
  const spring = bottom + (lower ? 2.58 : 2.73);
  const ceiling = lower ? 7.14 : 12.27;
  if (lod < 2) {
    panel(out, 'wall', w, 0, w.length, bottom - 0.13, ceiling, 0, C.wall);
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) * step;
      const radius = step * 0.34;
      const material = lower ? 'timber' : 'glass';
      const tone = lower ? C.dark : C.glass;
      const profile = archRim(u, spring, radius, 1.06, lod === 1 ? 6 : 4);
      panel(out, material, w, u - radius, u + radius, bottom, spring, 0.025, tone);
      face(
        out,
        material,
        profile.map(([x, y]) => w.p(x, y, 0.026)),
        w.normal,
        tone,
      );
    }
    return;
  }
  for (let i = 0; i < count; i++) {
    const start = step * i;
    const u = start + step / 2;
    const radius = step * 0.34;
    const arch = archRim(u, spring, radius, lower ? 1.12 : 1.05, [4, 6, 10, 14][lod]);
    const pr = (x, y, d = 0) => w.p(x, y, d);
    const back = lower ? -1.12 : -0.065;
    for (const [a, b] of [
      [start, u - radius],
      [u + radius, start + step],
    ])
      panel(out, 'wall', w, a, b, bottom - 0.13, ceiling, 0.017, C.wall);
    panel(
      out,
      lower ? 'timber' : 'glass',
      w,
      u - radius,
      u + radius,
      bottom - 0.13,
      spring + 0.04,
      back,
      lower ? C.dark : C.glass,
    );
    for (const [[a, y], [b, h]] of pairs(arch)) {
      face(out, 'wall', [pr(a, y), pr(b, h), pr(b, ceiling), pr(a, ceiling)], w.normal, C.wall);
      if (lower)
        face(
          out,
          'wall',
          [pr(a, y), pr(b, h), pr(b, h, back), pr(a, y, back)],
          [0, -1, 0],
          C.shade,
        );
      face(
        out,
        lower ? 'timber' : 'glass',
        [
          pr(a, spring - 0.05, back),
          pr(b, spring - 0.05, back),
          pr(b, spring + 1.13, back),
          pr(a, spring + 1.13, back),
        ],
        w.normal,
        lower ? C.dark : C.glass,
      );
    }
    if (lower)
      for (const sign of [-1, 1]) {
        const x = u + sign * radius;
        const t = [-w.normal[2] * sign, 0, w.normal[0] * sign];
        face(
          out,
          'wall',
          [pr(x, bottom, back), pr(x, bottom), pr(x, spring), pr(x, spring, back)],
          t,
          C.shade,
        );
      }
    if (lod > 0) {
      beamPath(
        out,
        'stucco',
        [
          pr(u - radius, bottom, 0.082),
          ...arch.map(([a, y]) => pr(a, y, 0.073)),
          pr(u + radius, bottom, 0.082),
        ],
        0.16,
        0.18,
        C.cream,
      );
      if (!lower) {
        panel(
          out,
          'stucco',
          w,
          u - radius - 0.24,
          u + radius + 0.24,
          bottom - 0.13,
          bottom + 0.07,
          0.139,
          C.cream,
        );
        for (const x of [u - radius * 0.43, u + radius * 0.43])
          panel(out, 'stucco', w, x - 0.034, x + 0.034, bottom, spring + 0.58, 0.085, C.cream);
        for (const y of [bottom + 0.71, bottom + 1.43, spring - 0.02])
          panel(out, 'stucco', w, u - radius, u + radius, y, y + 0.058, 0.085, C.cream);
      }
    }
  }
}

function mainWall(out, lod, outline, grade) {
  const direction = areaSign(outline);
  const main = outline.slice(14).concat([[4.46, 17.7]]);
  const activeArcades = [17, 25];
  shell(out, outline, (p) => Math.min(grade(p) - 0.42, 1.75), floor, {
    wall: 'base',
    color: C.base,
    roofColor: C.base,
  });
  shell(
    out,
    main,
    () => floor - 0.03,
    eave,
    { wall: 'wall', color: C.wall, roof: 'tiledRoof', roofColor: C.roof },
    (i) => !activeArcades.includes(i + 14),
  );
  for (const [[a, b], i] of pairs([...main, main[0]]).map((pair, i) => [pair, i + 14])) {
    const w = edge(a, b, direction);
    if (w.length < 2.2) continue;
    const frontSide = i === 22;
    const start = frontSide ? -11.67 - a[0] : 0;
    const end = frontSide ? 7.79 - a[0] : w.length;
    if (activeArcades.includes(i)) {
      sideArcade(out, lod, w, true);
      sideArcade(out, lod, w, false);
      sills(out, w, 0, w.length, 12.15, lod);
      panel(out, 'wall', w, 0, w.length, 12.3, eave, 0.003, C.wall);
      for (let j = 0; j < 4; j++)
        axisWindow(out, lod, w, (w.length * (j + 0.5)) / 4, 12.52, 14.0, 0.68);
    } else if (w.length > 5.2 && (lod > 0 || frontSide)) {
      const n = frontSide ? 5 : Math.max(2, Math.floor(w.length / 3.35));
      for (let j = 0; j < n; j++) {
        if (lod === 0 && j % 2 === 1) continue;
        const u = mix(start, end, (j + 0.5) / n);
        for (const [n, y] of [
          [0, floor + 0.62],
          [1, 7.77],
          [2, 12.1],
        ]) {
          if (frontSide && j === 2 && n < 2) continue;
          axisWindow(
            out,
            lod,
            w,
            u,
            y,
            y + (n === 1 ? 2.12 : 1.55),
            n === 1 ? 0.84 : 0.62,
            n === 1,
          );
        }
      }
    }
    if (lod > 1 && frontSide)
      for (let i = 1; i < 5; i++) {
        const u = mix(start, end, i / 5);
        trimBlock(out, 'stucco', w, u - 0.13, u + 0.13, 6.99, 14.11, 0, 0.21, C.cream);
      }
    sills(out, w, start, end, 6.79, lod);
    sills(out, w, start, end, eave - 0.33, lod);
    if (frontSide || activeArcades.includes(i)) {
      for (const y of [floor + 0.2, floor + 0.49, floor + 0.78])
        panel(out, 'base', w, start, end, y, y + 0.08, 0.072, C.base);
    }
  }
}

function hip(out, lod, box, base, top, copper) {
  const [x, z, a, b] = box;
  const sections =
    lod === 0
      ? [
          [0, 0],
          [1, 1],
        ]
      : [
          [0, 0],
          [0.22, 0.085],
          [0.5, 0.29],
          [0.77, 0.67],
          [1, 1],
        ];
  const ridge = copper ? 0.034 : 0.27;
  const rings = sections.map(([s, h]) => {
    const i = (a - x) * s * 0.5 * (1 - ridge),
      j = (b - z) * s * 0.5 * (1 - 0.025);
    return rect(x + i, z + j, a - i, b - j).map(([x, z]) => [x, mix(base, top, h), z]);
  });
  const material = copper ? 'greenRoof' : 'tiledRoof';
  const tint = copper ? C.green : C.roof;
  const seam = copper ? C.greenDark : C.roofShade;
  for (const [low, high] of pairs(rings))
    for (let i = 0; i < 4; i++)
      face(
        out,
        material,
        [low[i], low[(i + 1) % 4], high[(i + 1) % 4], high[i]],
        up,
        i % 2 === 0 ? tint : seam,
      );
  face(out, material, rings.at(-1), up, seam);
  if (lod < 2) return;
  for (let k = 0; k < 4; k++) {
    beamPath(
      out,
      material,
      rings.map((r) => r[k]),
      0.11,
      0.12,
      seam,
    );
    if (lod === 3) {
      for (const s of [0.2, 0.4, 0.6, 0.8])
        beamPath(
          out,
          material,
          rings.map((r) => {
            const a = r[k],
              b = r[(k + 1) % 4];
            return [mix(a[0], b[0], s), a[1] + 0.034, mix(a[2], b[2], s)];
          }),
          0.07,
          0.07,
          seam,
        );
    }
  }
}

function pavilionTower(out, lod, box, grade, peak) {
  const [x0, z0, x1, z1] = box;
  const y = 16.15;
  const bounds = rect(x0, z0, x1, z1);
  shell(out, bounds, (p) => Math.min(grade(p) - 0.32, floor - 0.22), y, {
    wall: 'wall',
    color: C.wall,
    roof: 'greenRoof',
    roofColor: C.greenDark,
  });
  for (const [a, b] of pairs([...bounds, bounds[0]])) {
    const w = edge(a, b);
    sills(out, w, 0, w.length, y - 0.43, lod);
    sills(out, w, 0, w.length, 6.88, lod);
    const levels = [
      [3.2, 4.67],
      [8.15, 10.25],
      [12.27, 14.43],
    ];
    for (const [f, g] of lod === 0 ? levels.slice(1) : levels) {
      const center = w.length / 2;
      for (const x of [center - w.length * 0.2, center + w.length * 0.2])
        axisWindow(out, lod, w, x, f, g, 0.53, f === 8.15);
    }
    if (lod > 0) {
      axisWindow(out, lod, w, w.length / 2, 14.89, 15.55, 0.37);
      for (const x of [0, w.length - 0.34])
        panel(out, 'stucco', w, x, x + 0.34, 3.11, y - 0.27, 0.042, C.cream);
    }
  }
  hip(out, lod, [x0 - 0.25, z0 - 0.23, x1 + 0.27, z1 + 0.22], y, peak - 1.18, true);
  const c = [(x0 + x1) / 2, (z0 + z1) / 2];
  ring(
    out,
    'bronze',
    c,
    lod === 0
      ? [
          [peak - 1.18, 0.28],
          [peak, 0.04],
        ]
      : [
          [peak - 1.33, 0.32],
          [peak - 0.82, 0.24],
          [peak - 0.59, 0.29],
          [peak - 0.27, 0.16],
          [peak, 0.036],
        ],
    lod === 0 ? 5 : 8,
    C.leaf,
  );
}

function figuralFronton(out, lod) {
  const roofBase = 14.52;
  const w = plane(front - 0.38, -1);
  const centerWidth = 5.18;
  const arc = archRim(center, roofBase + 0.21, centerWidth, 3.1, [6, 12, 16, 24][lod]);
  for (const [[a, y], [b, h]] of pairs(arc)) {
    face(out, 'wall', [w.p(a, roofBase), w.p(b, roofBase), w.p(b, h), w.p(a, y)], w.normal, C.wall);
    face(out, 'stucco', [w.p(a, y), w.p(b, h), w.p(b, h, -0.9), w.p(a, y, -0.9)], up, C.cream);
  }
  sills(out, w, center - centerWidth - 0.1, center + centerWidth + 0.1, roofBase - 0.08, lod);
  if (lod > 0) {
    beamPath(
      out,
      'stucco',
      arc.map(([x, y]) => w.p(x, y, 0.11)),
      0.19,
      0.24,
      C.cream,
    );
    const radius = 0.66;
    const medallion = Array.from({ length: 12 }, (_, i) => {
      const t = (2 * Math.PI * i) / 12;
      return w.p(center + radius * Math.cos(t), roofBase + 1.51 + radius * Math.sin(t), 0.096);
    });
    face(out, 'stucco', medallion, w.normal, C.cornice);
    beamPath(out, 'stucco', [...medallion, medallion[0]], 0.104, 0.1, C.cream);
    if (lod > 1)
      for (const sign of [-1, 1])
        beamPath(
          out,
          'stucco',
          [
            w.p(center + sign * 0.53, roofBase + 1.09, 0.1),
            w.p(center + sign * 1.28, roofBase + 0.8, 0.1),
            w.p(center + sign * 2.14, roofBase + 0.89, 0.1),
          ],
          0.13,
          0.11,
          C.cream,
        );
  }
}

function frontApproach(out, lod, grade) {
  const w = plane(front - 0.1, -1);
  const base = 2.54;
  const left = center - 3.27,
    right = center + 3.27;
  const toe = front - 3.12;
  block(
    out,
    'base',
    left,
    Math.min(grade([center, toe]) - 0.38, 0.1),
    toe,
    right - left,
    base - Math.min(grade([center, toe]) - 0.38, 0.1),
    3.16,
    C.base,
  );
  for (const side of [-1, 1])
    for (let i = 0; i < (lod === 0 ? 4 : 8); i++) {
      const count = lod === 0 ? 4 : 8;
      const inner = side < 0 ? left : right;
      const edge = inner + (side * 3.4 * (i + 1)) / count;
      const top = mix(2.53, Math.max(grade([edge, toe]) + 0.14, 0.38), (i + 1) / count);
      const low = Math.min(grade([edge, toe]) - 0.12, top - 0.12);
      block(
        out,
        'base',
        side < 0 ? edge : edge - 3.4 / count,
        low,
        toe,
        3.4 / count,
        top - low,
        2.14,
        C.base,
      );
    }
  const rad = 1.52;
  const portal = archRim(center, 5.03, rad, 0.69, lod < 2 ? 6 : 12);
  panel(out, 'timber', w, center - rad, center + rad, base, 5.05, 0.054, C.wood);
  face(
    out,
    'timber',
    portal.map(([x, y]) => w.p(x, y, 0.054)),
    w.normal,
    C.wood,
  );
  if (lod > 0) {
    beamPath(
      out,
      'stucco',
      [
        w.p(center - rad, base, 0.105),
        ...portal.map(([x, y]) => w.p(x, y, 0.105)),
        w.p(center + rad, base, 0.105),
      ],
      0.28,
      0.32,
      C.cream,
    );
    panel(out, 'base', w, center - 1.22, center + 1.22, 6.05, 6.43, 0.06, C.shade);
  }
}

function roundAnnex(out, lod, arc, grade) {
  const shape = [...arc.slice(0, 14), [-1.26, 17.75], [4.43, 17.69]];
  const roof = 12.18;
  shell(out, shape, (p) => Math.min(grade(p) - 0.32, 2.71), roof, {
    wall: 'wall',
    color: C.east,
    roof: 'greenRoof',
    roofColor: C.greenDark,
  });
  const c = [1.55, 22.58];
  const meters = 4.67;
  ring(
    out,
    'greenRoof',
    c,
    [
      [roof - 0.07, meters + 0.09],
      [roof + 0.31, meters + 0.13],
      [roof + 1.88, 0.12],
    ],
    lod === 0 ? 10 : lod === 1 ? 14 : 26,
    C.greenDark,
  );
  const winding = areaSign(shape);
  for (const [[a, b], i] of pairs(arc).map((pair, i) => [pair, i])) {
    const w = edge(a, b, winding);
    panel(out, 'stucco', w, 0, w.length, roof - 0.31, roof - 0.14, 0.041, C.cream);
    if (i % 3 !== 1) continue;
    for (const y of [3.49, 7.46, 10.19])
      axisWindow(out, lod, w, w.length / 2, y, y + 1.19, 0.43, y === 7.46);
  }
}

function build(out, lod, d, grade) {
  mainWall(out, lod, d.outline, grade);
  hip(out, lod, [-12.12, front - 0.29, 13.88, 17.31], eave, 21.25, false);
  for (const box of [
    [-20.69, front - 0.26, -11.67, -10.08],
    [7.79, front - 0.26, 15.16, -10.15],
    [-13.17, 8.73, -6.24, 17.86],
    [8.44, 8.62, 15.53, 17.63],
  ])
    pavilionTower(out, lod, box, grade, d.mappedHeightMeters);
  roundAnnex(out, lod, d.easternRound, grade);
  figuralFronton(out, lod);
  frontApproach(out, lod, grade);
}

const bundle = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'The restored three-storey Baroque palace in Vilnius, with four concave-roofed corner pavilions, a curved park facade fronton, twin stairs, glazed side galleries and the round eastern addition.',
    camera: [37, 28, -57],
    lookAt: [-1, 9, 0],
    sun: [-385, 608, -719],
    yaw: -0.66,
    views: [
      {
        name: 'park-facade-and-curved-fronton',
        position: [-1.85, 9.85, -56],
        lookAt: [center, 10.7, -20.9],
      },
      { name: 'north-double-arcades', position: [47, 13, 1.1], lookAt: [13, 7.4, -3.1] },
      { name: 'round-eastern-addition', position: [40, 31, 56], lookAt: [1.8, 9.4, 11.9] },
    ],
  },
  build,
);
export const { model, skyline, district, street, closeup } = bundle;
model.category = 'palace-castle-fort';
model.buildingCutout = {
  outline: controls.dimensions.outline,
  minimumCoverage: 0.9,
  basis: 'Replace only the footprint of the named palace and its attached eastern addition.',
};
