import {
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  mix,
  palette,
  pairs,
  panel,
  pavilion,
  rect,
  shell,
  surface,
  trimBlock,
  up,
  xz,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import { readFileSync } from 'node:fs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const surfaces = {
  brick: surface('wall', 'brick_flemish'),
  stone: surface('foundation', 'stone_ashlar'),
  tile: surface('trim', 'tile_mosaic', 0.66, 0.025),
  roof: surface('roof', 'stone_limestone_raw'),
  metal: surface('trim', 'metal_painted', 0.69, 0.21),
  detail: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.8, metallic: 0 },
  water: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.34, metallic: 0 },
};
const C = palette({
  brick: 'bd9970',
  lightBrick: 'cba77e',
  roof: 'ac916e',
  shadow: '654e3a',
  deep: '4f4137',
  bottom: 'a3937c',
  paving: 'c0b19b',
  rim: 'c9b99d',
  blue: '477797',
  darkBlue: '345570',
  teal: '58968f',
  ochre: 'c3a54d',
  cream: 'decc9d',
  wood: '685042',
  water: '6b9e96',
});
const rangeTop = 7.55;
const iwanSpecs = [
  { width: 4.8, spring: 5.1, peak: 10.35, top: 12.25, depth: 3.25 },
  { width: 6.25, spring: 6.2, peak: 13.35, top: 15.45, depth: 7.0 },
  { width: 4.65, spring: 5.15, peak: 10.2, top: 12.2, depth: 3.15 },
  { width: 6.45, spring: 6.55, peak: 14.25, top: 16.4, depth: 7.9 },
];

function mass(out, footprint, base, top, color = C.brick, roof = C.roof) {
  shell(out, footprint, typeof base === 'number' ? () => base : base, top, {
    wall: 'brick',
    color,
    roof: 'roof',
    roofColor: roof,
  });
}

function courtyardRoof(out, outline, court, gradedBase, floor, lod) {
  const z0 = floor + rangeTop;
  const orientation = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    const wall = edge(a, b, orientation);
    face(
      out,
      'brick',
      [at(a, gradedBase(a)), at(b, gradedBase(b)), at(b, z0), at(a, z0)],
      wall.normal,
      C.brick,
    );
    if (lod > 0) panel(out, 'stone', wall, 0, wall.length, z0 - 0.53, z0 - 0.21, 0.013, C.rim);
  }
  const roofHole = court.flatMap((a, i) => {
    const wall = edge(a, court[(i + 1) % court.length], -areaSign(court));
    const mid = wall.length / 2;
    const { width, depth } = iwanSpecs[i];
    const reach = width + 0.56;
    return [
      a,
      ...[
        [mid - reach, 0],
        [mid - reach, -depth + 0.19],
        [mid + reach, -depth + 0.19],
        [mid + reach, 0],
      ].map(([u, d]) => xz(wall.p(u, 0, d))),
    ];
  });
  horizontalSurface(out, 'roof', outline, roofHole, z0, C.roof);
}

function horizontalSurface(out, slot, outer, hole, y, color) {
  const points = [...outer, ...hole];
  const triangles = earcut(points.flat(), [outer.length]);
  for (let i = 0; i < triangles.length; i += 3)
    face(
      out,
      slot,
      triangles.slice(i, i + 3).map((index) => at(points[index], y)),
      up,
      color,
    );
}

function archProfile(width, spring, peak, segments) {
  const offset = 0.38 * width;
  const radius = width + offset;
  const scale = Math.sqrt(radius * radius - offset * offset);
  return Array.from({ length: segments + 1 }, (_, i) => {
    const x = mix(-width, width, i / segments);
    const d = Math.min(radius, Math.abs(x) + offset);
    return [x, spring + ((peak - spring) * Math.sqrt(radius * radius - d * d)) / scale];
  });
}

