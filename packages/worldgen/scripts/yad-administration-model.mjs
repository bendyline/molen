/** The Administration and Research Building on the uphill side of the archives lane. */
import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/sv/sv9/northern_detached_study_wing_yad_vashem/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source), 'utf8'));
const layout = read('layout.json');
const references = read('reference-metadata.json');
const palette = {
  stone: [0.69, 0.646, 0.56],
  plinth: [0.5, 0.472, 0.406],
  roof: [0.47, 0.454, 0.424],
  windows: [0.17, 0.26, 0.28],
  trim: [0.32, 0.34, 0.34],
};
const [nw, ne, se, sw] = layout.outline;
const splitNorth = [layout.westRoofEdgeX, nw[1]];
const splitSouth = [layout.westRoofEdgeX, sw[1]];
const westPlan = [nw, splitNorth, splitSouth, sw];
const eastPlan = [splitNorth, ne, se, splitSouth];

function surface(out, role, points, normal = normalFor(...points), tint = palette[role]) {
  const actual = normalFor(...points);
  const flip = actual.reduce((sum, x, i) => sum + x * normal[i], 0) < 0;
  quad(out, role, flip ? points.toReversed() : points, normal, tint);
}

function elevation(out, a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const direction = [(b[0] - a[0]) / length, 0, (b[1] - a[1]) / length];
  const normal = [direction[2], 0, -direction[0]];
  const at = (u, y, d = 0) => [
    a[0] + u * direction[0] - d * normal[0],
    y,
    a[1] + u * direction[2] - d * normal[2],
  ];
  const panel = (role, left, right, y0, y1, depth = 0, tint) => {
    if (right - left < 1e-4 || y1 - y0 < 1e-4) return;
    surface(
      out,
      role,
      [at(left, y0, depth), at(right, y0, depth), at(right, y1, depth), at(left, y1, depth)],
      normal,
      tint,
    );
  };
  return { length, direction, normal, at, panel };
}

function bay(out, facade, left, right, y0, y1, detail, mullions = 0) {
  const recess = detail ? (right - left > 2 ? 0.38 : 0.23) : 0;
  const { at, panel, direction } = facade;
  panel('windows', left, right, y0, y1, recess);
  if (!detail) return;
  for (const [s, sign] of [
    [left, 1],
    [right, -1],
  ])
    surface(
      out,
      'stone',
      [at(s, y0), at(s, y0, recess), at(s, y1, recess), at(s, y1)],
      direction.map((n) => n * sign),
    );
  surface(
    out,
    'stone',
    [at(left, y0), at(right, y0), at(right, y0, recess), at(left, y0, recess)],
    [0, 1, 0],
  );
  surface(
    out,
    'stone',
    [at(left, y1), at(right, y1), at(right, y1, recess), at(left, y1, recess)],
    [0, -1, 0],
  );
  if (detail < 2) return;
  if (mullions) {
    for (let i = 1; i <= mullions; i++) {
      const u = left + ((right - left) * i) / (mullions + 1);
      panel('trim', u - 0.032, u + 0.032, y0, y1, recess - 0.044);
    }
    if (y1 - y0 > 2.4) {
      const y = y0 + (y1 - y0) * 0.66;
      panel('trim', left, right, y - 0.034, y + 0.034, recess - 0.048);
    }
  }
  if (detail < 3) return;
  const frame = 0.051;
  panel('trim', left, right, y0, y0 + frame, recess - 0.064);
  panel('trim', left, right, y1 - frame, y1, recess - 0.066);
  panel('trim', left, left + frame, y0 + frame, y1 - frame, recess - 0.059);
  panel('trim', right - frame, right, y0 + frame, y1 - frame, recess - 0.059);
  surface(
    out,
    'stone',
    [
      at(left - 0.045, y0 + 0.006, -0.09),
      at(right + 0.045, y0 + 0.006, -0.09),
      at(right + 0.045, y0 + 0.006, 0),
      at(left - 0.045, y0 + 0.006, 0),
    ],
    [0, 1, 0],
  );
  panel('stone', left - 0.045, right + 0.045, y0 - 0.069, y0 + 0.006, -0.09);
}

