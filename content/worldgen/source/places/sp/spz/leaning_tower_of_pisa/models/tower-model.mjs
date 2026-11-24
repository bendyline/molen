import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  marble: { slot: 'trim', graph: 'stone_marble', roughness: 0.87 },
  masonry: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.91 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.75 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.76 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.91 },
};

const TAU = 2 * Math.PI;
const white = rgb('e1dbcb');
const cream = rgb('cec8b9');
const gray = rgb('b5b2a7');
const grayGreen = rgb('898e84');
const iron = rgb('555752');
const bronze = rgb('85775f');
const wood = rgb('655648');
const galleryLevels = [8.9, 15.18, 21.4, 27.57, 33.76, 39.86, 46.04];
const radians = Math.PI / 180;
const lean = site.leanDegrees * radians;
const spin = site.leanBearingDegrees * radians;
const leanX = Math.sin(spin);
const leanZ = -Math.cos(spin);
const sinLean = Math.sin(lean);
const cosLean = Math.cos(lean);

// The upper belfry partly corrects the shaft's inclination. The apron's plane remains level.
function position([x, height, z], tilted = true) {
  if (!tilted) return [x, height, z];
  const along = x * leanX + z * leanZ;
  const correction = Math.max(0, height - 46.04) * 0.022;
  const displacement = height * sinLean - correction + along * (cosLean - 1);
  return [x + leanX * displacement, height * cosLean - along * sinLean, z + leanZ * displacement];
}

const radial = (radius, height, angle) => [
  radius * Math.cos(angle),
  height,
  radius * Math.sin(angle),
];

function polygon(out, material, coords, color, tilted = true) {
  const p = coords.map((v) => position(v, tilted));
  const normal = normalFor(p[0], p[1], p[2]);
  if (p.length === 3) out.addTriangle(material, '', p, normal, [], color);
  else out.addQuad(material, '', p, normal, [], color);
}

function cylinder(
  out,
  material,
  profile,
  sides,
  color,
  center = [0, 0],
  tilted = true,
  cap = true,
) {
  const point = (r, y, angle) => {
    const [x, h, z] = radial(r, y, angle);
    return [x + center[0], h, z + center[1]];
  };
  for (let i = 0; i < sides; i++) {
    const a = (i * TAU) / sides,
      b = ((i + 1) * TAU) / sides;
    for (let k = 1; k < profile.length; k++) {
      const [low, inner] = profile[k - 1],
        [high, outer] = profile[k];
      polygon(
        out,
        material,
        [point(inner, low, a), point(outer, high, a), point(outer, high, b), point(inner, low, b)],
        color,
        tilted,
      );
    }
    if (cap) {
      const [low, bottom] = profile[0],
        [high, top] = profile.at(-1);
      polygon(
        out,
        material,
        [point(0, low, a), point(bottom, low, a), point(bottom, low, b)],
        color,
        tilted,
      );
      polygon(
        out,
        material,
        [point(0, high, a), point(top, high, b), point(top, high, a)],
        color,
        tilted,
      );
    }
  }
}

function arch(out, a, b, y, rise, radius, innerRadius, thickness, steps, solidHeight, color) {
  for (let j = 0; j < steps; j++) {
    const u = j / steps,
      v = (j + 1) / steps;
    const low = y + rise * Math.sin(u * Math.PI),
      next = y + rise * Math.sin(v * Math.PI);
    const top = solidHeight ?? low + thickness,
      topNext = solidHeight ?? next + thickness;
    const angle = a + (b - a) * u,
      later = a + (b - a) * v;
    const p = radial(radius, low, angle),
      q = radial(radius, next, later);
    const t = radial(radius, top, angle),
      uTop = radial(radius, topNext, later);
    const inside = radial(innerRadius, low, angle),
      laterInside = radial(innerRadius, next, later);
    polygon(out, 'marble', [p, t, uTop, q], color);
    if (innerRadius === radius) continue;
    const innerTop = radial(innerRadius, top, angle),
      laterTop = radial(innerRadius, topNext, later);
    polygon(out, 'marble', [inside, laterInside, laterTop, innerTop], color);
    polygon(out, 'marble', [p, q, laterInside, inside], cream);
    if (!solidHeight) polygon(out, 'marble', [t, innerTop, laterTop, uTop], color);
  }
}

