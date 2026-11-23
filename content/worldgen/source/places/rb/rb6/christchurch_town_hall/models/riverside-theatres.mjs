import { loft } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.94 },
  panels: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.87 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.86 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.83 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.41 },
};
const sill = site.eastSideLevel,
  roofY = site.podiumRoof;
const concrete = rgb('a9a193'),
  gray = rgb('969189'),
  coarse = rgb('8e8275');
const light = rgb('b6ac9b'),
  shaded = rgb('736b62'),
  roof = rgb('716a64');
const mullion = rgb('5e5951'),
  bronze = rgb('786a57');
const glassColors = ['54656b', '607476', '5b665f', '536068', '48585e', '6b7772'].map(rgb);

function pane(out, slot, f, a, b, y0, y1, d, color) {
  const p = f.P;
  quad4(out, slot, p(a, y0, d), p(b, y0, d), p(b, y1, d), p(a, y1, d), color);
}

function band(out, detail, f, y0, y1, recess, phase) {
  const segments = Math.max(1, Math.round(f.length / [9, 3.3, 1.78, 1.21][detail]));
  for (let i = 0; i < segments; i++) {
    const a = (i * f.length) / segments,
      b = ((i + 1) * f.length) / segments;
    pane(out, 'glass', f, a, b, y0, y1, recess, glassColors[(i + phase) % glassColors.length]);
    if (i > 0) {
      if (detail === 1) pane(out, 'trim', f, a - 0.052, a + 0.052, y0, y1, recess + 0.037, mullion);
      else if (detail > 1)
        fbox(out, 'trim', f, a - 0.052, a + 0.052, y0, y1, recess - 0.032, recess + 0.082, mullion);
    }
    if (detail > 1 && i % 3 === 0)
      pane(
        out,
        'glass',
        f,
        a + 0.11,
        b - 0.1,
        y0 + 0.92,
        y1 - 0.41,
        recess + 0.012,
        glassColors[(phase + 2) % glassColors.length],
      );
  }
  for (const y of detail > 0 ? [y0, y0 + (y1 - y0) * 0.47, y1] : [y0, y1]) {
    if (detail === 0)
      pane(out, 'trim', f, 0, f.length, y - 0.05, y + 0.057, recess + 0.045, bronze);
    else
      fbox(
        out,
        'trim',
        f,
        0,
        f.length,
        y - 0.051,
        y + 0.057,
        recess - 0.021,
        recess + 0.075,
        bronze,
      );
  }
}

function lowerFace(out, detail, a, b, grade, i) {
  const f = wallFace(a, b);
  if (f.length < 0.032) return;
  const cantilever = grade === sill;
  const glazed =
    f.length > 2.7 &&
    (cantilever ||
      f.normal[1] < -0.7 ||
      (f.normal[1] > 0.61 && i % 4 !== 0) ||
      (f.normal[0] < -0.6 && i % 4 !== 1));
  const color = i % 4 === 0 ? gray : concrete;
  if (glazed) {
    const bottom = cantilever ? grade + 0.57 : grade + 0.82;
    const ceiling = roofY - 1.07;
    pane(out, 'panels', f, 0, f.length, grade, bottom, 0, coarse);
    band(out, detail, f, bottom, ceiling, -0.3, i);
    if (detail === 0) {
      pane(out, 'concrete', f, 0, f.length, ceiling, roofY, 0, color);
      return;
    }
    fbox(out, 'concrete', f, 0, f.length, ceiling, roofY, -0.37, 0.19, color);
    fbox(out, 'concrete', f, -0.091, 0.27, grade, roofY - 0.19, -0.54, 0.16, light);
    fbox(
      out,
      'concrete',
      f,
      f.length - 0.22,
      f.length + 0.034,
      grade,
      roofY - 0.19,
      -0.54,
      0.17,
      color,
    );
  } else {
    pane(out, 'concrete', f, 0, f.length, grade, roofY, 0, color);
    if (detail > 1 && f.length > 3.75) {
      const n = Math.round(f.length / 2.36);
      for (let i = 1; i < n; i++) {
        const u = (i * f.length) / n;
        pane(out, 'trim', f, u - 0.014, u + 0.014, grade + 0.35, roofY - 0.7, 0.008, shaded);
      }
    }
  }
}

