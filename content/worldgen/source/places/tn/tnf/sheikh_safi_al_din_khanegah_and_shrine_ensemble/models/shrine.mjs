import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  fbox,
  pointedArch,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94 },
  tile: { slot: 'trim', graph: 'tile_glazed', roughness: 0.73 },
  mosaic: { slot: 'trim', graph: 'tile_mosaic', roughness: 0.75 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'brick_longformat', roughness: 0.94 },
  screen: { slot: 'window', graph: 'wood_vertical', roughness: 0.89 },
  pool: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.38 },
};
const ochre = rgb('b28a5d');
const pale = rgb('cbbb9c');
const glazed = rgb('548b8c');
const cobalt = rgb('455c81');
const white = rgb('cabd9e');
const darkWood = rgb('6c5237');
const terra = rgb('9d6c48');
const soil = rgb('7f8759');
const gold = rgb('bb9469');

function dome(out, part, spring, height, detail, main = false) {
  const [x, z] = [0, 1].map(
    (i) => (Math.min(...part.ring.map((p) => p[i])) + Math.max(...part.ring.map((p) => p[i]))) / 2,
  );
  const radius = Math.min(...part.radius);
  const sides = [12, 20, 28, 36][detail];
  const ring = (y, r) => radialRing(y, r * radius, r * radius, sides, [x, z]);
  if (main) {
    loft(out, 'brick', [ring(7.1, 1.035), ring(spring - 1.27, 1.015)], terra);
    loft(out, 'tile', [ring(spring - 1.29, 1.025), ring(spring - 0.6, 1.025)], cobalt);
    loft(out, 'tile', [ring(spring - 0.56, 1.016), ring(spring - 0.06, 1.016)], glazed);
    if (detail > 1) {
      const count = detail === 3 ? 40 : 28;
      const reach = radius * 1.035 + 0.032;
      const p = (az, y) => [x + Math.cos(az) * reach, y, z + Math.sin(az) * reach];
      for (let i = 0; i < count; i++) {
        const azimuth = (i * Math.PI * 2) / count;
        for (let row = 0; row < 5; row++) {
          const az = azimuth + ((row % 2) * Math.PI) / count;
          const y = 8.25 + row * 0.63,
            wide = (Math.PI / count) * 0.68;
          quad4(
            out,
            'tile',
            p(az - wide, y),
            p(az, y + 0.23),
            p(az + wide, y),
            p(az, y - 0.23),
            glazed,
          );
        }
      }
    }
  } else if (spring > 7.29) {
    loft(out, 'brick', [ring(7.235, 0.99), ring(spring + 0.02, 1)], ochre);
  }
  const profile = main
    ? [
        [0, 1],
        [0.13, 1.015],
        [0.39, 0.94],
        [0.65, 0.76],
        [0.87, 0.49],
        [0.98, 0.22],
        [1, 0.025],
      ]
    : [
        [0, 1],
        [0.21, 0.975],
        [0.48, 0.86],
        [0.72, 0.7],
        [0.92, 0.43],
        [0.99, 0.16],
        [1, 0.02],
      ];
  loft(
    out,
    'roof',
    profile.map(([y, r]) => ring(spring + height * y, r)),
    main ? terra : ochre,
  );
}

function niche(out, face, center, width, height, detail, primary) {
  const base = primary ? 0.11 : 0.84;
  const rise = height * 0.45;
  const spring = base + height - rise;
  const head = pointedArch(width * 0.5, rise, [3, 4, 6, 8][detail]);
  const arch = [
    [center - width * 0.5, base],
    ...head.map(([x, y]) => [center + x, spring + y]),
    [center + width * 0.5, base],
  ];
  const row = (x, y, d) => face.P(x, y, d);
  const depth = primary ? 0.88 : 0.36;
  fbox(
    out,
    'mosaic',
    face,
    center - width * 0.5 - 0.15,
    center + width * 0.5 + 0.15,
    base - 0.02,
    base + height + 0.26,
    0,
    0.042,
    cobalt,
  );
  for (let i = 0; i < arch.length - 1; i++) {
    const [u, y] = arch[i],
      [v, h] = arch[i + 1];
    const len = Math.hypot(v - u, h - y),
      lip = 0.19;
    const du = (-(h - y) * lip) / len,
      dy = ((v - u) * lip) / len;
    quad4(
      out,
      'tile',
      row(u, y, depth),
      row(v, h, depth),
      row(v + du, h + dy, depth),
      row(u + du, y + dy, depth),
      glazed,
    );
    quad4(
      out,
      'mosaic',
      row(v, h, depth),
      row(u, y, depth),
      row(u, y, 0.064),
      row(v, h, 0.064),
      cobalt,
    );
  }
  if (detail > 1) {
    mosaicField(out, face, center, width, base, height, detail);
    const n = primary ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const x = center + width * (i / (n - 1) - 0.5) * 0.69;
      fbox(
        out,
        'screen',
        face,
        x - 0.039,
        x + 0.039,
        base + 0.16,
        base + height * 0.57,
        0.075,
        0.147,
        darkWood,
      );
    }
    for (const y of [0.17, 0.46, 0.55])
      fbox(
        out,
        'screen',
        face,
        center - width * 0.35,
        center + width * 0.35,
        base + height * y,
        base + height * y + 0.035,
        0.079,
        0.149,
        darkWood,
      );
  }
}

