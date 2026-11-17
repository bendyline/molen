/** The Albert Street Tivoli as photographed in 1918. All dimensions are metres. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const { halfWidth, halfDepth, frontCanopyHeight, principalCorniceProjection } = plan.dimensions;
const surfaces = {
  render: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.81, metallic: 0.17 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.79, metallic: 0.12 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.84, metallic: 0 },
  accent: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.59, metallic: 0 },
};
const color = Object.fromEntries(
  Object.entries({
    cream: 'd7c6aa',
    highlight: 'e4d5bb',
    shaded: 'b2a087',
    darkTrim: '534d43',
    masonry: '947358',
    foundation: '898074',
    iron: '444744',
    rail: '343b34',
    canopy: '7c7b6e',
    zinc: '777873',
    shutter: '5d5b50',
    timber: '665444',
    dark: '30312c',
    glass: '56666a',
    topGlass: '66787a',
    brass: 'b3a27a',
    leaf: '566247',
    flower: 'ab7566',
  }).map(([key, hex]) => [key, rgb(hex)]),
);

const front = halfDepth;
const rear = -halfDepth;
const corniceY = 16.05;
const loftFloor = 17.88;
const eave = 22.0;
const ridge = 25.5;
const gableHalf = 12.55;

function tile(out, slot, lo, hi, z, tint) {
  face(
    out,
    slot,
    [
      [lo[0], lo[1], z],
      [hi[0], lo[1], z],
      [hi[0], hi[1], z],
      [lo[0], hi[1], z],
    ],
    tint,
  );
}

function wallBand(out, lo, hi, z, tint = color.cream) {
  if (hi[0] > lo[0] && hi[1] > lo[1]) tile(out, 'render', lo, hi, z, tint);
}

function section(out, slot, x0, x1, y0, y1, z0, z1, tint) {
  box(out, slot, [x0, y0, z0], [x1, y1, z1], tint);
}

/** The facade modules share their edge with the next bay. The pane sits behind its reveal. */
function bay(out, { lo, hi, x, width, y, spring, rise = 0, z, top, bottom, divisions = 1 }, lod) {
  const a = x - width / 2,
    b = x + width / 2,
    d = z - 0.36;
  wallBand(out, [lo, bottom], [a, top], z);
  wallBand(out, [b, bottom], [hi, top], z);
  wallBand(out, [a, bottom], [b, y], z);
  const segments = rise === 0 ? 1 : [3, 8, 12, 22][lod];
  const profile = (dx) => spring + rise * Math.sqrt(Math.max(0, 1 - ((dx - x) / (width / 2)) ** 2));
  const glass = lod === 0 ? color.topGlass : color.glass;
  tile(out, 'accent', [a, y], [b, spring], d, glass);
  for (let i = 0; i < segments; i++) {
    const l = a + (width * i) / segments,
      r = a + (width * (i + 1)) / segments;
    const yl = i === 0 ? spring : profile(l),
      yr = i + 1 === segments ? spring : profile(r);
    face(
      out,
      'render',
      [
        [l, yl, z],
        [r, yr, z],
        [r, top, z],
        [l, top, z],
      ],
      color.cream,
    );
    face(
      out,
      'render',
      [
        [l, yl, d],
        [r, yr, d],
        [r, yr, z],
        [l, yl, z],
      ],
      color.shaded,
    );
    if (rise) {
      if (i === 0)
        triangle(
          out,
          'accent',
          [
            [l, spring, d],
            [r, spring, d],
            [r, yr, d],
          ],
          glass,
        );
      else if (i + 1 === segments)
        triangle(
          out,
          'accent',
          [
            [l, spring, d],
            [r, spring, d],
            [l, yl, d],
          ],
          glass,
        );
      else
        face(
          out,
          'accent',
          [
            [l, spring, d],
            [r, spring, d],
            [r, yr, d],
            [l, yl, d],
          ],
          glass,
        );
    }
    if (rise && lod > 0) {
      beam(out, 'render', [l, yl, z + 0.065], [r, yr, z + 0.065], 0.18, 0.15, color.highlight);
    }
  }
  face(
    out,
    'render',
    [
      [a, y, z],
      [a, y, d],
      [a, spring, d],
      [a, spring, z],
    ],
    color.shaded,
  );
  face(
    out,
    'render',
    [
      [b, y, d],
      [b, y, z],
      [b, spring, z],
      [b, spring, d],
    ],
    color.shaded,
  );
  face(
    out,
    'render',
    [
      [a, y, z],
      [b, y, z],
      [b, y, d],
      [a, y, d],
    ],
    color.cream,
  );
  if (lod > 0) {
    const jamb = 0.072;
    for (let i = 0; i <= divisions; i++) {
      const vertical = a + (width * i) / divisions;
      section(
        out,
        'timber',
        vertical - jamb,
        vertical + jamb,
        y,
        profile(vertical),
        d,
        d + 0.075,
        color.timber,
      );
    }
    if (divisions > 1) {
      section(
        out,
        'timber',
        a,
        b,
        y + (spring - y) * 0.62,
        y + (spring - y) * 0.62 + 0.09,
        d,
        d + 0.09,
        color.timber,
      );
    }
  }
}