function diamond(out, angle, y, radius, size) {
  const halfAngle = size / radius;
  const p = (a, h) => radial(radius, h, a);
  polygon(
    out,
    'marble',
    [p(angle - halfAngle, y), p(angle, y + size), p(angle + halfAngle, y), p(angle, y - size)],
    grayGreen,
  );
  const rim = 1.22;
  const outer = [
    p(angle - halfAngle * rim, y),
    p(angle, y + size * rim),
    p(angle + halfAngle * rim, y),
    p(angle, y - size * rim),
  ];
  const inset = [
    p(angle - halfAngle, y),
    p(angle, y + size),
    p(angle + halfAngle, y),
    p(angle, y - size),
  ];
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    polygon(out, 'marble', [outer[i], outer[next], inset[next], inset[i]], white);
  }
}

function base(out, detail, sides) {
  cylinder(
    out,
    'marble',
    [
      [-0.17, 8.2],
      [0.06, 8.25],
      [0.23, 8.21],
    ],
    sides,
    cream,
    [0, 0],
    false,
  );
  cylinder(
    out,
    'masonry',
    [
      [-0.7, 7.82],
      [0.48, 7.82],
      [0.97, 7.49],
      [8.9, 7.47],
    ],
    sides,
    gray,
  );
  if (!detail) return;
  const count = 15;
  const entrance = site.entranceBay;
  for (let i = 0; i < count; i++) {
    const a = (i * TAU) / count,
      b = ((i + 1) * TAU) / count,
      mid = (a + b) / 2;
    if (i === entrance) {
      const door = (angle, y) => radial(7.59, y, angle);
      polygon(
        out,
        'timber',
        [
          door(mid - 0.123, 1.05),
          door(mid - 0.123, 4.96),
          door(mid + 0.123, 4.96),
          door(mid + 0.123, 1.05),
        ],
        wood,
      );
      arch(out, mid - 0.139, mid + 0.139, 4.95, 1.03, 7.68, 7.6, 0.25, 6, null, white);
    } else if (detail > 1) diamond(out, mid, 5.25, 7.62, 0.66);
    const radius = 7.46;
    cylinder(
      out,
      'marble',
      [
        [0.92, 0.255],
        [1.15, 0.221],
        [5.88, 0.196],
        [6.15, 0.29],
      ],
      detail > 1 ? 8 : 4,
      cream,
      [radius * Math.cos(a), radius * Math.sin(a)],
      true,
      false,
    );
    arch(out, a, b, 6.05, 1.05, 7.66, 7.52, 0.275, detail > 1 ? 6 : 3, null, white);
  }
}

function galleries(out, detail, sides) {
  const shaftRadius = 6.17;
  const count = [0, 12, 30, 30][detail];
  cylinder(
    out,
    'masonry',
    [
      [8.72, shaftRadius],
      [46.15, shaftRadius - 0.12],
    ],
    sides,
    gray,
  );
  for (let i = 0; i < 6; i++) {
    const low = galleryLevels[i],
      high = galleryLevels[i + 1];
    const radius = 7.24 - i * 0.035;
    const outer = radius + 0.47;
    const top = high - 0.12;
    const floor = low + 0.55;
    const spring = high - 1.65;
    if (detail === 0) {
      cylinder(
        out,
        'marble',
        [
          [low + 0.09, outer],
          [floor, outer],
        ],
        sides,
        white,
        [0, 0],
        true,
        false,
      );
      cylinder(
        out,
        'marble',
        [
          [top - 0.47, outer - 0.16],
          [high - 0.08, outer - 0.085],
        ],
        sides,
        cream,
        [0, 0],
        true,
        false,
      );
      continue;
    }
    cylinder(
      out,
      'marble',
      [
        [low - 0.12, outer - 0.08],
        [low + 0.16, outer],
        [floor, outer],
      ],
      sides,
      white,
    );
    for (let n = 0; n < count; n++) {
      const a = ((n + 0.5 * (i % 2)) * TAU) / count,
        b = a + TAU / count;
      const column =
        detail === 1
          ? [
              [floor, 0.22],
              [spring + 0.21, 0.17],
            ]
          : detail === 2
            ? [
                [floor, 0.21],
                [floor + 0.21, 0.133],
                [spring - 0.18, 0.11],
                [spring + 0.16, 0.23],
              ]
            : [
                [floor, 0.24],
                [floor + 0.16, 0.24],
                [floor + 0.3, 0.153],
                [floor + 0.4, 0.126],
                [spring - 0.36, 0.114],
                [spring - 0.19, 0.145],
                [spring - 0.04, 0.203],
                [spring + 0.16, 0.237],
              ];
      cylinder(
        out,
        'marble',
        column,
        [0, 3, 5, 7][detail],
        n % 7 === 0 ? cream : white,
        [radius * Math.cos(a), radius * Math.sin(a)],
        true,
        false,
      );
      arch(
        out,
        a,
        b,
        spring,
        detail === 1 ? 0.69 : 0.806,
        radius + 0.228,
        radius - 0.2,
        0,
        [0, 2, 4, 6][detail],
        top,
        white,
      );
    }
  }
}