function repeat(count, start, end, width) {
  return Array.from({ length: count }, (_, i) => {
    const centre = start + ((end - start) * (i + 0.5)) / count;
    return [centre - width * 0.5, centre + width * 0.5];
  });
}

function facade(out, a, b, top, rows, detail) {
  const edge = elevation(out, a, b);
  const { panel, at, length } = edge;
  panel('plinth', 0, length, 0, 2.05);
  let previousY = 2.05;
  for (const { y0, y1, spans, mullions } of rows) {
    panel('stone', 0, length, previousY, y0);
    let previous = 0;
    for (const [left, right] of spans) {
      panel('stone', previous, left, y0, y1);
      bay(out, edge, left, right, y0, y1, detail, mullions);
      previous = right;
    }
    panel('stone', previous, length, y0, y1);
    previousY = y1;
  }
  panel('stone', 0, length, previousY, top + 0.31);
  panel('stone', 0, length, top + 0.19, top + 0.32, -0.06, [0.78, 0.745, 0.679]);
  surface(
    out,
    'stone',
    [
      at(0, top + 0.32, -0.06),
      at(length, top + 0.32, -0.06),
      at(length, top + 0.32, 0.24),
      at(0, top + 0.32, 0.24),
    ],
    [0, 1, 0],
  );
}

function row(y0, y1, count, left, right, width, mullions) {
  return { y0, y1, spans: repeat(count, left, right, width), mullions };
}

function roof(out, plan, y, tint) {
  surface(
    out,
    'roof',
    plan.map(([x, z]) => [x, y, z]),
    [0, 1, 0],
    tint,
  );
}

