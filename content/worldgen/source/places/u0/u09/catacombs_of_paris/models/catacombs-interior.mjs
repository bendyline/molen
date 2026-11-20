import {
  beam,
  chamferedRectangle,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import {
  buildFontis,
  fontisMouthHeight,
  fontisMouthRange,
  fontisSegment,
} from './catacombs-fontis.mjs';
import {
  buildPortMahon,
  portMahonMouthHeight,
  portMahonMouthRange,
  portMahonSegment,
} from './catacombs-port-mahon.mjs';
import { ossuaryVestibuleFurnishings, pillarsHallFurnishings } from './catacombs-vestibule.mjs';
import { site } from './site-controls.mjs';

const ref = 'palette:#ffffff';
const rock = [0.55, 0.5, 0.41];
const course = [0.64, 0.59, 0.49];
const floor = [0.49, 0.45, 0.39];
const ivory = [0.68, 0.57, 0.43];
const aged = [0.52, 0.42, 0.306];
const dark = [0.25, 0.21, 0.17];
const tau = 2 * Math.PI;
// Paris Musées documents the descent between quarry levels. The vertical offset is estimated.
const lowerQuarryDrop = 1.65;
const vestibuleStations = [0.47, 0.86];
const shaftRadius = 1.7;
const stairCore = 0.25;
const renovatedHagueSegment = 27;
const renovatedHagueSide = 1;
const ossuaryPlaqueSegment = 24;
const ossuaryPlaqueSide = -1;
const tuileriesSegment = 43;
const tuileriesSide = -1;
const tuileriesStation = 0.44;
const sacellumSegment = 33;
const sacellumMouthRange = [0.14, 0.86];
const sacellumMouthHeight = 1.84;
const upperLandingStart = Math.PI / 2 - 0.42;
const upperLandingEnd = Math.PI / 2 + 0.52;
const shade = (rgb, scalar) => rgb.map((p) => p * scalar);
const quad = (out, key, pts, color) => out.addQuad(key, ref, pts, normalFor(...pts), [], color);
const triangle = (out, key, pts, color) =>
  out.addTriangle(key, ref, pts, normalFor(...pts), [], color);
const unit = ([x, z]) => {
  const length = Math.hypot(x, z);
  return [x / length, z / length];
};
const delta = (a, b) => [b[0] - a[0], b[1] - a[1]];
const facing = ([x, z]) => Math.atan2(x, z);
const laterals = ([x, z]) => [z, -x];

const kinds = {
  'entry-stair': [1.2, 2.25],
  'exit-stair': [1.2, 2.25],
  quarry: [1.13, 2.22],
  aqueduct: [1.2, 2.37],
  workshop: [2.35, 2.61],
  pillars: [2.53, 2.72],
  stairs: [1.2, 2.26],
  portal: [1.49, 2.34],
  ossuary: [1.32, 2.28],
  samaritaine: [2.54, 2.95],
  sepulchral: [3.04, 2.66],
  memorial: [1.59, 2.61],
  passion: [3.07, 3.06],
};

function galleryNodes(route, level) {
  const nodes = [];
  let y = level;
  for (const [i, control] of route.entries()) {
    const prior = route[i - 1],
      next = route[i + 1];
    const incoming = prior
      ? unit(delta(prior.point, control.point))
      : unit(delta(control.point, next.point));
    const outgoing = next ? unit(delta(control.point, next.point)) : incoming;
    const n0 = laterals(incoming),
      n1 = laterals(outgoing),
      side = unit([n0[0] + n1[0], n0[1] + n1[1]]);
    const shear = Math.min(1.36, 1 / Math.max(0.61, side[0] * n1[0] + side[1] * n1[1]));
    const [half, height] = kinds[control.kind];
    const node = {
      ...control,
      side,
      shear,
      half,
      height,
      facing: facing(outgoing),
      y,
    };
    if (control.kind === 'entry-stair') node.shaftDirection = outgoing;
    if (control.kind === 'exit-stair') node.shaftDirection = incoming.map((value) => -value);
    nodes.push(node);
    if (control.kind === 'stairs') y -= lowerQuarryDrop;
  }
  return nodes;
}

export function routeGeometry() {
  return galleryNodes(site.route, site.routeDepth);
}

function xz(node, x, y) {
  const [a, b] = node.point,
    [dx, dz] = node.side;
  return [a + dx * x * node.shear, node.y + y, b + dz * x * node.shear];
}

const archHeight = (node, f) =>
  node.mouthHeight ?? node.height - 0.33 + 0.33 * Math.sin(Math.PI * f);

function passagePoint(node, f, height) {
  const lateral = (2 * f - 1) * node.half;
  const point = xz(node, lateral, height);
  if (node.shaftDirection) {
    const distance = Math.sqrt(shaftRadius * shaftRadius - lateral * lateral);
    point[0] += node.shaftDirection[0] * distance;
    point[2] += node.shaftDirection[1] * distance;
  }
  return point;
}

// Positions and wall sides are estimates within the museum guide's sequence.
const quarryInscriptions = [
  {
    name: 'entry-depth-inscription',
    segment: 1,
    station: 0.19,
    wall: -1,
    center: 1.58,
    size: [0.71, 0.34],
    projection: 0.019,
    lines: ['HAUTEUR', '19ᵐ15'],
    painted: true,
  },
  {
    name: 'montsouris-street-plaque',
    segment: 4,
    station: 0.43,
    wall: 1,
    center: 1.49,
    size: [0.98, 0.52],
    projection: 0.074,
    lines: ['AVENUE DE', 'MONTSOURIS'],
    mounted: true,
  },
  {
    name: 'guillaumot-work-mark',
    segment: 5,
    station: 0.77,
    wall: -1,
    center: 1.52,
    size: [0.93, 0.29],
    projection: 0.014,
    lines: ['65 . G . 1781'],
  },
  {
    name: 'arcueil-aqueduct-inscription',
    segment: 9,
    station: 0.33,
    wall: 1,
    center: 1.48,
    size: [1.55, 0.385],
    projection: 0.017,
    lines: ['COURS DE L’AQUEDUC D’ARCUEIL', 'ENTRE LES REGARDS 24 ET 25'],
  },
  {
    name: 'rue-halle-plaque',
    segment: 21,
    inVestibule: true,
    station: 0.265,
    wall: 1,
    center: 1.51,
    size: [0.69, 0.46],
    projection: 0.018,
    tone: [0.68, 0.61, 0.5],
    lines: ['RUE', 'HALLÉ.'],
  },
];

export function quarryInscriptionFrames(nodes = routeGeometry()) {
  return quarryInscriptions.map((sign) => {
    const gallery = [nodes[sign.segment], nodes[sign.segment + 1]];
    const [from, to] = sign.inVestibule ? vestibuleNodes(...gallery) : gallery;
    const a = passagePoint(from, (sign.wall + 1) / 2, 0);
    const b = passagePoint(to, (sign.wall + 1) / 2, 0);
    const [dx, dz] = unit([b[0] - a[0], b[2] - a[2]]);
    return {
      ...sign,
      heading: Math.atan2(-dz * sign.wall, dx * sign.wall),
      position: a.map((coord, axis) => coord + (b[axis] - coord) * sign.station),
    };
  });
}

// The shared stroke font supplies the other letters. These glyphs complete the carved text.
const quarryGlyphs = {
  ᵐ: [
    [
      [0.12, 0.5],
      [0.12, 1.04],
      [0.45, 0.8],
      [0.78, 1.04],
      [0.78, 0.5],
    ],
  ],
  U: [
    [
      [0, 1],
      [0, 0.23],
      [0.2, 0],
      [0.8, 0],
      [1, 0.23],
      [1, 1],
    ],
  ],
  G: [
    [
      [1, 0.92],
      [0.72, 1],
      [0.25, 0.97],
      [0, 0.73],
      [0, 0.26],
      [0.23, 0.02],
      [0.78, 0],
      [1, 0.21],
      [1, 0.45],
      [0.52, 0.45],
    ],
  ],
  Q: [
    [
      [0.24, 0],
      [0, 0.22],
      [0, 0.78],
      [0.24, 1],
      [0.76, 1],
      [1, 0.78],
      [1, 0.22],
      [0.76, 0],
      [0.24, 0],
    ],
    [
      [0.63, 0.25],
      [1.1, -0.14],
    ],
  ],
  1: [
    [
      [0.16, 0.78],
      [0.54, 1],
      [0.54, 0],
    ],
    [
      [0.16, 0],
      [0.87, 0],
    ],
  ],
  2: [
    [
      [0, 0.8],
      [0.2, 1],
      [0.78, 1],
      [1, 0.73],
      [0.75, 0.53],
      [0.15, 0.2],
      [0, 0],
      [1, 0],
    ],
  ],
  5: [
    [
      [1, 1],
      [0.09, 1],
      [0, 0.56],
      [0.78, 0.56],
      [1, 0.35],
      [0.91, 0.14],
      [0.71, 0],
      [0.19, 0],
      [0, 0.15],
    ],
  ],
  6: [
    [
      [0.91, 0.91],
      [0.48, 1],
      [0.15, 0.72],
      [0, 0.4],
      [0.1, 0.14],
      [0.3, 0],
      [0.78, 0],
      [1, 0.19],
      [1, 0.41],
      [0.77, 0.55],
      [0.34, 0.54],
      [0.06, 0.38],
    ],
  ],
  7: [
    [
      [0, 1],
      [1, 1],
      [0.36, 0.34],
      [0.28, 0],
    ],
  ],
  8: [
    [
      [0.26, 0.52],
      [0.02, 0.69],
      [0.1, 0.88],
      [0.35, 1],
      [0.72, 1],
      [0.97, 0.83],
      [0.92, 0.68],
      [0.26, 0.39],
      [0, 0.25],
      [0.07, 0.12],
      [0.29, 0],
      [0.75, 0],
      [1, 0.18],
      [0.97, 0.34],
      [0.26, 0.52],
    ],
  ],
  9: [
    [
      [0.12, 0.05],
      [0.47, 0.03],
      [0.76, 0.18],
      [0.95, 0.49],
      [0.91, 0.86],
      [0.74, 1],
      [0.25, 1],
      [0.05, 0.8],
      [0.05, 0.61],
      [0.23, 0.45],
      [0.63, 0.45],
      [0.95, 0.55],
    ],
  ],
  '.': [
    [
      [0.46, 0.04],
      [0.56, 0.04],
    ],
  ],
  '’': [
    [
      [0.33, 0.73],
      [0.53, 0.96],
    ],
  ],
  X: [
    [
      [0.06, 0],
      [0.94, 1],
    ],
    [
      [0.06, 1],
      [0.94, 0],
    ],
  ],
  Y: [
    [
      [0, 1],
      [0.5, 0.53],
      [1, 1],
    ],
    [
      [0.5, 0.53],
      [0.5, 0],
    ],
  ],
  É: [
    [
      [1, 0],
      [0, 0],
      [0, 0.82],
      [1, 0.82],
    ],
    [
      [0, 0.42],
      [0.76, 0.42],
    ],
    [
      [0.48, 0.96],
      [0.72, 1.12],
    ],
  ],
};

function quarryLettering(out, text, { width, height, y, z, color, glyphs = quarryGlyphs }) {
  const stroke = height * 0.063;
  const advance = width / text.length;
  const aligned = transform(out, 0, [advance * 0.125, 0, 0]);
  const face = {
    addQuad(slot, _ref, points, normal, _uv, tone) {
      if (normal[2] > 0.99) quad(aligned, slot, points, tone);
    },
    addConvexPolygon() {},
  };
  lettering(face, text.replaceAll('O', '0'), { width, height, y, z, stroke, slot: 'rough', color });
  for (const [index, glyph] of [...text].entries()) {
    for (const line of glyphs[glyph] ?? []) {
      const point = ([x, v]) => [advance * (index - text.length / 2 + 0.75 * x), y + v * height, z];
      for (let i = 1; i < line.length; i++) {
        beam(face, 'rough', point(line[i - 1]), point(line[i]), stroke, stroke, color);
      }
    }
  }
}

// The upper tablet preserves the Greek opening of the Odyssey quotation.
const greekOval = [
  [0.57, 0.97],
  [0.23, 0.85],
  [0.08, 0.55],
  [0.12, 0.19],
  [0.4, 0],
  [0.73, 0.1],
  [0.95, 0.48],
  [0.84, 0.82],
  [0.57, 0.97],
];
const greekUpsilon = [
  [0.02, 0.82],
  [0.18, 0.92],
  [0.26, 0.73],
  [0.2, 0.25],
  [0.38, 0.04],
  [0.66, 0.04],
  [0.88, 0.4],
  [0.96, 0.91],
];
const memorialGreek = {
  Ο: [greekOval],
  ο: [greekOval],
  ὁ: [
    greekOval,
    [
      [0.57, 1.08],
      [0.35, 1.22],
    ],
  ],
  ὐ: [
    greekUpsilon,
    [
      [0.47, 1.22],
      [0.67, 1.08],
    ],
  ],
  χ: [
    [
      [0.1, 0.96],
      [0.74, -0.13],
    ],
    [
      [0.09, -0.13],
      [0.92, 0.96],
    ],
  ],
  σ: [
    greekOval,
    [
      [0.54, 0.94],
      [0.99, 0.89],
    ],
  ],
  ι: [
    [
      [0.56, 0.93],
      [0.39, 0.24],
      [0.48, 0],
      [0.7, 0.12],
    ],
  ],
  ί: [
    [
      [0.56, 0.93],
      [0.39, 0.24],
      [0.48, 0],
      [0.7, 0.12],
    ],
    [
      [0.5, 1.08],
      [0.77, 1.26],
    ],
  ],
  η: [
    [
      [0, 0.79],
      [0.19, 0.96],
      [0.33, 0.81],
      [0.23, 0.02],
    ],
    [
      [0.31, 0.61],
      [0.62, 0.96],
      [0.85, 0.84],
      [0.77, -0.19],
    ],
  ],
  φ: [
    greekOval,
    [
      [0.22, -0.2],
      [0.74, 1.15],
    ],
  ],
  θ: [
    greekOval,
    [
      [0.12, 0.53],
      [0.91, 0.53],
    ],
  ],
  μ: [
    [
      [0.05, -0.19],
      [0.29, 0.92],
      [0.19, 0.33],
      [0.38, 0.03],
      [0.61, 0.19],
      [0.82, 0.91],
      [0.71, 0.22],
      [0.96, 0.04],
    ],
  ],
  έ: [
    [
      [0.96, 0.83],
      [0.55, 0.94],
      [0.24, 0.77],
      [0.28, 0.58],
      [0.62, 0.52],
      [0.23, 0.4],
      [0.11, 0.16],
      [0.41, 0],
      [0.94, 0.14],
    ],
    [
      [0.51, 1.07],
      [0.81, 1.23],
    ],
  ],
  ν: [
    [
      [0.05, 0.9],
      [0.27, 0.79],
      [0.36, 0.04],
      [0.72, 0.37],
      [0.96, 0.93],
    ],
  ],
};

function quarryPlaque(out, sign, detail) {
  const [width, height] = sign.size;
  const model = transform(out, sign.heading, sign.position);
  // A continuous limestone face keeps the shared ashlar joints out of the text.
  const slot = 'rough';
  const tone =
    sign.tone ?? (sign.mounted || sign.painted ? [0.68, 0.62, 0.52] : shade(rock, 1.045));
  if (sign.painted && detail.name === 'street') {
    const left = -width / 2,
      right = width / 2;
    const low = sign.center - height / 2,
      high = sign.center + height / 2;
    const face = sign.projection;
    quad(
      model,
      slot,
      [
        [left, low, face],
        [right, low, face],
        [right, high, face],
        [left, high, face],
      ],
      tone,
    );
    return;
  }
  const bevel = sign.mounted ? 0.027 : 0.011;
  const outline = (inset, z) => {
    const w = width / 2 - inset;
    const h = height / 2 - inset;
    const corner = sign.mounted ? 0.027 : 0.014;
    return [
      [-w + corner, -h],
      [w - corner, -h],
      [w, -h + corner],
      [w, h - corner],
      [w - corner, h],
      [-w + corner, h],
      [-w, h - corner],
      [-w, -h + corner],
    ].map(([x, y]) => [x, sign.center + y, z]);
  };
  const back = outline(0, -0.023);
  const front = outline(bevel, sign.projection);
  for (let i = 0; i < front.length; i++) {
    const j = (i + 1) % front.length;
    quad(model, slot, [back[i], back[j], front[j], front[i]], shade(tone, 0.84 + 0.025 * i));
    triangle(model, slot, [[0, sign.center, sign.projection], front[i], front[j]], tone);
  }
  if (detail.name === 'street') return;
  const letterHeight = height * (sign.lines.length === 1 ? 0.39 : 0.23);
  const ink = sign.mounted || sign.painted ? [0.105, 0.087, 0.07] : [0.18, 0.146, 0.117];
  for (const [index, text] of sign.lines.entries()) {
    quarryLettering(model, text, {
      width: Math.min(text.length * letterHeight * 0.79, width - 0.12),
      height: letterHeight,
      y:
        sign.center +
        ((sign.lines.length - 1) / 2 - index) * 1.47 * letterHeight -
        letterHeight / 2,
      z: sign.projection + 0.002,
      color: ink,
    });
  }
}

const ossuaryKinds = new Set(['ossuary', 'passion', 'samaritaine', 'sepulchral', 'memorial']);

function galleryWallPoint(from, to, side, station, fromHeight, toHeight = fromHeight) {
  const a = passagePoint(from, side, fromHeight);
  const b = passagePoint(to, side, toHeight);
  return a.map((value, i) => value + (b[i] - value) * station);
}

export function portMahonOpening(nodes = routeGeometry()) {
  const from = nodes[portMahonSegment - 1];
  const to = nodes[portMahonSegment];
  return portMahonMouthRange.map((station) => galleryWallPoint(from, to, 1, station, 0));
}

export function fontisOpening(nodes = routeGeometry()) {
  return fontisMouthRange.map((station) =>
    galleryWallPoint(nodes[fontisSegment - 1], nodes[fontisSegment], 0, station, 0),
  );
}

export function sacellumFrame(nodes = routeGeometry()) {
  const from = nodes[sacellumSegment - 1];
  const to = nodes[sacellumSegment];
  const [a, b] = sacellumMouthRange.map((station) => galleryWallPoint(from, to, 0, station, 0));
  return {
    center: a.map((value, i) => (value + b[i]) / 2),
    heading: facing([b[0] - a[0], b[2] - a[2]]) + Math.PI / 2,
    halfWidth: Math.hypot(b[0] - a[0], b[2] - a[2]) / 2,
    headroom: sacellumMouthHeight,
  };
}

function galleryOpeningWall(out, from, to, side, [left, right], height) {
  const floor = (station) => galleryWallPoint(from, to, side, station, 0);
  const lintel = (station) => galleryWallPoint(from, to, side, station, height);
  const top = (station) =>
    galleryWallPoint(from, to, side, station, archHeight(from, side), archHeight(to, side));
  for (const panel of [
    [floor(0), floor(left), top(left), top(0)],
    [floor(right), floor(1), top(1), top(right)],
    [lintel(left), lintel(right), top(right), top(left)],
  ])
    quad(out, 'rough', side === 1 ? panel : panel.reverse(), rock);
}

export function easternGalleryNodes(nodes = routeGeometry()) {
  const { mouths, headroom, points } = site.easternGallery;
  const edges = mouths.map(({ segment, side, range }) =>
    range.map((station) =>
      galleryWallPoint(nodes[segment - 1], nodes[segment], (side + 1) / 2, station, 0),
    ),
  );
  const controls = edges.map(([a, b]) => [(a[0] + b[0]) * 0.5, (a[2] + b[2]) * 0.5]);
  const gallery = galleryNodes(
    [controls[0], ...points, controls[1]].map((point) => ({ point, kind: 'ossuary' })),
    edges[0][0][1],
  );
  for (const [index, edge] of edges.entries()) {
    const node = index === 0 ? gallery[0] : gallery.at(-1);
    const along = [edge[1][0] - edge[0][0], edge[1][2] - edge[0][2]];
    const side = unit(along);
    const alignment = side[0] * node.side[0] + side[1] * node.side[1];
    node.side = alignment < 0 ? side.map((value) => -value) : side;
    node.shear = 1;
    node.half = Math.hypot(...along) * 0.5;
    node.mouthHeight = headroom;
  }
  return gallery;
}

function passage(out, from, to, detail, index) {
  const deck = (left, right) =>
    quad(
      out,
      'foundation',
      [
        passagePoint(from, left, 0),
        passagePoint(to, left, 0),
        passagePoint(to, right, 0),
        passagePoint(from, right, 0),
      ],
      floor,
    );
  if (from.shaftDirection || to.shaftDirection) {
    for (let i = 0; i < detail.tunnelFacets; i++)
      deck(i / detail.tunnelFacets, (i + 1) / detail.tunnelFacets);
  } else if (from.y === to.y) deck(0, 1);
  else {
    // Use the centreline as a shared edge so sloped floor triangulation follows the descent.
    deck(0, 0.5);
    deck(0.5, 1);
  }
  const dressed = from.kind === 'ossuary' || from.kind === 'portal';
  const lined = ossuaryKinds.has(from.kind) || ossuaryKinds.has(to.kind);
  for (const side of [-1, 1]) {
    const mouth = site.easternGallery.mouths.find((m) => m.segment === index && m.side === side);
    if (mouth && detail.joinery) {
      galleryOpeningWall(out, from, to, (side + 1) / 2, mouth.range, site.easternGallery.headroom);
      ossuaryWall(out, from, to, side, detail, index, [0, mouth.range[0]]);
      ossuaryWall(out, from, to, side, detail, index, [mouth.range[1], 1]);
      continue;
    }
    if (index === portMahonSegment && side === 1) {
      galleryOpeningWall(out, from, to, 1, portMahonMouthRange, portMahonMouthHeight);
      continue;
    }
    if (index === fontisSegment && side === -1) {
      galleryOpeningWall(out, from, to, 0, fontisMouthRange, fontisMouthHeight);
      ossuaryWall(out, from, to, side, detail, index, [0, fontisMouthRange[0]]);
      ossuaryWall(out, from, to, side, detail, index, [fontisMouthRange[1], 1]);
      continue;
    }
    if (index === sacellumSegment && side === -1 && detail.joinery) {
      galleryOpeningWall(out, from, to, 0, sacellumMouthRange, sacellumMouthHeight);
      ossuaryWall(out, from, to, side, detail, index, [0, sacellumMouthRange[0]]);
      ossuaryWall(out, from, to, side, detail, index, [sacellumMouthRange[1], 1]);
      continue;
    }
    const f = side > 0 ? 1 : 0;
    const pts = [
      passagePoint(from, f, 0),
      passagePoint(to, f, 0),
      passagePoint(to, f, archHeight(to, f)),
      passagePoint(from, f, archHeight(from, f)),
    ];
    quad(
      out,
      dressed ? 'ashlar' : 'rough',
      side > 0 ? pts : pts.reverse(),
      lined && detail.name === 'district' ? aged : dressed ? course : rock,
    );
    if (lined && (detail.name !== 'district' || (from.kind === 'memorial' && side < 0))) {
      ossuaryWall(out, from, to, side, detail, index);
    }
  }
  const arch = (node, f) => passagePoint(node, f, archHeight(node, f));
  for (let i = 0; i < detail.tunnelFacets; i++) {
    const a = i / detail.tunnelFacets,
      b = (i + 1) / detail.tunnelFacets;
    quad(
      out,
      'rough',
      [arch(from, a), arch(from, b), arch(to, b), arch(to, a)],
      shade(rock, 0.89 + 0.1 * Math.sin(i * 2.7)),
    );
  }
}

function vestibuleNodes(from, to) {
  const forward = unit(delta(from.point, to.point));
  return vestibuleStations.map((fraction) => ({
    point: from.point.map((value, axis) => value + (to.point[axis] - value) * fraction),
    y: to.y,
    half: 2.17,
    height: 2.72,
    side: laterals(forward),
    facing: facing(forward),
    kind: 'vestibule',
    shear: 1,
  }));
}

export function restoredRoomFrames(nodes = routeGeometry()) {
  const i = nodes.findIndex((node) => node.kind === 'portal');
  const [a, b] = vestibuleNodes(nodes[i - 1], nodes[i]);
  return {
    pillars: nodes.find((node) => node.kind === 'pillars'),
    vestibule: { ...a, point: a.point.map((value, axis) => (value + b.point[axis]) * 0.5) },
  };
}

function lowerQuarryApproach(out, from, to, detail, index) {
  const [top, far] = vestibuleNodes(from, to);
  passage(out, from, top, detail, index);
  passage(out, top, far, detail, index);
  passage(out, far, to, detail, index);
  const count = detail.joinery ? 10 : 5;
  for (let i = 0; i < count; i++) {
    const a = i / count;
    const b = (i + 1) / count;
    const y = from.y + (top.y - from.y) * a + 0.003;
    const nextY = from.y + (top.y - from.y) * b + 0.003;
    const point = (side, station, height) => {
      const [x, , z] = galleryWallPoint(from, top, side, station, 0);
      return [x, height, z];
    };
    const c = shade(floor, 0.87 + 0.031 * (i % 4));
    quad(out, 'foundation', [point(0, a, y), point(0, b, y), point(1, b, y), point(1, a, y)], c);
    quad(
      out,
      'ashlar',
      [point(0, b, nextY), point(1, b, nextY), point(1, b, y), point(0, b, y)],
      c,
    );
  }
}

function routePart(out, node) {
  const [x, z] = node.point;
  return transform(out, node.facing, [x, node.y, z]);
}

export function stairRotation(portal, landing) {
  const mouth = Math.atan2(landing.shaftDirection[1], landing.shaftDirection[0]);
  const top = upperLandingStart + (portal.landingRotation ?? 0) - portal.heading;
  const turns = Math.round((mouth + (portal.steps * tau) / 18 - top) / tau);
  return (top + turns * tau - mouth) / portal.steps;
}

function upperLanding(out, portal, detail) {
  const {
    landingPad: [left, back, right, front],
    point: [x, z],
    heading,
    floor: surface,
  } = portal;
  const slab = transform(out, heading, [x, surface, z]);
  const walkingColor = shade(floor, 0.97);
  if (detail.closedLandings) {
    box(slab, 'foundation', [left, -0.14, back], [right, 0, front], walkingColor);
    return;
  }
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  const landingStart = upperLandingStart + (portal.landingRotation ?? 0);
  const landingEnd = upperLandingEnd + (portal.landingRotation ?? 0);
  const dx = portal.stair[0] - x;
  const dz = portal.stair[1] - z;
  const sx = c * dx - s * dz;
  const sz = s * dx + c * dz;
  const radius = shaftRadius - 0.04;
  const uv = (a, r, y = 0) => [sx + Math.cos(a) * r, y, sz + Math.sin(a) * r];
  const boundary = (a, y) => {
    const di = Math.cos(a);
    const dj = Math.sin(a);
    const toX = di ? (di > 0 ? right - sx : left - sx) / di : Infinity;
    const toZ = dj ? (dj > 0 ? front - sz : back - sz) / dj : Infinity;
    const r = Math.min(toX, toZ);
    return uv(a, r, y);
  };
  const count = detail.boneFaces ? 20 : 12;
  const corners = [
    [left, back],
    [left, front],
    [right, front],
    [right, back],
  ].map(([x, z]) => (Math.atan2(z - sz, x - sx) + tau) % tau);
  const angles = [
    ...Array.from({ length: count + 1 }, (_, i) => (i * tau) / count),
    ...corners,
    landingStart,
    landingEnd,
  ].sort((a, b) => a - b);
  for (let i = 1; i < angles.length; i++) {
    const [a, b] = [angles[i - 1], angles[i]];
    const rimA = uv(a, radius);
    const rimB = uv(b, radius);
    const edgeA = boundary(a, 0);
    const edgeB = boundary(b, 0);
    quad(slab, 'foundation', [rimA, rimB, edgeB, edgeA], walkingColor);
    if (a >= landingStart && b <= landingEnd) {
      quad(slab, 'foundation', [uv(a, stairCore), uv(b, stairCore), rimB, rimA], walkingColor);
    } else {
      quad(slab, 'rough', [rimA, uv(a, radius, -0.14), uv(b, radius, -0.14), rimB], rock);
      if (detail.boneFaces) {
        beam(
          slab,
          'iron',
          uv(a, radius + 0.025, 0.98),
          uv(b, radius + 0.025, 0.98),
          0.045,
          0.045,
          dark,
        );
        if (i % 4 === 1)
          beam(slab, 'iron', uv(a, radius + 0.027), uv(a, radius + 0.027, 0.98), 0.04, 0.04, dark);
      }
    }
  }
}

function denfertLandingRoom(out, detail) {
  const {
    landingPad: [left, back, right, front],
    heading,
    point: [x, z],
    floor: elevation,
  } = site.entrance;
  const room = transform(out, heading, [x, elevation, z]);
  const liner = [0.69, 0.65, 0.57];
  const headroom = 2.78;
  const doorHeight = 2.24;
  const partition = front - 0.31;
  const doorLeft = 9.98;
  const doorRight = 11.62;

  if (detail.name === 'street') {
    const wall = ([x0, z0], [x1, z1], low = 0) => {
      const points = [
        [x0, low, z0],
        [x1, low, z1],
        [x1, headroom, z1],
        [x0, headroom, z0],
      ];
      quad(room, 'plaster', points, liner);
      quad(room, 'plaster', points.toReversed(), liner);
    };
    wall([left, back], [right, back]);
    wall([left, back], [left, partition]);
    wall([right, back], [right, partition]);
    wall([left, partition], [doorLeft, partition]);
    wall([doorRight, partition], [right, partition]);
    wall([doorLeft, partition], [doorRight, partition], doorHeight);
    return;
  }

  // Keep the short turn from the street vestibule to the spiral landing open.
  box(room, 'plaster', [left, 0, back - 0.13], [right, headroom, back], liner);
  box(room, 'plaster', [left, 0, back], [left + 0.12, headroom, partition], liner);
  box(room, 'plaster', [right - 0.12, 0, back], [right, headroom, partition], liner);
  box(room, 'plaster', [left, 0, partition], [doorLeft, headroom, partition + 0.13], liner);
  box(room, 'plaster', [doorRight, 0, partition], [right, headroom, partition + 0.13], liner);
  box(
    room,
    'plaster',
    [doorLeft, doorHeight, partition],
    [doorRight, headroom, partition + 0.13],
    liner,
  );

  if (detail.name === 'master') {
    for (const jamb of [doorLeft, doorRight])
      box(
        room,
        'iron',
        [jamb - 0.025, 0, partition - 0.017],
        [jamb + 0.025, doorHeight, partition + 0.15],
        dark,
      );
    box(
      room,
      'iron',
      [doorLeft, doorHeight - 0.036, partition - 0.017],
      [doorRight, doorHeight, partition + 0.15],
      dark,
    );
  }
}

function stair(out, portal, landing, detail, radius = shaftRadius) {
  const {
    stair: [x, z],
    floor: surface,
    steps,
    sealedHeadroom = 0,
  } = portal;
  const start = landing.y;
  const span = surface - start;
  const ceiling = surface + sealedHeadroom;
  const [dx, dz] = landing.shaftDirection;
  const mouth = Math.atan2(dz, dx);
  const p = (a, y, r) => [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
  loft(
    out,
    'ashlar',
    [
      radialRing(start, stairCore, stairCore, 12, [x, z]),
      radialRing(surface + 0.14, stairCore, stairCore, 12, [x, z]),
    ],
    shade(course, 0.86),
  );

  // The gallery and shaft share the same chord edges across the opening. The
  // gallery ceiling terminates at the wall, outside the clear spiral swept area.
  const portalAngles = Array.from({ length: detail.tunnelFacets + 1 }, (_, i) => {
    const f = i / detail.tunnelFacets;
    return mouth + Math.asin(((2 * f - 1) * landing.half) / radius);
  });
  const first = portalAngles[0],
    last = portalAngles.at(-1);
  const outerArc = first + tau - last;
  const angles = [
    ...portalAngles,
    ...Array.from(
      { length: detail.stairFacets },
      (_, i) => last + (outerArc * (i + 1)) / detail.stairFacets,
    ),
  ];
  for (let i = 1; i < angles.length; i++) {
    const [a, b] = [angles[i - 1], angles[i]];
    const bottom =
      i <= detail.tunnelFacets
        ? [
            archHeight(landing, (i - 1) / detail.tunnelFacets),
            archHeight(landing, i / detail.tunnelFacets),
          ]
        : [0, 0];
    const shell = (angle, y) => p(angle, y, radius);
    quad(
      out,
      'rough',
      [
        shell(a, start + bottom[0]),
        shell(b, start + bottom[1]),
        shell(b, ceiling),
        shell(a, ceiling),
      ],
      shade(rock, 0.85 + (i % 3) * 0.04),
    );
    triangle(out, 'foundation', [[x, start, z], shell(b, start), shell(a, start)], floor);
    if (sealedHeadroom)
      triangle(out, 'rough', [[x, ceiling, z], shell(a, ceiling), shell(b, ceiling)], rock);
  }
  // One model riser per recorded step in close-up. Distant interiors use a coarser helical floor.
  const slopedTread = sealedHeadroom > 0 && !detail.boneFaces;
  const group = slopedTread ? 2 : detail.authoredStairs ? 1 : 7;
  const rotation = stairRotation(portal, landing);
  const treadInner = stairCore * 0.96;
  if (sealedHeadroom) {
    const from = mouth + rotation * steps;
    const to = from + rotation;
    quad(
      out,
      'foundation',
      [
        p(from, surface, treadInner),
        p(to, surface, treadInner),
        p(to, surface, radius),
        p(from, surface, radius),
      ],
      floor,
    );
  }
  for (let i = 0; i < steps; i += group) {
    const j = Math.min(i + group, steps);
    const from = mouth + rotation * i,
      to = mouth + rotation * j;
    const low = start + (span * i) / steps,
      high = start + (span * j) / steps;
    const front = slopedTread ? low : high;
    const top = [
      p(from, front, treadInner),
      p(to, high, treadInner),
      p(to, high, radius),
      p(from, front, radius),
    ];
    quad(out, 'foundation', top, shade(floor, 0.89 + 0.095 * Math.cos(i * 1.2)));
    if (slopedTread) continue;
    if (detail.authoredStairs) {
      // These four edges join adjacent stair undersides into a continuous soffit.
      const underside = [
        p(from, low - 0.12, treadInner),
        p(to, high - 0.12, treadInner),
        p(to, high - 0.12, radius),
        p(from, low - 0.12, radius),
      ];
      quad(out, 'rough', underside.toReversed(), rock);
      if (detail.boneFaces && !sealedHeadroom)
        quad(out, 'rough', [top[2], top[3], underside[3], underside[2]], shade(rock, 0.91));
    }
    quad(
      out,
      'rough',
      [
        p(from, low, treadInner),
        p(from, high, treadInner),
        p(from, high, radius),
        p(from, low, radius),
      ],
      shade(course, 0.94),
    );
  }
  if (!detail.joinery) return;
  // Short chords follow the outer wall without cutting across the walking line.
  const handrail = (step, offset, railRadius) =>
    p(mouth + step * rotation, start + (span * step) / steps + 0.99 + offset, railRadius);
  const railStep = detail.boneFaces ? 2 : 3;
  for (let i = 3; i < steps; i += railStep) {
    const j = Math.min(i + railStep, steps);
    const inner = radius - 0.145,
      outer = inner + 0.036;
    const a = handrail(i, 0.016, inner),
      b = handrail(j, 0.016, inner);
    if (detail.boneFaces)
      quad(out, 'iron', [a, b, handrail(j, 0.016, outer), handrail(i, 0.016, outer)], dark);
    quad(out, 'iron', [a, handrail(i, -0.016, inner), handrail(j, -0.016, inner), b], dark);
    if (detail.boneFaces && i % 10 === 3 && i + 5 < steps) {
      beam(
        out,
        'iron',
        handrail(i, -0.055, radius - 0.004),
        handrail(i, -0.016, inner + 0.013),
        0.025,
        0.025,
        dark,
      );
    }
  }
}

function skull(out, x, y, z, s, color) {
  const perimeter = [
    [-0.085, 0.038],
    [-0.061, 0.094],
    [0.025, 0.108],
    [0.084, 0.073],
    [0.085, 0.006],
    [0.052, -0.055],
    [-0.031, -0.065],
    [-0.065, -0.017],
  ];
  const back = perimeter.map(([a, b]) => [x + a * s, y + b * s, z - 0.067 * s]);
  const front = perimeter.map(([a, b]) => [x + a * s * 0.89, y + b * s * 0.89, z + 0.009 * s]);
  for (let i = 0; i < front.length; i++) {
    const j = (i + 1) % front.length;
    quad(out, 'rough', [back[j], back[i], front[i], front[j]], shade(color, 0.87 + (i % 3) * 0.09));
    triangle(out, 'rough', [[x, y + 0.023 * s, z + 0.021 * s], front[j], front[i]], color);
  }
  for (const side of [-1, 1]) {
    const cx = x + side * 0.035 * s,
      w = 0.018 * s,
      base = y + 0.011 * s;
    quad(
      out,
      'rough',
      [
        [cx - w, base, z + 0.023 * s],
        [cx + w, base, z + 0.023 * s],
        [cx + w * 0.86, base + 0.022 * s, z + 0.022 * s],
        [cx - w * 0.82, base + 0.024 * s, z + 0.023 * s],
      ],
      dark,
    );
  }
  triangle(
    out,
    'rough',
    [
      [x - 0.009 * s, y - 0.02 * s, z + 0.024 * s],
      [x + 0.009 * s, y - 0.02 * s, z + 0.024 * s],
      [x, y + 0.001 * s, z + 0.024 * s],
    ],
    dark,
  );
}

function longBone(out, x, y, z, angle, s, color) {
  const a = Math.cos(angle) * 0.091 * s,
    b = Math.sin(angle) * 0.091 * s;
  const u = Math.sin(angle) * 0.017 * s,
    v = Math.cos(angle) * 0.017 * s;
  const points = [
    [x - a - u, y - b + v, z],
    [x + a - u, y + b + v, z],
    [x + a + u, y + b - v, z],
    [x - a + u, y - b - v, z],
  ];
  quad(out, 'rough', points.reverse(), color);
}

function hague(out, panelWidth, panelHeight, z, detail, seed) {
  const cols = Math.ceil(panelWidth / (detail.boneSpacing ?? 0.23));
  const bands = detail.boneBands ?? 9;
  for (let row = 0; row < bands; row++) {
    const low = 0.25 + (panelHeight * row) / bands,
      high = 0.25 + (panelHeight * (row + 1)) / bands;
    for (let col = 0; col < cols; col++) {
      const left = -panelWidth / 2 + (panelWidth * col) / cols,
        right = -panelWidth / 2 + (panelWidth * (col + 1)) / cols;
      const k = col * 13 + row * 29 + seed;
      const x = (left + right) / 2,
        y = (low + high) / 2;
      const color = shade(row % 3 === 2 ? ivory : aged, 0.87 + 0.15 * Math.sin(k * 1.46));
      const bottom = low + 0.008 * Math.cos(k * 1.25),
        rim = z + 0.007 * Math.sin(k * 2.8);
      quad(
        out,
        'rough',
        [
          [left, bottom, rim],
          [right, bottom, rim],
          [right, high, rim],
          [left, high, rim],
        ],
        shade(aged, 0.7 + 0.12 * Math.cos(k)),
      );
      if (row % 3 === 2) {
        skull(out, x + 0.01 * Math.sin(k), y, rim + 0.058, 0.82 + 0.13 * Math.cos(k * 1.53), color);
      } else {
        longBone(out, x, y, rim + 0.014, 0.18 * Math.sin(k), 0.95, color);
      }
    }
  }
  box(out, 'ashlar', [-panelWidth * 0.5, 0, z - 0.18], [panelWidth * 0.5, 0.26, z + 0.03], course);
}

function restoredBoneEnd(out, x, y, seed, color) {
  const size = 0.85 + 0.16 * Math.sin(seed * 1.03);
  const shape = [
    [-0.045, -0.015],
    [-0.027, 0.034],
    [-0.008, 0.021],
    [0.026, 0.039],
    [0.048, 0.014],
    [0.039, -0.024],
    [-0.012, -0.037],
  ];
  const angle = 0.58 * Math.sin(seed * 0.65);
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const depth = 0.044 + 0.011 * Math.sin(seed * 1.44);
  const face = shape.map(([u, v]) => [
    x + size * (c * u - s * v),
    y + size * (s * u + c * v),
    depth,
  ]);
  const center = [x, y, depth + 0.013];
  for (const [i, a] of face.entries()) {
    const b = face[(i + 1) % face.length];
    triangle(out, 'rough', [center, b, a], shade(color, 0.9 + 0.075 * Math.sin(i + seed)));
    quad(out, 'rough', [a, b, [b[0], b[1], 0.012], [a[0], a[1], 0.012]], shade(color, 0.82));
  }
}

// The renovated hague has a separate stone footing and irregular courses of bone ends.
function renovatedHague(out, width, height, detail) {
  const base = 0.16;
  const sections = 5;
  const top = (x) => base + height + 0.075 * Math.sin(x * 3.3) + 0.034 * Math.cos(x * 8.1);
  const sectionWidth = width / sections;
  for (let i = 0; i < sections; i++) {
    const a = sectionWidth * i - width / 2;
    const b = a + sectionWidth;
    box(
      out,
      'ashlar',
      [a + 0.009, 0, -0.15],
      [b - 0.009, base, 0.078],
      shade(course, 0.91 + 0.09 * Math.cos(i * 4.7)),
    );
    const z = 0.008 * Math.cos(i * 5.1);
    const front = [
      [a, base, z],
      [b, base, z],
      [b, top(b), z],
      [a, top(a), z],
    ];
    quad(out, 'rough', front, shade(aged, 0.89 + 0.05 * Math.sin(i * 3.5)));
    quad(
      out,
      'rough',
      [front[3], front[2], [b, top(b), -0.14], [a, top(a), -0.14]],
      shade(aged, 0.74),
    );
  }
  if (!detail.boneFaces) {
    for (const [low, high] of [
      [0.16, 0.32],
      [0.44, 0.59],
      [0.72, 0.87],
    ]) {
      quad(
        out,
        'rough',
        [
          [-width / 2, base + low * height, 0.025],
          [width / 2, base + low * height, 0.022],
          [width / 2, base + high * height, 0.022],
          [-width / 2, base + high * height, 0.025],
        ],
        shade(ivory, 0.68),
      );
    }
    return;
  }

  const columns = Math.ceil(width / 0.143);
  const rows = 16;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const seed = row * 137 + col * 23;
      const x = width * ((col + 0.5 + 0.19 * Math.sin(seed * 1.23)) / columns - 0.5);
      const y = base + (height * (row + 0.48 + 0.21 * Math.cos(seed * 2.82))) / rows;
      const z = 0.023 + 0.012 * Math.sin(seed * 3.46);
      const w = 0.073 + 0.016 * Math.cos(seed * 2.14);
      const h = 0.052 + 0.013 * Math.sin(seed * 0.86);
      const tone = shade(seed % 3 === 0 ? ivory : aged, 0.99 + 0.17 * Math.cos(seed * 1.12));
      const rim = [
        [x - w, y - h * 0.58, z],
        [x - w * 0.38, y + h, z],
        [x + w * 0.77, y + h * 0.73, z],
        [x + w, y - h * 0.31, z],
        [x - w * 0.25, y - h, z],
      ];
      const tip = [x + w * 0.09, y + h * 0.11, z + 0.01];
      for (const [i, a] of rim.entries()) {
        triangle(out, 'rough', [tip, rim[(i + 1) % rim.length], a], shade(tone, 0.84 + 0.05 * i));
      }
      if (row === rows - 1 && col % 8 === 2)
        skull(out, x, Math.min(y, top(x) - 0.006), 0.042, 0.71, shade(ivory, 0.74));
    }
  }
}

