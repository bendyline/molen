import {
  face,
  mix,
  pairs,
  palette,
  pavilion,
  surface,
  up,
} from './montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  stone: surface('wall', 'stone_ashlar', 0.95),
  dressed: surface('trim', 'stone_granite', 0.91),
  ground: surface('foundation', 'stone_basalt_raw', 0.96),
  road: surface('roof', 'concrete_plain', 0.95),
};
const colors = palette({
  wall: '928b7a',
  pitted: '8c8677',
  foundation: '77776b',
  dressed: 'a29b89',
  arch: 'aaa28e',
  road: '959184',
});

function roadOffset(axis, x) {
  const [a, b] = pairs(axis).find(([, end]) => x <= end[0]) ?? axis.slice(-2);
  return mix(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
}

function bridgeEdges(outline, axis, width, x) {
  const bounds = [];
  for (const [a, b] of pairs([...outline, outline[0]])) {
    if (x >= Math.min(a[0], b[0]) && x < Math.max(a[0], b[0])) {
      bounds.push(mix(a[1], b[1], (x - a[0]) / (b[0] - a[0])));
    }
  }
  const center = roadOffset(axis, x);
  const minimum = Math.min(...bounds);
  const maximum = Math.max(...bounds);
  if (maximum - minimum < width * 0.66) return [center - width / 2, center + width / 2];
  return [Math.max(minimum, center - width * 0.73), Math.min(maximum, center + width * 0.73)];
}

function bridgeStations(axis, start, end, gap) {
  const knots = [start, ...axis.map(([x]) => x).filter((x) => start < x && x < end), end];
  const stations = [start];
  for (const [a, b] of pairs(knots)) {
    const count = Math.ceil((b - a) / gap);
    for (let i = 1; i <= count; i++) stations.push(mix(a, b, i / count));
  }
  return stations;
}

function layStrip(out, slot, stations, depth, bottom, top, color, caps = true) {
  const section = (x) => {
    const [near, far] = depth(x);
    return [
      [x, bottom(x, near), near],
      [x, top(x, near), near],
      [x, top(x, far), far],
      [x, bottom(x, far), far],
    ];
  };
  const slices = stations.map(section);
  for (const [a, b] of pairs(slices)) {
    face(out, slot, [a[0], b[0], b[1], a[1]], [0, 0, -1], color);
    face(out, slot, [a[1], b[1], b[2], a[2]], up, color);
    face(out, slot, [a[2], b[2], b[3], a[3]], [0, 0, 1], color);
    if (caps) face(out, slot, [a[0], a[3], b[3], b[0]], [0, -1, 0], color);
  }
  if (caps) {
    face(out, slot, slices[0], [-1, 0, 0], color);
    face(out, slot, slices.at(-1), [1, 0, 0], color);
  }
}

function footway(out, lod, axis, deck, edges) {
  const stations = bridgeStations(axis, axis[0][0], axis.at(-1)[0], [20, 10, 4.5, 2][lod]);
  layStrip(out, 'road', stations, edges, (x) => deck(x) - 0.31, deck, colors.road);
  for (const side of [0, 1]) {
    const direction = side === 0 ? -1 : 1;
    const trim = (x, outside, inside) => {
      const z = edges(x)[side];
      return [z - direction * inside, z + direction * outside].sort((a, b) => a - b);
    };
    const wall = (x) => trim(x, 0.022, 0.37);
    const coping = (x) => trim(x, 0.087, 0.43);
    layStrip(
      out,
      'stone',
      stations,
      wall,
      (x) => deck(x) - 0.06,
      (x) => deck(x) + 0.8,
      colors.wall,
    );
    layStrip(
      out,
      'dressed',
      stations,
      coping,
      (x) => deck(x) + 0.78,
      (x) => deck(x) + 0.92,
      colors.dressed,
      false,
    );
    if (lod > 0) {
      const cornice = (x) => trim(x, 0.12, 0.03);
      layStrip(
        out,
        'dressed',
        stations,
        cornice,
        (x) => deck(x) - 0.55,
        (x) => deck(x) - 0.381,
        colors.dressed,
        false,
      );
    }
  }
}

function archShell(out, lod, start, width, rise, deck, edges) {
  const count = [6, 9, 13, 18][lod];
  const center = start + width / 2;
  const point = (i, pad = 0) => {
    const angle = (Math.PI * i) / count;
    const x = center - (width / 2 + pad) * Math.cos(angle);
    return [x, deck(x) - 0.89 - rise + (rise + pad) * Math.sin(angle)];
  };
  const sidePoint = ([x, y], side, offset = 0) => [x, y, edges(x)[side] + offset];
  for (let i = 0; i < count; i++) {
    const a = point(i);
    const b = point(i + 1);
    face(
      out,
      'stone',
      [sidePoint(a, 0), sidePoint(b, 0), sidePoint(b, 1), sidePoint(a, 1)],
      [0, -1, 0],
      colors.pitted,
    );
    for (const side of [0, 1]) {
      const normal = [0, 0, side === 0 ? -1 : 1];
      const p = (p, offset = 0) => sidePoint(p, side, normal[2] * offset);
      face(
        out,
        'stone',
        [p(a), p(b), p([b[0], deck(b[0]) - 0.3]), p([a[0], deck(a[0]) - 0.3])],
        normal,
        colors.wall,
      );
      if (lod > 0) {
        const offset = 0.022;
        const size = 0.24 + width * 0.018;
        const joints = lod === 3 ? 0.037 : 0;
        const innerA = point(i + joints);
        const innerB = point(i + 1 - joints);
        const outerA = point(i + joints, size);
        const outerB = point(i + 1 - joints, size);
        const tint = lod > 1 && i % 3 === 1 ? colors.dressed : colors.arch;
        face(
          out,
          'dressed',
          [p(innerA, offset), p(innerB, offset), p(outerB, offset), p(outerA, offset)],
          normal,
          tint,
        );
      }
    }
  }
}

function taperedPier(out, lod, x0, x1, ceiling, edges, grade, impost) {
  const center = (x0 + x1) / 2;
  const [near, far] = edges(center);
  const bottom = Math.min(ceiling - 0.8, grade([center, near]), grade([center, far])) - 0.58;
  const taper = 0.12 + (x1 - x0) * 0.11;
  const profile = (y, extra, forward) => [
    [x0 - extra, y, near - forward],
    [x1 + extra, y, near - forward],
    [x1 + extra, y, far + forward],
    [x0 - extra, y, far + forward],
  ];
  const contours = [profile(bottom, taper + 0.09, 0.34), profile(ceiling, 0, 0.06)];
  if (lod > 1) contours.splice(1, 0, profile(bottom + 0.29, taper, 0.215));
  const normals = [
    [0, 0, -1],
    [1, 0, 0],
    [0, 0, 1],
    [-1, 0, 0],
  ];
  for (const [index, [low, high]] of pairs(contours).entries()) {
    const footing = lod > 1 && index === 0;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      face(
        out,
        footing ? 'ground' : 'stone',
        [low[i], low[j], high[j], high[i]],
        normals[i],
        footing ? colors.foundation : colors.wall,
      );
    }
  }
  if (impost || lod > 1) {
    const extra = impost ? 0.15 : 0.07;
    const bounds = () => [near - extra, far + extra];
    layStrip(
      out,
      'dressed',
      [x0 - extra, x1 + extra],
      bounds,
      () => ceiling - 0.17,
      () => ceiling + 0.13,
      colors.dressed,
    );
  }
}