function build(out, detail) {
  const { westRoofY, bodyRoofY, roofAccess } = layout;
  const westWidth = splitNorth[0] - nw[0];
  const eastWidth = ne[0] - splitNorth[0];
  const fine = detail > 0;
  roof(out, westPlan, westRoofY, [0.66, 0.649, 0.61]);
  roof(out, eastPlan, bodyRoofY);
  facade(
    out,
    nw,
    splitNorth,
    westRoofY,
    [
      row(3.8, 4.78, fine ? 8 : 5, 0.8, westWidth - 0.85, fine ? 0.65 : 1.04),
      row(5.37, 6.34, fine ? 8 : 5, 0.8, westWidth - 0.85, fine ? 0.65 : 1.04),
      row(7.02, 10.84, 4, 1.03, westWidth - 0.65, 2.86, 2),
      row(12.64, 13.39, 7, 1.0, westWidth - 0.7, 0.6),
    ],
    detail,
  );
  facade(
    out,
    splitNorth,
    ne,
    bodyRoofY,
    [
      row(3.77, 4.83, fine ? 19 : 10, 0.9, eastWidth - 0.92, fine ? 0.68 : 1.55),
      row(
        6.65,
        7.88,
        fine ? 18 : 10,
        1.1,
        eastWidth - 1.02,
        fine ? 0.95 : 1.58,
        detail > 3 ? 1 : 0,
      ),
      row(9.81, 10.96, fine ? 17 : 10, 1.32, eastWidth - 1.02, fine ? 0.92 : 1.54),
    ],
    detail,
  );
  facade(
    out,
    se,
    splitSouth,
    bodyRoofY,
    [
      row(5.02, 6.04, fine ? 17 : 8, 1.0, eastWidth - 1, fine ? 0.75 : 1.45),
      row(7.86, 9.04, fine ? 17 : 8, 1.0, eastWidth - 1, fine ? 0.82 : 1.53),
      row(10.56, 11.7, fine ? 17 : 8, 1.0, eastWidth - 1, fine ? 0.88 : 1.55),
    ],
    detail,
  );
  facade(
    out,
    splitSouth,
    sw,
    westRoofY,
    [
      row(7.85, 9.13, 5, 1.24, westWidth - 1.1, 1.16),
      row(10.65, 12.0, 5, 1.24, westWidth - 1.1, 1.16),
    ],
    detail,
  );
  facade(
    out,
    ne,
    se,
    bodyRoofY,
    [row(7.81, 8.75, 4, 2, 14.7, 0.73), row(10.73, 11.69, 4, 2, 14.7, 0.73)],
    detail,
  );
  facade(
    out,
    sw,
    nw,
    westRoofY,
    [
      { y0: 2.17, y1: 4.96, spans: [[3.1, 5.47]], mullions: 1 },
      row(9.42, 11.38, 3, 2.1, 14.6, 1.1),
    ],
    detail,
  );
  const step = elevation(out, splitNorth, splitSouth);
  step.panel('stone', 0, step.length, bodyRoofY, westRoofY + 0.32);
  const meeting = elevation(out, splitSouth, splitNorth);
  meeting.panel('stone', 0, meeting.length, bodyRoofY, westRoofY + 0.32, 0.01);
  for (let k = 0; k < 3; k++)
    box(
      out,
      'plinth',
      [nw[0] - 1.08 + k * 0.3, 0, sw[1] - 5.75],
      [nw[0] - 0.013, 1.83 + k * 0.17, sw[1] - 2.85],
      palette.plinth,
    );

  const { x, z, width, depth, height } = roofAccess;
  box(out, 'stone', [x, bodyRoofY, z], [x + width, bodyRoofY + height, z + depth], palette.stone);
  box(
    out,
    'trim',
    [x - 0.1, bodyRoofY + height - 0.03, z - 0.1],
    [x + width + 0.1, bodyRoofY + height + 0.18, z + depth + 0.1],
    palette.trim,
  );
  if (detail < 2) return;
  const access = elevation(out, [x, z - 0.004], [x + width, z - 0.004]);
  access.panel('windows', 0.46, width - 0.58, bodyRoofY + 0.35, bodyRoofY + 1.42, -0.014);
  access.panel('trim', width * 0.51, width * 0.535, bodyRoofY + 0.35, bodyRoofY + 1.42, -0.017);
  for (const [px, pz, w, d] of [
    [12.1, 1.2, 1.8, 1.36],
    [20.8, -3.52, 0.98, 0.85],
    [-7.3, -4.29, 1.16, 0.91],
  ]) {
    box(out, 'trim', [px, bodyRoofY + 0.03, pz], [px + w, bodyRoofY + 0.43, pz + d], palette.trim);
    if (detail > 2)
      for (let i = 0; i < 4; i++)
        box(
          out,
          'trim',
          [px + 0.1 + i * w * 0.21, bodyRoofY + 0.43, pz + 0.08],
          [px + 0.15 + i * w * 0.21, bodyRoofY + 0.46, pz + d - 0.08],
          palette.trim,
        );
  }
}

export const buildYadAdministrationSkyline = (out) => build(out, 0);
export const buildYadAdministrationDistrict = (out) => build(out, 1);
export const buildYadAdministrationStreet = (out) => build(out, 2);
export const buildYadAdministrationCloseup = (out) => build(out, 3);

export const yadAdministrationStudy = {
  id: 'northern_detached_study_wing_yad_vashem',
  title: 'Administration and Research Building, Yad Vashem',
  category: 'museum',
  wikidataId: 'Q156591',
  mapFrame: 'map-frame.json',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  build: (out) => build(out, 4),
  scaleBasis:
    'PMTiles footprint measures 55.34 m east-west by 17.01 m. Roof heights and facade proportions are estimated from the two oblique photos.',
  refs: references.pictures.map((p) => p.page),
  geometrySource:
    'Original exterior derived from the exact PMTiles footprint and two oblique photographs of this detached building.',
  sourceLicense:
    'Original geometry under repository license. Map evidence © OpenStreetMap contributors, ODbL-1.0. Reference photos viewed only.',
  qaCameras: [],
};