function restoredMartyrsWall(out, width, height, detail) {
  const plaqueWidth = 0.97;
  const boneWidth = width - plaqueWidth;
  const left = -width / 2;
  const seam = left + boneWidth;
  const wallBase = 0.21;
  box(out, 'rough', [left, 0, -0.14], [seam, wallBase + height, 0.015], shade(aged, 0.8));

  // The restored hague has a face-out course high on the wall and a course of
  // turned crania below. Denser courses of weathered long-bone ends fill the gaps.
  const cols = detail.boneFaces ? Math.floor(boneWidth / 0.185) : 0;
  for (const [band, row] of [
    [0.36, 'back'],
    [0.73, 'front'],
  ]) {
    const y = wallBase + height * band;
    for (let i = 0; i < cols; i++) {
      const x = left + (boneWidth * (i + 0.5)) / cols;
      const tint = shade(ivory, 0.87 + 0.11 * Math.sin(i * 1.76 + band));
      if (row === 'front') {
        skull(
          out,
          x + 0.01 * Math.cos(i * 2.1),
          y + 0.012 * Math.sin(i * 1.35),
          0.059,
          0.83 + 0.12 * Math.cos(i * 2.35),
          tint,
        );
      } else {
        loft(
          out,
          'rough',
          [
            radialRing(y - 0.069, 0.071, 0.048, 7, [x, 0.025]),
            radialRing(y + 0.04, 0.081, 0.052, 7, [x, 0.026]),
            radialRing(y + 0.078, 0.049, 0.033, 7, [x, 0.02]),
          ],
          tint,
        );
      }
    }
    if (!detail.boneFaces)
      quad(
        out,
        'rough',
        [
          [left, y - 0.065, 0.02],
          [seam, y - 0.065, 0.02],
          [seam, y + 0.065, 0.02],
          [left, y + 0.065, 0.02],
        ],
        shade(ivory, 0.78),
      );
  }
  if (detail.boneFaces) {
    const bones = Math.floor(boneWidth / 0.102);
    for (let row = 0; row < 17; row++) {
      const fraction = (row + 0.45) / 17;
      if ([0.36, 0.73].some((band) => Math.abs(fraction - band) * height < 0.115)) continue;
      for (let i = 0; i < bones; i++) {
        const seed = i * 17 + row * 23;
        const x = left + (boneWidth * (i + 0.5 + 0.11 * Math.sin(seed))) / bones;
        const y = wallBase + height * fraction + 0.013 * Math.cos(seed * 0.72);
        restoredBoneEnd(
          out,
          x,
          y,
          seed,
          shade(row % 2 ? aged : ivory, 0.86 + 0.17 * Math.sin(seed * 1.82)),
        );
      }
    }
  }

  const marker = transform(out, 0, [seam + plaqueWidth / 2, 0, 0]);
  box(marker, 'ashlar', [-0.47, 0.04, -0.16], [0.47, 1.95, 0.085], course);
  if (detail.boneFaces) {
    box(marker, 'ashlar', [-0.49, 0.04, -0.05], [0.49, 0.17, 0.163], shade(course, 0.84));
    box(marker, 'ashlar', [-0.465, 0.17, -0.05], [0.465, 0.27, 0.137], shade(course, 0.91));
  } else {
    box(marker, 'ashlar', [-0.49, 0.04, -0.05], [0.49, 0.27, 0.137], shade(course, 0.84));
  }
  box(marker, 'ashlar', [-0.49, 1.04, -0.07], [0.49, 1.16, 0.153], shade(course, 0.93));
  box(marker, 'rough', [-0.397, 0.32, 0.083], [0.397, 0.98, 0.098], shade(course, 1.08));
  box(marker, 'rough', [-0.42, 1.17, 0.084], [0.42, 1.93, 0.101], shade(course, 1.19));
  if (detail.boneFaces) {
    for (const [text, width, height, y] of [
      ['D. M.', 0.42, 0.092, 0.786],
      ['MDCCXCII', 0.65, 0.076, 0.46],
    ]) {
      quarryLettering(marker, text, { width, height, y, z: 0.101, color: dark });
    }
    quarryLettering(marker, 'Οὐχ ὁσίη φθιμένοισιν.', {
      width: 0.746,
      height: 0.087,
      y: 1.77,
      z: 0.104,
      color: dark,
      glyphs: { ...memorialGreek, '.': quarryGlyphs['.'] },
    });
    quarryLettering(marker, 'NON FAS EST MORTUIS INSULTARE.', {
      width: 0.735,
      height: 0.048,
      y: 1.62,
      z: 0.104,
      color: dark,
    });
    if (detail.name === 'master') {
      quarryLettering(marker, 'II ET III', {
        width: 0.39,
        height: 0.045,
        y: 0.676,
        z: 0.101,
        color: dark,
      });
      quarryLettering(marker, 'SEPT', {
        width: 0.183,
        height: 0.047,
        y: 0.607,
        z: 0.101,
        color: dark,
      });
      quarryLettering(transform(marker, 0, [0.128, 0, 0]), 'MBR', {
        width: 0.073,
        height: 0.025,
        y: 0.638,
        z: 0.101,
        color: dark,
      });
      for (const [text, width, height, y] of [
        ['C’EST UNE IMPIÉTÉ', 0.52, 0.047, 1.47],
        ['QUE D’INSULTER AUX MORTS', 0.71, 0.047, 1.38],
        ['HOMER ODYSS. XXII', 0.44, 0.037, 1.255],
      ]) {
        quarryLettering(marker, text, { width, height, y, z: 0.104, color: dark });
      }
    }
  }
}

