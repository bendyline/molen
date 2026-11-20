import { readFileSync } from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  surface,
  trimBlock,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const C = palette({
  clad: 'b5aa9e',
  cladLight: 'c2b7a9',
  grooves: '968c81',
  sill: 'b8b2a7',
  roof: 'a9a092',
  underside: 'b0a391',
  dark: '81786e',
  frame: '494846',
  glass: '536568',
  alternateGlass: '5b6a6a',
  patio: 'a69e92',
  coping: 'bbb2a4',
  plinth: 'a29b91',
  aluminium: '747772',
});
const surfaces = {
  gallery: surface('wall', 'concrete_panel', 0.87),
  fascia: surface('trim', 'stone_travertine', 0.86),
  soffit: surface('roof', 'concrete_boardformed', 0.9),
  base: surface('foundation', 'concrete_plain', 0.87),
  paving: surface('foundation', 'stone_ashlar', 0.87),
  frame: surface('trim', 'metal_painted', 0.75, 0.14),
  glass: surface('window', 'storefront', 0.53, 0.037),
};
const up = [0, 1, 0],
  down = [0, -1, 0];

function annulus(out, slot, outer, inner, y, normal, color) {
  const points = [...outer, ...inner];
  const triangles = earcut(points.flat(), [outer.length]);
  for (let i = 0; i < triangles.length; i += 3)
    face(
      out,
      slot,
      triangles.slice(i, i + 3).map((k) => at(points[k], y)),
      normal,
      color,
    );
}

function strip(out, slot, lower, upper, a, b, tint, inverse = false) {
  const orientation = areaSign(upper) * (inverse ? -1 : 1);
  for (let i = 0; i < upper.length; i++) {
    const j = (i + 1) % upper.length;
    const wall = edge(upper[i], upper[j], orientation);
    face(
      out,
      slot,
      [at(lower[i], a), at(lower[j], a), at(upper[j], b), at(upper[i], b)],
      wall.normal,
      tint,
    );
  }
}

function gallery(out, outer, atrium, lowerRing, soffit, upperTop, lod) {
  const belt = soffit + 1.65;
  const lip = upperTop + 0.18;
  const lower = outer.map(([x, z]) => [x * 0.94, z * 0.926]);
  strip(out, 'soffit', lower, outer, soffit, belt, C.underside);
  strip(out, 'gallery', outer, outer, belt, upperTop, C.clad);
  strip(out, 'fascia', outer, outer, upperTop, lip, C.cladLight);
  strip(out, 'gallery', atrium, atrium, soffit, lip, C.cladLight, true);
  annulus(out, 'soffit', outer, atrium, upperTop + 0.009, up, C.roof);
  annulus(out, 'soffit', lower, atrium, soffit, down, C.underside);
  if (lod === 0) return;
  const orientation = areaSign(outer);
  for (const [i, [a, b]] of pairs(closed(outer)).entries()) {
    const wall = edge(a, b, orientation);
    panel(out, 'fascia', wall, 0, wall.length, belt + 0.11, belt + 0.29, 0.024, C.cladLight);
    panel(out, 'fascia', wall, 0, wall.length, upperTop - 0.43, upperTop - 0.23, 0.03, C.cladLight);
    if (lod > 1) {
      const divisions = Math.max(2, Math.round(wall.length / (lod === 3 ? 2.63 : 4.84)));
      const pitch = wall.length / divisions;
      for (let j = 1; j < divisions; j++) {
        const u = j * pitch;
        panel(
          out,
          'gallery',
          wall,
          u - 0.017,
          u + 0.017,
          belt + 0.31,
          upperTop - 0.49,
          0.041,
          C.grooves,
        );
      }
      for (const h of [belt + 1.94, belt + 3.8])
        if (h + 0.022 < upperTop - 0.58)
          panel(out, 'gallery', wall, 0, wall.length, h, h + 0.022, 0.041, C.grooves);
    }
    if (lod === 3) {
      const back = edge(lowerRing[i], lowerRing[(i + 1) % lowerRing.length], orientation);
      for (let j = 1; j < Math.ceil(wall.length / 4.1); j++) {
        const t = j / Math.ceil(wall.length / 4.1);
        beamPath(
          out,
          'soffit',
          [
            back.p(back.length * t, soffit - 0.08, 0.08),
            wall.p(wall.length * t, soffit - 0.08, -1.59),
          ],
          0.045,
          0.045,
          C.sill,
        );
      }
    }
  }
  for (const [a, b] of pairs(closed(atrium))) {
    const wall = edge(a, b, -areaSign(atrium));
    panel(out, 'fascia', wall, 0, wall.length, upperTop - 0.28, lip + 0.07, 0.033, C.coping);
    if (lod > 1)
      for (const offset of [soffit + 1.98, soffit + 4.04])
        panel(out, 'fascia', wall, 0, wall.length, offset, offset + 0.095, 0.021, C.grooves);
  }
}

