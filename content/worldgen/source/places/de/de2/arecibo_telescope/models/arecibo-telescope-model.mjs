/** Arecibo's fixed primary reflector and cable-supported telescope in its 2006 configuration. */
import { readFileSync } from 'node:fs';
import {
  beam,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const { towerBlocks } = read('mapped-tower-controls');
const dimensions = plan.dimensions;
const diameter = dimensions.diameter;
const radius = diameter / 2;
const sphereRadius = dimensions.curvatureRadius;
const datum = terrain.modelDatumElevationMeters;
const sphereTop = dimensions.centerOfCurvatureElevation - datum;
const platformY = dimensions.platformElevationFeet * 0.3048 - datum;
const towerY = dimensions.towerCableElevationFeet * 0.3048 - datum;
const tau = Math.PI * 2;
const surfaces = {
  reflector: {
    slot: 'roof',
    graph: 'metal_stainless_beadblasted',
    roughness: 0.76,
    metalness: 0.32,
  },
  wire: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.83, metalness: 0.22 },
  chamber: { slot: 'wall', graph: 'metal_painted', roughness: 0.79, metalness: 0.15 },
  concrete: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.93 },
  equipment: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.9 },
};
const tints = Object.fromEntries(
  Object.entries({
    aluminum: 'b5b8ad',
    medium: 'b0b4aa',
    bright: 'bcc1b6',
    darkMetal: '7d857b',
    steel: 'a7aea3',
    paleSteel: 'bfc5b8',
    screen: '888f83',
    frame: '7b837a',
    shadow: '5e665f',
    dome: 'b7bcb0',
    domeShade: 'a8ada1',
    concrete: 'a5a095',
    footing: '918c7e',
    machine: '7e8376',
    weathered: '959187',
    post: '82887e',
  }).map(([key, hex]) => [key, rgb(hex)]),
);

const blend = (a, b, t) => a.map((p, i) => p + (b[i] - p) * t);
const world = ([x, z], y) => [x, y, z];
const scaled = ([x, z], r) => [x * r, z * r];
const circle = (r, n) =>
  Array.from({ length: n }, (_, i) => [r * Math.cos((tau * i) / n), r * Math.sin((tau * i) / n)]);
const radiusOf = (x, z) => Math.hypot(x, z);
const dishY = (r) => sphereTop - Math.sqrt(sphereRadius * sphereRadius - r * r);
const rimY = dishY(radius);

function sampleGround(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const row = terrain.heightsMeters[j],
    next = terrain.heightsMeters[j + 1];
  const a = u - i,
    b = v - j;
  return (
    (row[i] * (1 - a) + row[i + 1] * a) * (1 - b) +
    (next[i] * (1 - a) + next[i + 1] * a) * b -
    datum
  );
}

function dishVertex(p) {
  return world(p, dishY(radiusOf(...p)));
}

function reflectorTint(x, z) {
  const v = (x * 31 + z * 23) % 29;
  return v === 0 || v === 3 ? tints.bright : v === 7 || v === 1 ? tints.medium : tints.aluminum;
}

function reflectorRadial(out, n, bands) {
  let previous = circle(radius / bands, n).map(dishVertex);
  for (let i = 0; i < n; i++)
    triangle(
      out,
      'reflector',
      [[0, dishY(0), 0], previous[(i + 1) % n], previous[i]],
      tints.aluminum,
    );
  for (let k = 2; k <= bands; k++) {
    const next = circle((radius * k) / bands, n).map(dishVertex);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      face(out, 'reflector', [previous[j], next[j], next[i], previous[i]], reflectorTint(i, k));
    }
    previous = next;
  }
}

function clip(ring, a, b) {
  const side = ([x, z]) => (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]);
  const result = [];
  for (let i = 0; i < ring.length; i++) {
    const first = ring[i],
      second = ring[(i + 1) % ring.length];
    const u = side(first),
      v = side(second);
    if (u >= 0) result.push(first);
    if ((u < 0 && v > 0) || (u > 0 && v < 0)) result.push(blend(first, second, u / (u - v)));
  }
  return result;
}

