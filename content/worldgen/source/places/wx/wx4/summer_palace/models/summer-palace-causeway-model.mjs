import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import {
  courtBay,
  courtRoof,
  surfaces as courtSurfaces,
  face,
  frame,
  granite,
  hall,
  levels,
  marble,
  rectangle,
  red,
  roofs,
  solid,
  turquoise,
  up,
} from './summer-palace-model.mjs';

export const forms = new Set(['dike', 'jingming', 'residence']);
export const surfaces = { ...courtSurfaces, brick: { slot: 'wall', graph: 'brick_stack' } };
const limestone = [0.67, 0.65, 0.59];
const leadGrey = [0.34, 0.365, 0.338];
const bronze = [0.22, 0.268, 0.179];

function gradeAt(deck, x) {
  const i = deck.findIndex(([u]) => u >= x);
  if (i === 0) return deck[0][1];
  if (i < 0) return deck.at(-1)[1];
  const [a, y] = deck[i - 1];
  const [b, h] = deck[i];
  return y + ((x - a) / (b - a)) * (h - y);
}

function cutStoneBridge(out, layout, detail) {
  const { type, ends, width, water, deck, openings } = layout;
  const half = width / 2;
  const first = ends[0][0];
  const last = ends[1][0];
  const crown = gradeAt(deck, 0);
  const bed = water - 0.9;
  const moon = type === 'moon';
  const xiuyi = type === 'xiuyi';
  const finish = moon || xiuyi ? marble : limestone;
  let edge = first;
  const spans = [];
  for (const opening of openings) {
    const a = opening.center - opening.width / 2;
    const b = opening.center + opening.width / 2;
    spans.push({ from: edge, to: a }, { from: a, to: b, opening });
    edge = b;
  }
  spans.push({ from: edge, to: last });
  for (const { from, to, opening } of spans) {
    const curved = opening && opening.type !== 'beam';
    const count = curved
      ? [9, 14, 22, 33, 52][detail]
      : Math.max(1, Math.ceil((to - from) / (detail < 2 ? 3 : 1.3)));
    const row = (i) => {
      const t = i / count;
      const theta = Math.PI * (1 - t);
      const x = curved
        ? opening.center + Math.cos(theta) * opening.width * 0.5
        : from + (to - from) * t;
      const top = gradeAt(deck, x);
      let bottom = bed;
      if (opening?.type === 'beam')
        bottom = Math.min(gradeAt(deck, from), gradeAt(deck, to)) - 0.47;
      if (opening?.type === 'round') {
        const binfeng = type === 'binfeng';
        const spring = water + (binfeng ? 0.9 : 0);
        const rise = binfeng ? opening.width / 2 : 1.21;
        bottom = Math.min(top - 0.39, spring + rise * Math.sin(theta));
      }
      if (opening?.type === 'moon') {
        const span = Math.abs((2 * (x - opening.center)) / opening.width);
        bottom = water - 0.12 + (crown - 0.78 - water) * Math.sqrt(Math.max(0, 1 - span));
      }
      if (opening?.type === 'high-round') {
        const spring = water + 1.24;
        bottom = Math.min(top - 0.55, spring + (crown - 0.72 - spring) * Math.sin(theta));
      }
      return { x, top, bottom };
    };
    for (let i = 0; i < count; i++) {
      const a = row(i);
      const b = row(i + 1);
      for (const side of [-1, 1]) {
        const z = side * half;
        face(
          out,
          'stone',
          [
            [a.x, a.bottom, z],
            [b.x, b.bottom, z],
            [b.x, b.top, z],
            [a.x, a.top, z],
          ],
          finish,
          [0, 0, side],
        );
        if (opening && detail >= 2) {
          const border = z + side * 0.045;
          face(
            out,
            'marble',
            [
              [a.x, a.bottom, border],
              [b.x, b.bottom, border],
              [b.x, Math.min(b.top - 0.04, b.bottom + 0.27), border],
              [a.x, Math.min(a.top - 0.04, a.bottom + 0.27), border],
            ],
            marble,
            [0, 0, side],
          );
        }
      }
      face(
        out,
        'stone',
        [
          [a.x, a.top, -half],
          [a.x, a.top, half],
          [b.x, b.top, half],
          [b.x, b.top, -half],
        ],
        limestone,
        up,
      );
      if (opening || detail >= 2) {
        face(
          out,
          'stone',
          [
            [a.x, a.bottom, half],
            [a.x, a.bottom, -half],
            [b.x, b.bottom, -half],
            [b.x, b.bottom, half],
          ],
          granite,
          [0, -1, 0],
        );
      }
    }
    if (opening)
      for (const [i, s] of [
        [0, 1],
        [count, -1],
      ]) {
        const { x, bottom } = row(i);
        face(
          out,
          'stone',
          [
            [x, bed, -half],
            [x, bed, half],
            [x, bottom, half],
            [x, bottom, -half],
          ],
          limestone,
          [s, 0, 0],
        );
      }
  }
  if (xiuyi) {
    const opening = openings[0];
    for (const side of [-1, 1]) {
      const x = opening.center + side * (opening.width / 2 + 0.91);
      box(
        out,
        'stone',
        [x - 1.08, bed, -half - 0.43],
        [x + 1.08, water + 0.47, half + 0.43],
        limestone,
      );
      box(
        out,
        'marble',
        [x - 1.21, water + 0.35, -half - 0.5],
        [x + 1.21, water + 0.56, half + 0.5],
        marble,
      );
    }
  }
  for (const [x, sign] of [
    [first, -1],
    [last, 1],
  ]) {
    const top = gradeAt(deck, x);
    face(
      out,
      'stone',
      [
        [x, bed, -half],
        [x, bed, half],
        [x, top, half],
        [x, top, -half],
      ],
      limestone,
      [sign, 0, 0],
    );
  }
  balustrades(out, layout, detail);
  if (detail >= 2) treadEdges(out, layout, detail);
  if (layout.landing) stoneLanding(out, layout, bed);
  if (['binfeng', 'mirror', 'lian', 'willow'].includes(type)) coveredBay(out, layout, detail);
}

