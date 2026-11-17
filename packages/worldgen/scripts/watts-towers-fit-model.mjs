/** Site fit and open-frame delivery meshes for Rodia's Watts Towers. */
import { readFileSync } from 'node:fs';
import { cross, loft, normalize, radialRing } from './authored-structure-mesh.mjs';
import { face, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';
import { buildWattsDelivery, wattsTowers } from './watts-towers-model.mjs';

const map = JSON.parse(readFileSync(structureSourcePath('watts_towers', 'map-frame.json')));
const { corners, grades, triangles, raise, minimum } = JSON.parse(
  readFileSync(structureSourcePath('watts_towers', 'fit-controls.json')),
);
const tau = Math.PI * 2;
const concrete = [0.6, 0.585, 0.52];
const stucco = [0.4, 0.405, 0.37];
const cream = [0.67, 0.65, 0.56];
const red = [0.52, 0.31, 0.25];
const teal = [0.21, 0.45, 0.39];
const signedArea = ([x, z], [a, b], [p, q]) => (a - x) * (q - z) - (b - z) * (p - x);

function courtGrade(position) {
  const side = signedArea(corners[0], corners[2], position);
  const indices = triangles[side <= 0 ? 0 : 1];
  const area = signedArea(...indices.map((i) => corners[i]));
  return indices.reduce(
    (sum, i, k) =>
      sum +
      (grades[i] *
        signedArea(corners[indices[(k + 1) % 3]], corners[indices[(k + 2) % 3]], position)) /
        area,
    0,
  );
}

function fitted(out, datumOffset) {
  const geometry = (method) => (slot, ref, points, normal, uv, color) => {
    const fittedPoints = points.map(([x, y, z]) => [
      x,
      y + courtGrade([x, z]) + raise + datumOffset,
      z,
    ]);
    out[method](slot, ref, fittedPoints, normal, uv, color);
  };
  return {
    addQuad: geometry('addQuad'),
    addTriangle: geometry('addTriangle'),
    addConvexPolygon: geometry('addConvexPolygon'),
  };
}

function courtSkirt(out, offset) {
  const ring = corners.map(([x, z], index) => ({ x, z, grade: grades[index] })).reverse();
  loft(
    out,
    'concrete',
    [
      ring.map(({ x, z, grade }) => [x, grade - 0.085 + offset, z]),
      ring.map(({ x, z, grade }) => [x, grade + raise + 0.002 + offset, z]),
    ],
    concrete,
    { cap: false },
  );
}

export function buildWattsFittedMaster(out) {
  wattsTowers.build(fitted(out, 0));
  courtSkirt(out, 0);
}

export function buildWattsStreet(out) {
  buildWattsDelivery(fitted(out, -minimum), 'street');
  courtSkirt(out, -minimum);
}

export function buildWattsCloseup(out) {
  buildWattsDelivery(fitted(out, -minimum), 'closeup');
  courtSkirt(out, -minimum);
}

function twoSided(out, slot, points, color) {
  face(out, slot, points, color);
  face(out, slot, [...points].reverse(), color);
}

function rod(out, a, b, width, color = stucco) {
  const along = normalize(b.map((p, i) => p - a[i]));
  const side = normalize(cross(along, Math.abs(along[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0]));
  for (const direction of [side, cross(along, side)]) {
    const edge = (p, sign) => p.map((v, i) => v + sign * width * direction[i]);
    twoSided(out, 'plaster', [edge(a, -1), edge(b, -1), edge(b, 1), edge(a, 1)], color);
  }
}

function polar(x, z, r, y, a) {
  return [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
}

function hoop(out, x, y, z, r, segments, thickness = 0.03) {
  for (let i = 0; i < segments; i++) {
    const a = (i * tau) / segments,
      b = ((i + 1) * tau) / segments;
    twoSided(
      out,
      'plaster',
      [
        polar(x, z, r, y - thickness, a),
        polar(x, z, r, y - thickness, b),
        polar(x, z, r, y + thickness, b),
        polar(x, z, r, y + thickness, a),
      ],
      stucco,
    );
  }
}

function cage(out, { x, z, height, radius, base, legs, bands, sides, brace = false }) {
  const r = (t) => radius * (1 - t) + 0.021;
  for (let i = 0; i < legs; i++) {
    const a = 0.2 + (i * tau) / legs;
    rod(out, polar(x, z, r(0), base, a), polar(x, z, r(1), height, a), 0.049);
  }
  for (let i = 0; i < bands; i++) {
    const t = (i / (bands - 1)) * 0.925,
      y = base + (height - base) * t;
    hoop(out, x, y, z, r(t), sides, 0.035);
    if (brace && i + 1 < bands && i % 3 === 0) {
      const next = ((i + 1) / (bands - 1)) * 0.925;
      for (let k = 0; k < legs; k += 3) {
        const a = 0.2 + (k * tau) / legs,
          b = a + tau / legs;
        rod(
          out,
          polar(x, z, r(t), y, a),
          polar(x, z, r(next), base + (height - base) * next, b),
          0.026,
          cream,
        );
      }
    }
  }
}

function lowBase(out, x, z, r, height, sides) {
  loft(
    out,
    'concrete',
    [radialRing(0.075, r, r, sides, [x, z]), radialRing(height, r * 0.82, r * 0.82, sides, [x, z])],
    concrete,
  );
}

function sculptureCourt(out, district) {
  for (const ids of triangles)
    triangle(
      out,
      'concrete',
      ids.map((i) => [corners[i][0], 0.075, corners[i][1]]),
      concrete,
    );
  const group = [
    { name: 'west', h: 30.327, r: 2.286, base: 0.95, legs: 8, bands: 16 },
    { name: 'center', h: 29.5148, r: 2.0574, base: 0.9, legs: 8, bands: 17 },
    { name: 'east', h: 17.3736, r: 1.3716, base: 0.6, legs: 6, bands: 10 },
  ];
  for (const { name, h, r, base, legs, bands } of group) {
    const [x, z] = map.components[name].local;
    lowBase(out, x, z, r, base, district ? 10 : 4);
    cage(out, {
      x,
      z,
      height: h,
      radius: r * 0.96,
      base,
      legs: district ? legs : 4,
      bands: district ? bands : name === 'east' ? 3 : 5,
      sides: district ? 8 : 4,
      brace: district,
    });
    if (district && name !== 'east')
      cage(out, {
        x,
        z,
        height: name === 'west' ? 26.6 : 22.6,
        radius: r * 0.57,
        base: 1.2,
        legs: 4,
        bands: 5,
        sides: 4,
      });
    if (name !== 'west') continue;
    const loops = district ? 9 : 3;
    for (let i = 0; i < loops; i++) {
      const y = 3.55 + (i * 21) / (loops - 1),
        radius = r * (1 - y / h) + 0.6;
      const a = [x - radius, y, z],
        b = [x, y + 0.8, z],
        c = [x + radius, y, z],
        d = [x, y - 0.8, z];
      for (const [p, q] of [
        [a, b],
        [b, c],
        [c, d],
        [d, a],
      ])
        rod(out, p, q, 0.037, cream);
    }
  }

  const [gx, gz] = map.components.gazebo.local;
  lowBase(out, gx, gz, 2.8956, 0.4, district ? 8 : 4);
  const legs = district ? 8 : 4;
  for (let i = 0; i < legs; i++) {
    const a = (i * tau) / legs;
    const shoulder = polar(gx, gz, 2.75, 3.7, a);
    rod(out, polar(gx, gz, 2.75, 0.34, a), shoulder, 0.098);
    rod(out, shoulder, polar(gx, gz, 1.69, 6.6, a), 0.065);
  }
  hoop(out, gx, 3.7, gz, 2.75, legs, 0.071);
  cage(out, {
    x: gx,
    z: gz,
    base: 6.5,
    height: 12.19,
    radius: 1.63,
    legs: district ? 6 : 3,
    bands: district ? 6 : 3,
    sides: district ? 6 : 4,
  });
  if (district) lowBase(out, gx, gz, 0.51, 0.75, 8);

  const [sx, sz] = map.components.ship.local;
  const hull = transform(out, 0, [sx, 0, sz]);
  box(hull, 'concrete', [-3.08, 0.075, -0.31], [2.68, 0.38, 0.78], red);
  for (const [offset, h] of [
    [-1.5, 4.5],
    [0.15, 5.4],
    [1.44, 3.9],
  ]) {
    rod(hull, [offset, 0.38, 0.25], [offset, h, 0.25], 0.08, cream);
    rod(hull, [offset - 0.65, h * 0.64, 0.25], [offset + 0.69, h * 0.64, 0.25], 0.055, teal);
  }
  for (const [name, height] of [
    ['towerA', 6.4],
    ['towerB', 5.5],
  ]) {
    const [x, z] = map.components[name].local;
    cage(out, {
      x,
      z,
      base: 0.1,
      height,
      radius: 0.53,
      legs: district ? 3 : 2,
      bands: district ? 6 : 2,
      sides: 4,
    });
  }
  const [hx, hz] = map.components.house.local;
  box(out, 'concrete', [hx - 3, 0.075, hz - 0.4], [hx + 2.7, 1.53, hz - 0.2], concrete);
  box(out, 'concrete', [hx - 3, 0.075, hz - 0.2], [hx - 2.5, 3.32, hz + 0.45], red);
  for (let i = 0; i < (district ? 7 : 3); i++) {
    const x = -19 + i * (district ? 5.05 : 11);
    box(
      out,
      'concrete',
      [x, 0.075, 4.72],
      [x + (district ? 3.8 : 8.5), 1.18, 4.91],
      i % 2 ? red : cream,
    );
  }
}

export function buildWattsSkyline(out) {
  sculptureCourt(fitted(out, -minimum), false);
  courtSkirt(out, -minimum);
}

export function buildWattsDistrict(out) {
  sculptureCourt(fitted(out, -minimum), true);
  courtSkirt(out, -minimum);
}
