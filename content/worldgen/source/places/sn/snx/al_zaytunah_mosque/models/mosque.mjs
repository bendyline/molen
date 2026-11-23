import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beamPath,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  ribbon,
  roundArch,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  ashlar: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.94 },
  stone: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.92 },
  pale: { slot: 'roof', graph: 'plaster_lime', roughness: 0.91 },
  tile: { slot: 'trim', graph: 'tile_glazed', roughness: 0.68 },
  wood: { slot: 'window', graph: 'wood_vertical', roughness: 0.87 },
  basalt: { slot: 'foundation', graph: 'stone_basalt', roughness: 0.92 },
};
const cream = rgb('d2c7ad');
const beige = rgb('ad8661');
const honey = rgb('b78c5e');
const ivory = rgb('ddd7c2');
const white = rgb('e2ded0');
const green = rgb('427767');
const indigo = rgb('3c615d');
const metal = rgb('967044');
const walnut = rgb('4f4436');
const paved = rgb('b8aa91');
const floor = site.courtFloor;

function arcade(out, face, detail, count) {
  const pitch = face.length / count;
  const gallery = 3.34;
  const w = pitch / 2 - 0.11;
  const spring = 2.95;
  const top = 5.37;
  const profile = roundArch(w, [3, 5, 8, 14][detail]);
  const shells = [gallery - 0.34, gallery];
  const P = (x, y, d) => face.P(x, y, d);
  fbox(out, 'pale', face, 0, face.length, top - 0.025, top + 0.28, -0.09, gallery + 0.1, white, {
    bottom: true,
  });
  fbox(
    out,
    'stone',
    face,
    0,
    face.length,
    top - 0.26,
    top - 0.045,
    gallery - 0.36,
    gallery + 0.038,
    cream,
  );
  for (let i = 0; i <= count; i++) {
    const u = i * pitch;
    const [x, , z] = P(u, 0, gallery - 0.16);
    const sideCount = [5, 5, 8, 12][detail];
    const ring = (y, r) => radialRing(y, r, r, sideCount, [x, z]);
    const levels =
      detail === 1
        ? [
            [floor, 0.19],
            [spring + 0.02, 0.16],
          ]
        : [
            [floor, 0.24],
            [floor + 0.2, 0.24],
            [floor + 0.36, 0.17],
            [spring - 0.32, 0.135],
            [spring - 0.2, 0.21],
            [spring + 0.02, 0.25],
          ];
    loft(
      out,
      'stone',
      levels.map(([y, r]) => ring(y, r)),
      ivory,
    );
    if (i === count) continue;
    const mid = u + pitch / 2;
    fbox(out, 'ashlar', face, u - 0.1, u + 0.11, spring, top, ...shells, beige);
    for (let j = 0; j < profile.length - 1; j++) {
      const [a, h] = profile[j];
      const [b, k] = profile[j + 1];
      const x = mid + a,
        q = mid + b,
        y = spring + h,
        yy = spring + k;
      const [rear, front] = shells;
      const hue = detail > 1 && j % 2 === 0 ? honey : beige;
      quad4(
        out,
        'ashlar',
        P(x, y, front),
        P(q, yy, front),
        P(q, top, front),
        P(x, top, front),
        hue,
      );
      if (detail > 1)
        quad4(
          out,
          'ashlar',
          P(q, yy, rear),
          P(x, y, rear),
          P(x, top, rear),
          P(q, top, rear),
          beige,
        );
      quad4(out, 'stone', P(x, y, rear), P(q, yy, rear), P(q, yy, front), P(x, y, front), cream);
      if (detail > 1) {
        const shoulder = 0.16;
        quad4(
          out,
          'stone',
          P(x, y, front + 0.018),
          P(q, yy, front + 0.018),
          P(q + (b / w) * shoulder, yy + (k / w) * shoulder, front + 0.018),
          P(x + (a / w) * shoulder, y + (h / w) * shoulder, front + 0.018),
          cream,
        );
      }
    }
    if (detail === 3)
      opening(out, face, mid, floor, pitch * 0.47, 3.13, {
        head: 'round',
        frameSlot: 'stone',
        glassSlot: 'wood',
        frame: ivory,
        glass: walnut,
        frameWidth: 0.11,
        frameDepth: 0.13,
        d: 0.046,
        mullions: detail > 1 ? 1 : 0,
        sill: false,
      });
  }
  fbox(out, 'ashlar', face, face.length - 0.11, face.length + 0.11, spring, top, ...shells, beige);
}