function stoneLanding(out, { landing, width }, bed) {
  const { start, end, endWidth } = landing;
  const [x, y, z] = start;
  const [u, v, w] = end;
  const half = width / 2;
  const edge = endWidth / 2;
  face(
    out,
    'stone',
    [
      [x, y, z - half],
      [x, y, z + half],
      [u, v, w + edge],
      [u, v, w - edge],
    ],
    limestone,
    up,
  );
  for (const side of [-1, 1]) {
    const a = z + side * half;
    const b = w + side * edge;
    face(
      out,
      'stone',
      [
        [x, bed, a],
        [u, v - 0.6, b],
        [u, v, b],
        [x, y, a],
      ],
      marble,
      [0, 0, side],
    );
  }
  face(
    out,
    'stone',
    [
      [u, v - 0.6, w - edge],
      [u, v - 0.6, w + edge],
      [u, v, w + edge],
      [u, v, w - edge],
    ],
    marble,
    [1, 0, 0],
  );
}

function balustrades(out, { width, ends, deck, type }, detail) {
  const [a, b] = ends.map((p) => p[0]);
  const count =
    detail === 0 ? 6 : Math.max(8, Math.round((b - a) / (type === 'moon' ? 1.75 : 1.52)));
  const railY = type === 'moon' || type === 'xiuyi' ? 0.96 : 0.78;
  for (const side of [-1, 1]) {
    const z = side * (width / 2 - 0.14);
    for (let i = 0; i <= count; i++) {
      const x = a + ((b - a) * i) / count;
      const y = gradeAt(deck, x);
      if (detail >= 1 || i % 2 === 0) {
        beam(out, 'stone', [x, y, z], [x, y + railY + 0.085, z], 0.22, 0.25, marble);
        if (detail >= 3) {
          const points = [
            [railY + 0.04, 0.15],
            [railY + 0.16, 0.17],
            [railY + 0.28, 0.105],
            [railY + 0.38, 0.056],
          ];
          loft(
            out,
            'marble',
            points.map(([h, r]) => radialRing(y + h, r, r, detail === 4 ? 8 : 5, [x, z])),
            marble,
          );
        }
      }
      if (i === count) continue;
      const u = a + ((b - a) * (i + 1)) / count;
      const v = gradeAt(deck, u);
      beam(out, 'marble', [x, y + railY, z], [u, v + railY, z], 0.145, 0.18, marble);
      if (detail >= 2) {
        beam(out, 'stone', [x, y + 0.2, z], [u, v + 0.2, z], 0.174, 0.19, limestone);
        face(
          out,
          'marble',
          [
            [x + 0.14, y + 0.32, z + side * 0.031],
            [u - 0.14, v + 0.32, z + side * 0.031],
            [u - 0.14, v + railY - 0.15, z + side * 0.031],
            [x + 0.14, y + railY - 0.15, z + side * 0.031],
          ],
          marble,
          [0, 0, side],
        );
      }
    }
  }
}

