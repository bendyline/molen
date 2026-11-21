import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { kyivMetroSections } from '../../../../../../../../packages/worldgen/scripts/kyiv-metro-bridge-model.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import railFit from '../rail-fit.json' with { type: 'json' };

const { cell, deckY, half, pierRing, profile, stations } = kyivMetroSections;
const concrete = [0.67, 0.65, 0.59],
  stone = [0.46, 0.46, 0.42],
  pale = [0.79, 0.77, 0.7];
const asphalt = [0.18, 0.19, 0.19],
  paint = [0.48, 0.57, 0.55],
  steel = [0.57, 0.59, 0.58],
  mark = [0.85, 0.84, 0.75];
const allRibs = [-10.6, -3.5, 3.5, 10.6];
export const eastRailEnds = railFit.tracks.map((track) => track.at(-1));
const [rightEnd, leftEnd] = eastRailEnds;
const railEnd = (rightEnd[0] + leftEnd[0]) / 2;
const endZ = (rightEnd[1] + leftEnd[1]) / 2;
const endSkew = (leftEnd[0] - rightEnd[0]) / (leftEnd[1] - rightEnd[1]);
export const eastDeckEdgeX = (z) => railEnd + (z - endZ) * endSkew;

function trackZ(track, x) {
  const i = track.findIndex((p) => p[0] >= x);
  if (i === -1) return track.at(-1)[1];
  if (i === 0) return track[0][1];
  const [a, b] = [track[i - 1], track[i]];
  return a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
}

export function railCenterZ(x) {
  if (x >= railEnd) return endZ;
  const [right, left] = railFit.tracks;
  return (trackZ(right, x) + trackZ(left, x)) / 2;
}

export const surfaces = {
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.88, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.6, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_stainless', roughness: 0.49, metallic: 0.55 },
  road: {
    slot: 'foundation',
    localRef: 'palette:#ffffff',
    name: 'bridge-paving',
    roughness: 0.95,
    metallic: 0,
  },
  marking: {
    slot: 'trim',
    localRef: 'palette:#ffffff',
    name: 'painted-deck-stripes',
    roughness: 0.87,
    metallic: 0,
  },
};

function arch(out, a, b, z, detail) {
  const samples = detail.ribSegments;
  const bottom = (t) => 3.15 + 4 * t * (1 - t) * (deckY((a + b) / 2) - 6.1);
  const thickness = (t) => 1.6 + 1.75 * (2 * t - 1) ** 2;
  const rings = Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples,
      x = a + (b - a) * t,
      lo = bottom(t),
      hi = lo + thickness(t);
    return [
      [x, hi, z - 1],
      [x, hi, z + 1],
      [x, lo, z + 1],
      [x, lo, z - 1],
    ];
  });
  loft(out, 'concrete', rings, concrete);
  for (let i = 1; i < detail.posts; i++) {
    const t = i / detail.posts,
      x = a + (b - a) * t;
    const lo = bottom(t) + thickness(t),
      hi = deckY(x) - 0.69;
    if (hi - lo > 0.12)
      box(out, 'concrete', [x - 0.38, lo, z - 0.46], [x + 0.38, hi, z + 0.46], pale);
  }
  if (!detail.joints) return;
  for (let x = a + 4.2; x < b - 1; x += 4.2) {
    const t = (x - a) / (b - a),
      y = bottom(t),
      h = thickness(t);
    for (const side of [-1, 1]) {
      const edge = z + side * 1.009;
      beam(
        out,
        'concrete',
        [x, y + 0.025, edge],
        [x, y + h - 0.025, edge],
        0.038,
        0.024,
        [0.51, 0.5, 0.46],
      );
    }
  }
}

function supports(out, detail) {
  for (const x of stations.slice(1, -1)) {
    loft(out, 'stone', [pierRing(x, 0, 8, 31), pierRing(x, 3.15, 7.4, 30)], stone);
    if (detail.posts > 4)
      loft(out, 'concrete', [pierRing(x, 3.15, 7.8, 30.3), pierRing(x, 3.6, 7.8, 30.3)], pale);
    for (const z of detail.ribs) {
      box(
        out,
        'concrete',
        [x - 1.05, 3.15, z - 1.05],
        [x + 1.05, deckY(x) - 0.7, z + 1.05],
        concrete,
      );
    }
  }
  for (let i = 1; i < 7; i++) {
    for (const z of detail.ribs) arch(out, stations[i], stations[i + 1], z, detail);
  }
  for (const side of [-1, 1]) {
    const x = side * 336;
    box(out, 'concrete', [x - 3.5, -0.12, -14.5], [x + 3.5, deckY(x) - 0.6, 14.5], concrete);
  }
}

function strip(out, from, to, spacing, draw) {
  for (let x = from; x < to; x += spacing) draw(out, x, Math.min(x + spacing, to));
}

