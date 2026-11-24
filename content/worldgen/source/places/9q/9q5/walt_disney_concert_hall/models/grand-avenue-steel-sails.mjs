import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  steel: { slot: 'roof', graph: 'metal_painted', roughness: 0.67, metallic: 0.16 },
  substrate: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96 },
  limestone: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'metal_stainless', roughness: 0.81 },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    name: 'conservatory-glass',
    roughness: 0.34,
    metallic: 0.18,
  },
  planting: {
    slot: 'foundation',
    localRef: 'palette:#ffffff',
    name: 'courtyard-planting',
    roughness: 0.98,
  },
};
const F = facade(site.frame.origin, site.frame.along);
const P = F.P;
const xz = ([x, , z]) => [x, z];
const silver = ['b2b6b9', 'c4c5c6', 'a5aeb4'].map(rgb);
const pale = rgb('beb9ae');
const trim = rgb('6e7275');
const dark = rgb('9b9b92');
const glass = ['60737a', '687c80', '607080', '74868a'].map(rgb);
const green = ['686e51', '747a5b', '5c664b'].map(rgb);
const mix = (a, b, t) => a + (b - a) * t;
const lerp = (a, b, t) => a.map((v, i) => mix(v, b[i], t));

function surface(out, slot, a, b, c, d, tint) {
  tri(out, slot, a, b, c, tint);
  tri(out, slot, a, c, d, tint);
}

function interpolate(points, t) {
  const i = Math.min(2, Math.floor(t * 3));
  const start = points[i],
    end = points[i + 1],
    before = points[Math.max(0, i - 1)],
    after = points[Math.min(3, i + 2)];
  const s = t * 3 - i,
    ss = s * s,
    sss = ss * s;
  return start.map((v, k) => {
    const value =
      v * (2 * sss - 3 * ss + 1) +
      (end[k] - before[k]) * 0.5 * (sss - 2 * ss + s) +
      end[k] * (-2 * sss + 3 * ss) +
      (after[k] - v) * 0.5 * (sss - ss);
    return Math.max(Math.min(v, end[k]), Math.min(Math.max(v, end[k]), value));
  });
}

function sail(out, part, detail) {
  const { base, top, depth, bow, shine } = part;
  const columns = [3, 6, 12, 24][detail],
    strips = [1, 4, 7, 12][detail];
  const outer = Array.from({ length: strips + 1 }, (_, j) => {
    const t = j / strips;
    return Array.from({ length: columns + 1 }, (_, i) => {
      const u = i / columns;
      const [x, y, z] = lerp(interpolate(base, u), interpolate(top, u), t);
      const flex = bow * 0.67 * Math.sin(Math.PI * t) * Math.sin(Math.PI * u);
      return P(x + flex * 0.19, y, z + flex);
    });
  });
  const inner = outer.map((r, j) =>
    r.map(([x, y, z], i) => {
      const thick = depth * (0.67 + 0.25 * Math.sin((i / columns) * Math.PI) + 0.07 * (j / strips));
      return [x - F.normal[0] * thick, y, z - F.normal[1] * thick];
    }),
  );
  for (let j = 0; j < strips; j++)
    for (let i = 0; i < columns; i++) {
      const a = outer[j][i],
        b = outer[j][i + 1],
        c = outer[j + 1][i + 1],
        d = outer[j + 1][i];
      const A = inner[j][i],
        B = inner[j][i + 1],
        C = inner[j + 1][i + 1],
        D = inner[j + 1][i];
      const tint = silver[shine];
      surface(out, 'steel', a, b, c, d, tint);
      surface(out, 'steel', B, A, D, C, tint);
      if (i === 0) surface(out, 'steel', A, a, d, D, tint);
      if (i === columns - 1) surface(out, 'steel', b, B, C, c, tint);
      if (j === 0) surface(out, 'steel', A, B, b, a, tint);
      if (j === strips - 1) surface(out, 'steel', d, c, C, D, tint);
    }
  if (detail > 1) {
    for (let i = 0; i < columns; i++) {
      const top = outer.at(-1);
      beam(out, 'trim', top[i], top[i + 1], 0.075, 0.095, silver[shine]);
    }
  }
}

