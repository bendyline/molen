import fs from 'node:fs';
import { createRequire } from 'node:module';
import { beam, normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const requireGeometry = createRequire(new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url));
const { default: earcut } = requireGeometry('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const terrain = read('terrain-grid.json');
const d = plan.dimensions;
const colors = {
  copper: [rgb('498889'), rgb('54938f'), rgb('578e90'), rgb('60979a')],
  joint: rgb('3e7174'),
  roof: rgb('c4c4bd'),
  soffit: rgb('e1dfd5'),
  fascia: rgb('dfdfd5'),
  columns: rgb('e3e4df'),
  metal: rgb('6a7374'),
  brick: rgb('969a93'),
  pavement: rgb('aaa69b'),
  glass: [rgb('647e87'), rgb('5f747c'), rgb('536f7c'), rgb('6e8992')],
  entry: rgb('3c565a'),
};
const surfaces = {
  copper: { slot: 'wall', localRef: 'palette:#f1ffff', roughness: .79, metallic: .16 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: .8, metallic: .08 },
  white: { slot: 'trim', graph: 'concrete_plain', roughness: .83, metallic: 0 },
  frame: { slot: 'door', graph: 'metal_stainless_beadblasted', roughness: .72, metallic: .28 },
  base: { slot: 'foundation', graph: 'concrete_panel', roughness: .96, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: .25, metallic: .22 },
};

function panel(out, slot, points, color) {
  const normal = normalFor(...points);
  if (points.length === 4) quad(out, slot, points, normal, color);
  else out.addConvexPolygon(slot, 'palette:#ffffff', points, normal, p => [p[0], p[1] + p[2]], color);
}

function area(ring) {
  return ring.reduce((sum, [x, z], i) => {
    const [u, v] = ring[(i + 1) % ring.length];
    return sum + x * v - u * z;
  }, 0);
}

function facingRing(ring) {
  return area(ring) > 0 ? ring : ring.toReversed();
}

function cap(out, slot, ring, y, color, hole, facing = 1) {
  const vertices = hole ? ring.concat(hole) : ring;
  const indices = earcut(vertices.flat(), hole ? [ring.length] : null, 2);
  for (let i = 0; i < indices.length; i += 3) {
    const points = indices.slice(i, i + 3).map(index => [vertices[index][0], y, vertices[index][1]]);
    panel(out, slot, normalFor(...points)[1] * facing > 0 ? points : points.toReversed(), color);
  }
}

function sideWall(out, slot, ring, base, top, color) {
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i], [u, v] = ring[(i + 1) % ring.length];
    panel(out, slot, [[u, base, v], [x, base, z], [x, top, z], [u, top, v]], color);
  }
}

function grade([x, z]) {
  const p = (x - terrain.origin[0]) / terrain.stepMeters;
  const q = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(p), j = Math.floor(q), u = p - i, v = q - j;
  const interp = row => terrain.heightsMeters[row][i] * (1 - u) + terrain.heightsMeters[row][i + 1] * u;
  return interp(j) * (1 - v) + interp(j + 1) * v - terrain.modelDatumElevationMeters;
}

function line([x, z], [u, v]) {
  const span = Math.hypot(u - x, v - z);
  const dx = (u - x) / span, dz = (v - z) / span;
  return { span, at: (f, y, offset = 0) => [x + f * (u - x) + offset * dz, y, z + f * (v - z) - offset * dx] };
}

function facadePanel(out, slot, edge, left, right, bottom, top, offset, color) {
  panel(out, slot, [edge.at(right, bottom, offset), edge.at(left, bottom, offset),
    edge.at(left, top, offset), edge.at(right, top, offset)], color);
}

function rail(out, slot, edge, left, right, y, depth, size, color) {
  beam(out, slot, edge.at(left, y, depth), edge.at(right, y, depth), size, size, color);
}

function glazing(out, edge, from, to, sill, head, lod, entrance = false) {
  const length = (to - from) * edge.span;
  const across = Math.max(1, Math.round(length / [3.9, 2.6, 1.45, 1.18][lod]));
  const high = Math.max(1, Math.round((head - sill) / [5.3, 3.7, 2.23, 1.56][lod]));
  for (let row = 0; row < high; row++) {
    const bottom = sill + (head - sill) * row / high;
    const top = sill + (head - sill) * (row + 1) / high;
    for (let bay = 0; bay < across; bay++) {
      const left = from + (to - from) * bay / across, right = from + (to - from) * (bay + 1) / across;
      facadePanel(out, 'glass', edge, left, right, bottom, top, .018,
        entrance && row === 0 ? colors.entry : colors.glass[(bay * 3 + row * 5) % colors.glass.length]);
    }
    if (lod > 0 && row < high - 1) {
      facadePanel(out, 'frame', edge, from, to, top - .033, top + .033, .044, colors.metal);
    }
  }
  if (lod === 0) return;
  const mullion = (entrance ? .049 : .035) / edge.span;
  for (let i = 1; i < across; i++) {
    const center = from + (to - from) * i / across;
    facadePanel(out, 'frame', edge, center - mullion, center + mullion, sill, head, .051, colors.metal);
  }
}