function inscribedOssuaryPlaque(out, detail) {
  const tone = [0.73, 0.675, 0.565];
  // The inscribed tablet overhangs a flared stone stem at stop 7 of the museum guide.
  const stem = [
    [0, 0.32],
    [0.16, 0.3],
    [0.22, 0.23],
    [0.89, 0.21],
    [1.01, 0.245],
    [1.12, 0.34],
  ];
  const tablet = [
    [1.12, 0.552],
    [1.17, 0.584],
    [1.26, 0.522],
    [1.36, 0.509],
    [1.43, 0.572],
    [1.51, 0.557],
    [1.57, 0.51],
    [1.7, 0.573],
    [1.747, 0.539],
  ];
  const face = (profile, back, front, color) => {
    loft(
      out,
      'rough',
      profile.map(([y, half]) => [
        [-half, y, back],
        [-half, y, front],
        [half, y, front],
        [half, y, back],
      ]),
      color,
    );
  };
  if (!detail.boneFaces) {
    face([stem[0], stem[2], stem[3], stem.at(-1)], -0.045, 0.17, shade(tone, 0.92));
    face([tablet[0], tablet[2], tablet[4], tablet[6], tablet.at(-1)], 0.005, 0.227, tone);
    return;
  }
  face(stem, -0.045, 0.17, shade(tone, 0.92));
  face(tablet, 0.005, 0.227, tone);
  for (const side of [-1, 1]) {
    for (let column = 0; column < 3; column++) {
      const x = side * (0.43 + 0.17 * column);
      skull(out, x, 0.36 + 0.009 * column, 0.058, 0.79, shade(ivory, 0.83 + column * 0.045));
    }
  }
  // Pack short bone ends into the wall around the projecting stone.
  for (let row = 0; row < 15; row++) {
    for (let column = 0; column < 19; column++) {
      const seed = row * 31 + column * 17;
      const x = (column - 9 + (row % 2) * 0.45) * 0.116 + 0.018 * Math.sin(seed);
      const y = 0.47 + row * 0.095 + 0.019 * Math.cos(seed * 0.85);
      const coveredHalfWidth = y >= 1.12 && y <= 1.74 ? 0.52 : 0.21;
      if (y < 1.74 && Math.abs(x) < coveredHalfWidth) continue;
      const width = 0.035 + 0.017 * Math.cos(seed * 1.4);
      const depth = 0.017 + 0.018 * Math.abs(Math.sin(seed * 1.17));
      quad(
        out,
        'rough',
        [
          [x - width * 0.85, y - 0.026, depth],
          [x + width, y - 0.024, depth - 0.012],
          [x + width * 0.74, y + 0.036, depth + 0.004],
          [x - width, y + 0.022, depth + 0.016],
        ],
        shade(seed % 3 === 0 ? ivory : aged, 0.86 + 0.31 * Math.abs(Math.sin(seed * 1.82))),
      );
    }
  }
  const lines = [
    'AINSI TOUT PASSE SUR LA TERRE',
    'ESPRIT BEAUTÉ GRÂCES TALENT',
    'TELLE EST UNE FLEUR ÉPHÉMÈRE',
    'QUE RENVERSE LE MOINDRE VENT',
  ];
  for (const [i, verse] of lines.entries()) {
    // The shared font draws the base letters. Add the accents as shallow incision strokes.
    const width = 0.94;
    const height = 0.068;
    const y = 1.592 - 0.123 * i;
    const z = 0.229;
    const letters = verse.normalize('NFD').replace(/\p{M}/gu, '');
    quarryLettering(out, letters, { width, height, y, z, color: dark });
    const advance = width / letters.length;
    for (const [j, letter] of [...verse].entries()) {
      if (letter === letters[j]) continue;
      const x = advance * (j - letters.length / 2 + 0.5);
      const peak = [x, y + height + 0.019, z];
      const left = [x - 0.009, y + height + 0.008, z];
      const right = [x + 0.009, y + height + 0.008, z];
      if (letter !== 'È') beam(out, 'rough', left, peak, 0.003, 0.003, dark);
      if (letter !== 'É') beam(out, 'rough', peak, right, 0.003, 0.003, dark);
    }
  }
}