function sill(out, x, y, z, width, tint = color.highlight) {
  section(out, 'render', x - width / 2, x + width / 2, y - 0.13, y, z - 0.12, z + 0.28, tint);
}

function archHood(out, x, y, z, width, rise, lod) {
  const sides = [3, 8, 12, 20][lod];
  for (let i = 0; i < sides; i++) {
    const theta = (Math.PI * i) / sides;
    const phi = (Math.PI * (i + 1)) / sides;
    const at = (a) => [x - (width * Math.cos(a)) / 2, y + rise * Math.sin(a), z];
    beam(out, 'render', at(theta), at(phi), 0.44, 0.53, color.shaded);
    if (lod > 1) {
      const a = at(theta),
        b = at(phi);
      a[1] += 0.26;
      b[1] += 0.26;
      beam(out, 'render', a, b, 0.12, 0.65, color.highlight);
    }
  }
}

function planter(out, x, y, z, lod) {
  section(out, 'timber', x - 0.79, x + 0.79, y - 0.25, y, z + 0.06, z + 0.44, color.timber);
  if (lod > 0) {
    for (let i = 0; i < 7; i++) {
      const px = x - 0.65 + i * 0.21;
      const tall = 0.13 + (i % 3) * 0.075;
      section(
        out,
        'accent',
        px - 0.13,
        px + 0.13,
        y - 0.04,
        y + tall,
        z + 0.11,
        z + 0.41,
        color.leaf,
      );
      if (lod > 1 && i % 2 === 0)
        section(
          out,
          'accent',
          px - 0.06,
          px + 0.06,
          y + tall,
          y + tall + 0.08,
          z + 0.24,
          z + 0.34,
          color.flower,
        );
    }
  }
}

