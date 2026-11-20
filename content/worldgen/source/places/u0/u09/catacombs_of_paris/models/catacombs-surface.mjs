import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { site } from './site-controls.mjs';

const ashlar = [0.77, 0.7, 0.56];
const recessed = [0.61, 0.55, 0.45];
const mortar = [0.56, 0.51, 0.42];
const iron = [0.2, 0.28, 0.26];
const glass = [0.22, 0.3, 0.32];
const roof = [0.31, 0.3, 0.27];
const liner = [0.88, 0.89, 0.85];
const ref = 'palette:#ffffff';
const shade = (rgb, scalar) => rgb.map((p) => p * scalar);
const quad = (out, key, pts, color) => out.addQuad(key, ref, pts, normalFor(...pts), [], color);
const tri = (out, key, pts, color) => out.addTriangle(key, ref, pts, normalFor(...pts), [], color);

function placed(out, { point: [x, z], floor, heading }) {
  return transform(out, heading, [x, floor, z]);
}

function window(out, x, y, half, height, z, detail) {
  const surround = 0.115;
  box(
    out,
    'ashlar',
    [x - half - surround, y - 0.05, z - 0.2],
    [x - half, y + height, z + 0.04],
    recessed,
  );
  box(
    out,
    'ashlar',
    [x + half, y - 0.05, z - 0.2],
    [x + half + surround, y + height, z + 0.04],
    recessed,
  );
  box(
    out,
    'ashlar',
    [x - half - 0.19, y + height, z - 0.06],
    [x + half + 0.19, y + height + 0.14, z + 0.11],
    ashlar,
  );
  box(
    out,
    'ashlar',
    [x - half - 0.18, y - 0.13, z - 0.05],
    [x + half + 0.18, y + 0.01, z + 0.15],
    ashlar,
  );
  box(out, 'glazing', [x - half, y, z - 0.25], [x + half, y + height, z - 0.23], glass);
  if (detail.joinery) {
    box(out, 'iron', [x - 0.028, y, z - 0.22], [x + 0.028, y + height, z - 0.16], iron);
    const rail = y + height * 0.63;
    box(out, 'iron', [x - half, rail - 0.026, z - 0.22], [x + half, rail + 0.026, z - 0.16], iron);
  }
}

function upperFacade(out, span, z, detail, front) {
  const columns = [-span * 0.327, 0, span * 0.327];
  const bands = front
    ? [
        { y: 5.45, height: 2.27, half: 0.57 },
        { y: 9.23, height: 1.33, half: 0.47 },
      ]
    : [
        { y: 2.51, height: 2.14, half: 0.57 },
        { y: 5.45, height: 2.27, half: 0.57 },
        { y: 9.23, height: 1.33, half: 0.47 },
      ];
  let lower = front ? 4.77 : 0;
  if (detail.name === 'district') {
    const panel = (key, minX, maxX, minY, maxY, depth, color) =>
      quad(
        out,
        key,
        [
          [minX, minY, depth],
          [maxX, minY, depth],
          [maxX, maxY, depth],
          [minX, maxY, depth],
        ],
        color,
      );
    panel('ashlar', -span / 2, span / 2, lower, 11.64, z, ashlar);
    for (const { y, height, half } of bands)
      for (const center of columns)
        panel('glazing', center - half, center + half, y, y + height, z + 0.016, glass);
    return;
  }
  for (const { y, height, half } of bands) {
    box(out, 'ashlar', [-span / 2, lower, z - 0.29], [span / 2, y, z], ashlar);
    let x = -span / 2;
    for (const center of columns) {
      box(out, 'ashlar', [x, y, z - 0.29], [center - half, y + height, z], ashlar);
      window(out, center, y, half, height, z, detail);
      x = center + half;
    }
    box(out, 'ashlar', [x, y, z - 0.29], [span / 2, y + height, z], ashlar);
    lower = y + height;
  }
  box(out, 'ashlar', [-span / 2, lower, z - 0.29], [span / 2, 11.64, z], ashlar);
  if (detail.joinery) {
    box(out, 'ashlar', [-span / 2, 8.78, z - 0.04], [span / 2, 8.88, z + 0.162], ashlar);
    box(out, 'ashlar', [-span / 2, 10.99, z - 0.02], [span / 2, 11.14, z + 0.19], ashlar);
  }
}