function tuileriesStele(out, detail) {
  const stone = [0.715, 0.664, 0.57];
  box(out, 'ashlar', [-0.55, 0, -0.11], [0.55, 0.234, 0.36], shade(stone, 0.91));
  // Stop 10 shows a shallow curved crest between two raised ends.
  const outline = detail.boneFaces
    ? [
        [-0.525, 1.125],
        [-0.491, 1.115],
        [-0.421, 1.042],
        [-0.262, 1.094],
        [-0.04, 1.123],
        [0.223, 1.097],
        [0.415, 1.038],
        [0.489, 1.114],
        [0.525, 1.126],
      ]
    : [
        [-0.525, 1.085],
        [0, 1.123],
        [0.525, 1.085],
      ];
  loft(
    out,
    'rough',
    outline.map(([x, high]) => [
      [x, 0.234, -0.082],
      [x, high, -0.082],
      [x, high, 0.264],
      [x, 0.234, 0.264],
    ]),
    stone,
  );
  if (!detail.boneFaces) return;
  box(out, 'ashlar', [-0.537, 0.905, -0.07], [0.537, 0.943, 0.279], shade(stone, 0.92));
  const inscription = [
    ['D.M.', 0.31, 0.08, 0.791],
    ['COMBAT', 0.39, 0.064, 0.687],
    ['AU CHATEAU', 0.62, 0.064, 0.581],
    ['DES TUILERIES', 0.78, 0.061, 0.474],
    ['LE 10 AOUST 1792', 0.86, 0.053, 0.365],
  ];
  for (const [text, width, height, y] of inscription) {
    quarryLettering(out, text, { width, height, y, z: 0.265, color: dark });
  }
}