function glazingWall(out, wall, bottom, glassY, top, lod, entrance) {
  const divisions = Math.max(2, Math.round(wall.length / (lod === 0 ? 5.5 : 2.27)));
  const width = wall.length / divisions;
  panel(out, 'base', wall, 0, wall.length, bottom, glassY, 0.031, C.dark);
  panel(out, 'fascia', wall, 0, wall.length, top - 0.36, top, 0.032, C.sill);
  for (let i = 0; i < divisions; i++) {
    const l = i * width,
      r = (i + 1) * width;
    const middle = Math.abs((i + 0.5) / divisions - 0.5) < 0.135,
      entryBay = entrance && middle;
    panel(
      out,
      'glass',
      wall,
      l + 0.035,
      r - 0.035,
      glassY,
      top - 0.36,
      0.015,
      i % 4 === 1 ? C.alternateGlass : C.glass,
    );
    if (lod < 1) continue;
    const mullion = entryBay ? 0.077 : 0.045;
    trimBlock(
      out,
      'frame',
      wall,
      l - mullion,
      l + mullion,
      glassY,
      top - 0.31,
      0.016,
      0.102,
      C.frame,
    );
    if (lod > 1) {
      const cross = top - (entryBay ? 1.06 : 1.34);
      panel(out, 'frame', wall, l, r, cross - 0.034, cross + 0.034, 0.117, C.frame);
      if (entryBay) {
        const u = (l + r) / 2;
        panel(out, 'frame', wall, u - 0.046, u + 0.046, glassY, cross, 0.12, C.frame);
        if (lod === 3)
          panel(
            out,
            'frame',
            wall,
            u + 0.074,
            u + 0.112,
            glassY + 0.94,
            glassY + 1.21,
            0.154,
            C.aluminium,
          );
      }
    }
  }
}

function lowerMuseum(out, outline, atrium, plaza, top, ground, lod) {
  const floor = Math.min(...outline.map((p) => ground(p))) - 0.35;
  const facing = areaSign(outline);
  for (const [i, [a, b]] of pairs(closed(outline)).entries()) {
    const wall = edge(a, b, facing);
    glazingWall(out, wall, floor, plaza + 0.105, top, lod, i === 0);
    if (lod > 0) {
      const count = Math.max(1, Math.round(wall.length / 8.8));
      for (let j = 0; j < count; j++) {
        const u = ((j + 0.52) * wall.length) / count;
        trimBlock(out, 'gallery', wall, u - 0.32, u + 0.32, floor, top, 0.12, 0.785, C.underside);
      }
    }
  }
  for (const [a, b] of pairs(closed(atrium)))
    glazingWall(out, edge(a, b, -areaSign(atrium)), floor, plaza + 0.15, top, lod, false);
  annulus(out, 'paving', outline, atrium, plaza, up, C.patio);
  // The floor in the light well is below the plaza and open to the sky.
  const courtY = Math.max(...atrium.map((p) => ground(p)), 0) + 0.09;
  cap(out, 'paving', atrium, courtY, C.patio);
  if (lod > 1) {
    for (const [a, b] of pairs(closed(atrium))) {
      const w = edge(a, b, -areaSign(atrium));
      panel(out, 'fascia', w, 0.05, w.length - 0.05, courtY + 0.1, courtY + 0.31, 0.043, C.coping);
    }
  }
}

