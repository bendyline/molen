import { readFileSync } from 'node:fs';
import {
  areaSign,
  at,
  block,
  closed,
  edge,
  face,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  plane,
  stairs,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const surfaces = {
  plinth: surface('foundation', 'concrete_plain', 0.97),
  masonry: surface('wall', 'stone_sandstone', 0.89),
  brick: surface('wall', 'brick', 0.88),
  roof: surface('roof', 'metal_corrugated', 0.7, 0.28),
  trim: surface('trim', 'metal_painted', 0.68, 0.13),
  glass: surface('window', 'window_grid', 0.48, 0.1),
};
const colors = palette({
  plinth: 'aaa093',
  sandstone: 'd7bca0',
  brick: 'aa7967',
  court: 'c4aa92',
  white: 'dbd8c8',
  brightRoof: 'bebbb0',
  shadeRoof: 'a5a69e',
  zinc: 'b0aaa0',
  gutter: '888a80',
  frame: '657c7c',
  recess: '445355',
  glass: '729096',
  blue: '285e76',
  emergency: 'a65e4f',
  yellow: 'd9bd6e',
});

function buildingEnvelope(out, lod, rings, height, grade) {
  let base = 0;
  const indices = [];
  for (const ring of rings) {
    if (base) indices.push(base);
    base += ring.length;
  }
  const vertices = rings.flat();
  const triangles = earcut(vertices.flat(), indices);
  for (let i = 0; i < triangles.length; i += 3) {
    const points = triangles.slice(i, i + 3).map((index) => vertices[index]);
    face(
      out,
      'roof',
      points.map((point) => at(point, height)),
      up,
      colors.shadeRoof,
    );
  }
  for (const [i, ring] of rings.entries()) {
    const courtyard = i > 0;
    const sign = areaSign(ring) * (courtyard ? -1 : 1);
    for (const [a, b] of pairs(closed(ring))) {
      const wall = edge(a, b, sign);
      const gradeA = grade(a);
      const gradeB = grade(b);
      const sillA = Math.min(height - 1.65, Math.max(0.46, gradeA + 0.5));
      const sillB = Math.min(height - 1.65, Math.max(0.46, gradeB + 0.5));
      const skin = !courtyard && wall.normal[2] > 0.72 ? 'brick' : 'masonry';
      const tint = courtyard ? colors.court : skin === 'brick' ? colors.brick : colors.sandstone;
      if (!lod) {
        face(
          out,
          skin,
          [at(a, gradeA - 1.2), at(b, gradeB - 1.2), at(b, height), at(a, height)],
          wall.normal,
          tint,
        );
        continue;
      }
      face(
        out,
        'plinth',
        [
          at(a, Math.min(gradeA - 1.2, sillA - 0.4)),
          at(b, Math.min(gradeB - 1.2, sillB - 0.4)),
          at(b, sillB),
          at(a, sillA),
        ],
        wall.normal,
        colors.plinth,
      );
      face(
        out,
        skin,
        [at(a, sillA), at(b, sillB), at(b, height - 0.14), at(a, height - 0.14)],
        wall.normal,
        tint,
      );
      panel(out, 'trim', wall, 0, wall.length, height - 0.14, height, 0, colors.gutter);
      if (wall.length < 4.1) continue;
      const bays = Math.max(1, Math.floor(wall.length / (courtyard ? 4.3 : 3.9)));
      const step = wall.length / bays;
      for (let j = 0; j < bays; j++) {
        const center = (j + 0.5) * step;
        const [x, , z] = wall.p(center, 0);
        if (
          !courtyard &&
          ((x > 3.5 && x < 15.2 && z > 35) || (x > 6.9 && x < 20.4 && z < -40.8 && z > -42))
        )
          continue;
        const lower = Math.min(height - 1.35, Math.max(1.1, grade([x, z]) + 0.96));
        const top = Math.min(height - 0.45, lower + 1.37);
        const width = courtyard ? 1.52 : 1.83;
        opening(
          out,
          wall,
          center - width / 2,
          center + width / 2,
          lower,
          top,
          'trim',
          colors.glass,
          'glass',
          colors.frame,
          lod - 1,
          0.016,
        );
        if (lod === 3) {
          panel(
            out,
            'masonry',
            wall,
            center - width / 2 - 0.13,
            center + width / 2 + 0.13,
            lower - 0.16,
            lower - 0.08,
            0.057,
            colors.white,
          );
        }
      }
    }
  }
}

function gabledRoof(out, lod, x0, x1, z0, z1, base, eave, rise) {
  const middle = (x0 + x1) / 2;
  const top = eave + rise;
  block(out, 'roof', x0, base - 0.06, z0, x1 - x0, eave - base + 0.06, z1 - z0, colors.zinc);
  face(
    out,
    'roof',
    [
      [x0, eave, z0],
      [middle, top, z0],
      [middle, top, z1],
      [x0, eave, z1],
    ],
    up,
    colors.shadeRoof,
  );
  face(
    out,
    'roof',
    [
      [middle, top, z0],
      [x1, eave, z0],
      [x1, eave, z1],
      [middle, top, z1],
    ],
    up,
    colors.brightRoof,
  );
  face(
    out,
    'roof',
    [
      [x0, eave, z0],
      [x1, eave, z0],
      [middle, top, z0],
    ],
    [0, 0, -1],
    colors.zinc,
  );
  face(
    out,
    'roof',
    [
      [x0, eave, z1],
      [x1, eave, z1],
      [middle, top, z1],
    ],
    [0, 0, 1],
    colors.zinc,
  );
  if (lod > 1) {
    for (const x of [x0, x1 - 0.12]) {
      block(out, 'trim', x, eave - 0.15, z0, 0.12, 0.16, z1 - z0, colors.gutter);
    }
    block(out, 'trim', middle - 0.07, top - 0.005, z0, 0.14, 0.05, z1 - z0, colors.zinc);
  }
}

function entryCanopy(out, lod, bay, isEmergency, grade) {
  const direction = isEmergency ? -1 : 1;
  const front = isEmergency ? bay.back : bay.front;
  const edgeOfCanopy = front + direction * (isEmergency ? 5.6 : 6.3);
  const width = bay.width;
  const left = bay.center - width / 2;
  const right = bay.center + width / 2;
  const sampledGround = grade([bay.center, front]);
  const threshold = sampledGround + 0.19;
  const canopyY = threshold + (isEmergency ? 3.2 : 3.9);
  const bottomZ = Math.min(front - direction * 0.17, edgeOfCanopy);
  const depth = Math.abs(edgeOfCanopy - front) + 0.17;
  const color = isEmergency ? colors.emergency : colors.blue;
  block(out, 'trim', left, canopyY, bottomZ, width, 0.36, depth, color);
  block(
    out,
    'roof',
    left + 0.09,
    canopyY + 0.34,
    bottomZ + 0.06,
    width - 0.18,
    0.13,
    depth - 0.12,
    colors.brightRoof,
  );
  for (const x of [left + 0.77, right - 0.98]) {
    const z = edgeOfCanopy - direction * 0.78;
    const floor = grade([x, z]) - 0.27;
    block(out, 'trim', x, floor, z - 0.13, 0.24, canopyY - floor, 0.26, colors.gutter);
  }
  const glazing = plane(front + direction * 0.14, direction);
  const doorWidth = isEmergency ? 6.6 : 8.4;
  panel(
    out,
    'trim',
    glazing,
    bay.center - doorWidth / 2 - 0.16,
    bay.center + doorWidth / 2 + 0.16,
    threshold - 0.04,
    canopyY - 0.18,
    0,
    colors.frame,
  );
  const bays = isEmergency ? 3 : 4;
  const span = doorWidth / bays;
  for (let i = 0; i < bays; i++) {
    const x = bay.center - doorWidth / 2 + i * span;
    opening(
      out,
      glazing,
      x + 0.055,
      x + span - 0.055,
      threshold + 0.1,
      canopyY - 0.39,
      'trim',
      colors.glass,
      'glass',
      colors.recess,
      Math.max(0, lod - 1),
      0.042,
    );
  }
  if (lod > 0) {
    const apron = front + direction * 2.65;
    stairs(
      out,
      grade,
      'plinth',
      bay.center - 2.4,
      bay.center + 2.4,
      apron,
      front + direction * 0.04,
      threshold,
      3,
      colors.plinth,
    );
    const sign = plane(edgeOfCanopy + direction * 0.02, direction);
    panel(
      out,
      'trim',
      sign,
      bay.center - 0.51,
      bay.center + 0.51,
      canopyY + 0.03,
      canopyY + 0.32,
      0,
      isEmergency ? colors.yellow : colors.white,
    );
    panel(
      out,
      'trim',
      sign,
      bay.center - 0.36,
      bay.center + 0.36,
      canopyY + 0.08,
      canopyY + 0.27,
      0.012,
      color,
    );
    const markWidth = 0.074;
    for (const x of [bay.center - 0.13, bay.center + 0.056]) {
      panel(
        out,
        'trim',
        sign,
        x,
        x + markWidth,
        canopyY + 0.064,
        canopyY + 0.29,
        0.025,
        colors.white,
      );
    }
    panel(
      out,
      'trim',
      sign,
      bay.center - 0.13,
      bay.center + 0.13,
      canopyY + 0.141,
      canopyY + 0.206,
      0.026,
      colors.white,
    );
  }
}

function draw(out, lod, { outline, courtyards, wallHeight, publicBay, emergencyBay }, grade) {
  const height = wallHeight + 1.14;
  buildingEnvelope(out, lod, [outline, ...courtyards], height, grade);
  // Keep raised roofs between native courtyards and inside the mapped wing recesses.
  const wings = [
    [-112, -101, -3.7, 30.4, 0.33, 1.25],
    [-75, -50, -12.8, 30.8, 0.38, 1.36],
    [-38, -23, -12.6, 29.7, 0.3, 1.25],
    [-13, 1.6, -12.2, 31.5, 0.36, 1.25],
    [2.5, 26, -39.4, -28.5, 0.3, 0.85],
    [43, 71.5, -49.2, -22.1, 0.52, 1.42],
    [101.5, 118, -72.9, -22.1, 0.44, 1.33],
    [42, 58.7, 10.2, 28.5, 0.23, 1.18],
    [72, 91.9, 10.5, 31.8, 0.29, 1.33],
    [103.2, 117.7, 10.7, 30.3, 0.25, 1.19],
  ];
  for (const [left, right, near, far, lift, pitch] of wings) {
    gabledRoof(out, lod, left, right, near, far, height, height + lift, pitch);
  }
  gabledRoof(out, lod, 4.22, 14.42, 25.35, 36.0, height, height + 0.47, 1.71);
  entryCanopy(out, lod, publicBay, false, grade);
  entryCanopy(out, lod, emergencyBay, true, grade);
  if (lod === 3) {
    for (const [x, z] of [
      [-69, -9],
      [-33, 5],
      [48, -42],
      [55, -39],
      [108, -59],
      [79, 19],
      [108, 23],
    ]) {
      block(out, 'trim', x, height + 0.9, z, 1.17, 0.84, 1.03, colors.zinc);
      block(out, 'trim', x - 0.09, height + 1.68, z - 0.09, 1.35, 0.11, 1.21, colors.gutter);
    }
  }
}

const building = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [218, 163, 282],
    lookAt: [0, 3.7, -9],
    yaw: 0.35,
    brief:
      'Standing Broken Hill hospital in its full mapped hospital wings and six open courtyards. Low linked masonry and corrugated-metal wings, a raised Thomas Street foyer, and the integrated rear emergency access.',
    views: [
      { name: 'main-hospital-thomas-street', position: [57, 31, 110], lookAt: [8, 3.1, 29] },
      { name: 'hospital-rear-emergency-access', position: [-45, 40, -133], lookAt: [17, 3.2, -28] },
      { name: 'six-hospital-courtyards', position: [112, 233, -155], lookAt: [0, 3, -9] },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = building;
model.category = 'civic';
const nativeFrame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
model.buildingCutout = {
  outline: nativeFrame.geometry.outline,
  minimumCoverage: 0.92,
  basis: 'Replace the mapped main hospital roofprint where it overlaps the authored exterior. Keep separate campus buildings outside the hospital outline.',
};