function ossuaryWall(out, from, to, side, detail, index, range = [0, 1]) {
  const edge = (node, y) => xz(node, side * (node.half - 0.095), y);
  const height = Math.min(1.75, from.height - 0.62, to.height - 0.62);
  const a = edge(from, 0),
    b = edge(to, 0);
  const at = (t) => a.map((value, i) => value + (b[i] - value) * t);
  const [ax, y, az] = at(range[0]);
  const [bx, , bz] = at(range[1]);
  const length = Math.hypot(bx - ax, bz - az);
  const panels = detail.name === 'district' ? 1 : Math.ceil(length / (detail.boneFaces ? 2.6 : 12));
  const rail = (t, up) => [ax + t * (bx - ax), y + up, az + t * (bz - az)];
  const byPlaque = index >= ossuaryPlaqueSegment && index <= ossuaryPlaqueSegment + 3;
  const flatBands = detail.name === 'district' || byPlaque || length < 10 ? 1 : 2;
  const reliefBands = detail.name === 'closeup' ? 7 : 11;
  const bands = detail.boneFaces ? reliefBands : flatBands;
  const localFacing = facing([bx - ax, bz - az]) - (side * Math.PI) / 2;
  if (index === ossuaryPlaqueSegment + 1 && side === ossuaryPlaqueSide && detail.joinery) {
    inscribedOssuaryPlaque(transform(out, localFacing, rail(0.45, 0)), detail);
  }
  if (index === tuileriesSegment + 1 && side === tuileriesSide && detail.joinery) {
    tuileriesStele(transform(out, localFacing, rail(tuileriesStation, 0)), detail);
  }
  if (index === renovatedHagueSegment + 1 && side === renovatedHagueSide && detail.joinery) {
    renovatedHague(transform(out, localFacing, rail(0.5, 0)), length, height, detail);
    return;
  }
  const memorialLength = from.kind === 'memorial' && side < 0 ? Math.min(3.45, length) : 0;
  const memorialEnd = memorialLength / length;
  if (memorialLength > 0) {
    const wall = transform(out, localFacing, rail(memorialEnd * 0.5, 0));
    restoredMartyrsWall(wall, memorialLength, height, detail);
  }
  const relief =
    detail.boneFaces &&
    (index !== ossuaryPlaqueSegment + 3 || detail.name === 'master') &&
    (index !== 39 || side > 0 || detail.name === 'master') &&
    (detail.easternOssuary ||
      index % 3 === 0 ||
      ['portal', 'passion', 'samaritaine'].includes(from.kind) ||
      (to.kind === 'passion' && side > 0));
  for (let i = 0; i < panels; i++) {
    const start = memorialEnd + ((1 - memorialEnd) * i) / panels,
      end = memorialEnd + ((1 - memorialEnd) * (i + 1)) / panels;
    if (relief && i === 0 && length / panels > 1) {
      const panel = transform(out, localFacing, rail((start + end) * 0.5, 0));
      hague(panel, (length * (1 - memorialEnd)) / panels, height, 0, detail, index);
      continue;
    }
    for (let band = 0; band < bands; band++) {
      const bottom = 0.25 + (height * band) / bands,
        top = 0.25 + (height * (band + 1)) / bands;
      const face = [rail(start, bottom), rail(end, bottom), rail(end, top), rail(start, top)];
      const variation = Math.cos(index * 4.12 + i * 2.27 + band * 1.32);
      const tone = band % 3 === 1 ? ivory : aged;
      const color = detail.easternOssuary
        ? shade(aged, 0.84 + 0.08 * variation)
        : shade(tone, 0.65 + 0.15 * variation);
      quad(out, 'rough', side > 0 ? face : face.reverse(), color);
    }
  }
  if (detail.easternOssuary && detail.name === 'closeup') {
    const count = Math.ceil(length / 0.66);
    for (let i = 0; i < count; i++) {
      const mark = transform(out, localFacing, rail((i + 0.5) / count, 0));
      const phase = Math.sin(index * 2.41 + i * 3.14 + side);
      longBone(
        mark,
        0,
        height * (0.65 + 0.18 * phase),
        0.018,
        phase * 0.52,
        1.05,
        shade(ivory, 0.87),
      );
      if (i === 0 && index % 3 === 0)
        skull(mark, 0.16, height * 0.81, 0.086, 0.82, shade(ivory, 0.9));
    }
  }
}