function capCourt(out, slot, ring, holes, y, tint) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      'roof',
      'palette:#ffffff',
      ring,
      holes,
      () => y,
      [0, 1, 0],
      (p) => p,
      tint,
    )
  )
    throw new Error('The concert hall podium must leave its mapped courtyard open');
  const { positions, indices } = b.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = Array.from(indices.subarray(i, i + 3), (j) =>
      positions.subarray(j * 3, j * 3 + 3),
    );
    tri(out, slot, a, b, c, tint);
  }
}

function lowerSite(out, detail) {
  const { outline, court } = site;
  extrude(out, 'limestone', outline, -8.32, 0.99, pale, { holes: [court], top: false });
  capCourt(out, 'limestone', outline, [court], 0.99, pale);
  cap(out, 'limestone', court, 0.36, pale);
  fbox(out, 'substrate', F, -3.1, 28.03, 0.95, 11.78, -88.72, -32.64, pale);
  fbox(out, 'substrate', F, 28.03, 107.71, 0.95, 18.73, -75.84, -32.68, dark);
  fbox(out, 'substrate', F, 111.89, 124.24, 0.96, 10.82, -66.9, -34.11, pale);
  fbox(out, 'substrate', F, 29.38, 99.18, 18.71, 25.13, -64.81, -37.78, silver[0]);
  fbox(out, 'steel', F, 28.96, 99.65, 25.13, 26.31, -65.09, -37.42, silver[2]);
  fbox(out, 'steel', F, 32.85, 95.22, 26.3, 27.65, -61.22, -41.29, silver[0]);
  fbox(out, 'substrate', F, 17.7, 43.17, 1.02, 9.79, -32.95, -5.5, dark);
  fbox(out, 'substrate', F, 51.19, 113.2, 1.02, 11.61, -32.95, -11.82, dark);
  if (detail > 0) {
    for (const d of [-63, -48, -43])
      fbox(out, 'trim', F, 32.92, 95.06, 26.49, 26.75, d - 0.31, d + 0.28, trim);
    for (const u of [41.4, 81.71])
      fbox(out, 'steel', F, u - 3.5, u + 3.5, 26.27, 28.9, -56.19, -47.66, silver[0]);
  }
}

function frontage(out, detail) {
  const banks = [
    [6.15, 43.93, -1.85, 5.87],
    [44, 64.86, 3.46, 8.17],
    [65.17, 85.91, 6.23, 9.89],
    [86.1, 100.37, -6.51, 14.07],
    [103.6, 120.37, -4.52, 8.59],
  ];
  for (const [k, [u, U, d, Y]] of banks.entries()) {
    const y = 1.02 + (k > 2 ? 0.39 : 0);
    fbox(out, 'glass', F, u, U, y, Y, d - 1.77, d, glass[k % glass.length]);
    if (detail === 0) continue;
    const n = Math.max(2, Math.round((U - u) / (detail > 1 ? 1.92 : 3.2)));
    for (let j = 0; j <= n; j++) {
      const x = mix(u, U, j / n);
      fbox(out, 'trim', F, x - 0.054, x + 0.054, y, Y, d + 0.011, d + 0.098, trim);
    }
    for (const h of [y + 0.18, Math.min(y + 2.63, Y - 0.21), Y - 0.13])
      fbox(out, 'trim', F, u - 0.075, U + 0.075, h, h + 0.068, d + 0.031, d + 0.096, trim);
    if (detail > 1) {
      const x = mix(u, U, 0.53);
      for (const v of [x - 0.81, x + 0.85])
        fbox(out, 'trim', F, v - 0.029, v + 0.026, y + 0.91, y + 1.24, d + 0.1, d + 0.182, pale);
    }
  }
  const steps = [4, 7, 14, 23][detail],
    a = 91.17,
    b = 105.19;
  for (let i = 0; i < steps; i++) {
    const j = i / steps,
      y = mix(0.99, 5.04, (i + 1) / steps);
    fbox(
      out,
      'limestone',
      F,
      mix(a, a + 0.53, j),
      mix(b, b - 1.12, j),
      0.84,
      y,
      2.92,
      mix(12.82, 3.72, j),
      pale,
    );
  }
  if (detail > 1)
    for (const u of [91.71, 97.25, 102.18]) {
      beam(out, 'trim', P(u, 2.13, 12.69), P(u, 6.16, 3.8), 0.049, 0.057, trim);
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        beam(
          out,
          'trim',
          P(u, mix(1.14, 5.02, t), mix(12.6, 3.8, t)),
          P(u, mix(2.13, 6.16, t), mix(12.6, 3.8, t)),
          0.041,
          0.045,
          trim,
        );
      }
    }
}

