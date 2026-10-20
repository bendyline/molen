/** Taipei's broad swept memorial roof, south entrance dormer and open concrete colonnade. */
import './install-deterministic-math.mjs';
import nativeFrame from '../../../content/worldgen/source/places/ws/wsq/sun_yat_sen_memorial_hall_taipei/map-frame.json' with {
  type: 'json',
};
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  gray = rgb('b3b4ab'),
  underside = rgb('a7aa9b'),
  yellow = rgb('dfae42'),
  tileRib = rgb('ebbe59'),
  red = rgb('aa6656'),
  deckRed = rgb('a85b50'),
  glass = rgb('4f6465'),
  wood = rgb('8d7560'),
  floor = rgb('b8b5a7');
function facing(out, a) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
  return {
    addTriangle: (slot, r, p, n, u, col) => out.addTriangle(slot, r, p.map(v), v(n), u, col),
    addQuad: (slot, r, p, n, u, col) => out.addQuad(slot, r, p.map(v), v(n), u, col),
    addConvexPolygon: (slot, r, p, n, u, col) => {
      const q = p.map(v),
        uv = p.map(u);
      return out.addConvexPolygon(slot, r, q, v(n), (p) => uv[q.indexOf(p)], col);
    },
  };
}
function surface(out, slot, p, col, up = true) {
  let n = normalFor(...p.slice(0, 3));
  if (n[1] > 0 !== up) {
    p = [...p].reverse();
    n = normalFor(...p.slice(0, 3));
  }
  quad(out, slot, p, n, col);
}
// Curves run from the raised central deck to the broad low eave. Corner tips curl upward.
function roofPoint(u, t, front = false) {
  const edge = 51.7 * u + Math.sign(u) * 2.8 * Math.max(0, (Math.abs(u) - 0.84) / 0.16),
    corner = Math.pow(Math.max(0, (Math.abs(u) - 0.82) / 0.18), 2),
    x = 25.8 * u * (1 - t) + edge * t,
    z = 25.8 * (1 - t) + (51.7 + 2.8 * corner) * t,
    y = 14 + 15.5 * Math.pow(1 - t, 3) + 3.3 * Math.pow(Math.abs(u), 12) * Math.pow(t, 3);
  // The south roof is interrupted by a real tall entrance bay, not a second roof across its glass.
  return [front ? (u < 0 ? -17.5 + (x + 17.5) : 17.5 + (x - 17.5)) : x, y, z];
}
function patchPoint(u, t, front, side) {
  if (!front) return roofPoint(u, t);
  const a = side < 0 ? -1 : 1,
    outerU = a * (0.338491296 + 0.661508704 * u),
    innerX = a * (17.5 + 8.3 * u),
    p = roofPoint(outerU, t);
  p[0] = innerX * (1 - t) + roofPoint(outerU, 1)[0] * t;
  return p;
}
function roofPatch(out, d, front = false, side = 0) {
  const nu = [2, 4, 8, 22][d],
    nt = [3, 7, 10, 24][d],
    point = (u, t) => patchPoint(front ? u : 2 * u - 1, t, front, side);
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nt; j++) {
      const p = [
        point(i / nu, j / nt),
        point((i + 1) / nu, j / nt),
        point((i + 1) / nu, (j + 1) / nt),
        point(i / nu, (j + 1) / nt),
      ];
      surface(out, 'tile', p, yellow);
      surface(
        out,
        'concrete',
        p.map((p) => [p[0], p[1] - 0.65, p[2]]),
        underside,
        false,
      );
    }
  // Thick exposed fascia is a solid band; roof edges have visible depth from below.
  const count = Math.max(nu, d >= 2 ? 12 : d ? 4 : 2);
  for (let i = 0; i < count; i++) {
    const a = point(i / count, 1),
      b = point((i + 1) / count, 1);
    beam(out, 'concrete', a, b, 0.72, 0.84, gray);
  }
  if (d >= 2 || (d === 1 && front))
    for (const u of [0, 1])
      for (let j = 0; j < nt; j++)
        beam(out, 'concrete', point(u, j / nt), point(u, (j + 1) / nt), 0.72, 0.75, gray);
  if (d >= 2) {
    const ribs = front ? [0, 0, 13, 48][d] : [0, 0, 26, 96][d],
      steps = d === 3 ? 16 : 8;
    for (let k = 1; k < ribs; k++)
      for (let j = 0; j < steps; j++) {
        const u = k / ribs,
          du = 0.0018,
          p = [
            point(u - du, j / steps),
            point(u + du, j / steps),
            point(u + du, (j + 1) / steps),
            point(u - du, (j + 1) / steps),
          ].map((p) => [p[0], p[1] + 0.024, p[2]]);
        surface(out, 'tile', p, tileRib);
      }
  }
}
// Intersect the actual tessellated roof in local XZ so supports meet each authored distance version.
const roofSamples = new Map();
function roofHeight(x, z, d, front) {
  if (Math.abs(x) > z) return roofHeight(z, Math.abs(x), d, false);
  const key = `${d}/${front}`;
  if (!roofSamples.has(key)) {
    const triangles = [],
      nu = [2, 4, 8, 22][d],
      nt = [3, 7, 10, 24][d];
    for (const side of front ? [-1, 1] : [0])
      for (let i = 0; i < nu; i++)
        for (let j = 0; j < nt; j++) {
          const point = (u, t) => patchPoint(front ? u : 2 * u - 1, t, front, side),
            p = [
              point(i / nu, j / nt),
              point((i + 1) / nu, j / nt),
              point((i + 1) / nu, (j + 1) / nt),
              point(i / nu, (j + 1) / nt),
            ];
          triangles.push([p[3], p[2], p[1]], [p[3], p[1], p[0]]);
        }
    roofSamples.set(key, triangles);
  }
  for (const [a, b, c] of roofSamples.get(key)) {
    const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]),
      u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det,
      v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
    if (u >= -1e-7 && v >= -1e-7 && u + v <= 1.0000001)
      return u * a[1] + v * b[1] + (1 - u - v) * c[1];
  }
  throw Error(`Roof support outside silhouette:${x},${z}/${d}/${front}`);
}
function entranceRoof(out, d) {
  const nu = [2, 8, 16, 28][d],
    nt = [2, 4, 10, 16][d],
    point = (u, t) => [
      17.5 * u,
      29.5 - 2.7 * t + 3.6 * Math.pow(Math.abs(u), 8) * t,
      25.8 + 32.5 * t,
    ];
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nt; j++) {
      const a = -1 + (2 * i) / nu,
        b = -1 + (2 * (i + 1)) / nu,
        p = [point(a, j / nt), point(b, j / nt), point(b, (j + 1) / nt), point(a, (j + 1) / nt)];
      surface(out, 'tile', p, yellow);
      surface(
        out,
        'concrete',
        p.map((p) => [p[0], p[1] - 0.75, p[2]]),
        underside,
        false,
      );
    }
  for (let i = 0; i < Math.max(nu, d ? 4 : 2); i++) {
    const n = Math.max(nu, d ? 4 : 2);
    beam(
      out,
      'concrete',
      point(-1 + (2 * i) / n, 1),
      point(-1 + (2 * (i + 1)) / n, 1),
      1.0,
      0.95,
      gray,
    );
  }
  for (const u of [-1, 1])
    for (let j = 0; j < nt; j++)
      beam(out, 'concrete', point(u, j / nt), point(u, (j + 1) / nt), 0.9, 0.9, gray);
  if (d >= 2)
    for (let i = -12; i <= 12; i++)
      for (let j = 0; j < nt; j++) {
        const u = i / 13,
          p = [
            point(u - 0.002, j / nt),
            point(u + 0.002, j / nt),
            point(u + 0.002, (j + 1) / nt),
            point(u - 0.002, (j + 1) / nt),
          ].map((p) => [p[0], p[1] + 0.025, p[2]]);
        surface(out, 'tile', p, tileRib);
      }
}
function column(out, x, z, top, d, square = false) {
  if (square) B(out, 'concrete', x, 1.5, z, 1.3, top - 1.5, 1.3, gray);
  else
    loft(
      out,
      'concrete',
      [
        radialRing(1.5, 0.68, 0.68, [3, 6, 12, 20][d], [x, z]),
        radialRing(top, 0.64, 0.64, [3, 6, 12, 20][d], [x, z]),
      ],
      gray,
      { cap: d > 0 },
    );
  if (d >= 2) B(out, 'concrete', x, top - 0.35, z, 1.5, 0.4, 1.5, gray);
}
function glazing(out, x, y, z, w, h, d) {
  const plane = (slot, x0, y0, zz, ww, hh, col) =>
    quad(
      out,
      slot,
      [
        [x0 - ww / 2, y0, zz],
        [x0 + ww / 2, y0, zz],
        [x0 + ww / 2, y0 + hh, zz],
        [x0 - ww / 2, y0 + hh, zz],
      ],
      [0, 0, 1],
      col,
    );
  plane('glass', x, y, z, w, h, glass);
  if (d >= 2) {
    const n = Math.max(1, Math.round(w / (d === 3 ? 1.1 : 2.2)));
    for (let i = 0; i <= n; i++) plane('wood', x - w / 2 + (w * i) / n, y, z + 0.08, 0.08, h, wood);
    for (let yy = y + (d === 3 ? 1.2 : 2.4); yy < y + h; yy += d === 3 ? 1.2 : 2.4)
      plane('wood', x, yy, z + 0.08, w, 0.065, wood);
  }
}
export function sunYatSenMemorialHallTaipei(out, _frame, d = 3) {
  // Architectural terrace and its own stairs, independent of the frozen ground field.
  B(out, 'concrete', 0, -0.4, 0, 109.8, 1.9, 110, floor);
  for (const [angle, width] of [
    [0, 32],
    [Math.PI, 24],
    [Math.PI / 2, 24],
    [-Math.PI / 2, 24],
  ]) {
    const o = facing(out, angle);
    for (let i = 0; i < (d ? 8 : 1); i++) {
      const n = d ? 8 : 1,
        h = (1.5 * (n - i)) / n;
      B(o, 'concrete', 0, -0.25, 55 + ((i + 0.5) * 3.6) / n, width, h + 0.25, 3.6 / n, floor);
    }
  }
  // Recess the real red walls behind the walkable perimeter colonnade.
  B(out, 'brick', 0, 1.5, 0, 84, 12.0, 84, red);
  // Central raised hall/roof deck, with a projecting high south entrance.
  B(out, 'brick', 0, 13.5, 0, 51.2, 15.3, 51.2, red);
  B(out, 'deck', 0, 28.8, 0, 51.6, 0.7, 51.6, deckRed);
  B(out, 'concrete', 0, 1.5, 48.0, 28.3, 24.4, 13.0, gray);
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2,
      o = facing(out, a);
    if (side === 0) {
      roofPatch(o, d, true, -1);
      roofPatch(o, d, true, 1);
    } else roofPatch(o, d);
    for (let i = 0; i < 14; i++) {
      const x = -47.5 + (95 * i) / 13;
      if (side === 0 && Math.abs(x) < 17.5) continue;
      if ((side > 0 && i === 0) || (side === 3 && i === 13)) continue;
      const top = roofHeight(x, 47.5, d, side === 0) - 0.65;
      column(o, x, 47.5, top, d);
      if (d) {
        const segments = d === 3 ? 4 : d === 2 ? 2 : 1;
        for (let k = 0; k < segments; k++) {
          const z0 = 41.7 + (10 * k) / segments,
            z1 = 41.7 + (10 * (k + 1)) / segments;
          beam(
            o,
            'concrete',
            [x, roofHeight(x, z0, d, side === 0) - 1.05, z0],
            [x, roofHeight(x, z1, d, side === 0) - 1.05, z1],
            0.65,
            0.7,
            underside,
          );
        }
        if (d >= 2) for (const y of [4.3, 8.3]) B(o, 'concrete', x, y, 41.95, 1.0, 0.2, 1.1, gray);
      }
    }
    B(o, 'concrete', 0, 13.15, 48.2, 96, 0.6, 0.7, gray);
    if (d) B(o, 'concrete', 0, 12.6, 41.6, 84, 0.65, 0.7, underside);
    for (let i = 0; i < 14; i++) {
      const x = -39 + (78 * i) / 13;
      if (side === 0 && Math.abs(x) < 16) continue;
      glazing(o, x, 3.3, 42.08, 2.1, 7.7, d);
      if (d >= 2)
        for (const xx of [-1.35, 1.35]) B(o, 'concrete', x + xx, 1.5, 42.3, 0.25, 11.4, 0.45, gray);
    }
    // Inner high parapet follows the flat red deck, with slightly upturned corners.
    B(o, 'concrete', 0, 29.4, 25.8, 51.9, 0.48, 0.65, gray);
    if (d) for (const x of [-25.65, 25.65]) B(o, 'concrete', x, 29.4, 25.8, 0.7, 1.0, 0.8, gray);
    if (d >= 2)
      for (let j = 0; j < 13; j++) {
        const z = 42.3 + j * 0.68;
        B(o, 'concrete', 0, 12.8, z, 95, 0.16, 0.17, underside);
      }
  }
  entranceRoof(out, d);
  // Tall four-column front, recess-backed glazing; no solid wall in the peripheral walkway.
  for (const x of [-12.8, -4.25, 4.25, 12.8]) {
    column(
      out,
      x,
      55.0,
      29.5 -
        2.7 * ((55 - 25.8) / 32.5) +
        3.6 * Math.pow(Math.abs(x / 17.5), 8) * ((55 - 25.8) / 32.5) -
        0.75,
      d,
      true,
    );
    if (d) beam(out, 'concrete', [x, 25.8, 42.0], [x, 25.8, 58.1], 0.8, 0.9, gray);
  }
  glazing(out, 0, 2.0, 54.6, 25.5, 23.2, d);
  B(out, 'concrete', 0, 25.8, 55, 28.6, 0.65, 0.8, gray);
  if (d) {
    for (const x of [-8.5, 0, 8.5]) B(out, 'concrete', x, 1.5, 55, 0.5, 24.1, 0.65, gray);
    for (const x of [-11, -6.6, -2.2, 2.2, 6.6, 11]) glazing(out, x, 1.5, 54.73, 3.9, 3.1, d);
  }
  if (d === 3) {
    // Red flat roof joint grid. Subtle strips, not image pixels or painted lighting.
    for (let x = -25; x <= 25; x += 1.25) B(out, 'deck', x, 29.502, 0, 0.035, 0.012, 50.8, red);
    for (let z = -25; z <= 25; z += 1.25) B(out, 'deck', 0, 29.502, z, 50.8, 0.012, 0.035, red);
  }
}
export const sunYatSenMemorialHallTaipeiSkyline = (o) => sunYatSenMemorialHallTaipei(o, null, 0);
export const sunYatSenMemorialHallTaipeiDistrict = (o) => sunYatSenMemorialHallTaipei(o, null, 1);
export const sunYatSenMemorialHallTaipeiStreet = (o) => sunYatSenMemorialHallTaipei(o, null, 2);
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_glazed', roughness: 0.49, metallic: 0 },
  deck: { slot: 'roof', graph: 'tile_flat', roughness: 0.92, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.32, metallic: 0.1 },
};
export const sunYatSenMemorialHallTaipeiModel = {
  id: 'sun_yat_sen_memorial_hall_taipei',
  key: 'sun_yat_sen_memorial_hall_taipei',
  recipe: 'structure-sun-yat-sen-memorial-hall-taipei.mjs',
  cell: 'ws/wsq',
  title: 'Sun Yat-sen Memorial Hall, Taipei',
  build: sunYatSenMemorialHallTaipei,
  surfaces,
  brief:
    'Broad modern Chinese memorial hall: flat red central roof deck, four concave yellow glazed slopes, upcurled gray-edged corners, tall projecting south entrance dormer with gridded glazing, gray round perimeter columns, real recessed red walls and open colonnade, own masonry terrace and stairs. Park, fountain, gate piers, statues, trees, auditorium/interior and temporary construction excluded.',
  camera: [130, 98, 155],
  lookAt: [0, 12, 0],
  portableGroundY: -0.41,
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline: nativeFrame.geometry.outline,
    basis:
      'Native main-building eaves polygon only, fully covered by independently authored continuous masonry terrace, hall and south entrance stairs in inspected official front/aerial. Original coarse source heights locally exceed the own terrace floor near the closed hall; remove covered terrain triangles under this architectural volume, preserving all source heights and original relief beyond the native perimeter. No park/fountain/plaza cutout, terrain flattening or fitted foundation. Floor and terrace dimensions preceded contact checks.',
  },
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Native signed eaves/parts and south orientation frozen before geometry. External dry forecourt[-25,64] datum7.9795m in retained published third-party NLSC-claimed2024 20mDTM derivative; no flattening or foundation fitting. Own terrace/steps are architectural estimates from official front/aerial. Original official raster and private conversion unavailable;17.3m pixels interpolated at1m, not survey accuracy. Source-relative bounded preview only.',
  qaCameras: [
    { name: 'south-front', position: [0, 36, 165], lookAt: [0, 15, 15] },
    { name: 'whole-roof', position: [-115, 145, 125], lookAt: [0, 16, 0] },
    { name: 'curled-corner', position: [72, 24, 75], lookAt: [44, 15, 43] },
    { name: 'open-west-colonnade', position: [-49, 5, 25], lookAt: [-48, 7, -25] },
    { name: 'north-return', position: [-100, 36, -108], lookAt: [0, 13, -20] },
    { name: 'entrance-grid', position: [20, 13, 86], lookAt: [0, 15, 54] },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-sun-yat-sen-memorial-hall-taipei.mjs',
    level: 'skyline',
    export: 'sunYatSenMemorialHallTaipeiSkyline',
    errorMeters: 3.0,
    surfaces,
    authoredLevels: {
      district: { export: 'sunYatSenMemorialHallTaipeiDistrict', errorMeters: 2.0, surfaces },
      street: { export: 'sunYatSenMemorialHallTaipeiStreet', errorMeters: 1.1, surfaces },
    },
  },
  limitations: [
    'Dated surviving exterior interpreted from inspected local originals and official illustrated front/aerial. No claim to represent temporary construction or current site access.',
    'Official100m square and30.4mheight are approximate controls; quantized native curled eaves span about109m. Roof curves/tiles, column proportions, terrace/stairs and unseen returns are photographic estimates, not survey/photogrammetry.',
    'Open outer colonnade only; auditorium, memorial statue, indoor galleries, signage, parks, fountain, trees and gate piers excluded.',
    'Ground is a retained public third-party Terrarium reencoding attributed by publisher to2024NLSC20mDTM. Original official raster/private conversion pipeline unavailable. One-metre review interpolation is not one-metre accuracy. Native main footprint clips only covered ground beneath own masonry hall/terrace/entrance; source heights and exterior ground unchanged. Isolated portable stage reviews geometry; actual source-field medium-fi fixture reviews bounded contact. Another DEM requires independent review.',
    'No photographic pixels redistributed; portable fallback and five shared architectural surfaces use authored geometry and local glazing.',
  ],
};