function dome(out, { center, radius, drum, rise, height }, detail) {
  const sides = [8, 12, 24, 48][detail];
  const rings = (y, r) => radialRing(y, r, r, sides, center);
  loft(
    out,
    'ashlar',
    [
      rings(height - 0.19, radius * 1.12),
      rings(height + 0.16, radius * 1.12),
      rings(height + 0.22, radius),
      rings(height + drum - 0.25, radius),
      rings(height + drum, radius * 1.045),
    ],
    honey,
  );
  if (detail > 1) {
    const r = radialRing(0, radius * 1.014, radius * 1.014, 12, center);
    for (let i = 0; i < r.length; i++) {
      const f = wallFace([r[(i + 1) % r.length][0], r[(i + 1) % r.length][2]], [r[i][0], r[i][2]]);
      opening(out, f, f.length / 2, height + 0.36, f.length * 0.57, drum - 0.79, {
        head: 'round',
        glassSlot: 'wood',
        frameSlot: 'stone',
        glass: walnut,
        frame: cream,
        frameWidth: 0.16,
        sill: false,
      });
    }
  }
  const profile = [
    [0, 1],
    [0.27, 0.974],
    [0.54, 0.862],
    [0.75, 0.678],
    [0.89, 0.48],
    [0.975, 0.26],
    [1, 0.037],
  ];
  loft(
    out,
    'pale',
    profile.map(([y, r]) =>
      radialRing(height + drum + y * rise, r * radius, r * radius, sides, center).map(
        ([x, h, z], i) => {
          const rib = detail === 0 ? 1 : 1 - 0.038 * (i % (sides / 12) === 0 ? 0 : 1) * r;
          return [center[0] + (x - center[0]) * rib, h, center[1] + (z - center[1]) * rib];
        },
      ),
    ),
    white,
  );
  loft(
    out,
    'tile',
    [rings(height + drum + rise, 0.11), rings(height + drum + rise + 0.68, 0.04)],
    indigo,
  );
  if (detail > 0)
    sphere(
      out,
      'tile',
      [center[0], height + drum + rise + 0.36, center[1]],
      [0.22, 0.19, 0.22],
      indigo,
      10,
      5,
    );
}

function towerSquare(y, width) {
  const {
    center: [x, z],
    angle,
  } = site.minaret;
  const c = Math.cos(angle),
    s = Math.sin(angle),
    h = width / 2;
  return [
    [-h, -h],
    [-h, h],
    [h, h],
    [h, -h],
  ].map(([u, v]) => [x + u * c - v * s, y, z + u * s + v * c]);
}

function lattice(out, f, detail) {
  const w = f.length / 2 - 0.94;
  const c = f.length / 2;
  fbox(out, 'stone', f, c - w, c + w, 9.2, 27.21, 0.005, 0.054, honey);
  if (detail < 2) return;
  const pitch = detail === 3 ? 0.85 : 1.32;
  for (let row = 0, y = 9.7; y < 26.65; y += pitch * 0.72, row++) {
    for (
      let x = c - w + pitch * 0.6 + (row % 2) * pitch * 0.5;
      x < c + w - pitch * 0.43;
      x += pitch
    ) {
      const points = [
        [x - pitch * 0.38, y],
        [x, y + pitch * 0.58],
        [x + pitch * 0.38, y],
        [x, y - pitch * 0.58],
      ].map(([u, v]) => f.P(u, v, 0.069));
      if (detail === 3) beamPath(out, 'stone', points, 0.055, 0.041, ivory, true);
      else {
        const center = f.P(x, y, 0.069);
        const inner = points.map((p) => p.map((v, i) => center[i] + (v - center[i]) * 0.76));
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4;
          quad4(out, 'stone', points[j], points[i], inner[i], inner[j], cream);
        }
      }
    }
  }
}