function entrance(out, lod) {
  const width = halfWidth - 0.44;
  const awning = frontCanopyHeight;
  const outer = front + 3.18;
  const x0 = -width,
    x1 = width;
  section(out, 'brick', x0, x1, -6.2, 0.06, front - 0.86, front, color.foundation);
  section(out, 'timber', x0, x1, 4.44, awning + 0.07, front - 0.72, front, color.timber);
  section(out, 'timber', x0, -9.0, 0.06, 4.44, front - 0.75, front, color.timber);
  if (lod === 0) {
    tile(out, 'accent', [-9, 0.06], [x1, 4.44], front - 0.41, color.dark);
    for (const x of [-9, -5.2, -1.4, 2.4, 6.2, 10, x1 - 0.1]) {
      section(out, 'timber', x - 0.08, x + 0.08, 0.06, 4.44, front - 0.4, front, color.timber);
    }
  } else {
    for (const [a, b] of [
      [-9, -6.1],
      [-6.1, -3.05],
      [-3.05, 0],
      [0, 3.0],
      [3.0, 6.0],
      [6.0, 9.0],
      [9.0, x1],
    ]) {
      const inset = 0.28;
      const door = a >= -6.1 && a < 6;
      const foot = door ? 0.06 : 0.89;
      section(out, 'timber', a, a + inset, 0.06, 4.44, front - 0.54, front, color.timber);
      section(out, 'timber', b - inset, b, 0.06, 4.44, front - 0.54, front, color.timber);
      if (!door) section(out, 'brick', a, b, 0.06, foot, front - 0.62, front - 0.02, color.masonry);
      section(
        out,
        'accent',
        a + inset,
        b - inset,
        foot,
        4.44,
        front - 0.52,
        front - 0.41,
        color.dark,
      );
      if (lod > 0) {
        section(
          out,
          'timber',
          (a + b) / 2 - 0.06,
          (a + b) / 2 + 0.06,
          foot,
          4.44,
          front - 0.405,
          front - 0.26,
          color.timber,
        );
        section(
          out,
          'timber',
          a + inset,
          b - inset,
          3.19,
          3.34,
          front - 0.405,
          front - 0.24,
          color.timber,
        );
        section(
          out,
          'accent',
          a + inset,
          b - inset,
          3.34,
          4.33,
          front - 0.4,
          front - 0.39,
          color.glass,
        );
      }
      if (lod > 1 && door) {
        for (const sign of [-1, 1]) {
          const center = (a + b) / 2 + sign * 0.18;
          section(
            out,
            'iron',
            center - 0.055,
            center + 0.055,
            1.12,
            1.4,
            front - 0.22,
            front - 0.15,
            color.brass,
          );
        }
      }
    }
  }
  const awningRing = (y, z0, z1, inset = 0) => [
    [x0 + inset, y, z0],
    [x1 - inset, y, z0],
    [x1 - inset, y, z1],
    [x0 + inset, y, z1],
  ];
  loft(
    out,
    'iron',
    [
      awningRing(4.93, front - 0.1, outer, 0.18),
      awningRing(5.13, front - 0.1, outer),
      awningRing(5.29, front - 0.1, outer),
    ],
    color.darkTrim,
  );
  face(
    out,
    'roof',
    [
      [x0, 5.3, outer],
      [x1, 5.3, outer],
      [x1, awning, front],
      [x0, awning, front],
    ],
    color.canopy,
  );
  const terraceLimit = outer - 0.17;
  section(
    out,
    'iron',
    x0 + 0.12,
    x1 - 0.12,
    6.43,
    6.55,
    terraceLimit - 0.045,
    terraceLimit + 0.045,
    color.rail,
  );
  if (lod > 0) {
    const bars = lod > 1 ? 76 : 29;
    for (let i = 0; i <= bars; i++) {
      const x = x0 + 0.16 + ((x1 - x0 - 0.32) * i) / bars;
      const thick = i % 6 === 0 ? 0.08 : 0.032;
      section(
        out,
        'iron',
        x - thick,
        x + thick,
        5.39,
        6.46,
        terraceLimit - thick,
        terraceLimit + thick,
        color.rail,
      );
    }
    for (const x of [x0 + 0.18, x1 - 0.18]) {
      section(
        out,
        'iron',
        x - 0.055,
        x + 0.055,
        6.43,
        6.53,
        front + 0.28,
        terraceLimit,
        color.rail,
      );
      for (let z = front + 0.4; z < terraceLimit; z += 0.39) {
        section(out, 'iron', x - 0.036, x + 0.036, 5.43, 6.43, z - 0.032, z + 0.032, color.rail);
      }
    }
    for (let i = 0; i < 10; i++) {
      const x = x0 + 1.0 + ((x1 - x0 - 2) * i) / 9;
      const ground = Math.min(4.7, -x * 0.37 - 0.5);
      section(
        out,
        'iron',
        x - 0.095,
        x + 0.095,
        ground,
        4.97,
        outer - 0.26,
        outer - 0.07,
        color.rail,
      );
      if (lod > 1 && ground < 3.9)
        beam(
          out,
          'iron',
          [x, 4.65, outer - 0.17],
          [x, 4.98, outer - 0.78],
          0.115,
          0.095,
          color.rail,
        );
    }
  }
}