function rail(out, y, radius, count, detail) {
  if (detail < 2) return;
  cylinder(
    out,
    'iron',
    [
      [y + 0.81, radius],
      [y + 0.85, radius],
      [y + 0.85, radius - 0.035],
    ],
    count,
    iron,
    [0, 0],
    true,
    false,
  );
  for (let i = 0; i < count; i++) {
    const a = (i * TAU) / count;
    cylinder(
      out,
      'iron',
      [
        [y, 0.031],
        [y + 0.84, 0.027],
      ],
      4,
      iron,
      [radius * Math.cos(a), radius * Math.sin(a)],
      true,
      false,
    );
  }
}

function belfry(out, detail, sides) {
  cylinder(
    out,
    'marble',
    [
      [45.76, 7.54],
      [46.13, 7.56],
      [46.52, 7.4],
    ],
    sides,
    white,
  );
  cylinder(
    out,
    'marble',
    [
      [46.48, 5.4],
      [47.0, 5.57],
      [47.5, 5.32],
    ],
    sides,
    cream,
  );
  const spring = 52.63,
    floor = 47.49;
  const count = detail ? 8 : 6;
  for (let i = 0; i < count; i++) {
    const a = (i * TAU) / count,
      b = a + TAU / count,
      center = (a + b) / 2;
    const pier = 0.086;
    for (const [s, e] of [
      [a, a + pier],
      [b - pier, b],
    ]) {
      const outside = 5.38,
        inside = 4.52;
      polygon(
        out,
        'masonry',
        [
          radial(outside, floor, s),
          radial(outside, spring, s),
          radial(outside, spring, e),
          radial(outside, floor, e),
        ],
        cream,
      );
      polygon(
        out,
        'masonry',
        [
          radial(inside, floor, e),
          radial(inside, spring, e),
          radial(inside, spring, s),
          radial(inside, floor, s),
        ],
        gray,
      );
      const edge = s === a ? e : s;
      const side = [
        radial(outside, floor, edge),
        radial(inside, floor, edge),
        radial(inside, spring, edge),
        radial(outside, spring, edge),
      ];
      polygon(out, 'marble', s === a ? side : side.reverse(), gray);
    }
    arch(out, a, b, spring, 1.01, 5.38, 4.52, 0, detail > 1 ? 7 : 3, 54.26, cream);
    if (detail > 1 && i < 7) {
      const centerXZ = [2.95 * Math.cos(center), 2.95 * Math.sin(center)];
      const radius = 0.61 + (i % 4) * 0.1;
      cylinder(
        out,
        'bronze',
        [
          [48.71, radius],
          [48.97, radius * 0.86],
          [50.3, radius * 0.58],
          [50.6, radius * 0.28],
        ],
        [0, 0, 8, 12][detail],
        bronze,
        centerXZ,
      );
    }
  }
  cylinder(
    out,
    'marble',
    [
      [54.25, 5.51],
      [54.58, 5.66],
      [54.84, 5.59],
      [55.07, 5.38],
    ],
    sides,
    white,
  );
  rail(out, 46.49, 7.27, detail > 2 ? 48 : 24, detail);
  rail(out, 55.01, 5.14, detail > 2 ? 36 : 20, detail);
}

function build(out, detail) {
  const sides = [12, 22, 40, 60][detail];
  base(out, detail, sides);
  galleries(out, detail, sides);
  belfry(out, detail, sides);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