function vaultedBay(out, wall, center, width, base, spring, peak, top, depth, lod, iwan) {
  const sections = iwan ? [4, 6, 12, 18][lod] : [2, 4, 6, 8][lod];
  const outline = archProfile(width, spring, peak, sections);
  const frameWidth = width + (iwan ? 1.68 : 0.44);
  const p = (u, y, d = 0) => wall.p(center + u, y, d);
  for (const sign of [-1, 1]) {
    const u = [sign * width, sign * frameWidth].sort((a, b) => a - b);
    panel(out, 'brick', wall, center + u[0], center + u[1], base, top, 0, C.lightBrick);
    face(
      out,
      iwan ? 'tile' : 'brick',
      [
        p(sign * width, base),
        p(sign * width, base, -depth),
        p(sign * width, spring, -depth),
        p(sign * width, spring),
      ],
      [wall.normal[2] * sign, 0, -wall.normal[0] * sign],
      iwan ? C.blue : C.shadow,
    );
  }
  panel(out, 'detail', wall, center - width, center + width, base, spring, -depth, C.deep);
  for (const [[a, y], [b, h]] of pairs(outline)) {
    face(out, 'brick', [p(a, y), p(b, h), p(b, top), p(a, top)], wall.normal, C.lightBrick);
    if (iwan || lod > 0) {
      face(
        out,
        iwan ? 'tile' : 'brick',
        [p(a, y), p(a, y, -depth), p(b, h, -depth), p(b, h)],
        [0, -1, 0],
        iwan ? C.blue : C.shadow,
      );
      const back = [p(a, spring, -depth), p(b, spring, -depth)];
      if (h > spring + 0.0001) back.push(p(b, h, -depth));
      if (y > spring + 0.0001) back.push(p(a, y, -depth));
      face(out, 'detail', back, wall.normal, C.deep);
    }
  }
  if (!iwan && lod > 0) {
    for (const shift of [-0.61, 0, 0.61]) {
      panel(
        out,
        'detail',
        wall,
        center + shift * width - 0.045,
        center + shift * width + 0.045,
        base + 0.12,
        spring + (shift === 0 ? 0.55 : 0.16),
        -depth + 0.05,
        C.wood,
      );
    }
    panel(
      out,
      'detail',
      wall,
      center - width,
      center + width,
      spring - 0.53,
      spring - 0.39,
      -depth + 0.05,
      C.wood,
    );
  }
  if (!iwan) return;
  const contour = [
    p(-width, base, 0.08),
    ...outline.map(([u, y]) => p(u, y, 0.08)),
    p(width, base, 0.08),
  ];
  if (lod > 0) beamPath(out, 'tile', contour, 0.38, 0.16, C.darkBlue);
  for (const sign of [-1, 1])
    trimBlock(
      out,
      'tile',
      wall,
      center + sign * (frameWidth - 0.35) - 0.29,
      center + sign * (frameWidth - 0.35) + 0.29,
      base,
      top - 0.52,
      0.018,
      0.125,
      C.blue,
    );
  trimBlock(
    out,
    'tile',
    wall,
    center - frameWidth,
    center + frameWidth,
    top - 0.71,
    top - 0.06,
    0.01,
    0.16,
    C.darkBlue,
  );
  trimBlock(
    out,
    'stone',
    wall,
    center - frameWidth - 0.17,
    center + frameWidth + 0.17,
    top - 0.04,
    top + 0.2,
    -0.08,
    0.18,
    C.cream,
  );
  if (lod < 2) return;
  const nicheWidths = [0.23, 0.35, 0.29, 0.42];
  for (let i = 0; i < 4; i++) {
    for (const sign of [-1, 1]) {
      const a = sign * (width + 0.56);
      const y = mix(base + 1.29, top - 2.3, i / 3);
      const k = nicheWidths[i];
      face(
        out,
        'tile',
        [
          p(a - k, y - 0.48, 0.045),
          p(a + k, y - 0.48, 0.045),
          p(a + k, y + 0.27, 0.045),
          p(a, y + 0.55, 0.045),
          p(a - k, y + 0.27, 0.045),
        ],
        wall.normal,
        i % 2 === 0 ? C.ochre : C.teal,
      );
    }
  }
  for (let i = 1; i < outline.length - 1; i += lod === 3 ? 1 : 2) {
    const [u, y] = outline[i];
    const h = Math.min(top - 1.12, y + 0.8);
    face(
      out,
      'detail',
      [p(u - 0.12, h, 0.08), p(u, h - 0.16, 0.08), p(u + 0.12, h, 0.08), p(u, h + 0.16, 0.08)],
      wall.normal,
      i % 2 === 0 ? C.ochre : C.teal,
    );
  }
  if (lod === 3)
    for (const depthRatio of [0.24, 0.51, 0.77]) {
      const d = -depth * depthRatio;
      beamPath(
        out,
        'tile',
        outline.map(([u, y]) => p(u * 0.988, y - 0.055, d)),
        0.08,
        0.085,
        depthRatio === 0.51 ? C.ochre : C.teal,
      );
    }
}