function reflectorPanels(out, lod) {
  const rim = circle(radius, 96);
  const width = lod === 2 ? 8.45 : 2.95,
    depth = lod === 2 ? 6.65 : 1.6;
  const rows = Math.ceil(diameter / depth),
    cols = Math.ceil(diameter / width);
  for (let row = 0; row < rows; row++) {
    const z0 = row * depth - radius,
      z1 = Math.min(radius, z0 + depth);
    for (let col = 0; col < cols; col++) {
      const x0 = col * width - radius,
        x1 = Math.min(radius, x0 + width);
      const nearestX = Math.max(x0, 0, -x1),
        nearestZ = Math.max(z0, 0, -z1);
      if (radiusOf(nearestX, nearestZ) >= radius) continue;
      let tile = [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ];
      if (tile.some((p) => radiusOf(...p) > radius - 0.085)) {
        for (let i = 0; i < rim.length && tile.length >= 3; i++)
          tile = clip(tile, rim[i], rim[(i + 1) % rim.length]);
      }
      if (tile.length < 3) continue;
      const v = tile.map(dishVertex),
        tint = reflectorTint(col, row);
      for (let i = 1; i < v.length - 1; i++) {
        const ux = v[i][0] - v[0][0],
          uz = v[i][2] - v[0][2],
          vx = v[i + 1][0] - v[0][0],
          vz = v[i + 1][2] - v[0][2];
        if (Math.abs(ux * vz - uz * vx) > 0.000001)
          triangle(out, 'reflector', [v[0], v[i + 1], v[i]], tint);
      }
    }
  }
}

function reflectorsSupport(out, lod) {
  const n = [22, 34, 64, 96][lod];
  const rim = circle(radius, n),
    screenTop = circle(radius + 2, n);
  const bottom = rim.map((p) => world(p, rimY - 0.72));
  const top = screenTop.map((p) => world(p, rimY + dimensions.groundScreenHeight));
  const grade = rim.map((p) => world(p, Math.min(rimY - 1.55, sampleGround(...p) - 0.95)));
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const tint = i % 7 === 2 ? tints.frame : tints.screen;
    face(out, 'chamber', [bottom[j], bottom[i], top[i], top[j]], tint);
    if (lod >= 2) face(out, 'chamber', [bottom[i], bottom[j], top[j], top[i]], tint);
    face(out, 'concrete', [grade[j], grade[i], bottom[i], bottom[j]], tints.footing);
    if (lod >= 2) face(out, 'concrete', [grade[i], grade[j], bottom[j], bottom[i]], tints.footing);
    if (lod >= 1) {
      beam(out, 'wire', top[i], top[j], 0.34, 0.3, tints.steel);
      if (lod >= 2) {
        const middle = (k) => blend(bottom[k], top[k], 0.55);
        beam(out, 'wire', bottom[i], top[i], 0.23, 0.29, tints.steel);
        beam(out, 'wire', middle(i), middle(j), 0.19, 0.29, tints.frame);
      }
    }
  }
  if (lod >= 2) {
    for (const r of [25, 50, 75, 100, 125, 145]) {
      for (const p of circle(r, Math.max(8, Math.round(r / 6)))) {
        const y = sampleGround(...p);
        const high = dishY(r) - 0.17;
        if (high > y + 0.45)
          beam(out, 'wire', world(p, y - 0.4), world(p, high), 0.27, 0.27, tints.frame);
      }
    }
  }
}

function cap(out, ring, y, slot, tint, down = false) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((index) => world(ring[index], y));
    triangle(out, slot, down ? [a, b, c] : [a, c, b], tint);
  }
}

function solid(out, outline, low, high, tint, upper = outline) {
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    face(
      out,
      'concrete',
      [
        world(outline[j], low),
        world(outline[i], low),
        world(upper[i], high),
        world(upper[j], high),
      ],
      tint,
    );
  }
  cap(out, upper, high, 'concrete', tint);
  cap(out, outline, low, 'concrete', tint, true);
}

