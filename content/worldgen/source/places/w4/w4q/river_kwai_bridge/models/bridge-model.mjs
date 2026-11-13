import {
  beam,
  beamPath,
  chamferedRectangle,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const bridgeControls = {
  id: 'river_kwai_bridge',
  anchor: [99.503460803, 14.040409573],
  heading: 1.111249203502,
  datum: 29,
  ends: [-160.47, 160.92],
  halfWidth: 3.25,
  trackId: 35184397120053,
  trackApproachIds: [35184397120054, 35184748111087],
  curve: [
    [-160.47, -0.26],
    [-88, 0.96],
    [160.92, 1.018],
  ],
  profile: [
    [-160.47, 10.73],
    [-88, 9.83],
    [40, 7.45],
    [160.92, 5.25],
  ],
  spanBoundaries: [-160.47, -132, -103, -75, -46, -17, 10, 39, 74, 107, 134, 160.92],
  replacementSpanStarts: [39, 74],
  pierBaseElevations: [9.9, 7.7, 5.1, 2.4, -0.8, -2.7, -2.9, -2.7, -3, -2.5, -1.1, 4.1],
};

function interpolate(station, points) {
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (station <= x1) return y0 + (y1 - y0) * Math.max(0, (station - x0) / (x1 - x0));
  }
  return points.at(-1)[1];
}

export const deckY = (station) => interpolate(station, bridgeControls.profile);
export const centerZ = (station) => interpolate(station, bridgeControls.curve);

const materials = {
  steel: { slot: 'wall', graph: 'metal_painted', hex: '363b39' },
  gusset: { slot: 'wall', graph: 'metal_painted', hex: '494a43' },
  worn: { slot: 'wall', graph: 'metal_painted', hex: '69645c' },
  oxide: { slot: 'wall', graph: 'metal_painted', hex: '624836' },
  rail: { slot: 'trim', graph: 'metal_stainless', hex: '938c7d' },
  pier: { slot: 'foundation', graph: 'concrete_plain', hex: '958776' },
  apron: { slot: 'foundation', graph: 'concrete_plain', hex: 'b1a38b' },
};