function courtyardFronts(out, court, floor, lod) {
  for (const [i, a] of court.entries()) {
    const wall = edge(a, court[(i + 1) % court.length], -areaSign(court));
    const mid = wall.length / 2;
    const { width, spring, peak, top, depth } = iwanSpecs[i];
    const reach = width + 1.68;
    const iwanCap = [
      [mid - reach, 0],
      [mid + reach, 0],
      [mid + reach, -depth],
      [mid - reach, -depth],
    ].map(([u, d]) => xz(wall.p(u, 0, d)));
    cap(out, 'roof', iwanCap, floor + top + 0.015, C.roof);
    for (const [u, v] of [
      [mid - reach, mid - width],
      [mid + width, mid + reach],
    ]) {
      const band = [
        [u, -0.012],
        [v, -0.012],
        [v, -depth],
        [u, -depth],
      ].map(([x, d]) => xz(wall.p(x, 0, d)));
      mass(out, band, floor + 0.02, floor + top, C.lightBrick);
    }
    const insideFloor = [
      [mid - width, 0],
      [mid + width, 0],
      [mid + width, -depth],
      [mid - width, -depth],
    ].map(([u, d]) => xz(wall.p(u, 0, d)));
    cap(out, 'stone', insideFloor, floor, C.paving);
    vaultedBay(
      out,
      wall,
      mid,
      width,
      floor,
      floor + spring,
      floor + peak,
      floor + top,
      depth,
      lod,
      true,
    );
    if (lod > 0) {
      const portalHalf = i === 3 ? 1.95 : 1.15;
      const back = -depth + 0.046;
      const entry = archProfile(portalHalf, floor + 2.5, floor + (i === 3 ? 4.45 : 3.6), 8);
      const profile = [[-portalHalf, floor], ...entry, [portalHalf, floor]];
      face(
        out,
        'tile',
        profile.map(([u, y]) => wall.p(mid + u, y, back)),
        wall.normal,
        C.blue,
      );
      face(
        out,
        'detail',
        profile.map(([u, y]) => wall.p(mid + u * 0.77, floor + (y - floor) * 0.88, back + 0.012)),
        wall.normal,
        i === 1 ? C.ochre : C.wood,
      );
      if (lod > 1) {
        for (const delta of [-0.49, 0, 0.49])
          panel(
            out,
            'detail',
            wall,
            mid + portalHalf * delta - 0.027,
            mid + portalHalf * delta + 0.027,
            floor + 0.22,
            floor + 2.72,
            back + 0.025,
            C.cream,
          );
      }
    }
    for (const [start, end] of [
      [0, mid - reach],
      [mid + reach, wall.length],
    ]) {
      if (lod === 0) {
        panel(out, 'brick', wall, start, end, floor, floor + rangeTop, 0, C.lightBrick);
        continue;
      }
      const arcadeFloor = [
        [start, 0],
        [end, 0],
        [end, -1.05],
        [start, -1.05],
      ].map(([u, d]) => xz(wall.p(u, 0, d)));
      cap(out, 'stone', arcadeFloor, floor + 0.126, C.paving);
      const bays = i % 2 === 0 ? 6 : 4;
      const spacing = (end - start) / bays;
      for (let j = 0; j < bays; j++) {
        const center = start + (j + 0.5) * spacing;
        const width = spacing / 2 - 0.44;
        vaultedBay(
          out,
          wall,
          center,
          width,
          floor + 0.13,
          floor + 2.44,
          floor + 5.17,
          floor + rangeTop,
          1.05,
          lod,
          false,
        );
        if (j < bays - 1)
          panel(
            out,
            'brick',
            wall,
            center + spacing / 2 - 0.12,
            center + spacing / 2 + 0.12,
            floor,
            floor + rangeTop,
            0,
            C.lightBrick,
          );
      }
      panel(
        out,
        'stone',
        wall,
        start,
        end,
        floor + rangeTop - 0.35,
        floor + rangeTop - 0.13,
        0.065,
        C.rim,
      );
      if (lod > 1)
        panel(out, 'tile', wall, start, end, floor + 5.81, floor + 6.08, 0.043, C.darkBlue);
    }
  }
}

