import {
  areaSign,
  block,
  cap,
  closed,
  edge,
  mix,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  shell,
  surface,
  trimBlock,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  granite: surface('wall', 'stone_ashlar'),
  concrete: surface('wall', 'concrete_plain'),
  coping: surface('trim', 'stone_limestone_raw'),
  aluminum: surface('trim', 'metal_painted', 0.58, 0.25),
  roof: surface('roof', 'concrete_plain'),
  glaze: surface('window', 'window_grid', 0.65, 0.02),
};
const C = palette({
  granite: 'bdbbb6',
  coping: 'c9c5bc',
  concrete: 'adaaa0',
  reveal: 'aaa69e',
  dark: '535956',
  glass: '525a57',
  greenGlass: '687167',
  grayGlass: '707570',
  metal: 'bfbfba',
  lettering: '77766e',
  roof: 'c1beb3',
  roofEdge: '9e9b91',
  track: '686863',
});
const mainRoof = 16.9;
const deckLevel = 6.1;
const windows = ['glass', 'greenGlass', 'grayGlass', 'glass', 'grayGlass', 'greenGlass', 'glass'];
const walls = (p) => pairs(closed(p)).map(([a, b]) => edge(a, b, areaSign(p)));

function mass(out, p, low, high, slot, color, roofColor = color) {
  shell(out, p, typeof low === 'number' ? () => low : low, high, {
    wall: slot,
    color,
    roof: 'roof',
    roofColor,
  });
}

function course(out, w, start, end, y, h, thickness, slot, color) {
  trimBlock(out, slot, w, start, end, y, y + h, 0.012, thickness, color);
}

function wingWindows(out, w, count, lod, roof) {
  const pitch = w.length / count;
  for (let i = 0; i < count; i++) {
    const center = (i + 0.5) * pitch;
    const width = pitch * (i % 4 === 3 ? 0.52 : 0.68);
    const bottom = deckLevel + 1.0;
    if (lod === 0) {
      panel(
        out,
        'glaze',
        w,
        center - width / 2,
        center + width / 2,
        bottom,
        roof - 1.1,
        0.06,
        C.glass,
      );
      continue;
    }
    opening(
      out,
      w,
      center - width / 2,
      center + width / 2,
      bottom,
      roof - 1.1,
      'concrete',
      C[windows[i % 7]],
      'glaze',
      C.reveal,
      0,
      0.046,
    );
    if (lod >= 2) {
      for (const fraction of [-0.17, 0.17]) {
        const bar = center + width * fraction;
        panel(
          out,
          'aluminum',
          w,
          bar - 0.037,
          bar + 0.037,
          bottom + 0.04,
          roof - 1.14,
          0.086,
          C.metal,
        );
      }
      if (lod === 3) {
        course(
          out,
          w,
          center - width / 2,
          center + width / 2,
          bottom + 1.06,
          0.06,
          0.086,
          'aluminum',
          C.metal,
        );
        course(
          out,
          w,
          center - width / 2,
          center + width / 2,
          bottom - 0.13,
          0.1,
          0.17,
          'concrete',
          C.coping,
        );
      }
    }
  }
}

function wing(out, x0, x1, back, front, roof, grade, lod) {
  const p = rect(x0, back, x1, front);
  mass(out, p, deckLevel - 1.35, roof, 'concrete', C.concrete, C.roof);
  const frontWall = edge([x1, front], [x0, front], areaSign(p));
  const rearWall = edge([x0, back], [x1, back], areaSign(p));
  const core = rect(x0 + 7, back + 12, x1 - 6, front - 3.2);
  mass(out, core, (q) => grade(q) - 0.43, deckLevel - 1.31, 'concrete', C.reveal);
  for (let x = x0 + 8; x < x1 - 4; x += 10.5) {
    for (const z of [back + 5.4, front - 1.7]) {
      const low = grade([x, z]) - 0.43;
      block(
        out,
        'concrete',
        x - 0.68,
        low,
        z - 0.75,
        1.36,
        deckLevel - low - 1.02,
        1.5,
        C.concrete,
      );
    }
  }
  for (const w of [frontWall, rearWall]) {
    if (lod > 0) {
      course(out, w, 0, w.length, roof - 0.23, 0.37, 0.19, 'coping', C.roofEdge);
      course(out, w, 0, w.length, deckLevel - 0.55, 0.32, 0.2, 'concrete', C.coping);
    }
    wingWindows(out, w, Math.round(w.length / (lod === 0 ? 7.8 : 4.75)), lod, roof);
  }
}