function entryBay(out, center, z, detail, central) {
  const half = 1.37;
  const spring = 2.73;
  const arc = (a, delta, distance) => [
    center - (half + delta) * Math.cos(a),
    spring + (1.14 + delta) * Math.sin(a),
    distance,
  ];
  const steps = detail.romans;
  for (let i = 0; i < steps; i++) {
    const a = (i * Math.PI) / steps,
      b = ((i + 1) * Math.PI) / steps;
    const lip = i % 2 ? 0.41 : 0.36;
    const inside = [
      arc(a, 0, z + 0.08),
      arc(b, 0, z + 0.08),
      arc(b, lip, z + 0.21),
      arc(a, lip, z + 0.21),
    ];
    quad(out, 'ashlar', inside, shade(ashlar, 0.96 + (i % 3) * 0.021));
    quad(out, 'ashlar', [arc(b, 0, z - 0.23), arc(a, 0, z - 0.23), inside[0], inside[1]], recessed);
    quad(
      out,
      'ashlar',
      [inside[3], inside[2], [inside[2][0], 4.77, z], [inside[3][0], 4.77, z]],
      ashlar,
    );
    tri(
      out,
      central ? 'iron' : 'glazing',
      [[center, spring, z - 0.27], arc(a, -0.017, z - 0.27), arc(b, -0.017, z - 0.27)].reverse(),
      central ? iron : glass,
    );
  }
  box(
    out,
    central ? 'iron' : 'glazing',
    [center - half, 0.1, z - 0.34],
    [center + half, spring, z - 0.28],
    central ? shade(iron, 0.74) : glass,
  );
  for (const sign of [-1, 1]) {
    const x = center + sign * (half + 0.29);
    for (let k = 0; k < 4; k++) {
      const w = k % 2 ? 0.27 : 0.34;
      box(
        out,
        'ashlar',
        [x - w, 0.17 + k * 0.63, z - 0.23],
        [x + w, 0.69 + k * 0.63, z + 0.22 + (k % 2) * 0.08],
        shade(ashlar, 0.962 + 0.028 * (k % 3)),
      );
    }
  }
  if (detail.joinery) {
    const count = central ? 10 : 4;
    for (let i = 0; i <= count; i++) {
      const x = center - half + 0.035 + ((2 * half - 0.07) * i) / count;
      beam(
        out,
        'iron',
        [x, 0.127, z - 0.227],
        [x, spring - 0.04, z - 0.227],
        0.047,
        0.07,
        central ? iron : [0.55, 0.6, 0.58],
      );
    }
    for (const y of [0.22, 1.43, 2.68])
      beam(
        out,
        'iron',
        [center - half, y, z - 0.22],
        [center + half, y, z - 0.22],
        0.065,
        0.059,
        central ? iron : [0.55, 0.6, 0.58],
      );
  }
}

function pavilionRoof(out, width, depth, detail) {
  const a = width / 2 + 0.52,
    b = depth / 2 + 0.5,
    y = 11.81,
    h = 13.89,
    r = width * 0.23;
  const ends = [
    [-a, y, b],
    [a, y, b],
    [a, y, -b],
    [-a, y, -b],
  ];
  const west = [-r, h, 0],
    east = [r, h, 0];
  quad(out, 'slate', [ends[0], ends[1], east, west], roof);
  quad(out, 'slate', [ends[2], ends[3], west, east], shade(roof, 0.91));
  tri(out, 'slate', [ends[1], ends[2], east], shade(roof, 0.95));
  tri(out, 'slate', [ends[3], ends[0], west], shade(roof, 0.96));
  for (const [x, z] of [
    [-width * 0.327, -2.45],
    [width * 0.32, -1.85],
    [-width * 0.08, 2.68],
  ]) {
    box(out, 'ashlar', [x - 0.4, 12.89, z - 0.29], [x + 0.4, 14.12, z + 0.29], [0.51, 0.35, 0.26]);
    box(out, 'ashlar', [x - 0.49, 14.02, z - 0.36], [x + 0.49, 14.24, z + 0.36], recessed);
  }
  if (!detail.joinery) return;
  for (const x of [-width * 0.318, 0, width * 0.318]) {
    const z = depth * 0.33;
    box(out, 'slate', [x - 0.48, 12.61, z - 1.04], [x + 0.48, 13.59, z + 0.12], roof);
    box(out, 'glazing', [x - 0.29, 12.81, z + 0.121], [x + 0.29, 13.38, z + 0.147], glass);
    beam(out, 'slate', [x - 0.59, 13.53, z + 0.16], [x, 13.89, z + 0.16], 0.11, 0.12, roof);
    beam(out, 'slate', [x, 13.89, z + 0.16], [x + 0.59, 13.53, z + 0.16], 0.11, 0.12, roof);
  }
}