function ossuaryWallFrame(nodes, segment, side, station) {
  const edge = (node) => xz(node, side * (node.half - 0.095), 0);
  const a = edge(nodes[segment]);
  const b = edge(nodes[segment + 1]);
  return {
    center: a.map((value, i) => value + (b[i] - value) * station),
    heading: facing([b[0] - a[0], b[2] - a[2]]) - (side * Math.PI) / 2,
    width: Math.hypot(b[0] - a[0], b[2] - a[2]),
  };
}

export function renovatedHagueFrame(nodes = routeGeometry()) {
  return ossuaryWallFrame(nodes, renovatedHagueSegment, renovatedHagueSide, 0.5);
}

export function inscribedOssuaryPlaqueFrame(nodes = routeGeometry()) {
  return ossuaryWallFrame(nodes, ossuaryPlaqueSegment, ossuaryPlaqueSide, 0.45);
}

export function tuileriesSteleFrame(nodes = routeGeometry()) {
  return ossuaryWallFrame(nodes, tuileriesSegment, tuileriesSide, tuileriesStation);
}

function sacellum(out, nodes, detail) {
  const { center, heading, halfWidth, headroom } = sacellumFrame(nodes);
  const room = transform(out, heading, center);
  const back = -3.16;
  const deck = (y) => [
    [-halfWidth, y, back],
    [-halfWidth, y, 0],
    [halfWidth, y, 0],
    [halfWidth, y, back],
  ];
  quad(room, 'foundation', deck(0), floor);
  quad(room, 'rough', deck(headroom).reverse(), shade(rock, 0.76));
  quad(
    room,
    'ashlar',
    [
      [-halfWidth, 0, back],
      [halfWidth, 0, back],
      [halfWidth, headroom, back],
      [-halfWidth, headroom, back],
    ],
    shade(course, 0.47),
  );
  for (const sign of [-1, 1]) {
    const x = sign * halfWidth;
    const wall = [
      [x, 0, back],
      [x, headroom, back],
      [x, headroom, 0],
      [x, 0, 0],
    ];
    quad(room, 'rough', sign === -1 ? wall : wall.reverse(), rock);
  }
  // The pale altar widens toward its cornice and stands on two broad steps.
  const altarX = 0.28;
  const altarZ = -2.51;
  const socket = (height, width, depth) =>
    detail.boneFaces
      ? chamferedRectangle(altarX, height, altarZ, width, depth, 0.029)
      : [
          [altarX - width / 2, height, altarZ - depth / 2],
          [altarX - width / 2, height, altarZ + depth / 2],
          [altarX + width / 2, height, altarZ + depth / 2],
          [altarX + width / 2, height, altarZ - depth / 2],
        ];
  const profile = [
    [0, 2.75, 1.28],
    [0.105, 2.75, 1.28],
    [0.105, 2.52, 1.13],
    [0.215, 2.52, 1.13],
    [0.215, 2.27, 0.94],
    [0.308, 2.27, 0.94],
    [0.348, 2.14, 0.87],
    [0.348, 1.83, 0.71],
    [0.765, 2.17, 0.94],
    [0.81, 2.29, 0.99],
    [0.872, 2.33, 1.025],
    [0.923, 2.33, 1.025],
  ];
  loft(
    room,
    'foundation',
    profile.map(([h, w, d]) => socket(h, w, d)),
    shade(course, 1.04),
  );
  box(room, 'foundation', [-0.31, 0.953, -3.14], [0.87, 1.658, -3.04], [0.52, 0.425, 0.355]);
  for (const x of [-0.68, 1.24]) {
    const z = -3.024;
    const points = [
      [x - 0.205, 0.957, z],
      [x + 0.205, 0.957, z],
      [x + 0.205, 1.57, z],
    ];
    for (let i = 1; i <= 8; i++) {
      const angle = (i * Math.PI) / 8;
      points.push([x + 0.205 * Math.cos(angle), 1.57 + 0.156 * Math.sin(angle), z]);
    }
    room.addConvexPolygon('foundation', ref, points, [0, 0, 1], (p) => [p[0], p[1]], aged);
  }
  // Bone courses are visible along the left return beside the altar.
  const boneWall = transform(room, Math.PI / 2, [-halfWidth + 0.095, 0.03, -1.43]);
  if (detail.boneFaces) {
    const bones =
      detail.name === 'closeup' ? { ...detail, boneSpacing: 0.55, boneBands: 6 } : detail;
    hague(boneWall, 2.69, 1.5, 0, bones, 61);
  } else {
    box(boneWall, 'ashlar', [-1.345, 0, -0.1], [1.345, 0.24, 0.03], course);
    for (let row = 0; row < 6; row++) {
      const y = 0.24 + row * 0.25;
      const tone = row % 3 === 2 ? shade(ivory, 0.8) : shade(aged, 0.79 + 0.04 * (row % 2));
      quad(
        boneWall,
        'rough',
        [
          [-1.345, y, 0],
          [1.345, y, 0],
          [1.345, y + 0.25, 0],
          [-1.345, y + 0.25, 0],
        ],
        tone,
      );
    }
  }
}