const colors = Object.fromEntries(
  Object.entries(materials).map(([key, { hex }]) => [
    key,
    [0, 2, 4].map((offset) => {
      const v = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  ]),
);
export const bridgeSurfaces = Object.fromEntries(
  Object.entries(materials).map(([key, { hex, ...surface }]) => [key, surface]),
);

export function buildBridgeLevel(out, level = 'master') {
  const tier = ['skyline', 'district', 'street', 'closeup', 'master'].indexOf(level);
  if (tier === -1) throw new Error('Unknown River Kwai detail level: ' + level);
  const { ends, spanBoundaries, replacementSpanStarts, pierBaseElevations } = bridgeControls;
  const p = (x, height, z) => [x, deckY(x) + height, centerZ(x) + z];
  const bar = (key, a, b, width, depth = width) => beam(out, key, a, b, width, depth, colors[key]);
  const path = (key, points, width, depth = width) =>
    beamPath(out, key, points, width, depth, colors[key]);
  function ribbon(key, a, b, width) {
    // The distant open truss uses two windings on one narrow plane.
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const offset = [
      (-(b[1] - a[1]) * width) / (2 * length),
      ((b[0] - a[0]) * width) / (2 * length),
    ];
    const points = [
      [a[0] + offset[0], a[1] + offset[1], a[2]],
      [a[0] - offset[0], a[1] - offset[1], a[2]],
      [b[0] - offset[0], b[1] - offset[1], b[2]],
      [b[0] + offset[0], b[1] + offset[1], b[2]],
    ];
    for (const ring of [points, points.toReversed()]) {
      out.addQuad(key, 'palette:#ffffff', ring, normalFor(...ring), undefined, colors[key]);
    }
  }

  const deckStations = [
    ...new Set([
      ...ends,
      ...bridgeControls.curve.map(([x]) => x),
      ...bridgeControls.profile.map(([x]) => x),
    ]),
  ].sort((a, b) => a - b);
  const strip = (key, z, y, width, thickness) =>
    path(
      key,
      deckStations.map((x) => p(x, y, z)),
      width,
      thickness,
    );
  strip('steel', 0, -0.23, 3.64, 0.46);
  // Short landing lips meet the native ballast bed at the two ends.
  for (const [i, x] of ends.entries()) {
    const inward = x + (i === 0 ? 1.8 : -1.8);
    for (const side of [-1, 1]) {
      const ring = [p(x, 0, side * 1.815), p(x, 0, side * 2.31), p(inward, 0, side * 1.815)];
      if (normalFor(...ring)[1] < 0) ring.reverse();
      out.addTriangle('worn', 'palette:#ffffff', ring, normalFor(...ring), undefined, colors.worn);
      const apron = [p(x, 0, side * 2.31), p(x, -0.28, side * 2.31), p(inward, 0, side * 1.815)];
      if (normalFor(...apron)[2] * side < 0) apron.reverse();
      out.addTriangle(
        'steel',
        'palette:#ffffff',
        apron,
        normalFor(...apron),
        undefined,
        colors.steel,
      );
    }
  }
  if (tier > 0) {
    for (const side of [-1, 1]) {
      strip('worn', side * 1.07, 0.022, 0.92, 0.05);
      strip('oxide', side * 0.5, 0.042, 0.087, 0.077);
      strip('rail', side * 0.5, 0.104, 0.054, 0.052);
      strip('steel', side * 1.63, 0.83, 0.061, 0.061);
      if (tier > 1) strip('steel', side * 1.63, 0.47, 0.047, 0.047);
    }
    strip('worn', 0, 0.028, 0.63, 0.055);
  }

  for (const [i, station] of spanBoundaries.entries()) {
    const [x, y, z] = p(station, -0.46, 0);
    const footing = pierBaseElevations[i];
    const end = i === 0 || i === spanBoundaries.length - 1;
    const section = (h, w, d) =>
      tier === 0
        ? [
            [x - w / 2, h, z - d / 2],
            [x - w / 2, h, z + d / 2],
            [x + w / 2, h, z + d / 2],
            [x + w / 2, h, z - d / 2],
          ]
        : chamferedRectangle(x, h, z, w, d, 0.35);
    const rings = [section(footing, end ? 2.8 : 2.5, end ? 6.2 : 3.35)];
    if (tier > 0 && !end) rings.push(section(y - 1.25, 1.85, 2.62));
    rings.push(section(y, end ? 2.55 : 2.25, end ? 5.35 : 4.05));
    loft(out, 'pier', rings, colors.pier);
    if (tier > 0 && !end) {
      if (tier > 1) bar('apron', [x, y - 0.24, z], [x, y - 0.05, z], 4.3, 2.8);
      for (const side of [-1, 1]) {
        const outer = side * 2.65;
        bar(
          'worn',
          p(x - 1.18, 0.035, outer - side * 0.35),
          p(x + 1.18, 0.035, outer - side * 0.35),
          1.64,
          0.16,
        );
        path(
          'steel',
          [
            p(x - 1.22, 0.16, outer),
            p(x - 1.22, 0.91, outer),
            p(x + 1.22, 0.91, outer),
            p(x + 1.22, 0.16, outer),
          ],
          0.057,
        );
      }
    }
  }

  for (let i = 0; i < spanBoundaries.length - 1; i++) {
    const x0 = spanBoundaries[i] + 0.6;
    const x1 = spanBoundaries[i + 1] - 0.6;
    const replacement = replacementSpanStarts.includes(spanBoundaries[i]);
    const rise = replacement ? 4.25 : 2.86;
    const top = (u) =>
      0.31 + rise * (replacement ? Math.min(1, 6 * u, 6 * (1 - u)) : 4 * u * (1 - u));
    const panels = [4, 6, 10, 12, 14][tier];
    const fractions =
      replacement && tier === 0
        ? [0, 1 / 6, 5 / 6, 1]
        : Array.from({ length: panels + 1 }, (_, j) => j / panels);
    const nodes = fractions.map((u) => [x0 + (x1 - x0) * u, top(u)]);
    for (const side of [-1, 1]) {
      const z = side * 1.79;
      const head = nodes.map(([x, y]) => p(x, y, z));
      const web = tier < 2 ? ribbon : bar;
      if (tier === 0) {
        for (let j = 1; j < head.length; j++) ribbon('steel', head[j - 1], head[j], 0.25);
        ribbon('steel', p(x0, 0.12, z), head[1], 0.15);
        ribbon('steel', head[1], p((x0 + x1) / 2, 0.12, z), 0.15);
        ribbon('steel', p((x0 + x1) / 2, 0.12, z), head.at(-2), 0.15);
        ribbon('steel', head.at(-2), p(x1, 0.12, z), 0.15);
        continue;
      }
      path('steel', head, 0.29, replacement ? 0.36 : 0.23);
      for (let j = 1; j < nodes.length; j++) {
        const x = nodes[j][0],
          prev = nodes[j - 1][0];
        const lower = p(x, 0.12, z),
          prevLower = p(prev, 0.12, z);
        if (j < nodes.length - 1) web('steel', head[j], lower, replacement ? 0.17 : 0.1);
        web('steel', j % 2 ? head[j] : head[j - 1], j % 2 ? prevLower : lower, 0.145);
        if (!replacement && tier > 1)
          web('steel', j % 2 ? head[j - 1] : head[j], j % 2 ? lower : prevLower, 0.085);
        if (tier > 2 && j < nodes.length - 1) {
          bar(
            'gusset',
            p(x - 0.11, nodes[j][1] - 0.19, z + side * 0.15),
            p(x + 0.11, nodes[j][1] - 0.19, z + side * 0.15),
            0.07,
            0.22,
          );
          bar('oxide', p(x, -0.39, side * 1.65), p(x, 0.7, side * 1.65), 0.042);
        }
      }
    }
    if (tier > 1) {
      for (let x = x0 + 0.35; x < x1 - 0.3; x += tier === 2 ? 1.5 : tier === 3 ? 1.0 : 0.72) {
        bar('oxide', p(x, -0.045, -0.83), p(x, -0.045, 0.83), 0.16, 0.085);
      }
      for (const [x] of nodes) {
        bar('steel', p(x, -0.41, -1.94), p(x, -0.41, 1.94), 0.22, 0.22);
      }
    }
  }
}

export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');