function tower(out, control, lod) {
  const { base, center, anchorBlock, anchorCenter } = control;
  const orient = (outline) =>
    outline.reduce(
      (s, p, i) =>
        s +
        p[0] * outline[(i + 1) % outline.length][1] -
        p[1] * outline[(i + 1) % outline.length][0],
      0,
    ) > 0
      ? outline
      : [...outline].reverse();
  const bottom = orient(base),
    anchor = orient(anchorBlock);
  const low = Math.min(...bottom.map((p) => sampleGround(...p))) - 1.7;
  const baseTop = Math.max(...bottom.map((p) => sampleGround(...p))) + 1.34;
  solid(out, bottom, low, baseTop, tints.footing);
  const d = radiusOf(...center);
  const u = scaled(center, 1 / d),
    v = [-u[1], u[0]];
  const rect = (radial, tangent, offset = 0) =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([a, b]) => center.map((p, i) => p + u[i] * (a * radial + offset) + v[i] * b * tangent));
  const shaft = rect(2.5, 4.35);
  const shoulder = rect(2.05, 3.7, -0.82);
  solid(out, shaft, baseTop - 0.06, towerY - 3.4, tints.concrete, shoulder);
  solid(out, rect(2.75, 4.6, -0.82), towerY - 3.35, towerY + 0.63, tints.weathered);
  if (lod >= 2) {
    const h = towerY - baseTop;
    for (let k = 8; k < h - 4; k += 6.7) {
      const c = rect(2.54, 4.37, (-0.8 * k) / h);
      const tint = k % 5 < 3 ? tints.weathered : tints.concrete;
      for (let j = 0; j < c.length; j++) {
        const q = (j + 1) % c.length;
        face(
          out,
          'concrete',
          [
            world(c[q], baseTop + k),
            world(c[j], baseTop + k),
            world(c[j], baseTop + k + 0.09),
            world(c[q], baseTop + k + 0.09),
          ],
          tint,
        );
      }
    }
  }
  const anchorY = sampleGround(...anchorCenter) + 1.85;
  solid(
    out,
    anchor,
    Math.min(...anchor.map((p) => sampleGround(...p))) - 1.6,
    anchorY,
    tints.footing,
  );
  return {
    top: world(
      center.map((p, i) => p - u[i] * 0.82),
      towerY,
    ),
    anchor: world(anchorCenter, anchorY),
    u,
    v,
  };
}

function cable(out, a, b, sag, width, segments, tint = tints.shadow) {
  let prev = a;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const p = blend(a, b, t);
    p[1] -= 4 * sag * t * (1 - t);
    beam(out, 'wire', prev, p, width, width, tint);
    prev = p;
  }
}

function truss(out, a, b, height, width, lod, panels) {
  const axis = b.map((p, i) => p - a[i]);
  const len = radiusOf(axis[0], axis[2]);
  const perpendicular = [-axis[2] / len, 0, axis[0] / len];
  if (lod === 0) {
    beam(out, 'wire', a, b, width, Math.max(0.7, height * 0.23), tints.steel);
    return;
  }
  const at = (t, side, level) => {
    const p = blend(a, b, t);
    return p.map(
      (q, i) => q + (side * width * perpendicular[i]) / 2 + (i === 1 ? level * height : 0),
    );
  };
  for (const side of [-1, 1]) {
    for (const level of [0, 1])
      beam(out, 'wire', at(0, side, level), at(1, side, level), 0.5, 0.58, tints.paleSteel);
    for (let i = 0; i < panels; i++) {
      const lo = i / panels,
        hi = (i + 1) / panels;
      beam(out, 'wire', at(lo, side, 0), at(hi, side, 1), 0.34, 0.42, tints.steel);
      if (lod >= 2) {
        beam(out, 'wire', at(lo, side, 0), at(lo, side, 1), 0.38, 0.42, tints.steel);
        if (i % 2 === 1)
          beam(out, 'wire', at(lo, side, 1), at(hi, side, 0), 0.24, 0.34, tints.frame);
      }
    }
  }
}