function rearCourts(out, detail) {
  const [cover, canopy, apron] = site.parts;
  cap(out, 'limestone', apron.outline, 8.39, pale);
  extrude(out, 'limestone', apron.outline, 5.77, 8.39, pale, { top: false });
  for (const [i, part] of [cover, canopy].entries()) {
    const y = i === 0 ? 12.25 : 6.12;
    const ring = outwardRing(part.outline);
    const middle = ring.reduce(
      ([x, z], [a, b]) => [x + a / ring.length, z + b / ring.length],
      [0, 0],
    );
    const roofY = ([x, z]) => y + 0.108 * (x - middle[0]) + 0.089 * (z - middle[1]);
    for (const [j, [x, z]] of ring.entries()) {
      const [u, d] = ring[(j + 1) % ring.length];
      const a = roofY([x, z]),
        b = roofY([u, d]);
      quad4(out, 'steel', [x, a - 0.29, z], [u, b - 0.29, d], [u, b, d], [x, a, z], silver[0]);
    }
    const geometry = new MeshBufferBuilder();
    if (
      !geometry.addCap('roof', 'palette:#ffffff', ring, [], roofY, [0, 1, 0], (p) => p, silver[1])
    )
      throw new Error('The native pavilion roof must triangulate');
    const { indices, positions } = geometry.finalize();
    for (let j = 0; j < indices.length; j += 3) {
      const [a, b, c] = Array.from(indices.subarray(j, j + 3), (k) =>
        positions.subarray(k * 3, k * 3 + 3),
      );
      tri(out, 'steel', a, b, c, silver[1]);
    }
    for (let k = 0; k < ring.length; k += detail === 0 ? 6 : 3) {
      const [x, z] = lerp(ring[k], middle, 0.14);
      const f = facade([x, z], F.along);
      fbox(
        out,
        'trim',
        f,
        -0.085,
        0.085,
        i === 0 ? 8.35 : 1.03,
        roofY([x, z]) + 0.04,
        -0.085,
        0.085,
        trim,
      );
    }
  }
  if (detail === 0) return;
  for (let i = 0; i < 6; i++)
    fbox(
      out,
      'limestone',
      F,
      8.76 + i * 0.37,
      20.63 + i * 0.69,
      8.32,
      8.52 + i * 0.145,
      -67.84 + i * 1.07,
      -67.03 + i * 1.07,
      dark,
    );
  for (const [i, [x, z]] of [
    [8, -46.21],
    [8.91, -42.72],
    [9.31, -39.54],
    [13.44, -34.57],
  ].entries()) {
    fbox(out, 'limestone', F, x - 1.37, x + 1.38, 11.61, 12.18, z - 1.11, z + 1.09, pale);
    if (detail > 1)
      lathe(
        out,
        'planting',
        xz(P(x, 0, z)),
        [
          [12.08, 0, 0],
          [12.75, 1.21, 1.05],
          [13.69, 1.48, 1.28],
          [14.44, 1.06, 0.93],
          [14.79, 0, 0],
        ],
        8,
        green[i % green.length],
      );
  }
}

function build(out, detail) {
  lowerSite(out, detail);
  frontage(out, detail);
  for (const record of site.sails) sail(out, record, detail);
  rearCourts(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