function mosaicField(out, face, center, width, base, height, detail) {
  const step = detail === 3 ? 0.26 : 0.39;
  const columns = Math.floor(width / step);
  const rows = Math.floor((height * 0.29) / step);
  for (let row = 0; row < rows; row++) {
    const y = base + step * (row + 0.55);
    for (let column = 0; column < columns; column++) {
      const u = center + step * (column - (columns - 1) / 2);
      const half = step * 0.34;
      const p = (x, h) => face.P(x, h, 0.066);
      quad4(
        out,
        'tile',
        p(u - half, y),
        p(u, y - half),
        p(u + half, y),
        p(u, y + half),
        (row + column) % 2 === 0 ? white : glazed,
      );
      if (detail !== 3) continue;
      const centerSize = half * 0.37;
      const q = (x, h) => face.P(x, h, 0.067);
      quad4(
        out,
        'tile',
        q(u - centerSize, y - centerSize),
        q(u + centerSize, y - centerSize),
        q(u + centerSize, y + centerSize),
        q(u - centerSize, y + centerSize),
        gold,
      );
    }
  }
}

function courtyardFace(out, detail) {
  const face = wallFace(site.outline[15], site.outline[16]);
  const n = 7,
    spacing = face.length / n;
  fbox(out, 'stone', face, 0, face.length, -0.2, 0.7, 0, 0.22, pale);
  fbox(out, 'tile', face, 0, face.length, 6.38, 6.84, 0, 0.16, glazed);
  for (let i = 0; i < n; i++) {
    niche(
      out,
      face,
      (i + 0.5) * spacing,
      spacing * (i === 3 ? 0.83 : 0.72),
      i === 3 ? 5.87 : 4.69,
      detail,
      i === 3,
    );
    if (detail > 0)
      fbox(
        out,
        'mosaic',
        face,
        spacing * i + 0.015,
        spacing * i + 0.125,
        0.72,
        6.37,
        0,
        0.1,
        white,
      );
  }
}

function walledGarden(out, detail) {
  for (const { path, ground, gate } of site.perimeter) {
    if (gate) {
      entryGate(out, wallFace(path[0], path.at(-1)), Math.min(...ground), detail);
      continue;
    }
    for (let i = 1; i < path.length; i++) {
      const face = wallFace(path[i - 1], path[i]);
      const y = Math.min(ground[i - 1], ground[i]);
      fbox(out, 'brick', face, -0.16, face.length + 0.16, y - 0.8, y + 2.62, -0.44, 0.44, ochre);
      fbox(out, 'stone', face, -0.17, face.length + 0.17, y + 2.6, y + 2.78, -0.51, 0.51, pale);
    }
  }

  const { innerPool, innerPoolRadius, poolGrade, gardenRows, gardenStartGrade, gardenEndGrade } =
    site.courtyard;
  const rim = (y, radius) => radialRing(y, radius, radius, 12, innerPool, Math.PI / 12);
  const r = innerPoolRadius;
  loft(out, 'stone', [rim(poolGrade - 0.51, r), rim(poolGrade + 0.28, r)], pale, { cap: false });
  loft(out, 'stone', [rim(poolGrade + 0.28, r), rim(poolGrade + 0.28, r - 0.28)], pale, {
    cap: false,
  });
  loft(out, 'tile', [rim(poolGrade + 0.28, r - 0.28), rim(poolGrade + 0.03, r - 0.28)], glazed, {
    cap: false,
  });
  const water = rim(poolGrade + 0.071, r - 0.28);
  out.addConvexPolygon(
    'pool',
    'palette:#ffffff',
    water,
    [0, 1, 0],
    (p) => [p[0], p[2]],
    rgb('5f8281'),
  );

  const walk = wallFace(...gardenRows);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const start = 5.2 + i * ((walk.length - 12) / 5);
      const end = start + (walk.length - 12) / 5 - 2.4;
      const f = (start + end) / (2 * walk.length);
      const y = gardenStartGrade * (1 - f) + gardenEndGrade * f;
      const [left, right] = [side * 4.25, side * 8.1].sort((a, b) => a - b);
      fbox(out, 'stone', walk, start, end, y - 0.11, y + 0.2, left, right, pale);
      fbox(
        out,
        'stone',
        walk,
        start + 0.19,
        end - 0.19,
        y - 0.1,
        y + 0.217,
        left + 0.19,
        right - 0.19,
        soil,
      );
    }
  }
}