function road(out, detail) {
  strip(out, -half, half, detail.deckSpacing, (out, x, b) => {
    cell(out, 'concrete', x, b, -14.5, 14.5, -0.74, -0.12, concrete);
    if (detail.posts <= 4) {
      cell(out, 'road', x, b, -12.75, 12.75, -0.1, 0, asphalt);
    } else {
      for (const side of [-1, 1]) {
        const a = side < 0 ? -12.75 : 5.2,
          e = side < 0 ? -5.2 : 12.75;
        cell(out, 'road', x, b, a, e, -0.1, 0, asphalt);
        const p = side < 0 ? -14.5 : 12.95,
          q = side < 0 ? -12.95 : 14.5;
        cell(out, 'concrete', x, b, p, q, -0.03, 0.16, pale);
        cell(out, 'iron', x, b, side * 14.28 - 0.04, side * 14.28 + 0.04, 1.13, 1.24, paint);
        if (detail.joints) {
          const z = side * 14.28,
            y = deckY(x);
          beam(out, 'iron', [x, y + 0.15, z], [x, y + 1.2, z], 0.09, 0.09, paint);
        }
      }
    }
  });
  if (!detail.markSpacing) return;
  strip(out, -half + 1, half, detail.markSpacing, (out, x) => {
    for (const side of [-1, 1]) {
      const z = side * 8.9,
        b = Math.min(x + 3, half);
      cell(out, 'marking', x, b, z - 0.065, z + 0.065, 0.012, 0.02, mark);
    }
  });
  for (let x = -half + 8; x < half; x += detail.lampSpacing) {
    for (const side of [-1, 1]) {
      const z = side * 13.85,
        y = deckY(x) + 0.16;
      beam(out, 'iron', [x, y, z], [x, y + 7.6, z], 0.13, 0.13, paint);
      beam(out, 'iron', [x, y + 7.6, z], [x, y + 8, z - side * 2.7], 0.095, 0.1, paint);
    }
  }
}

function railway(out, detail) {
  const clippedEnd = {
    addQuad(slot, ref, points, _normal, uv, color) {
      const shaped = points.map(([x, y, z]) => {
        if (x !== railEnd) return [x, y, z];
        const edgeX = eastDeckEdgeX(z);
        return [edgeX, y + profile(edgeX) - profile(x), z];
      });
      out.addQuad(slot, ref, shaped, normalFor(...shaped.slice(0, 3)), uv, color);
    },
  };
  const deck = (target, x, b) => {
    cell(target, 'concrete', x, b, -4.7, 4.7, -0.78, 0.09, pale, profile, railCenterZ);
    if (detail.posts > 4) {
      for (const side of [-1, 1]) {
        const z = side * 4.48;
        cell(target, 'iron', x, b, z - 0.044, z + 0.044, 1.12, 1.22, paint, profile, railCenterZ);
      }
    }
  };
  strip(out, -half, half, detail.railSpacing, deck);
  const eastDeckSpans = Math.max(2, Math.ceil((railEnd - half) / detail.railSpacing));
  for (let i = 0; i < eastDeckSpans; i++) {
    const a = half + ((railEnd - half) * i) / eastDeckSpans;
    const last = i + 1 === eastDeckSpans;
    const b = last ? railEnd : half + ((railEnd - half) * (i + 1)) / eastDeckSpans;
    deck(last ? clippedEnd : out, a, b);
  }
  if (detail.posts > 4) {
    for (const track of railFit.tracks) {
      const lateral = (x) => trackZ(track, x);
      const rails = (out, a, b) => {
        for (const q of [-0.76, 0.76])
          cell(out, 'steel', a, b, q - 0.038, q + 0.038, 0.39, 0.47, steel, profile, lateral);
      };
      strip(out, -half, half, detail.railSpacing, rails);
      for (let i = 1; i < track.length; i++) {
        strip(out, track[i - 1][0], track[i][0], detail.railSpacing, rails);
      }
    }
  }
  for (let x = -half + 7.5; x < railEnd - 6; x += detail.railSupports) {
    const z = railCenterZ(x),
      y = profile(x),
      base = x < half ? deckY(x) - 0.12 : 0;
    if (!detail.posts) {
      box(out, 'concrete', [x - 0.63, base, z - 0.78], [x + 0.63, y - 0.78, z + 0.78], concrete);
      continue;
    }
    for (const side of [-1, 1]) {
      const offset = side * (x < half ? 2.8 : 3.2),
        w = x < half ? 0.46 : 0.97;
      box(
        out,
        'concrete',
        [x - w, base, z + offset - w],
        [x + w, y - 0.78, z + offset + w],
        concrete,
      );
    }
  }
  if (!detail.sleepers) return;
  for (let x = -half + 0.3; x < railEnd - 0.25; x += detail.sleepers) {
    for (const track of railFit.tracks) {
      cell(
        out,
        'concrete',
        x,
        x + 0.22,
        -1.15,
        1.15,
        0.09,
        0.27,
        [0.58, 0.59, 0.56],
        profile,
        (x) => trackZ(track, x),
      );
    }
  }
}

function build(out, detail) {
  supports(out, detail);
  road(out, detail);
  railway(out, detail);
}

export const buildSkyline = (out) =>
  build(out, {
    ribs: [-10.6, 10.6],
    ribSegments: 3,
    posts: 0,
    deckSpacing: 142,
    railSpacing: 140,
    railSupports: 135,
  });
export const buildDistrict = (out) =>
  build(out, {
    ribs: allRibs,
    ribSegments: 6,
    posts: 4,
    deckSpacing: 57,
    railSpacing: 58,
    railSupports: 55,
  });
export const buildStreet = (out) =>
  build(out, {
    ribs: allRibs,
    ribSegments: 13,
    posts: 9,
    deckSpacing: 24,
    railSpacing: 25,
    railSupports: 28,
    markSpacing: 18,
    lampSpacing: 63,
    sleepers: 9,
  });
export const buildCloseup = (out) =>
  build(out, {
    ribs: allRibs,
    ribSegments: 28,
    posts: 15,
    deckSpacing: 8.5,
    railSpacing: 8.5,
    railSupports: 9.8,
    markSpacing: 9,
    lampSpacing: 31.5,
    sleepers: 1.3,
    joints: true,
  });