function facade(out, lod) {
  const central = 9.5,
    relief = front + 0.24;
  const lower = frontCanopyHeight;
  for (const sign of [-1, 1]) {
    const x = sign * 11.58;
    const lo = sign < 0 ? -halfWidth : central;
    const hi = sign < 0 ? -central : halfWidth;
    bay(
      out,
      {
        lo,
        hi,
        x,
        width: 0.94,
        y: 7.06,
        spring: 12.76,
        rise: 0.49,
        z: front,
        top: 15.77,
        bottom: lower,
      },
      lod,
    );
    sill(out, x, 7.06, front, 1.48, color.darkTrim);
    section(
      out,
      'render',
      sign * 13.56 - 0.46,
      sign * 13.56 + 0.46,
      lower,
      17.69,
      front - 0.52,
      front + 0.42,
      color.highlight,
    );
    section(
      out,
      'roof',
      x - 1.39,
      x + 1.39,
      14.1,
      14.31,
      front - 0.14,
      front + 0.47,
      color.shutter,
    );
  }
  wallBand(out, [-central, lower], [-6.95, 9.68], relief);
  wallBand(out, [6.95, lower], [central, 9.68], relief);
  const baseBays = [
    { lo: -6.95, hi: -3.7, x: -5.58, width: 1.49, y: 7.04, spring: 8.92 },
    { lo: -3.7, hi: 3.7, x: 0, width: 4.47, y: lower + 0.02, spring: 9.12, divisions: 4 },
    { lo: 3.7, hi: 6.95, x: 5.58, width: 1.49, y: 7.04, spring: 8.92 },
  ];
  for (const spec of baseBays) bay(out, { ...spec, z: relief, top: 9.68, bottom: lower }, lod);
  for (const x of [-5.58, 5.58]) planter(out, x, 7.05, relief, lod);
  section(out, 'render', -7.45, 7.45, 9.61, 9.9, relief - 0.1, relief + 0.5, color.shaded);
  section(out, 'render', -7.5, 7.5, 9.87, 10.0, relief - 0.03, relief + 0.56, color.highlight);
  const foyer = [
    { lo: -central, hi: -4.0, x: -4.49, width: 0.89, y: 10.77, spring: 12.24, divisions: 1 },
    { lo: -4.0, hi: 4.0, x: 0, width: 7.01, y: 10.77, spring: 12.57, rise: 0.69, divisions: 6 },
    { lo: 4.0, hi: central, x: 4.49, width: 0.89, y: 10.77, spring: 12.24, divisions: 1 },
  ];
  for (const spec of foyer)
    bay(out, { ...spec, z: relief, top: corniceY + 0.02, bottom: 9.68 }, lod);
  archHood(out, 0, 12.66, relief + 0.35, 11.43, 1.46, lod);
  if (lod > 0) {
    for (const x of [-8.61, -5.92, 5.92, 8.61]) {
      beam(
        out,
        'iron',
        [x, 14.98, relief],
        [x, 14.98, relief + 0.98],
        0.067,
        0.067,
        color.darkTrim,
      );
      if (lod > 1) {
        beam(
          out,
          'iron',
          [x, 14.21, relief],
          [x, 14.98, relief + 0.51],
          0.049,
          0.049,
          color.darkTrim,
        );
        section(
          out,
          'accent',
          x - 0.109,
          x + 0.109,
          14.69,
          14.84,
          relief + 0.86,
          relief + 1.04,
          color.brass,
        );
      }
    }
    for (const x of [-7.98, 7.98]) {
      for (let i = 0; i < 8; i++) {
        const y = 7.6 + i * 0.7;
        section(
          out,
          'render',
          x - 0.25,
          x + 0.25,
          y,
          y + 0.44,
          relief - 0.02,
          relief + 0.105,
          color.shaded,
        );
      }
    }
  }
}

function roofline(out, lod) {
  const frontPast = front + principalCorniceProjection;
  const side = gableHalf + 0.56;
  const profile = [
    [corniceY, side - 0.5, front + 0.02],
    [16.44, side - 0.33, front + 0.42],
    [16.96, side, frontPast - 0.28],
    [17.11, side + 0.25, frontPast],
    [17.36, side + 0.32, frontPast],
    [17.5, side + 0.38, frontPast + 0.06],
  ];
  for (let i = 0; i < profile.length - 1; i++) {
    const pair = profile.slice(i, i + 2).map(([y, w, z]) => [
      [-w, y, front - 3.66],
      [w, y, front - 3.66],
      [w, y, z],
      [-w, y, z],
    ]);
    const dark = i < 3;
    loft(out, dark ? 'iron' : 'render', pair, dark ? color.darkTrim : color.highlight, {
      cap: i === 0 || i === profile.length - 2,
    });
  }
  section(
    out,
    'render',
    -side,
    side,
    17.45,
    loftFloor,
    front - 3.68,
    frontPast - 0.18,
    color.cream,
  );
  if (lod > 1) {
    const brackets = lod === 3 ? 34 : 19;
    for (let i = 0; i < brackets; i++) {
      const x = -side + ((2 * i + 1) * side) / brackets;
      beam(
        out,
        'iron',
        [x, 16.45, front + 0.45],
        [x, 17.03, frontPast - 0.26],
        0.14,
        0.17,
        color.darkTrim,
      );
    }
  }
}