function treadEdges(out, { deck, ends, width, type }, detail) {
  const span = ends[1][0] - ends[0][0];
  const stride = type === 'moon' || type === 'xiuyi' ? 0.43 : 0.62;
  const count = Math.floor(span / stride);
  for (let i = 1; i < count; i++) {
    const x = ends[0][0] + (span * i) / count;
    const y = gradeAt(deck, x);
    const next = gradeAt(deck, x + stride);
    if (Math.abs(y - next) < 0.062) continue;
    beam(
      out,
      'stone',
      [x, y + 0.044, -width * 0.46],
      [x, y + 0.044, width * 0.46],
      detail >= 3 ? 0.115 : 0.072,
      0.07,
      limestone,
    );
  }
}

function pyramidalRoof(out, { xRadius, zRadius, base, rise, sides, tint, detail }) {
  const phase = Math.PI / sides;
  const make = (y, r) => radialRing(y, xRadius * r, zRadius * r, sides, [0, 0], phase);
  const points =
    detail === 0
      ? [
          [0, 1],
          [1, 0.08],
        ]
      : [
          [0, 1],
          [0.29, 0.77],
          [0.67, 0.42],
          [1, 0.08],
        ];
  const rings = points.map(([t, r]) => make(base + rise * t, r));
  loft(out, 'tile', rings, tint);
  if (detail >= 2)
    for (const [i, a] of rings[0].entries()) {
      const tip = [a[0] * 1.022, a[1] + 0.34, a[2] * 1.022];
      beam(out, 'tile', a, tip, 0.16, 0.195, tint);
      for (let j = 1; j < rings.length; j++)
        beam(out, 'tile', rings[j - 1][i], rings[j][i], 0.125, 0.15, tint);
    }
}

function coveredBay(out, { type, width, deck }, detail) {
  const buildingWidth = { binfeng: 9.5, mirror: 6.15, lian: 6.0, willow: 9.6 }[type];
  const body = frame(out, [0, 0], gradeAt(deck, 0) + 0.03, 0);
  const length = buildingWidth;
  const depth = width * 0.91;
  const height = type === 'willow' ? 3.53 : 3.15;
  const roofTint = type === 'binfeng' ? roofs.grey : leadGrey;
  const radial = type === 'mirror' || type === 'lian';
  if (type === 'mirror') {
    const poles = radialRing(0, length * 0.48, depth * 0.54, 8, [0, 0], Math.PI / 8);
    for (const [i, [x, , z]] of poles.entries()) {
      beam(body, 'timber', [x, 0, z], [x, height, z], 0.29, 0.29, red);
      if (detail > 0) {
        const [a, , b] = poles[(i + 1) % poles.length];
        beam(body, 'timber', [x, height - 0.17, z], [a, height - 0.17, b], 0.25, 0.3, turquoise);
        beam(body, 'stone', [x, 0, z], [x, 0.16, z], 0.45, 0.42, granite);
      }
    }
  } else {
    courtBay(body, length, depth, 0, height, type === 'lian' ? 1 : 3, detail, {
      plaque: detail >= 2,
    });
  }
  if (radial) {
    const sides = type === 'mirror' ? 8 : 4;
    const factor = sides === 4 ? 0.82 : 0.53;
    pyramidalRoof(body, {
      xRadius: length * factor,
      zRadius: depth * factor,
      base: height + 0.18,
      rise: 1.58,
      sides,
      tint: roofTint,
      detail,
    });
    const lantern = radialRing(
      height + 1.04,
      length * factor * 0.37,
      depth * factor * 0.37,
      sides,
      [0, 0],
      Math.PI / sides,
    );
    for (const [i, a] of lantern.entries()) {
      const b = lantern[(i + 1) % sides];
      face(
        body,
        'timber',
        [a, b, [b[0], b[1] + 0.62, b[2]], [a[0], a[1] + 0.62, a[2]]],
        turquoise,
        [a[0] + b[0], 0, a[2] + b[2]],
      );
    }
    pyramidalRoof(body, {
      xRadius: length * factor * 0.72,
      zRadius: depth * factor * 0.72,
      base: height + 1.65,
      rise: 1.94,
      sides,
      tint: roofTint,
      detail,
    });
    const tip = radialRing(height + 3.58, 0.17, 0.17, sides);
    loft(body, 'tile', [tip, radialRing(height + 3.88, 0.079, 0.079, sides)], roofTint);
  } else {
    const willow = type === 'willow';
    courtRoof(
      body,
      length * 1.13,
      depth * 1.17,
      height + 0.2,
      1.39,
      roofTint,
      detail,
      willow,
      0.19,
    );
    box(
      body,
      'timber',
      [-length * 0.31, height + 1.19, -depth * 0.25],
      [length * 0.31, height + 1.82, depth * 0.25],
      turquoise,
    );
    courtRoof(
      body,
      length * (willow ? 0.91 : 0.78),
      depth * 0.83,
      height + 1.78,
      willow ? 2.18 : 1.66,
      roofTint,
      detail,
      willow,
      0.19,
    );
  }
}