function copper(out, edge, from, to, bottom, top, lod, shade = 0) {
  if (lod < 2) {
    facadePanel(out, 'copper', edge, from, to, bottom, top, 0, colors.copper[shade]);
    return;
  }
  const rows = Math.max(1, Math.round((top - bottom) / (lod === 3 ? .47 : .96)));
  for (let row = 0; row < rows; row++) {
    const start = bottom + (top - bottom) * row / rows;
    const end = bottom + (top - bottom) * (row + 1) / rows;
    facadePanel(out, 'copper', edge, from, to, start, end, 0, colors.copper[(row * 2 + shade) % 4]);
    if (row === 0) continue;
    facadePanel(out, 'copper', edge, from, to, start - .014, start + .014, .012, colors.joint);
    if (lod === 3) {
      const panels = Math.round((to - from) * edge.span / 2.35);
      for (let i = 1; i < panels; i++) {
        const f = from + (to - from) * (i + (row % 2) * .29) / panels;
        facadePanel(out, 'copper', edge, f - .009 / edge.span, f + .009 / edge.span,
          start, end, .012, colors.joint);
      }
    }
  }
}

function plinth(out, edge, sill) {
  facadePanel(out, 'base', edge, 0, 1, d.basement, sill, 0, colors.brick);
}

function longWing(out, edge, lod, office) {
  const base = d.lowerLevel, deck = d.roofHeight - .43;
  plinth(out, edge, base + .38);
  let previous = base + .38;
  for (const [i, height] of [1.28, 4.64, 8.02, 11.4, 14.79].entries()) {
    const bottom = base + height, top = bottom + 1.63;
    copper(out, edge, 0, 1, previous, bottom, lod, office ? 2 : 0);
    glazing(out, edge, 0, 1, bottom, top, lod);
    if (office && lod >= 1) {
      const slats = lod === 1 ? 1 : 3;
      for (let j = 0; j < slats; j++) {
        rail(out, 'frame', edge, .015, .985, bottom + .45 + (.92 * j) / slats, .22, .10, colors.metal);
      }
    }
    if (office && lod > 1) {
      for (let j = 1; j <= 6; j++) {
        const center = j / 7;
        beam(out, 'frame', edge.at(center, bottom, .27), edge.at(center, top, .27), .081, .081, colors.metal);
      }
    }
    previous = top;
    if (i === 4) copper(out, edge, 0, 1, previous, deck, lod, office ? 2 : 0);
  }
}

function westElevation(out, lod) {
  const lower = d.lowerLevel, upper = d.roofHeight - .42;
  const center = d.surveyedEntrance;
  const shell = [
    [-24.8, 23.8], [-26.45, 16.3], [-27.12, 10.9], [-27.23, 5.45],
    center, [-27.82, -7.3], [-27.31, -10.75], [-25.4, -13.05], [-23.7, -14.21],
  ];
  for (let i = 1; i < shell.length; i++) {
    const edge = line(shell[i - 1], shell[i]);
    plinth(out, edge, lower);
    if (i >= 3 && i <= 5) {
      glazing(out, edge, 0, 1, lower, upper, lod, true);
      continue;
    }
    if (i >= 6) {
      glazing(out, edge, 0, 1, lower, lower + 3.28, lod);
      copper(out, edge, 0, 1, lower + 3.28, upper, lod, 2);
    } else {
      copper(out, edge, 0, 1, lower, upper, lod, 1);
    }
  }
  if (lod === 0) return shell;
  const door = line(shell[3], center);
  for (const ratio of [.19, .42, .66, .91]) {
    const face = door.at(ratio, lower + 1.11, .05);
    beam(out, 'frame', face, door.at(ratio, lower + .9, .05), .045, .045, colors.metal);
  }
  rail(out, 'frame', door, .09, .98, lower + 2.38, .052, .086, colors.metal);
  return shell;
}

function eastElevation(out, lod, east) {
  const deck = d.roofHeight - .42;
  for (let i = 1; i < east.length; i++) {
    const edge = line(east[i - 1], east[i]);
    const mid = east[i][0] * .5 + east[i - 1][0] * .5;
    const sill = d.upperLevel + (mid > 47 ? 0 : .4);
    plinth(out, edge, sill);
    glazing(out, edge, 0, 1, sill, deck, lod, mid > 47);
  }
}

function shellStudy(out, lod) {
  const west = westElevation(out, lod);
  const east = d.outline.slice(0, 17).map(([x, z]) => [x - 1.08, -6.8 + (z + 6.8) * .89]);
  eastElevation(out, lod, east.toReversed());
  longWing(out, line(west.at(-1), east.at(-1)), lod, false);
  longWing(out, line(east[0], west[0]), lod, true);
  const ring = facingRing(east.concat(west.toReversed()));
  cap(out, 'base', ring, d.basement, colors.brick, null, -1);
  cap(out, 'base', ring, d.roofHeight - .425, colors.brick);
}