function deck(out, p, grade, lod) {
  mass(out, p, deckLevel - 1.7, deckLevel, 'concrete', C.concrete, C.track);
  const xs = p.map((q) => q[0]);
  const outer = (Math.min(...xs) + Math.max(...xs)) / 2;
  for (const dx of [-4.25, 7.3]) {
    for (const z of [-16, -4, 12, 24]) {
      const x = outer + dx;
      const y = grade([x, z]) - 0.38;
      block(out, 'concrete', x - 0.72, y, z - 0.83, 1.44, deckLevel - y - 1.53, 1.66, C.concrete);
    }
  }
  const zs = p.map((q) => q[1]);
  for (const w of walls(p)) {
    if (w.length > 35) continue;
    const width = lod > 1 ? 0.27 : 0.18;
    course(out, w, 0, w.length, deckLevel - 0.06, 0.88, width, 'concrete', C.concrete);
    if (lod === 3) course(out, w, 0, w.length, deckLevel + 0.79, 0.15, 0.36, 'coping', C.coping);
  }
  if (lod > 0) {
    for (const z of [-11, 1.5, 14, 24]) {
      if (z < Math.max(...zs) - 3)
        block(out, 'coping', outer - 9.8, deckLevel + 0.015, z, 19.6, 0.025, 0.14, C.metal);
    }
  }
}