function entryGate(out, face, y, detail) {
  const u = face.length * 0.5;
  const halfWidth = 1.45;
  const top = y + 4.73;
  fbox(out, 'brick', face, 0, u - halfWidth, y - 0.5, top, -0.55, 0.55, ochre);
  fbox(out, 'brick', face, u + halfWidth, face.length, y - 0.5, top, -0.55, 0.55, ochre);
  fbox(out, 'stone', face, -0.13, face.length + 0.13, top, top + 0.22, -0.66, 0.66, pale);
  const arch = pointedArch(halfWidth, 1.19, detail === 1 ? 4 : 8);
  for (let i = 1; i < arch.length; i++) {
    const [x, a] = arch[i - 1],
      [z, b] = arch[i];
    const aY = y + 2.89 + a,
      bY = y + 2.89 + b;
    const p = face.P;
    quad4(
      out,
      'brick',
      p(u + x, aY, 0.55),
      p(u + z, bY, 0.55),
      p(u + z, top, 0.55),
      p(u + x, top, 0.55),
      ochre,
    );
    quad4(
      out,
      'brick',
      p(u + z, bY, -0.55),
      p(u + x, aY, -0.55),
      p(u + x, top, -0.55),
      p(u + z, top, -0.55),
      ochre,
    );
    quad4(
      out,
      'tile',
      p(u + x, aY, -0.55),
      p(u + z, bY, -0.55),
      p(u + z, bY, 0.55),
      p(u + x, aY, 0.55),
      glazed,
    );
  }
  for (const offset of [-1, 1]) {
    const x = u + offset * (halfWidth + 0.17);
    fbox(out, 'tile', face, x - 0.09, x + 0.09, y + 0.21, y + 3.91, 0.55, 0.595, glazed);
  }
}

function build(out, detail) {
  const skinned = {
    ...out,
    addCap(slot, ref, outline, holes, grade, normal, uv, color) {
      const builder = new MeshBufferBuilder();
      if (!builder.addCap('roof', ref, outline, holes, grade, normal, uv, color)) return false;
      const { positions, indices } = builder.finalize();
      for (let i = 0; i < indices.length; i += 3) {
        const points = Array.from(indices.slice(i, i + 3), (j) =>
          positions.slice(j * 3, j * 3 + 3),
        );
        out.addTriangle(
          slot,
          ref,
          points,
          normal,
          points.map((p) => uv([p[0], p[2]])),
          color,
        );
      }
      return true;
    },
  };
  extrude(skinned, 'brick', site.outline, -1.54, 7.26, ochre, { topSlot: 'roof', topColor: terra });
  const [jannat, tomb, chini, smallTomb] = site.parts;
  loft(
    out,
    'brick',
    [7.22, 8.74].map((y) =>
      radialRing(y, jannat.radius[0], jannat.radius[1], 8, [10.12, -15.21], Math.PI / 8),
    ),
    ochre,
  );
  dome(out, jannat, 8.72, 2.36, detail);
  dome(out, chini, 8.1, 5.64, detail);
  dome(out, tomb, 12.78, 3.22, detail, true);
  dome(out, smallTomb, 7.18, 2.79, detail);
  if (detail > 0) {
    courtyardFace(out, detail);
    walledGarden(out, detail);
  }
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