function roofGarden(out, lod) {
  const xf = gableHalf;
  const frontZ = front - 0.35;
  const backZ = -19.2;
  const ridgeY = ridge - 0.09;
  const under = loftFloor;
  const overhang = 0.36;
  for (const sign of [-1, 1]) {
    const x = sign * xf;
    const outerX = sign * (xf + overhang);
    const zh = sign > 0 ? backZ : frontZ;
    const zl = sign > 0 ? frontZ : backZ;
    face(
      out,
      'roof',
      [
        [outerX, eave, zl],
        [outerX, eave, zh],
        [0, ridge, zh],
        [0, ridge, zl],
      ],
      color.zinc,
    );
    beam(out, 'iron', [outerX, eave, backZ], [outerX, eave, frontZ], 0.18, 0.18, color.darkTrim);
    face(
      out,
      'iron',
      [
        [x, under, zl],
        [x, under, zh],
        [x, eave, zh],
        [x, eave, zl],
      ],
      color.dark,
    );
    for (let i = 0; lod > 0 && i < 8; i++) {
      const z = backZ + ((i + 0.5) * (frontZ - backZ)) / 8;
      const slotWidth = (frontZ - backZ) / 8;
      section(
        out,
        'render',
        Math.min(x, x + sign * 0.16),
        Math.max(x, x + sign * 0.16),
        under,
        eave,
        z - slotWidth * 0.5,
        z - slotWidth * 0.5 + 0.34,
        color.shaded,
      );
      if (lod > 0) {
        section(
          out,
          'iron',
          Math.min(x, x + sign * 0.1),
          Math.max(x, x + sign * 0.1),
          under + 0.05,
          under + 1.92,
          z - slotWidth * 0.44,
          z + slotWidth * 0.45,
          color.shutter,
        );
        if (lod > 1) {
          for (let j = 0; j < 4; j++) {
            const zz = z - slotWidth * 0.37 + j * slotWidth * 0.22;
            section(
              out,
              'iron',
              Math.min(x, x + sign * 0.17),
              Math.max(x, x + sign * 0.17),
              under + 0.18,
              under + 1.85,
              zz - 0.035,
              zz + 0.04,
              color.darkTrim,
            );
          }
        }
      }
    }
  }
  tile(out, 'iron', [-xf, under], [xf, eave], frontZ, color.shutter);
  triangle(
    out,
    'iron',
    [
      [-xf, eave, frontZ],
      [xf, eave, frontZ],
      [0, ridgeY, frontZ],
    ],
    color.dark,
  );
  face(
    out,
    'iron',
    [
      [xf, under, backZ],
      [-xf, under, backZ],
      [-xf, eave, backZ],
      [xf, eave, backZ],
    ],
    color.shutter,
  );
  triangle(
    out,
    'iron',
    [
      [xf, eave, backZ],
      [-xf, eave, backZ],
      [0, ridgeY, backZ],
    ],
    color.shutter,
  );
  for (const sign of [-1, 1]) {
    beam(
      out,
      'iron',
      [sign * (xf + overhang), eave, frontZ + 0.035],
      [0, ridge, frontZ + 0.035],
      0.36,
      0.29,
      color.darkTrim,
    );
    beam(
      out,
      'iron',
      [sign * (xf + overhang), eave, backZ - 0.035],
      [0, ridge, backZ - 0.035],
      0.25,
      0.24,
      color.darkTrim,
    );
  }
  const count = [4, 12, 20, 28][lod];
  for (let i = 0; i <= count; i++) {
    const x = xf * ((2 * i) / count - 1);
    const y = eave + (ridgeY - eave) * (1 - Math.abs(x) / xf);
    const thick = lod > 1 ? 0.09 : 0.14;
    const base = 20.4;
    section(
      out,
      'render',
      x - thick,
      x + thick,
      base,
      y - 0.03,
      frontZ - 0.005,
      frontZ + 0.12,
      color.highlight,
    );
    if (lod > 0) {
      beam(
        out,
        'iron',
        [x, 20.41, frontZ - 0.15],
        [x, 20.55, frontZ + 1.0],
        0.1,
        0.12,
        color.darkTrim,
      );
    }
  }
  section(out, 'iron', -xf, xf, 20.29, 20.49, frontZ + 0.12, frontZ + 0.97, color.darkTrim);
  if (lod > 1) {
    for (const x of [-8.28, -4.16, 0, 4.16, 8.28]) {
      section(
        out,
        'iron',
        x - 0.042,
        x + 0.042,
        under + 0.03,
        20.32,
        frontZ,
        frontZ + 0.11,
        color.darkTrim,
      );
    }
    for (let z = backZ + 3.8; z < frontZ - 1.0; z += 4.3) {
      for (const sign of [-1, 1]) {
        beam(
          out,
          'iron',
          [sign * xf, eave + 0.033, z],
          [0, ridge + 0.028, z],
          0.038,
          0.047,
          color.canopy,
        );
      }
    }
  }
}