function draw(out, lod, dims, grade) {
  const { outline, roadAxis, deckWidth, deckEnds, openingStart, widths, rises, pierWidth, impost } =
    dims;
  const start = roadAxis[0][0];
  const end = roadAxis.at(-1)[0];
  const deck = (x) => mix(...deckEnds, (x - start) / (end - start));
  const edges = (x) => bridgeEdges(outline, roadAxis, deckWidth, x);
  const spanPositions = [];
  let x = openingStart;
  for (const [i, width] of widths.entries()) {
    spanPositions.push({ start: x, end: x + width, rise: rises[i] });
    archShell(out, lod, x, width, rises[i], deck, edges);
    x += width + pierWidth;
  }
  footway(out, lod, roadAxis, deck, edges);
  for (const [a, b] of pairs(spanPositions)) {
    const ceiling = Math.min(deck(a.end) - a.rise, deck(b.start) - b.rise) - 0.89;
    taperedPier(out, lod, a.end, b.start, ceiling, edges, grade, impost);
    layStrip(
      out,
      'stone',
      [a.end, b.start],
      edges,
      () => ceiling - 0.02,
      (x) => deck(x) - 0.29,
      colors.wall,
    );
  }
  for (const [a, b] of [
    [start, openingStart],
    [spanPositions.at(-1).end, end],
  ]) {
    const stations = bridgeStations(roadAxis, a, b, [14, 8, 4, 1.8][lod]);
    const foundation = (x, z) => Math.min(deck(x) - 0.95, grade([x, z]) - 0.63);
    layStrip(out, 'stone', stations, edges, foundation, (x) => deck(x) - 0.29, colors.wall);
  }
}

export function createTaiTamTukMasonryBridge(url, config) {
  const bridge = pavilion(url, { ...config, surfaces }, draw);
  bridge.model.category = 'bridge';
  bridge.model.mediumFiContext.scale = config.scale;
  bridge.model.sourceLicense =
    'Independent reconstruction from official geographic data, OpenStreetMap, original survey terrain and written construction records.';
  bridge.model.recipeDependencies.push('tai-tam-tuk-masonry-bridge-geometry.mjs');
  return bridge;
}