// The museum photograph shows a rounded casing from the foot of the pillar to its cap.
// Three courses of mostly turned crania break up the much smaller long-bone ends.
const barrelProfile = [
  [0, 0.81],
  [0.45, 0.99],
  [0.64, 1.05],
  [1.28, 1.17],
  [1.47, 1.17],
  [2.27, 1.04],
  [2.46, 1.01],
  [2.82, 0.91],
  [3.06, 0.83],
];
const barrelSkullCourses = [0.545, 1.375, 2.365];
const headShape = [
  [-1, -0.24],
  [-0.64, -0.78],
  [0.48, -0.84],
  [0.98, -0.31],
  [0.88, 0.47],
  [0.28, 1],
  [-0.66, 0.73],
];
const endShape = [
  [-0.92, -0.53],
  [0.78, -0.8],
  [0.9, 0.65],
  [-0.6, 0.92],
];

function barrelRadius(y) {
  const i = barrelProfile.findIndex(([upper]) => y < upper);
  const [y0, a] = barrelProfile[i - 1];
  const [y1, b] = barrelProfile[i];
  return a + ((b - a) * (y - y0)) / (y1 - y0);
}

function barrelRelief(out, facets, angle, y, seed, cranium) {
  const span = tau / facets;
  const radial = barrelRadius(y) * (Math.cos(span / 2) / Math.cos((angle % span) - span / 2));
  const base = 0.68 + 0.2 * Math.sin(seed * 2.03);
  const color = shade(cranium || seed % 4 === 0 ? ivory : aged, base);
  const depth = (cranium ? 0.091 : 0.036) * (0.86 + 0.16 * Math.sin(seed * 2.48));
  const width = (cranium ? 0.095 : 0.073) * (0.88 + 0.21 * Math.sin(seed * 1.74));
  const height = (cranium ? 0.093 : 0.066) * (0.92 + 0.18 * Math.cos(seed * 2.35));
  const turn = 0.68 * Math.sin(seed * 3.07);
  const c = Math.cos(turn),
    s = Math.sin(turn);
  const place = (u, v, lift) => {
    const r = radial + lift;
    return [
      r * Math.sin(angle) + u * Math.cos(angle),
      y + v,
      r * Math.cos(angle) - u * Math.sin(angle),
    ];
  };
  const face = (cranium ? headShape : endShape).map(([u, v], i) =>
    place(
      width * (c * u - s * v),
      height * (s * u + c * v),
      cranium ? 0.019 : i % 2 === 0 ? depth : -0.008,
    ),
  );
  if (!cranium) {
    triangle(out, 'rough', [face[0], face[1], face[2]], color);
    triangle(out, 'rough', [face[0], face[2], face[3]], shade(color, 0.78));
    return;
  }
  const tip = place(width * 0.12, height * 0.13, depth);
  for (const [i, before] of face.entries()) {
    const after = face[(i + 1) % face.length];
    triangle(out, 'rough', [before, after, tip], shade(color, 0.86 + 0.11 * Math.sin(i + seed)));
  }
}

function theBarrel(out, detail) {
  const count = detail.boneFaces ? 20 : 9;
  const point = (r, y, i) => [r * Math.sin((tau * i) / count), y, r * Math.cos((tau * i) / count)];
  for (let row = 1; row < barrelProfile.length; row++) {
    const [y0, r0] = barrelProfile[row - 1],
      [y1, r1] = barrelProfile[row];
    const course = !detail.boneFaces && row % 2 === 0 && row < 7;
    for (let i = 0; i < count; i++) {
      const color = shade(course ? ivory : aged, 0.52 + 0.09 * Math.cos(i * 2.18 + row));
      quad(
        out,
        'rough',
        [point(r0, y0, i), point(r0, y0, i + 1), point(r1, y1, i + 1), point(r1, y1, i)],
        color,
      );
    }
  }
  if (!detail.boneFaces) return;

  const rows = detail.name === 'master' ? 33 : 27;
  const spacing = detail.name === 'master' ? 0.105 : 0.13;
  for (let row = 0; row < rows; row++) {
    const level = 0.1 + (2.85 * (row + 0.5)) / rows;
    if (barrelSkullCourses.some((course) => Math.abs(level - course) < 0.09)) continue;
    const columns = Math.round((tau * barrelRadius(level)) / spacing);
    for (let i = 0; i < columns; i++) {
      const seed = 317 * row + 47 * i + 6;
      const angle = (tau * (i + 0.3 + 0.31 * (row % 2) + 0.14 * Math.sin(seed * 2.36))) / columns;
      barrelRelief(out, count, angle, level + 0.034 * Math.sin(seed), seed, false);
    }
  }
  for (const [row, level] of barrelSkullCourses.entries()) {
    const heads = Math.round((tau * barrelRadius(level)) / 0.205);
    for (let i = 0; i < heads; i++) {
      const seed = 101 * row + 17 * i;
      const angle = (tau * (i + 0.43 + 0.16 * Math.sin(seed * 1.15))) / heads;
      barrelRelief(out, count, angle, level + 0.03 * Math.cos(seed * 2.43), seed, true);
    }
  }
}

function lintelInscription(out) {
  const ink = [0.092, 0.08, 0.067];
  const textFace = 0.429;
  // Reuse the shared stroke font, retaining its face as thin black pigment on the stone.
  const paint = {
    addQuad(slot, _ref, points, normal, _uv, color) {
      if (normal[2] > 0.99) quad(out, slot, points, color);
    },
    addConvexPolygon() {},
  };
  const mark = (a, b, width = 0.0048) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const size = width / (2 * Math.hypot(dx, dy));
    const at = ([x, y], side) => [x - side * dy * size, y + side * dx * size, textFace + 0.003];
    quad(out, 'plaster', [at(a, 1), at(a, -1), at(b, -1), at(b, 1)], ink);
  };
  function line(text, width, height, y) {
    const advance = width / text.length;
    lettering(paint, text.replaceAll('Ê', 'E').replaceAll('O', '0'), {
      slot: 'plaster',
      width,
      height,
      y,
      z: textFace,
      color: ink,
      stroke: 0.0049,
    });
    for (const [index, glyph] of [...text].entries()) {
      const x = (index - text.length / 2 + 0.38) * advance;
      if (glyph === 'Ê') {
        mark([x - 0.021, y + height + 0.012], [x, y + height + 0.025]);
        mark([x, y + height + 0.025], [x + 0.021, y + height + 0.012]);
      }
      if (glyph === '!') {
        mark([x, y + 0.027], [x, y + height]);
        mark([x, y], [x, y + 0.008], 0.007);
      }
      if (glyph === '’') mark([x - 0.007, y + height - 0.02], [x + 0.004, y + height], 0.006);
    }
  }
  line('ARRÊTE!', 0.68, 0.067, 2.112);
  line('C’EST ICI L’EMPIRE DE LA MORT', 1.76, 0.062, 2.001);
}

function ritualPortal(out, detail) {
  const half = 1.51;
  const door = 0.79;
  const panelColor = [0.145, 0.147, 0.136];
  const pale = [0.73, 0.69, 0.602];
  for (const side of [-1, 1]) {
    const [x0, x1] = side < 0 ? [-half, -door] : [door, half];
    box(out, 'ashlar', [x0, 0, -0.43], [x1, 2.21, 0.405], shade(course, 0.93));
    const pz = 0.407;
    quad(
      out,
      'plaster',
      [
        [x0, 0, pz],
        [x1, 0, pz],
        [x1, 2.21, pz],
        [x0, 2.21, pz],
      ],
      panelColor,
    );
    const x = (x0 + x1) * 0.5;
    quad(
      out,
      'plaster',
      [
        [x, 0.13, 0.4085],
        [x + 0.263, 0.93, 0.4085],
        [x, 1.94, 0.4085],
        [x - 0.263, 0.93, 0.4085],
      ],
      pale,
    );
  }
  box(out, 'ashlar', [-0.86, 1.9, -0.43], [0.86, 2.225, 0.421], shade(course, 0.89));
  quad(
    out,
    'plaster',
    [
      [-0.91, 1.969, 0.425],
      [0.91, 1.969, 0.425],
      [0.94, 2.222, 0.425],
      [-0.935, 2.226, 0.425],
    ],
    [0.63, 0.54, 0.42],
  );
  if (detail.joinery) lintelInscription(out);
}

function sepulchralLamp(out, detail) {
  const lampX = -0.78;
  const bowlZ = 0.28;
  const stone = [0.425, 0.378, 0.309];
  const count = detail.joinery ? 12 : 5;
  const ring = (h, r) => radialRing(h, r, r, count, [lampX, bowlZ]);
  loft(
    out,
    'rough',
    [ring(0, 0.234), ring(0.12, 0.199), ring(0.64, 0.193), ring(0.82, 0.224)],
    stone,
  );
  const bowl = [
    ring(0.815, 0.124),
    ring(0.89, 0.16),
    ring(1.02, 0.293),
    ring(1.055, 0.297),
    ring(1.055, 0.259),
    ring(1.019, 0.224),
    ring(0.938, 0.124),
  ];
  loft(out, 'rough', bowl, shade(stone, 0.83), { cap: false });
  out.addConvexPolygon(
    'rough',
    ref,
    bowl.at(-1),
    [0, 1, 0],
    (p) => [p[0], p[2]],
    shade(stone, 0.69),
  );
  const tar = [0.128, 0.121, 0.112];
  const paintedStone = [0.64, 0.592, 0.51];
  for (const x of [-2.18, 1.43]) {
    box(out, 'ashlar', [x - 0.252, 0, 1.01], [x + 0.254, 2.47, 1.52], tar);
    box(out, 'ashlar', [x - 0.335, 2.45, 0.934], [x + 0.335, 2.57, 1.59], shade(stone, 1.08));
    const faceZ = 1.007;
    const painted = [
      [x - 0.154, 0.27, faceZ],
      [x - 0.121, 1.94, faceZ],
      [x - 0.074, 2.118, faceZ],
      [x + 0.066, 2.132, faceZ],
      [x + 0.132, 1.96, faceZ],
      [x + 0.15, 0.27, faceZ],
    ];
    out.addConvexPolygon('plaster', ref, painted, [0, 0, -1], (p) => [p[0], p[1]], paintedStone);
  }
}