function screen(out, w, d, h, bays, detail, fill) {
  const width = (w * 0.82) / bays;
  const z = d * 0.295;
  for (let i = 0; i < bays; i++) {
    if (i === (bays - 1) / 2) continue;
    const x = (i - (bays - 1) / 2) * width;
    box(
      out,
      'timber',
      [x - width * 0.48, h * 0.24, z - 0.045],
      [x + width * 0.48, h * 0.84, z + 0.025],
      fill,
    );
    if (detail < 2) continue;
    const z1 = z + 0.043;
    for (const off of [-0.34, -0.17, 0, 0.17, 0.34])
      beam(
        out,
        'timber',
        [x + off * width, h * 0.3, z1],
        [x + off * width, h * 0.83, z1],
        0.075,
        0.083,
        turquoise,
      );
    for (const row of [0.3, 0.43, 0.56, 0.69, 0.82])
      beam(
        out,
        'timber',
        [x - width * 0.44, h * row, z1],
        [x + width * 0.44, h * row, z1],
        0.068,
        0.078,
        turquoise,
      );
  }
}

function stair(out, w, z, floor, detail) {
  const rows = detail < 2 ? 2 : Math.ceil(floor / 0.18);
  for (let i = 0; i < rows; i++) {
    const d = z + i * 0.36;
    box(
      out,
      'stone',
      [-w / 2, -floor - 0.35, d],
      [w / 2, 0.016 - (i * floor) / rows, d + 0.365],
      limestone,
    );
  }
}

function ceremonialVessel(out, y, x, z, detail) {
  const radius = 0.47;
  const base = [
    [0, 0.62],
    [0.3, 0.48],
    [0.56, 0.68],
    [0.86, 0.93],
    [1.22, 1],
    [1.4, 0.82],
    [1.51, 0.84],
  ];
  loft(
    out,
    'enamel',
    base.map(([v, r]) => radialRing(y + v, radius * r, radius * r, detail === 4 ? 12 : 8, [x, z])),
    bronze,
  );
  if (detail >= 3) {
    const top = [
      [1.43, 0.8],
      [1.59, 0.6],
      [1.76, 0.16],
      [1.99, 0.11],
    ];
    loft(
      out,
      'enamel',
      top.map(([v, r]) => radialRing(y + v, radius * r, radius * r, detail === 4 ? 12 : 8, [x, z])),
      bronze,
    );
  }
}

function principalResidence(out, site, detail) {
  const { width: w, depth: d, center, angle } = site.frame;
  const { role } = site;
  const leshou = role === 'leshou';
  const yulan = role === 'yulan';
  const gate = role === 'residence_gate';
  const grade = gate ? 0.63 : leshou ? 0.96 : 0.71;
  const h = gate ? 3.37 : leshou ? 5.38 : yulan ? 4.93 : 4.51;
  const bays = leshou ? 7 : gate ? 3 : 5;
  const body = frame(out, center, site.grade + grade, angle);
  solid(out, 'stone', site.outline, site.toe, site.grade + grade, granite);
  courtBay(body, w, d, 0, h, bays, detail, { wall: !gate, frontScreen: !gate, plaque: true });
  courtRoof(
    body,
    w * 1.067,
    d * 1.102,
    h + 0.29,
    Math.min(3.21, d * 0.28),
    roofs.grey,
    detail,
    true,
    0.24,
  );
  if (!gate) {
    screen(body, w, d, h, bays, detail, yulan ? [0.14, 0.22, 0.141] : [0.13, 0.19, 0.137]);
    stair(body, w * (leshou ? 0.64 : 0.46), d * 0.49, grade, detail);
  }
  if (leshou && detail >= 2)
    for (const x of [-w * 0.28, w * 0.28]) {
      box(
        body,
        'stone',
        [x - 0.58, -grade - 0.2, d * 0.65 - 0.6],
        [x + 0.58, -grade + 0.28, d * 0.65 + 0.6],
        marble,
      );
      ceremonialVessel(body, -grade + 0.28, x, d * 0.65, detail);
    }
}