function minaret(out, detail) {
  const {
    outline,
    width,
    center: [x, z],
  } = site.minaret;
  const ring = (y, w) => towerSquare(y, w);
  extrude(out, 'ashlar', outline, -3.4, 8.54, cream);
  loft(
    out,
    'ashlar',
    [
      [8.5, width],
      [8.83, width + 0.36],
      [9.2, width],
      [27.6, width],
      [27.89, width + 0.22],
      [28.31, width],
      [31.38, width],
      [31.61, width + 0.27],
      [36.23, width + 0.16],
      [36.46, width + 0.39],
    ].map(([y, w]) => ring(y, w)),
    cream,
  );
  const edges = outwardRing(ring(0, width).map(([x, , z]) => [x, z]));
  for (let i = 0; i < 4; i++) {
    const f = wallFace(edges[i], edges[(i + 1) % 4]);
    lattice(out, f, detail);
    for (let j = 0; j < 5; j++) {
      if (detail < 2) {
        const u = f.length / 2 + (j - 2) * 1.055;
        quad4(
          out,
          'wood',
          f.P(u - 0.31, 32.07, 0.13),
          f.P(u + 0.31, 32.07, 0.13),
          f.P(u + 0.31, 34.06, 0.13),
          f.P(u - 0.31, 34.06, 0.13),
          walnut,
        );
        continue;
      }
      opening(out, f, f.length / 2 + (j - 2) * 1.055, 32.07, 0.62, 1.99, {
        head: 'round',
        glassSlot: 'wood',
        frameSlot: 'stone',
        glass: walnut,
        frame: ivory,
        frameWidth: detail > 0 ? 0.12 : 0.045,
        frameDepth: 0.14,
        d: 0.13,
        sill: false,
      });
    }
    for (let j = 0; detail > 1 && j <= 9; j++) {
      const u = (j * f.length) / 9;
      fbox(out, 'stone', f, u - 0.16, u + 0.16, 36.31, 36.91, 0.015, 0.22, cream);
    }
  }
  loft(
    out,
    'ashlar',
    [
      [36.42, 3.72],
      [39.72, 3.72],
      [39.92, 3.96],
    ].map(([y, w]) => ring(y, w)),
    cream,
  );
  if (detail > 1) {
    const windows = outwardRing(ring(0, 3.72).map(([x, , z]) => [x, z]));
    for (let j = 0; j < 4; j++) {
      const f = wallFace(windows[j], windows[(j + 1) % 4]);
      opening(out, f, f.length / 2, 36.78, 1.82, 2.47, {
        head: 'round',
        glassSlot: 'wood',
        frameSlot: 'stone',
        glass: indigo,
        frame: ivory,
        frameWidth: 0.13,
      });
    }
  }
  loft(out, 'tile', [ring(39.9, 3.91), ring(42.1, 0.18)], green);
  for (const [y, r] of detail === 0
    ? [[42.16, 0.22]]
    : [
        [42.16, 0.22],
        [42.49, 0.16],
        [42.77, 0.11],
      ])
    sphere(out, 'tile', [x, y, z], [r, r, r], metal, 8, 4);
  loft(
    out,
    'tile',
    [radialRing(42.04, 0.045, 0.045, 8, [x, z]), radialRing(43, 0.029, 0.029, 8, [x, z])],
    metal,
  );
}

function build(surface, detail) {
  const out = {
    ...surface,
    addCap(slot, ref, outline, holes, grade, normal, uv, color) {
      const mesh = new MeshBufferBuilder();
      if (!mesh.addCap('roof', ref, outline, holes, grade, normal, uv, color)) return false;
      const { positions, indices } = mesh.finalize();
      for (let i = 0; i < indices.length; i += 3) {
        const points = Array.from(indices.slice(i, i + 3), (j) =>
          positions.slice(j * 3, j * 3 + 3),
        );
        surface.addTriangle(
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
  const { outline, court, domes } = site;
  extrude(out, 'ashlar', outline, site.foundationBottom, floor, paved, { topSlot: 'basalt' });
  extrude(out, 'ashlar', outline, floor, 7.36, cream, {
    holes: [court],
    topSlot: 'pale',
    topColor: white,
  });
  if (detail > 1) ribbon(out, 'pale', outline, 7.36, 0.35, 0.21, ivory);
  const prayerRoof = [outline[11], outline[12], outline[14], court[1], court[0]];
  extrude(out, 'pale', prayerRoof, 7.33, 9.85, white);
  for (const d of domes) dome(out, d, detail);
  const edges = outwardRing(court).reverse();
  for (let i = 0; i < edges.length; i++) {
    const f = wallFace(edges[i], edges[(i + 1) % edges.length]);
    if (detail > 0 && f.length > 7) arcade(out, f, detail, Math.round(f.length / 4.17));
  }
  minaret(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