export function buildDenfertEntrance(pavilion, detail) {
  const { width, depth } = site.entrance,
    xf = width / 2,
    zf = depth / 2;
  if (detail.name === 'skyline') box(pavilion, 'ashlar', [-xf, 0, -zf], [xf, 11.64, zf], ashlar);
  else {
    for (const [angle, span, z, front] of [
      [0, width, zf, true],
      [Math.PI, width, zf, false],
      [-Math.PI / 2, depth, xf, false],
      [Math.PI / 2, depth, xf, false],
    ])
      upperFacade(transform(pavilion, angle), span, z, detail, front);
    const bays = [-width * 0.322, 0, width * 0.322];
    let left = -xf;
    for (const [index, x] of bays.entries()) {
      box(pavilion, 'ashlar', [left, 0.11, zf - 0.37], [x - 1.72, 4.77, zf], ashlar);
      entryBay(pavilion, x, zf, detail, index === 1);
      left = x + 1.72;
    }
    box(pavilion, 'ashlar', [left, 0.11, zf - 0.37], [xf, 4.77, zf], ashlar);
    for (const edge of [-1, 1])
      for (let j = 0; j < 6; j++) {
        const x = edge * (xf - 0.53);
        box(
          pavilion,
          'ashlar',
          [x - 0.52, 0.13 + j * 0.51, zf - 0.07],
          [x + 0.52, 0.32 + j * 0.51, zf + 0.3 - (j % 2) * 0.12],
          ashlar,
        );
      }
  }
  box(pavilion, 'ashlar', [-xf - 0.23, -0.13, -zf - 0.22], [xf + 0.23, 0.14, zf + 0.25], recessed);
  box(pavilion, 'ashlar', [-xf - 0.41, 11.25, -zf - 0.42], [xf + 0.41, 11.51, zf + 0.42], ashlar);
  box(pavilion, 'ashlar', [-xf - 0.59, 11.59, -zf - 0.59], [xf + 0.59, 11.85, zf + 0.59], ashlar);
  pavilionRoof(pavilion, width, depth, detail);
  if (detail.joinery)
    for (let i = 0; i < Math.ceil(width / 0.53); i++) {
      const x = -xf + 0.16 + i * 0.53;
      box(pavilion, 'ashlar', [x - 0.11, 11.43, zf + 0.12], [x + 0.11, 11.64, zf + 0.42], ashlar);
      box(pavilion, 'ashlar', [x - 0.11, 11.43, -zf - 0.42], [x + 0.11, 11.64, -zf - 0.12], ashlar);
    }
  // The museum's 2018 surface entrance is the low black-framed glass wing.
  const x = xf + 2.58,
    z = zf - 0.35;
  box(pavilion, 'ashlar', [xf - 0.09, 0, z - 5.64], [xf + 0.31, 4.19, z + 0.04], ashlar);
  box(pavilion, 'ashlar', [xf + 5.3, 0, z - 5.64], [xf + 5.64, 4.12, z + 0.18], ashlar);
  box(pavilion, 'ashlar', [xf - 0.09, 0, z - 5.66], [xf + 5.64, 4.14, z - 5.25], ashlar);
  box(pavilion, 'iron', [xf - 0.12, 4.0, z - 5.78], [xf + 5.8, 4.19, z + 0.16], roof);
  box(
    pavilion,
    'glazing',
    [x + 0.52, 0.17, z - 0.11],
    [x + 2.54, 3.94, z - 0.08],
    [0.49, 0.59, 0.6],
  );
  box(pavilion, 'glazing', [xf + 0.32, 2.74, z - 0.12], [x + 0.51, 3.94, z - 0.08], glass);
  for (const post of [xf + 0.31, x - 1.02, x + 0.49, x + 2.51])
    box(
      pavilion,
      'iron',
      [post - 0.05, 0.05, z - 0.15],
      [post + 0.05, 4.05, z + 0.035],
      shade(iron, 0.67),
    );
  box(pavilion, 'iron', [xf + 0.31, 2.68, z - 0.14], [x + 0.52, 2.76, z + 0.04], shade(iron, 0.71));
  box(pavilion, 'foundation', [xf - 0.09, -0.14, z - 0.51], [xf + 5.64, 0.01, z + 0.38], mortar);
  box(pavilion, 'iron', [x - 0.93, 0.1, z - 1.12], [x - 0.85, 2.66, z + 0.04], shade(iron, 0.82));
}