function sealedChamber(out, site, detail) {
  const { width: w, depth: d, center, angle } = site.frame;
  const body = frame(out, center, site.grade + 0.47, angle);
  solid(out, 'stone', site.outline, site.toe, site.grade + 0.47, granite);
  box(body, 'brick', [-w * 0.46, 0, -d * 0.44], [w * 0.46, 3.51, d * 0.43], leadGrey);
  courtRoof(
    body,
    w * 1.065,
    d * 1.085,
    3.59,
    Math.min(d * 0.27, 2.05),
    roofs.grey,
    detail,
    true,
    0.19,
  );
  if (detail >= 2)
    for (const x of [-w * 0.26, 0, w * 0.26])
      beam(body, 'timber', [x, 0.13, d * 0.44], [x, 3.62, d * 0.44], 0.19, 0.21, red);
}

function galleryRoof(out, width, depth, y, rise, detail, lift) {
  if (detail === 0) {
    const eave = rectangle(width, depth)
      .toReversed()
      .map(([x, z]) => [x, y, z]);
    const ridge = rectangle(width * 0.63, depth * 0.06)
      .toReversed()
      .map(([x, z]) => [x, y + rise, z]);
    loft(out, 'tile', [eave, ridge], roofs.green);
  } else {
    courtRoof(out, width, depth, y, rise, roofs.green, detail, false, lift);
  }
}

function residence(out, layout, detail) {
  for (const site of layout.sites) {
    if (site.role !== 'side') principalResidence(out, site, detail);
    else if (layout.id === 'summer_palace_jade_ripples') sealedChamber(out, site, detail);
    else hall(out, site, detail);
  }
}

function jingming(out, layout, detail) {
  for (const { role, center, width: w, depth: d, angle, grade } of layout.reconstructed) {
    const centerHall = role === 'central';
    const body = frame(out, center, grade, angle);
    const floor = centerHall ? 1.3 : 0.78;
    solid(body, 'stone', rectangle(w * 1.12, d * 1.22), -1.05, floor, marble);
    const h = centerHall ? 4.28 : 3.69;
    courtBay(body, w, d, floor, h, 5, detail, { wall: true, frontScreen: true, plaque: true });
    galleryRoof(body, w * 1.115, d * 1.16, floor + h + 0.22, centerHall ? 1.52 : 2.2, detail, 0.23);
    if (centerHall) {
      const upper = floor + h + 1.05;
      const uW = w * 0.79,
        uD = d * 0.72;
      box(
        body,
        'stone',
        [-uW * 0.47, upper - 0.22, -uD * 0.47],
        [uW * 0.47, upper, uD * 0.47],
        marble,
      );
      courtBay(body, uW, uD, upper, 3.33, 5, detail, {
        wall: true,
        frontScreen: true,
        rail: true,
        plaque: true,
      });
      galleryRoof(body, uW * 1.165, uD * 1.18, upper + 3.58, 2.05, detail, 0.29);
    }
    stair(frame(body, [0, 0], floor, 0), w * 0.54, d * 0.6, floor, detail);
    if (detail >= 2)
      for (const z of [-d * 0.59, d * 0.59])
        for (let j = 0; j < 8; j++) {
          const x = (j / 7 - 0.5) * w * 1.1;
          if (z > 0 && Math.abs(x) < w * 0.28) continue;
          beam(body, 'marble', [x, floor, z], [x, floor + 0.89, z], 0.2, 0.22, marble);
        }
  }
}

export function buildSummerPalaceMember(out, layout, level) {
  const detail = levels[level];
  switch (layout.form) {
    case 'dike':
      cutStoneBridge(out, layout.dike, detail);
      break;
    case 'residence':
      residence(out, layout, detail);
      break;
    case 'jingming':
      jingming(out, layout, detail);
      break;
  }
}