function baseBuilding(out, detail) {
  const r = outwardRing(site.outline);
  for (const [i, a] of r.entries()) {
    const b = r[(i + 1) % r.length];
    const start = a[1] > 27,
      end = b[1] > 27;
    if (start !== end) {
      const cut = [a[0] + (b[0] - a[0]) * ((27 - a[1]) / (b[1] - a[1])), 27];
      lowerFace(out, detail, a, cut, start ? sill : site.foundationBottom, i);
      lowerFace(out, detail, cut, b, end ? sill : site.foundationBottom, i);
    } else lowerFace(out, detail, a, b, start ? sill : site.foundationBottom, i);
  }
  cap(out, 'roof', r, roofY, roof);
  for (const r of site.restaurant) {
    const flip = {
      addTriangle(slot, _ref, p, _n, uv, color) {
        out.addTriangle(
          slot,
          'palette:#ffffff',
          [p[2], p[1], p[0]],
          [0, -1, 0],
          [uv[2], uv[1], uv[0]],
          color,
        );
      },
    };
    cap(flip, 'panels', r, sill, shaded);
  }
  for (const [x, z] of [
    [27.15, 40.72],
    [15.2, 39.53],
    [44.8, 31.5],
    [16.03, 29.22],
  ]) {
    const ring = (y, w, d) => [
      [x - w / 2, y, z - d / 2],
      [x - w / 2, y, z + d / 2],
      [x + w / 2, y, z + d / 2],
      [x + w / 2, y, z - d / 2],
    ];
    loft(
      out,
      'concrete',
      [
        ring(site.foundationBottom, 1.04, 1.58),
        ring(sill - 0.54, 1.12, 1.76),
        ring(sill + 0.02, 1.83, 2.68),
      ],
      light,
    );
  }
}

function volume(out, detail, { id, outline, height }) {
  const r = outwardRing(outline);
  const concert = id === 930572762,
    theatre = id === 930572763,
    grid = id === 993370307;
  const foot = concert ? 13.48 : roofY - 0.12;
  for (const [i, a] of r.entries()) {
    const f = wallFace(a, r[(i + 1) % r.length]);
    const color = i % 3 === 1 ? gray : coarse;
    const length = f.length;
    if (length < 0.04) continue;
    if (grid && length > 4.0) {
      band(out, detail, f, foot + 0.94, height - 0.96, -0.1, i);
      pane(out, 'panels', f, 0, length, foot, foot + 0.94, 0, coarse);
      pane(out, 'concrete', f, 0, length, height - 0.96, height, 0, light);
    } else if ((concert || theatre) && length < 2.85 && detail > 0) {
      pane(out, 'concrete', f, 0, length, foot, height, 0, shaded);
      const a = f.length * 0.27,
        b = f.length * 0.69;
      pane(out, 'roof', f, a, b, foot + 0.43, height - 1.1, 0.014, roof);
    } else {
      pane(out, 'concrete', f, 0, length, foot, height, 0, color);
      if (detail > 0 && (concert || theatre)) {
        for (const u of [length * 0.08, length * 0.9]) {
          const w = detail === 0 ? 0.17 : 0.275;
          fbox(out, 'concrete', f, u - w, u + w, foot, height - 0.032, -0.18, 0.43, light);
        }
        if (detail > 1 && length > 4.1) {
          const n = Math.floor(length / 1.52);
          for (let j = 1; j < n; j++) {
            const u = (j * length) / n;
            pane(
              out,
              'panels',
              f,
              u - 0.027,
              u + 0.027,
              foot + 0.18,
              height - 0.17,
              0.013,
              concrete,
            );
          }
        }
      }
    }
    if (detail > 0) pane(out, 'panels', f, 0, length, height - 0.41, height, 0.031, light);
  }
  cap(out, 'roof', r, height, id === 930572764 ? gray : roof);
  if (concert) {
    const center = r.reduce(([a, b], [x, z]) => [a + x / r.length, b + z / r.length], [0, 0]);
    const low = r.map(([x, z]) => [
      center[0] + (x - center[0]) * 1.137,
      roofY - 0.031,
      center[1] + (z - center[1]) * 1.137,
    ]);
    const high = r.map(([x, z]) => [x, foot + 0.02, z]);
    loft(out, 'roof', [low, high], roof, { cap: false });
  }
}

function arrivals(out, detail) {
  const f = facade([20.3, -28.3], [-1, 0]);
  const a = -13.4,
    b = 13.4;
  fbox(out, 'concrete', f, a, b, 5.27, 5.78, -1.12, 1.28, concrete);
  fbox(out, 'roof', f, a - 0.24, b + 0.24, 5.75, 5.87, -1.17, 1.36, roof);
  for (const u of [-11.1, 0, 11.1])
    fbox(out, 'panels', f, u - 0.16, u + 0.16, site.foundationBottom, 5.31, 0.81, 1.108, gray);
  if (detail > 0)
    for (const u of [-7.8, -3.11, 3.21, 7.8]) {
      fbox(out, 'glass', f, u - 0.87, u + 0.87, 0.07, 3.94, -0.12, 0.067, glassColors[0]);
      fbox(out, 'trim', f, u - 0.019, u + 0.019, 0.03, 4.02, 0.065, 0.13, bronze);
    }
}

function build(out, detail) {
  baseBuilding(out, detail);
  for (const part of site.parts) volume(out, detail, part);
  arrivals(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