function courtyardBasin(out, court, pool, grade, floor, lod) {
  const outer = pool.map(([x, z]) => [x * 1.05 + 0.09, z * 1.05 - 0.025]);
  horizontalSurface(out, 'stone', court, outer, floor, C.paving);
  shell(
    out,
    court,
    (p) => Math.min(grade(p) - 0.11, floor - 0.23),
    floor - 0.035,
    { wall: 'stone', color: C.bottom, roof: 'stone', roofColor: C.paving },
    () => false,
  );
  horizontalSurface(out, 'stone', outer, pool, floor + 0.19, C.rim);
  cap(out, 'water', pool, floor + 0.08, C.water);
  if (lod < 2) return;
  for (const [a, b] of pairs(closed(outer))) {
    const wall = edge(a, b, areaSign(outer));
    panel(out, 'stone', wall, 0, wall.length, floor - 0.012, floor + 0.19, 0, C.rim);
    panel(out, 'tile', wall, 0, wall.length, floor + 0.06, floor + 0.1, 0.012, C.teal);
  }
}

function tower(out, slot, center, profile, n, color) {
  loft(
    out,
    slot,
    profile.map(([y, radius]) => radialRing(y, radius, radius, n, center)),
    color,
  );
}

function minaret(out, position, floor, base, top, lod) {
  const center = xz(position);
  const n = [7, 10, 14, 20][lod];
  const atHeight = (profile) => profile.map(([y, r]) => [floor + y, r]);
  if (lod === 0) {
    tower(
      out,
      'tile',
      center,
      atHeight([
        [base, 1.47],
        [top - 4.6, 0.94],
        [top - 3.55, 1.49],
        [top - 1.5, 1.08],
        [top - 1.42, 1.39],
        [top, 0.065],
      ]),
      6,
      C.blue,
    );
    return;
  }
  tower(
    out,
    'brick',
    center,
    atHeight([
      [base, 1.51],
      [base + 0.65, 1.38],
      [top - 4.5, 0.93],
    ]),
    n,
    C.lightBrick,
  );
  tower(
    out,
    'tile',
    center,
    atHeight([
      [top - 4.59, 0.94],
      [top - 3.95, 1.49],
      [top - 3.55, 1.52],
      [top - 3.4, 1.52],
    ]),
    n,
    C.blue,
  );
  tower(
    out,
    'tile',
    center,
    atHeight([
      [top - 1.43, 1.39],
      [top - 1.13, 1.35],
      [top - 0.37, 0.61],
      [top, 0.065],
    ]),
    n,
    C.teal,
  );
  for (let i = 0; i < n; i += 2) {
    const angle = (2 * Math.PI * i) / n;
    const x = center[0] + 1.1 * Math.cos(angle);
    const z = center[1] + 1.1 * Math.sin(angle);
    block(out, 'detail', x - 0.085, floor + top - 3.5, z - 0.085, 0.17, 2.18, 0.17, C.cream);
  }
  if (lod < 2) return;
  for (const y of [base + 1.1, base + 2.18, top - 4.77]) {
    const r = mix(1.38, 0.93, (y - base - 0.65) / (top - 4.5 - base - 0.65)) + 0.05;
    tower(
      out,
      'tile',
      center,
      atHeight([
        [y, r],
        [y + 0.18, r - 0.006],
      ]),
      n,
      C.darkBlue,
    );
  }
}

function northernClock(out, wall, floor, height, minaretHeight, lod) {
  const mid = wall.length / 2;
  const base = iwanSpecs[1].top - 0.16;
  for (const delta of [-6.85, 6.85])
    minaret(out, wall.p(mid + delta, 0, -2.15), floor, base, minaretHeight, lod);
  const shellPlan = [
    [mid - 1.4, -0.61],
    [mid + 1.4, -0.61],
    [mid + 1.4, -3.39],
    [mid - 1.4, -3.39],
  ].map(([u, d]) => xz(wall.p(u, 0, d)));
  mass(out, shellPlan, floor + base, floor + height - 0.44, C.lightBrick);
  tower(
    out,
    'metal',
    xz(wall.p(mid, 0, -2)),
    [
      [floor + height - 0.45, 1.81],
      [floor + height + 0.45, 0.08],
    ],
    4,
    C.wood,
  );
  panel(
    out,
    'tile',
    wall,
    mid - 1.33,
    mid + 1.33,
    floor + base + 0.3,
    floor + height - 0.46,
    -0.594,
    C.darkBlue,
  );
  const clockY = floor + height - 1.85;
  const count = lod < 2 ? 12 : 24;
  const circle = Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count;
    return wall.p(mid + 0.8 * Math.cos(angle), clockY + 0.8 * Math.sin(angle), -0.567);
  });
  face(out, 'detail', circle, wall.normal, C.cream);
  if (lod > 0)
    beamPath(
      out,
      'detail',
      [
        wall.p(mid - 0.24, clockY - 0.21, -0.545),
        wall.p(mid, clockY, -0.545),
        wall.p(mid + 0.09, clockY + 0.57, -0.545),
      ],
      0.056,
      0.035,
      C.deep,
    );
}