function cableSuspension(out, lod) {
  const vertices = towerBlocks.map(({ center }) => scaled(center, 38.1 / radiusOf(...center)));
  const lower = vertices.map((p) => world(p, platformY - 5.6));
  for (let i = 0; i < 3; i++) {
    const { top, anchor, u, v } = tower(out, towerBlocks[i], lod);
    truss(out, lower[i], lower[(i + 1) % 3], 13, 3.3, lod, lod === 1 ? 4 : 11);
    const shift = (p, t) => [p[0] + v[0] * t, p[1], p[2] + v[1] * t];
    const bundle = lod === 0 ? [0] : lod === 1 ? [-2, 0, 2] : [-3.3, -0.57, -0.19, 0.19, 0.57, 3.3];
    const backstay =
      lod === 0 ? [0] : lod === 1 ? [-2.5, 0, 2.5] : [-4, -1.1, -0.55, 0, 0.55, 1.1, 4];
    for (const pos of bundle) {
      const end = world(vertices[i], platformY + 0.45);
      cable(
        out,
        shift(top, pos),
        shift(end, pos * 0.92),
        4.2,
        lod === 0 ? 0.61 : lod === 1 ? 0.31 : 0.102,
        [1, 2, 5, 8][lod],
      );
    }
    for (const pos of backstay)
      cable(
        out,
        shift(top, pos),
        shift(anchor, pos * 1.08),
        2.7,
        lod === 0 ? 0.62 : lod === 1 ? 0.3 : 0.11,
        [1, 2, 4, 7][lod],
      );
    if (lod >= 1) {
      const tiedown = world(scaled(u, 20.8), platformY - 5.55);
      const floor = world(scaled(u, 20.8), dishY(20.8) + 0.29);
      cable(out, tiedown, floor, 0, lod === 1 ? 0.15 : 0.09, 1);
      const center = [0, platformY - 5.6, 0];
      truss(out, lower[i], center, 3.9, 1.4, lod, lod === 1 ? 3 : 9);
    }
  }
}

function track(out, lod) {
  const frameY = platformY - 9.5,
    r = 24;
  const ring = circle(r, [13, 24, 48, 64][lod]);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    beam(
      out,
      'wire',
      world(ring[i], frameY),
      world(ring[j], frameY),
      lod === 0 ? 1.4 : 1.2,
      lod === 0 ? 1.2 : 0.64,
      tints.paleSteel,
    );
    if (lod >= 1) {
      const at = (p, y) => world(scaled(p, 0.925), y);
      beam(
        out,
        'wire',
        at(ring[i], frameY + 0.65),
        at(ring[j], frameY + 0.65),
        0.46,
        0.3,
        tints.frame,
      );
      if (lod >= 2 && i % 2 === 0)
        beam(
          out,
          'wire',
          world(ring[i], frameY),
          at(ring[j], frameY + 3.6),
          0.28,
          0.28,
          tints.steel,
        );
    }
  }
  const local = transform(out, -0.48, [0, frameY, 0]);
  const span = dimensions.azimuthArmLength / 2;
  const intervals = [4, 7, 14, 20][lod];
  const camber = (x) => -12 + (12 * x * x) / (span * span);
  for (let i = 0; i < intervals; i++) {
    const x0 = (2 * span * i) / intervals - span,
      x1 = (2 * span * (i + 1)) / intervals - span;
    truss(local, [x0, camber(x0), 0], [x1, camber(x1), 0], lod === 0 ? 2.3 : 5.2, 3.4, lod, 1);
  }
  if (lod >= 1) {
    for (const x of [-22, 22])
      for (const z of [-3.5, 3.5])
        beam(local, 'wire', [x, camber(x) + 4, z / 2], [x, 0, z], 0.38, 0.42, tints.paleSteel);
    box(local, 'equipment', [37, camber(40) + 2.7, -2.8], [43, camber(40) + 6.2, 3], tints.machine);
    beam(local, 'wire', [19, camber(19) + 2.7, 0], [19, -25.5, 0], 0.36, 0.33, tints.steel);
    box(local, 'equipment', [17.8, -16.7, -1.2], [20.2, -11.7, 1.2], tints.machine);
  }
  return { local, camber };
}