function forecourt(out, outer, plaza, ground, lod) {
  const north = Math.min(...outer.map((p) => p[1]));
  const front = rect(-20.85, north - 4.12, 21.5, north + 8.38);
  const grade = (p) => Math.min(ground(p) - 0.21, plaza - 0.23);
  const sign = areaSign(front);
  for (const [a, b] of pairs(closed(front))) {
    const w = edge(a, b, sign);
    face(
      out,
      'base',
      [at(a, grade(a)), at(b, grade(b)), at(b, plaza), at(a, plaza)],
      w.normal,
      C.plinth,
    );
  }
  cap(out, 'paving', front, plaza, C.patio);
  if (lod === 0) return;
  const stepFront = north - 5.94;
  const approach = [-6.83, 0.5, 7.47].map((x) => ground([x, stepFront]));
  const stepBase = Math.min(plaza - 0.22, Math.max(...approach) + 0.03);
  const footing = Math.min(...approach) - 0.19;
  for (let i = 0; i < 5; i++) {
    const height = mix(stepBase, plaza, (i + 1) / 5);
    block(
      out,
      'paving',
      -6.83,
      footing,
      stepFront + 0.37 * i,
      14.3,
      height - footing,
      0.38,
      C.coping,
    );
  }
  if (lod < 2) return;
  for (const x of [-6.57, 0.28, 7.15]) {
    const a = [x, stepBase + 0.87, stepFront + 0.18],
      b = [x, plaza + 1, north - 3.72];
    beamPath(out, 'frame', [a, b], 0.048, 0.048, C.aluminium);
    for (const t of [0.12, 0.54, 0.93]) {
      const top = [x, mix(a[1], b[1], t), mix(a[2], b[2], t)];
      beamPath(out, 'frame', [[x, top[1] - 0.85, top[2]], top], 0.05, 0.05, C.aluminium);
    }
  }
}

function draw(out, lod, d, ground) {
  const { outer, atrium, plazaY, gallerySoffit, upperTop } = d;
  const ring = outer.map(([x, z]) => [x * 0.665, z * 0.657]);
  const soffit = plazaY + gallerySoffit;
  forecourt(out, outer, plazaY, ground, lod);
  lowerMuseum(out, ring, atrium, plazaY, soffit, ground, lod);
  gallery(out, outer, atrium, ring, soffit, plazaY + upperTop, lod);
}

const museum = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [56, 35, -61],
    lookAt: [0, 6.1, 0],
    yaw: 0.76,
    sun: [-340, 590, -460],
    brief:
      'The Athens War Museum at Rizari, with its deep concrete gallery cantilever, recessed glazed base, low entrance terrace and mapped central open atrium.',
    views: [
      {
        name: 'recessed-glass-and-overhanging-north-gallery',
        position: [-24, 7, -41],
        lookAt: [0, 5.7, -16],
      },
      { name: 'square-open-atrium-and-mapped-roof', position: [10, 57, 13], lookAt: [0, 4.2, 0] },
      {
        name: 'rizari-side-massing-and-terrain-contact',
        position: [43, 18, 30],
        lookAt: [4, 5.7, 3],
      },
      {
        name: 'north-terrace-and-entrance-stairs',
        position: [4.4, 5.8, -39],
        lookAt: [0.4, 4, -21],
      },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = museum;
const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const model = {
  ...museum.model,
  recipeDependencies: [...museum.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  sourceLicense:
    'Independent architecture from the exact mapped museum roof and atrium, the original Terrarium terrain and primary written architectural facts.',
  buildingCutout: {
    outline: plan.dimensions.outer,
    minimumCoverage: 0.91,
    basis: 'The exact museum roof extent replaces only the closely coincident procedural building.',
  },
};