function theWell(out, detail) {
  const x = 0.79;
  const z = 0.28;
  const outer = 1.08;
  const inner = 0.84;
  const sides = detail.joinery ? 24 : detail.tunnelFacets * 4;
  const rimHeights = [0.47, 0.7, 0.92, 1.17, 1.42];
  const rim = (angle) => {
    const rise = (1 + Math.cos(angle)) / 2;
    return detail.joinery ? rimHeights[Math.min(4, Math.floor(rise * 5))] : 0.47 + 0.95 * rise;
  };
  const circle = (r, y, a) => [x + Math.sin(a) * r, y, z + Math.cos(a) * r];
  const lip = (a, y) => [circle(inner, y, a), circle(outer, y, a)];
  // The photographed curb rises in steps from the low, guarded opening to the rear sill.
  for (let i = 0; i < sides; i++) {
    const a = (tau * i) / sides;
    const b = (tau * (i + 1)) / sides;
    const heightA = rim(detail.joinery ? (a + b) / 2 : a);
    const heightB = detail.joinery ? heightA : rim(b);
    const [innerA, outerA] = lip(a, heightA);
    const [innerB, outerB] = lip(b, heightB);
    quad(out, 'ashlar', [outerA, outerB, innerB, innerA], shade(course, 1.07));
    quad(out, 'ashlar', [circle(outer, 0, a), circle(outer, 0, b), outerB, outerA], course);
    quad(out, 'rough', [innerA, innerB, circle(inner, 0.016, b), circle(inner, 0.016, a)], rock);
    triangle(
      out,
      'rough',
      [[x, 0.016, z], circle(inner, 0.016, a), circle(inner, 0.016, b)],
      [0.09, 0.103, 0.088],
    );
    if (detail.joinery) {
      const nextHeight = rim(b + (b - a) / 2);
      if (nextHeight !== heightB) {
        const [nextInner, nextOuter] = lip(b, nextHeight);
        quad(out, 'ashlar', [innerB, outerB, nextOuter, nextInner], shade(course, 0.94));
      }
    }
  }
  if (detail.joinery) {
    const angles = Array.from({ length: 9 }, (_, i) => Math.PI - 1.02 + (2.04 * i) / 8);
    const railR = 0.94;
    const iron = [0.19, 0.177, 0.15];
    for (const [height, width] of [
      [0.61, 0.022],
      [0.77, 0.022],
      [0.94, 0.042],
    ]) {
      for (let i = 1; i < angles.length; i++) {
        beam(
          out,
          'iron',
          circle(railR, height, angles[i - 1]),
          circle(railR, height, angles[i]),
          width,
          width,
          iron,
        );
      }
    }
    for (const i of [0, 2, 4, 6, 8]) {
      const angle = angles[i];
      beam(
        out,
        'iron',
        circle(railR, rim(angle) - 0.04, angle),
        circle(railR, 0.94, angle),
        0.031,
        0.031,
        iron,
      );
    }
    box(out, 'ashlar', [x - 0.72, 1.38, z + 0.72], [x + 0.72, 1.49, z + 1.09], shade(course, 0.99));
  }
}

function lowerQuarryPortal(out, detail) {
  const spring = 1.43;
  const halfOpening = 0.79;
  const halfSpan = 1.17;
  const front = -0.24;
  const back = 0.19;
  for (const side of [-1, 1]) {
    const [left, right] = side < 0 ? [-halfSpan, -halfOpening] : [halfOpening, halfSpan];
    box(out, 'ashlar', [left, 0, front], [right, spring, back], course);
    box(out, 'ashlar', [left - 0.025, 0, front - 0.042], [right + 0.025, 0.19, back], rock);
    box(
      out,
      'ashlar',
      [left - 0.016, spring - 0.11, front - 0.046],
      [right + 0.016, spring, back],
      shade(course, 0.91),
    );
  }
  const arch = (angle, inner, z) => [
    Math.cos(angle) * (inner ? halfOpening : halfSpan),
    spring + Math.sin(angle) * (inner ? 0.63 : 0.79),
    z,
  ];
  const stones = detail.joinery ? 11 : 7;
  for (let i = 0; i < stones; i++) {
    const right = (i * Math.PI) / stones;
    const left = ((i + 1) * Math.PI) / stones;
    const tone = shade(course, 0.85 + 0.055 * (i % 4));
    quad(
      out,
      'ashlar',
      [
        arch(right, false, front),
        arch(right, true, front),
        arch(left, true, front),
        arch(left, false, front),
      ],
      tone,
    );
    quad(
      out,
      'ashlar',
      [
        arch(left, false, back),
        arch(left, true, back),
        arch(right, true, back),
        arch(right, false, back),
      ],
      tone,
    );
    quad(
      out,
      'ashlar',
      [
        arch(right, true, front),
        arch(right, true, back),
        arch(left, true, back),
        arch(left, true, front),
      ],
      shade(tone, 0.83),
    );
    quad(
      out,
      'ashlar',
      [
        arch(left, false, front),
        arch(left, false, back),
        arch(right, false, back),
        arch(right, false, front),
      ],
      tone,
    );
  }
}

function quarryPillar(out, node, side) {
  const x = side * (node.half - 0.65);
  const profiles = [
    [0, 0.49],
    [0.25, 0.46],
    [1.09, 0.4],
    [2.08, 0.53],
    [node.height - 0.04, 0.65],
  ];
  loft(
    out,
    'rough',
    profiles.map(([y, r]) => radialRing(y, r, r * 1.04, 7, [x, side * 0.35])),
    shade(rock, 0.88 + (side + 1) * 0.08),
  );
  box(out, 'ashlar', [x - 0.83, 0.03, -0.93], [x + 0.71, 0.2, 0.81], floor);
}

function quarryBlock(out, { x, y, z, height, width, depth, tone, skew }) {
  loft(
    out,
    'rough',
    [
      chamferedRectangle(x, y, z, width * 0.93, depth * 0.94, width * 0.17),
      chamferedRectangle(x + skew, y + height, z - skew, width, depth, width * 0.22),
    ],
    shade(course, tone),
  );
}

function quarryWorkshop(out, node, prior, detail) {
  const model = routePart(out, node);
  quarryPillar(model, node, -1);
  if (!detail.joinery) {
    quarryPillar(model, node, 1);
    return;
  }

  // The workshop shows both rock left in place and piers assembled from stacked stone.
  const x = node.half - 0.66;
  const courses = [0, 0.28, 0.64, 0.89, 1.19, 1.54, 1.78, 2.06, 2.29, 2.62];
  for (let i = 1; i < courses.length; i++) {
    quarryBlock(model, {
      x: x + 0.044 * ((i % 3) - 1),
      y: courses[i - 1] - 0.008,
      z: 0.24 + 0.06 * ((i % 4) - 1.5),
      height: courses[i] - courses[i - 1] + 0.012,
      width: 0.97 + 0.14 * (i % 3),
      depth: 0.79 + 0.075 * (i % 4),
      tone: 0.81 + 0.035 * ((i * 7) % 5),
      skew: 0.055 * ((i % 3) - 1),
    });
  }

  // Low dry-stacked retaining wall along the approach, behind the assembled pier.
  const start = passagePoint(prior, 1, 0);
  const end = passagePoint(node, 1, 0);
  const direction = unit([end[0] - start[0], end[2] - start[2]]);
  const wall = transform(out, facing(direction), end);
  box(wall, 'rough', [-0.27, 0, -4.05], [0.12, 0.93, -0.25], shade(rock, 0.92));
  if (detail.name === 'street') return;
  for (let row = 0; row < 4; row++) {
    for (let block = 0; block < 7; block++) {
      const n = block + 7 * row;
      quarryBlock(wall, {
        x: -0.24 - 0.017 * ((n * 7) % 6),
        y: 0.235 * row,
        z: -3.75 + 0.51 * block - 0.13 * (row % 2),
        height: 0.23 + 0.033 * (n % 3),
        width: 0.25 + 0.025 * (n % 4),
        depth: 0.49 + 0.025 * (n % 3),
        tone: 0.69 + 0.044 * ((n * 3) % 7),
        skew: 0.027 * ((n % 3) - 1),
      });
    }
  }
}

function sitesAlongRoute(out, nodes, detail) {
  for (const [index, node] of nodes.entries()) {
    if (node.kind === 'workshop') {
      quarryWorkshop(out, node, nodes[index - 1], detail);
      continue;
    }
    const model = routePart(out, node);
    if (node.kind === 'stairs') lowerQuarryPortal(model, detail);
    if (node.kind === 'portal') ritualPortal(transform(model, Math.PI), detail);
    if (node.kind === 'sepulchral') sepulchralLamp(model, detail);
    if (node.kind === 'passion') theBarrel(transform(model, 0, [1.04, 0, 0]), detail);
    if (node.kind === 'samaritaine') theWell(model, detail);
    if (node.kind === 'pillars') pillarsHallFurnishings(model, detail);
  }
}

export function buildCatacombInterior(out, detail) {
  if (detail.name === 'skyline') {
    upperLanding(out, site.entrance, detail);
    upperLanding(out, site.exit, detail);
    return;
  }
  const nodes = routeGeometry();
  stair(out, site.entrance, nodes[0], detail);
  stair(out, site.exit, nodes.at(-1), detail);
  upperLanding(out, site.entrance, detail);
  upperLanding(out, site.exit, detail);
  if (detail.joinery) denfertLandingRoom(out, detail);
  for (let i = 1; i < nodes.length; i++) {
    const from = nodes[i - 1];
    const to = nodes[i];
    if (from.kind === 'stairs') lowerQuarryApproach(out, from, to, detail, i);
    else passage(out, from, to, detail, i);
  }
  if (detail.joinery) {
    const easternGallery = easternGalleryNodes(nodes);
    const galleryDetail = {
      ...detail,
      easternOssuary: true,
      ...(detail.name === 'master'
        ? {}
        : { boneFaces: false, tunnelFacets: detail.boneFaces ? 4 : 2 }),
    };
    for (let i = 1; i < easternGallery.length; i++) {
      passage(out, easternGallery[i - 1], easternGallery[i], galleryDetail, nodes.length + i);
    }
  }
  const { vestibule } = restoredRoomFrames(nodes);
  ossuaryVestibuleFurnishings(routePart(out, vestibule), detail);
  buildPortMahon(out, portMahonOpening(nodes), detail);
  buildFontis(out, fontisOpening(nodes), detail, stair);
  if (detail.joinery) sacellum(out, nodes, detail);
  sitesAlongRoute(out, nodes, detail);
  if (detail.joinery) {
    for (const sign of quarryInscriptionFrames(nodes)) quarryPlaque(out, sign, detail);
  }
}