const signLetters = {
  A: ['01110', '11011', '11011', '11111', '11011', '11011', '11011'],
  B: ['11110', '11011', '11011', '11110', '11011', '11011', '11110'],
  E: ['11111', '11000', '11000', '11110', '11000', '11000', '11111'],
  I: ['111', '010', '010', '010', '010', '010', '111'],
  L: ['11000', '11000', '11000', '11000', '11000', '11000', '11111'],
  M: ['10001', '11011', '11111', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  R: ['11110', '11011', '11011', '11110', '11100', '11010', '11001'],
  S: ['01111', '11000', '11000', '01110', '00011', '00011', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
};

function terminalSign(out, w) {
  const sign = 'TRANSBAY TRANSIT TERMINAL';
  let u = w.length / 2 - 9.8;
  const stem = 0.131;
  for (const letter of sign) {
    const pattern = signLetters[letter];
    if (!pattern) {
      u += 0.48;
      continue;
    }
    for (const [row, line] of pattern.entries()) {
      for (const run of line.matchAll(/1+/g)) {
        const x = u + run.index * stem;
        const y = 15.44 - row * stem;
        panel(out, 'aluminum', w, x, x + run[0].length * stem, y, y + stem, 0.07, C.lettering);
      }
    }
    u += (pattern[0].length + 1) * stem;
  }
}

function hall(out, p, grade, lod) {
  mass(out, p, (q) => grade(q) - 0.5, mainRoof, 'granite', C.granite, C.roof);
  const pFront = p[2][1];
  const w = edge(p[3], p[2], -areaSign(p));
  const pitch = w.length / 7;
  for (let i = 0; i < 7; i++) {
    const u = (i + 0.5) * pitch;
    const l = u - 2.48;
    const r = u + 2.48;
    const b = 4.65;
    const t = 13.26;
    if (lod === 0) {
      panel(out, 'glaze', w, l, r, b, t, 0.042, C[windows[i]]);
    } else {
      opening(out, w, l, r, b, t, 'granite', C[windows[i]], 'glaze', C.reveal, 0, 0.042);
      const nx = lod === 3 ? 7 : lod === 2 ? 5 : 3;
      const ny = lod === 3 ? 8 : 5;
      for (let j = 1; j < nx; j++) {
        const x = mix(l, r, j / nx);
        panel(out, 'aluminum', w, x - 0.045, x + 0.045, b + 0.05, t - 0.05, 0.083, C.metal);
      }
      for (let j = 1; j < ny; j++) {
        const y = mix(b, t, j / ny);
        panel(out, 'aluminum', w, l + 0.05, r - 0.05, y - 0.035, y + 0.035, 0.088, C.metal);
      }
    }
    const entrance = i >= 2 && i <= 4;
    const lintel = entrance ? 3.52 : 3.03;
    panel(
      out,
      entrance ? 'concrete' : 'glaze',
      w,
      u - 2.65,
      u + 2.65,
      entrance ? 0.08 : 0.48,
      lintel,
      0.043,
      C.dark,
    );
    if (lod >= 2) {
      for (const side of [-1, 0, 1])
        panel(
          out,
          'aluminum',
          w,
          u + side * 1.36 - 0.055,
          u + side * 1.36 + 0.055,
          0.31,
          lintel - 0.09,
          0.071,
          C.lettering,
        );
    }
  }
  const canopy = [
    [-17.8, pFront - 0.1],
    [17.8, pFront - 0.1],
    [17.8, pFront + 3.15],
    [17.2, pFront + 4.1],
    [16, pFront + 4.55],
    [-16, pFront + 4.55],
    [-17.2, pFront + 4.1],
    [-17.8, pFront + 3.15],
  ];
  mass(out, canopy, 3.73, 4.32, 'aluminum', C.metal, C.roofEdge);
  cap(out, 'concrete', canopy, 3.731, C.dark);
  if (lod > 0) {
    course(out, w, 0, w.length, mainRoof - 0.11, 0.42, 0.17, 'coping', C.coping);
    for (const e of walls(canopy))
      course(out, e, 0, e.length, 3.9, 0.14, 0.13, 'aluminum', C.lettering);
  }
  if (lod >= 2) {
    for (const y of [3.65, 13.48, 14.92, 16.29])
      panel(out, 'granite', w, 0.04, w.length - 0.04, y, y + 0.025, 0.019, C.reveal);
    for (let j = 1; j < 22; j++) {
      const u = (j * w.length) / 22;
      if (lod === 3 || j % 2 === 0)
        panel(out, 'granite', w, u, u + 0.02, 13.48, mainRoof - 0.15, 0.023, C.reveal);
    }
  }
  if (lod === 3) terminalSign(out, w);
}

function draw(out, lod, plan, grade) {
  const { outline, mainProjection, eastDeck, westDeck } = plan;
  const [minX, back] = outline[0];
  const [maxX, front] = outline[2];
  const [left, overlap] = mainProjection[0];
  const [right, pavilionFront] = mainProjection[2];
  wing(out, minX, left, back, front, 11.2, grade, lod);
  wing(out, right, maxX, back, front, 11.2, grade, lod);
  mass(
    out,
    rect(left, back, right, overlap + 0.1),
    deckLevel - 1.35,
    12.6,
    'concrete',
    C.concrete,
    C.roof,
  );
  mass(
    out,
    rect(left + 4, back + 4.5, right - 4, overlap),
    (q) => grade(q) - 0.39,
    deckLevel - 1.34,
    'concrete',
    C.reveal,
  );
  hall(out, rect(left, 6.4, right, pavilionFront), grade, lod);
  for (const p of [eastDeck, westDeck]) deck(out, p, grade, lod);
  if (lod > 0)
    for (const [x, z] of [
      [-81, 4],
      [-60, 3],
      [29, -12],
      [70, 4],
      [91, 3],
    ]) {
      const y = Math.abs(x) < right ? 12.6 : 11.2;
      block(out, 'concrete', x - 2.7, y, z - 2, 5.4, 0.75, 4, C.roofEdge);
    }
}

const terminal = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-174, 77, 170],
    lookAt: [0, 6, 12],
    yaw: 0.32,
    sun: [310, 550, 580],
    brief:
      'The original Transbay Terminal in its 2008 bus-station era. A seven-bay granite pavilion faces Mission Street from the raised concrete transit deck.',
    views: [
      { name: 'mission-street-granite-pavilion', position: [15, 20, 115], lookAt: [0, 7, 27] },
      { name: 'granite-glazing-and-entry-canopy', position: [-26, 8, 74], lookAt: [0, 8, 41] },
      { name: 'first-street-elevated-deck', position: [171, 27, 82], lookAt: [87, 6, 13] },
      { name: 'fremont-wing-and-rear-deck', position: [-169, 55, -100], lookAt: [-44, 6, 0] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = terminal;
export const model = {
  ...terminal.model,
  category: 'transport',
  geographicStatus: 'historical-proposal',
  sourceLicense:
    'Independent geometry from a published creator-dedicated public-domain photograph, USDA NAIP public-domain orthophotography, factual preservation records and open Terrarium elevations.',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: '2008-12-05',
    validFrom: '2008-12-05',
    validUntil: '2010-08-08',
  },
};
