import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  facade,
  fan,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  facing: { slot: 'wall', graph: 'stone_travertine', roughness: 0.89 },
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.95 },
  soffit: { slot: 'trim', graph: 'concrete_panel', roughness: 0.87 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.79 },
  gold: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.68 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.9 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.56 },
};
const straw = rgb('cfbf9d'),
  cream = rgb('d7c9a9'),
  stone = rgb('a59b89'),
  silver = rgb('b4b3a8');
const paleGold = rgb('d3b77c'),
  bronze = rgb('886e4c'),
  soffit = rgb('898a81'),
  seam = rgb('afa184');
const glass = rgb('536167'),
  blue = rgb('576b71'),
  shadow = rgb('6d7472');
const { outline, roofHeight, gallerySoffit } = site;
const plan = outwardRing(outline);
const inset = (ring, t) =>
  ring.map(([x, z]) => [site.hub[0] + (x - site.hub[0]) * t, site.hub[1] + (z - site.hub[1]) * t]);

function cap(out, slot, points, y, color, holes = [], down = false) {
  const mesh = new MeshBufferBuilder();
  if (
    !mesh.addCap(
      'roof',
      'palette:#ffffff',
      points,
      holes,
      () => y,
      [0, down ? -1 : 1, 0],
      (p) => p,
      color,
    )
  )
    throw Error('The museum roof outline could not be triangulated.');
  const { indices, positions } = mesh.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (j) => positions.slice(j * 3, j * 3 + 3));
    tri(out, slot, ...points, color);
  }
}

function face(out, slot, f, a, b, lo, hi, d, color) {
  const p = f.P;
  quad4(out, slot, p(a, lo, d), p(b, lo, d), p(b, hi, d), p(a, hi, d), color);
}

function band(out, slot, f, lo, hi, d, color) {
  face(out, slot, f, 0, f.length, lo, hi, d, color);
}

function gallery(out, detail) {
  const bands = [
    [gallerySoffit, 15, 'facing'],
    [15, 16, 'glazing'],
    [16, 33, 'facing'],
    [33, 34, 'glazing'],
    [34, 35.98, 'facing'],
    [35.98, 37.13, 'glazing'],
    [37.13, roofHeight, 'facing'],
  ];
  for (const [i, a] of plan.entries()) {
    const b = plan[(i + 1) % plan.length],
      f = wallFace(a, b),
      l = f.length;
    if (l < 0.023) continue;
    const nearCorner = site.podium.some(
      (p) => Math.hypot(...p.map((n, j) => n - (a[j] + b[j]) / 2)) < 5.85,
    );
    if (nearCorner) {
      band(out, 'facing', f, gallerySoffit, roofHeight, 0, cream);
      if (detail > 0 && l > 2.1)
        face(out, 'glazing', f, l * 0.52, l * 0.88, gallerySoffit, roofHeight - 0.24, 0.032, glass);
    } else {
      for (const [lo, hi, slot] of bands) {
        band(
          out,
          slot,
          f,
          lo,
          hi,
          slot === 'glazing' ? -0.27 : 0,
          slot === 'glazing' ? glass : i % 3 === 1 ? cream : straw,
        );
        if (detail > 0 && slot === 'glazing')
          fbox(out, 'steel', f, 0, l, lo, lo + 0.072, -0.28, 0.028, bronze);
      }
    }
    if (detail < 2 || l < 1.31) continue;
    for (const [lo, hi, slot] of bands) {
      if (slot !== 'facing') continue;
      const rows = Math.max(1, Math.floor((hi - lo) / 1.19));
      for (let j = 1; j < rows; j++) {
        const y = lo + ((hi - lo) * j) / rows;
        band(out, 'facing', f, y, y + 0.022, 0.014, seam);
        if (detail === 3) {
          const n = Math.max(1, Math.round(l / 1.43));
          for (let k = 1; k < n; k++) {
            const u = (l * k) / n;
            face(out, 'facing', f, u, u + 0.023, y - 0.83, y, 0.017, seam);
          }
        }
      }
    }
  }
  cap(out, 'soffit', plan, gallerySoffit - 0.011, soffit, [], true);
}