function auditorium(out, lod) {
  const top = loftFloor;
  for (const x of [-halfWidth + 0.25, halfWidth - 0.25]) {
    section(
      out,
      'render',
      x - 0.25,
      x + 0.25,
      -6.24,
      17.24,
      front - 0.85,
      front - 0.01,
      color.cream,
    );
  }
  const base = -6.3;
  const backZone = -18.8;
  section(out, 'brick', -halfWidth, halfWidth, base, top, rear, front - 0.84, color.masonry);
  section(
    out,
    'render',
    -halfWidth,
    halfWidth,
    15.83,
    16.07,
    rear - 0.04,
    front - 0.79,
    color.shaded,
  );
  section(
    out,
    'roof',
    -halfWidth,
    halfWidth,
    top - 0.18,
    top,
    rear - 0.12,
    front - 0.66,
    color.zinc,
  );
  section(out, 'brick', -8.5, 8.5, top - 0.02, 22.8, rear, backZone, color.masonry);
  section(out, 'roof', -8.62, 8.62, 22.64, 22.87, rear - 0.13, backZone + 0.13, color.shutter);
  for (const sign of [-1, 1]) {
    const x = sign * (halfWidth - 0.74);
    section(
      out,
      'render',
      x - 0.73,
      x + 0.73,
      top - 0.08,
      20.74,
      front - 4.3,
      front - 0.09,
      color.cream,
    );
    section(out, 'roof', x - 0.8, x + 0.8, 20.73, 20.94, front - 4.45, front, color.zinc);
    if (lod > 0) {
      for (const z of [-20.9, -11.6, 2.7, 18.4]) {
        section(
          out,
          'brick',
          Math.min(x, x + sign * 0.84),
          Math.max(x, x + sign * 0.84),
          base,
          15.89,
          z - 0.26,
          z + 0.26,
          color.masonry,
        );
      }
    }
  }
  if (lod > 1) {
    for (const x of [-5.4, -3.6, 3.6, 5.4]) {
      section(out, 'iron', x - 0.39, x + 0.39, 19.68, 21.98, rear - 0.055, rear, color.shutter);
      for (let j = 0; j < 8; j++) {
        const y = 19.7 + j * 0.27;
        section(
          out,
          'iron',
          x - 0.4,
          x + 0.4,
          y,
          y + 0.09,
          rear - 0.083,
          rear - 0.055,
          color.darkTrim,
        );
      }
    }
  }
}

function build(out, lod) {
  auditorium(out, lod);
  entrance(out, lod);
  facade(out, lod);
  roofline(out, lod);
  roofGarden(out, lod);
}

export const tivoliSkyline = (out) => build(out, 0);
export const tivoliDistrict = (out) => build(out, 1);
export const tivoliStreet = (out) => build(out, 2);
export const tivoliCloseup = (out) => build(out, 3);

const recipe = 'tivoli-theatre-brisbane-model.mjs';
const camera = [46, 22, 94];
const lookAt = [0, 11, 4];
export const tivoliModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: tivoliCloseup,
  quality: 'medium-fi-exterior',
  geographicStatus: 'historical-proposal',
  reviewStatus: 'review-in-qa.json',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The original Albert Street Tivoli Theatre in Brisbane, with its dramatic sheet-metal cornice, balcony terrace and gabled rooftop vaudeville theatre.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-37, 42, 51],
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'brick_flemish',
    'metal_corrugated',
    'metal_painted',
    'wood_plain',
  ],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'albert-street-front', position: [18, 5.55, 55], lookAt: [-0.5, 11.0, 24.8] },
    { name: 'foyer-and-terrace', position: [-16, 13.1, 47], lookAt: [0, 11.7, 25] },
    { name: 'roof-and-shutters', position: [33, 27.0, 58], lookAt: [0, 19.9, 13] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'albert-street-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'tivoliSkyline',
    errorMeters: 0.57,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'tivoliDistrict', 0.3],
        ['street', 'tivoliStreet', 0.13],
        ['closeup', 'tivoliCloseup', 0.055],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model geometry under the repository license. Public-domain 1918 State Library of Queensland photograph. OpenStreetMap street controls under ODbL 1.0.',
};