function southDome(out, floor, height, lod) {
  const center = [0.35, 49.7];
  const n = [10, 16, 28, 40][lod];
  mass(
    out,
    rect(-10.15, 37.93, 10.85, 60.66),
    floor + rangeTop - 0.04,
    floor + 12.65,
    C.lightBrick,
  );
  tower(
    out,
    'brick',
    center,
    [
      [floor + 12.62, 8.08],
      [floor + 14.11, 7.77],
    ],
    16,
    C.lightBrick,
  );
  const profile = [
    [14.03, 7.84],
    [15.8, 7.68],
    [17.46, 6.84],
    [19.29, 5.34],
    [21.06, 3.55],
    [22.17, 1.24],
    [height, 0.36],
  ];
  tower(
    out,
    'tile',
    center,
    (lod === 0 ? profile.filter((_, i) => i % 2 === 0) : profile).map(([y, r]) => [floor + y, r]),
    n,
    C.teal,
  );
  tower(
    out,
    'metal',
    center,
    [
      [floor + height - 0.44, 0.38],
      [floor + height + 0.33, 0.6],
      [floor + height + 0.79, 0.24],
      [floor + height + 1.17, 0.041],
    ],
    8,
    C.ochre,
  );
  if (lod > 0)
    tower(
      out,
      'tile',
      center,
      [
        [floor + 14.1, 7.855],
        [floor + 14.46, 7.855],
      ],
      n,
      C.darkBlue,
    );
  if (lod < 2) return;
  for (let i = 0; i < n; i += 2) {
    const angle = (2 * Math.PI * i) / n;
    const rib = profile
      .slice(1, -1)
      .map(([y, r]) => [
        center[0] + (r + 0.06) * Math.cos(angle),
        floor + y,
        center[1] + (r + 0.06) * Math.sin(angle),
      ]);
    beamPath(out, 'tile', rib, 0.092, 0.08, i % 4 === 0 ? C.darkBlue : C.cream);
  }
}

function draw(out, lod, controls, grade) {
  const {
    parts: { outline, court, pool },
    courtTerrace,
    clockHeight,
    minaretHeight,
    domeHeight,
  } = controls;
  const floor = courtTerrace;
  const gradedBase = (p) => Math.min(grade(p) - 0.23, floor - 0.25);
  courtyardRoof(out, outline, court, gradedBase, floor, lod);
  courtyardBasin(out, court, pool, grade, floor, lod);
  courtyardFronts(out, court, floor, lod);
  northernClock(
    out,
    edge(court[1], court[2], -areaSign(court)),
    floor,
    clockHeight,
    minaretHeight,
    lod,
  );
  southDome(out, floor, domeHeight, lod);
}

const mosque = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-95, 68, -108],
    lookAt: [0, 7, 2],
    sun: [-350, 500, -570],
    yaw: -2.14,
    brief:
      'Tehran’s Qajar Shah Mosque with a four-iwan courtyard, rectangular basin, southern dome and two northern minarets flanking the clock.',
    views: [
      { name: 'court-pool-and-southern-qibla-iwan', position: [-12, 15, -25], lookAt: [0, 8, 26] },
      { name: 'northern-iwan-clock-and-minarets', position: [19, 14, 22], lookAt: [0, 12, -31] },
      { name: 'open-courtyard-and-bazaar-envelope', position: [-24, 106, -54], lookAt: [0, 4, 0] },
      { name: 'southern-dome-above-prayer-halls', position: [69, 47, 111], lookAt: [0, 12, 43] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = mosque;
const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const model = {
  ...mosque.model,
  category: 'religious',
  buildingCutout: {
    outline: plan.dimensions.outline,
    minimumCoverage: 0.9,
    basis:
      'The mapped perimeter replaces the procedural mosque mass without removing adjoining bazaar buildings.',
  },
  embeddedCanonicalGraphs: mosque.model.embeddedCanonicalGraphs.filter(Boolean),
  recipeDependencies: [...mosque.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  sourceLicense:
    'Original model based on mapped features, public-domain historical artwork, architectural research and original Terrarium elevation.',
};