function gregorian(out, lod) {
  const { local, camber } = track(out, lod);
  const x = -11.6;
  const body = transform(local, 0, [x, camber(x) - 1.6, 0]);
  const profile = [
    [-19, 8.45],
    [-17.0, 10.04],
    [-13.1, 11],
    [-8.3, 10.75],
    [-4.4, 8.1],
    [-1.0, 5.9],
    [0.4, 3.7],
  ];
  const n = [10, 16, 24, 36][lod];
  const rings = profile.map(([y, r], row) =>
    radialRing(y, r, r * 0.94, n, [0, 0], row % 2 === 0 ? 0 : Math.PI / n),
  );
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      const p = [rings[j][i], rings[j][k], rings[j + 1][k], rings[j + 1][i]];
      triangle(
        body,
        'chamber',
        [p[0], p[1], p[2]],
        (i + j) % 9 === 2 ? tints.domeShade : tints.dome,
      );
      triangle(body, 'chamber', [p[0], p[2], p[3]], tints.dome);
      if (lod === 3 && i % 2 === 0) {
        beam(body, 'wire', p[0], p[2], 0.105, 0.105, tints.frame);
        beam(body, 'wire', p[1], p[2], 0.115, 0.115, tints.frame);
      }
    }
  }
  for (const [ring, flip] of [
    [rings[0], false],
    [rings.at(-1), true],
  ]) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const y = ring[i][1];
      triangle(
        body,
        'chamber',
        [[0, y, 0], ring[flip ? i : j], ring[flip ? j : i]],
        tints.domeShade,
      );
    }
  }
}

function build(out, lod) {
  if (lod < 2) reflectorRadial(out, [22, 34][lod], [3, 6][lod]);
  else reflectorPanels(out, lod);
  reflectorsSupport(out, lod);
  cableSuspension(out, lod);
  gregorian(out, lod);
}

export const areciboSkyline = (out) => build(out, 0);
export const areciboDistrict = (out) => build(out, 1);
export const areciboStreet = (out) => build(out, 2);
export const areciboCloseup = (out) => build(out, 3);
const recipe = 'arecibo-telescope-model.mjs';
const camera = [373, 311, 437],
  lookAt = [0, 95, -8];
const groundOpening = circle(radius - 1.1, 48);
export const areciboTelescopeModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  category: 'landmark',
  build: areciboCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.geometryBasis,
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  groundCutout: {
    outline: groundOpening,
    basis:
      'A visibility mask follows the original reflector rim in the dated viewer. It keeps coarse terrain from occluding the historical dish and leaves all sampled elevations unchanged.',
  },
  buildingCutout: {
    outline: groundOpening,
    outlines: [groundOpening, ...towerBlocks.flatMap((t) => [t.base, t.anchorBlock])],
    minimumCoverage: 0.76,
    basis:
      'Only the historical reflector and its surviving mapped concrete footings and backstay anchorages.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Arecibo’s 305 m spherical reflector as it appeared in 2006, with three concrete towers, its steel suspension platform, curved arm and Gregorian dome.',
  camera,
  lookAt,
  sunDirection: [-43, 62, 58],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.98,
    cameraYaw: 0.3,
    focus: { center: [0, 75, 0] },
    groundY: 0,
    far: 4500,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'reflector-and-suspended-platform', position: [235, 178, 236], lookAt: [0, 66, 0] },
    {
      name: 'gregorian-receiver-and-azimuth-track',
      position: [91, 127, 82],
      lookAt: [0, platformY - 11, 0],
    },
    { name: 'tower-four-and-backstay', position: [314, 135, 203], lookAt: [175, 139, 113] },
    { name: 'whole-dish-and-three-towers', position: [401, 438, -375], lookAt: [0, 79, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'dish-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'areciboSkyline',
    errorMeters: 6.1,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'areciboDistrict', 2.6],
        ['street', 'areciboStreet', 0.75],
        ['closeup', 'areciboCloseup', 0.13],
      ].map(([key, name, errorMeters]) => [key, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceLicense:
    'Original model informed by the public-domain Alessandro Cai exterior already published on Qualla. Mapped remains are OpenStreetMap data under ODbL 1.0.',
  limitations: plan.limitations,
};