function pier(out, detail, corner) {
  const range = [-2, -1, 0, 1, 2].map(
    (i) => outline[(corner + i + outline.length) % outline.length],
  );
  const vertex = outline[corner];
  const back = [
    site.hub[0] + (vertex[0] - site.hub[0]) * 0.58,
    site.hub[1] + (vertex[1] - site.hub[1]) * 0.58,
  ];
  const r = outwardRing([...range, back]);
  for (const [i, a] of r.entries()) {
    const b = r[(i + 1) % r.length],
      f = wallFace(a, b),
      l = f.length;
    if (l < 0.024) continue;
    band(out, 'granite', f, site.foundationBottom, 0.4, 0, stone);
    band(out, 'facing', f, 0.4, gallerySoffit + 0.04, 0, cream);
    if (l < 2.2 || i % 3 !== 1) continue;
    const left = l * 0.49,
      right = l * 0.89;
    face(out, 'glazing', f, left, right, 0.76, roofHeight - 0.23, 0.045, blue);
    if (detail > 0) {
      const n = detail === 1 ? 8 : 17;
      for (let j = 1; j < n; j++) {
        const y = 0.76 + ((roofHeight - 1) * j) / n;
        face(out, 'steel', f, left, right, y, y + 0.094, 0.071, shadow);
      }
    }
  }
}

function recessedLobby(out, detail) {
  const r = outwardRing(inset(site.podium, 0.44));
  for (const [i, a] of r.entries()) {
    const f = wallFace(a, r[(i + 1) % r.length]),
      l = f.length;
    band(out, 'granite', f, site.foundationBottom, 0.31, 0, stone);
    band(out, 'glazing', f, 0.31, gallerySoffit - 0.03, 0, i % 2 === 0 ? glass : shadow);
    if (detail === 0) continue;
    const n = Math.ceil(l / (detail > 1 ? 1.66 : 3.6));
    for (let j = 1; j < n; j++) {
      const u = (l * j) / n;
      fbox(out, 'steel', f, u - 0.038, u + 0.038, 0.31, gallerySoffit, 0, 0.078, shadow);
    }
  }
  cap(out, 'granite', r, 0.32, stone);
}

function roofDeck(out, detail) {
  const court = outwardRing(inset(site.podium, 0.45));
  cap(out, 'roof', plan, roofHeight, silver, [court]);
  cap(out, 'roof', court, site.observationLevel, soffit);
  const inside = court.slice().reverse();
  for (const [i, a] of inside.entries()) {
    const b = inside[(i + 1) % inside.length],
      f = wallFace(a, b);
    band(out, 'facing', f, site.observationLevel, roofHeight, 0, cream);
    if (detail > 1) {
      const l = f.length;
      fbox(
        out,
        'steel',
        f,
        0.18,
        l - 0.18,
        roofHeight - 0.23,
        roofHeight - 0.14,
        -0.06,
        0.09,
        shadow,
      );
    }
  }
}

function sunEmblem(out, detail) {
  const axis = [site.front[1], -site.front[0]],
    f = facade(site.emblem, axis);
  const p = f.P,
    y = 23.11,
    depth = 0.25;
  const n = [12, 16, 24, 30][detail],
    ring = (r, d) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n;
        return p(r * Math.cos(a), y + r * Math.sin(a), d);
      });
  fan(out, 'gold', ring(0.96, depth), bronze);
  fan(out, 'gold', ring(0.77, depth + 0.052), paleGold);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      point = (r, theta) => p(r * Math.cos(theta), y + r * Math.sin(theta), depth + 0.04);
    tri(out, 'gold', point(0.88, a - 0.13), point(1.35, a), point(0.88, a + 0.13), bronze);
  }
}

function build(out, detail) {
  for (const i of site.vertexIndices) pier(out, detail, i);
  recessedLobby(out, detail);
  gallery(out, detail);
  roofDeck(out, detail);
  sunEmblem(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