export function buildReneCotyExit(p, detail, canopySurface = 'glazing') {
  const x = site.exit.width / 2,
    z = site.exit.depth / 2,
    gap = 1.83;
  const facing = [0.61, 0.57, 0.48];
  for (const side of [-1, 1]) {
    const [a, b] = side < 0 ? [-x, -gap] : [gap, x];
    box(p, 'rough', [a, 0.05, z - 0.5], [b, 4.98, z], facing);
    box(p, 'ashlar', [a - 0.066, 4.66, z - 0.61], [b + 0.066, 5.22, z + 0.13], shade(facing, 0.91));
    if (detail.joinery)
      for (let i = 0; i < 15; i += detail.name === 'street' ? 2 : 1) {
        const cy = 0.25 + i * 0.285;
        const course = (i % 2) * 0.208;
        const count = Math.ceil((b - a) / 0.416);
        for (let j = 0; j < count; j++) {
          const lo = Math.max(a, a + j * 0.416 + course - 0.208),
            hi = Math.min(b, a + (j + 1) * 0.416 + course - 0.226);
          if (hi - lo > 0.095)
            box(
              p,
              detail.facingSurface ?? 'ashlar',
              [lo, cy, z - 0.018],
              [hi, cy + 0.259, z + 0.027],
              shade(facing, 0.8 + 0.18 * Math.cos(j * 2.83 + i * 1.9)),
            );
        }
      }
  }
  box(p, 'plaster', [-gap - 0.2, 0, -z], [-gap, 5.72, z + 0.33], liner);
  if (!detail.surfaceConnection) {
    box(p, 'plaster', [gap, 0, -z], [gap + 0.2, 5.72, z + 0.33], liner);
  }
  box(p, 'plaster', [-gap, 2.56, -z - 0.02], [gap, 5.1, -z + 0.21], shade(liner, 0.9));
  if (detail.surfaceConnection) {
    const [left, back, right, front] = site.exit.landingPad;
    const [doorBack, doorFront] = site.exit.landingDoor;
    const lintelHeight = 2.24;
    box(p, 'plaster', [gap, lintelHeight, -z], [left, 5.72, z + 0.33], liner);
    box(p, 'plaster', [gap, 0, -z], [left, lintelHeight, doorBack], liner);
    box(p, 'plaster', [gap, 0, doorFront], [left, lintelHeight, z + 0.33], liner);
    box(p, 'foundation', [-gap, -0.09, -z], [left, 0, z - 2.6], shade(mortar, 0.87));
    box(p, 'plaster', [right - 0.12, 0, back], [right, 2.88, front], liner);
    box(p, 'plaster', [left, 0, back], [right, 2.88, back + 0.13], liner);
    box(p, 'plaster', [left, 0, front - 0.13], [right, 2.88, front], liner);
    box(p, 'rough', [left, 2.88, back], [right, 3.03, front], facing);
  } else {
    box(p, 'glazing', [-gap, 0, -z - 0.031], [gap, 2.56, -z + 0.03], glass);
  }
  box(p, 'foundation', [-gap, -0.09, z - 2.6], [gap, 0.018, z + 0.54], shade(mortar, 0.87));
  box(
    p,
    canopySurface,
    [-gap - 0.26, 5.64, -z - 0.15],
    [gap + 0.3, 5.74, z + 1.48],
    [0.64, 0.74, 0.76],
  );
  const n = detail.joinery ? 5 : 2;
  for (let i = 0; i <= n; i++) {
    const plane = -z + ((2 * z + 1.4) * i) / n;
    beam(
      p,
      'iron',
      [-gap - 0.19, 5.61, plane],
      [gap + 0.19, 5.61, plane],
      0.074,
      0.073,
      [0.36, 0.41, 0.39],
    );
  }
  if (detail.joinery)
    for (const dz of [-0.7, 0, 0.68]) {
      const center = z - 2.2 + dz;
      const leaf = [
        [gap - 0.011, 2.8, center],
        [gap - 0.011, 3.27, center - 0.15],
        [gap - 0.011, 3.87, center - 0.04],
        [gap - 0.011, 4.27, center + 0.1],
        [gap - 0.011, 3.37, center + 0.12],
      ];
      for (let i = 1; i + 1 < leaf.length; i++)
        tri(p, 'iron', [leaf[0], leaf[i], leaf[i + 1]], shade(iron, 0.75));
    }
}

export function buildCatacombSurface(out, detail) {
  buildDenfertEntrance(placed(out, site.entrance), detail);
  buildReneCotyExit(placed(out, site.exit), {
    ...detail,
    surfaceConnection: detail.name !== 'skyline',
  });
}