function canopy(out, lod) {
  const westernEdge = [
    [-26.4, -17.72], [-32.7, -16.42], [-36.4, -12.77], [-38.2, -7],
    [-38.52, -.4], [-36.95, 6.31], [-33.01, 13.26], [-28.35, 19.58], [-20.66, 28.56],
  ];
  const ring = facingRing(d.outline.slice(0, 17).concat(westernEdge));
  const [cx, cz] = d.canopy.oculus;
  const [rx, rz] = d.canopy.oculusRadii;
  const count = [12, 20, 32, 48][lod];
  const hole = Array.from({ length: count }, (_, i) => {
    const a = 2 * Math.PI * i / count;
    return [cx + rx * Math.cos(a), cz + rz * Math.sin(a)];
  });
  const top = d.roofHeight, bottom = top - .42;
  cap(out, 'roof', ring, top, colors.roof, hole);
  cap(out, 'roof', ring, bottom, colors.soffit, hole, -1);
  sideWall(out, 'roof', ring, bottom, top, colors.fascia);
  sideWall(out, 'roof', facingRing(hole).toReversed(), bottom, top, colors.soffit);
  for (const [index, [x, z]] of d.canopy.lowerColumns.entries()) {
    const base = grade([x, z]) - .22;
    const radius = index === 0 ? .2 : .218;
    const columns = [8, 10, 14, 20][lod];
    const outline = Array.from({ length: columns }, (_, i) => {
      const a = 2 * Math.PI * i / columns;
      return [x + radius * Math.cos(a), z + radius * Math.sin(a)];
    });
    sideWall(out, 'white', outline, base, bottom, colors.columns);
    if (lod >= 1) box(out, 'base', [x - .32, base, z - .32], [x + .32, base + .48, z + .32], colors.pavement);
  }
}

function landing(out, bounds, floor) {
  const bottom = Math.min(floor - .3, ...bounds.map(grade)) - .28;
  const ring = facingRing(bounds);
  cap(out, 'base', ring, floor, colors.pavement);
  sideWall(out, 'base', ring, bottom, floor, colors.pavement);
}

function build(out, lod) {
  shellStudy(out, lod);
  canopy(out, lod);
  landing(out, [[-38.2,-12.8],[-25.3,-13],[-24.84,11],[-33.6,11.7],[-37.5,6.6]],
    d.lowerLevel -.02);
  const [x, z] = d.surveyedCampusEntrance;
  landing(out, [[x - 1.7,z - 2.4],[x + 5.2,z - 2.15],[x + 5.2,z + 2.35],[x - 1.9,z + 2.2]],
    d.upperLevel -.02);
}

export const skyline = out => build(out, 0);
export const district = out => build(out, 1);
export const street = out => build(out, 2);
export const closeup = out => build(out, 3);

const recipe = 'solvay-brussels-school-of-economics-and-management-model.mjs';
const camera = [-108, 36, 76];
const lookAt = [3, 7.8, 3];
const field = { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' };
export const solvayModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  sourceDocuments: plan.requiredSourceDocuments,
  surfaces,
  wikidataId: plan.wikidataId,
  category: 'landmark',
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-exterior',
  groundContactBasis: 'The original independent ground field supplies the separate Roosevelt and campus contact levels and individual canopy column bases.',
  brief: 'Solvay School R42 with its white cantilevered canopy and circular opening, patinated copper wings, glazed atrium and two entrances.',
  camera,
  lookAt,
  sunDirection: [-63, 39, 43],
  embeddedCanonicalGraphs: Object.values(surfaces).map(s => s.graph).filter(Boolean),
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: .9,
    basis: 'The exact mapped shape suppresses the generic R42 building only.',
  },
  mediumFiContext: { scale: 1, groundY: -.16, terrain: field },
  qaCameras: [
    { name: 'roosevelt-canopy-and-oculus', position: [-58, 8, 20], lookAt: [-28, 10, -.6] },
    { name: 'two-wings-and-atrium', position: [-63, 30, -45], lookAt: [-1, 8.3, 2.4] },
    { name: 'campus-entrance-and-office-shades', position: [75, 26, 39], lookAt: [22, 8, 6] },
    { name: 'roof-aperture-and-native-silhouette', position: [-45, 83, 40], lookAt: [5, 13, 2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map(reviewLod => ({
    name: 'solvay-r42-' + reviewLod, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline', export: 'skyline', errorMeters: 2.55, surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.12, surfaces },
      street: { export: 'street', errorMeters: .42, surfaces },
      closeup: { export: 'closeup', errorMeters: .14, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense: 'Original geographic reconstruction from facts and native ODbL 1.0 mapping. No source photos incorporated.',
};
