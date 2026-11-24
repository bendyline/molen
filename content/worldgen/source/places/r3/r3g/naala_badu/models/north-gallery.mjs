import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
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
  limestone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.92 },
  concrete: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.94 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.73 },
  solar: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.45 },
  bed: { slot: 'roof', graph: 'gravel', roughness: 0.98 },
  glazing: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    roughness: 0.34,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.51],
    doubleSided: true,
  },
  canopy: {
    slot: 'window',
    localRef: 'palette:#e7f1f5',
    roughness: 0.37,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.64],
    doubleSided: true,
  },
};
const stone = rgb('d8d7cb');
const white = rgb('e1e0d9');
const concrete = rgb('b7b4aa');
const paving = rgb('bdac9b');
const glazing = rgb('748d99');
const skyGlass = rgb('b2c6d4');
const solar = rgb('3e4f64');
const soil = rgb('77835d');
const dry = rgb('8d8c62');
const interior = rgb('caba9f');
const base = site.foundationBottom;
function panel(out, slot, f, a, b, y0, y1, d, color) {
  const P = f.P;
  quad4(out, slot, P(a, y0, d), P(b, y0, d), P(b, y1, d), P(a, y1, d), color);
}

function walls(out, slot, ring, lower, upper, color, inset = 0) {
  for (const [i, a] of ring.entries()) {
    const f = wallFace(a, ring[(i + 1) % ring.length]);
    if (f.length > 0.014) panel(out, slot, f, 0, f.length, lower, upper, inset, color);
  }
}

function glassWall(out, f, floor, ceiling, detail, open = false) {
  const P = f.P;
  if (detail === 0) {
    panel(out, 'glazing', f, 0, f.length, floor, ceiling, -0.04, glazing);
    return;
  }
  const count = Math.max(1, Math.round(f.length / [4.7, 3.8, 2.3, 2.15][detail]));
  const mid = Math.floor(count / 2);
  const bay = f.length / count;
  fbox(out, 'metal', f, 0, f.length, ceiling - 0.17, ceiling, -0.155, 0.045, white);
  for (let i = 0; i < count; i++) {
    const a = i * bay,
      b = a + bay;
    if (!(open && i === mid))
      quad4(
        out,
        'glazing',
        P(a, floor, -0.04),
        P(b, floor, -0.04),
        P(b, ceiling, -0.04),
        P(a, ceiling, -0.04),
        glazing,
      );
    const mullion = detail > 1 ? 0.036 : 0.065;
    if (detail === 1)
      panel(out, 'metal', f, a - mullion, a + mullion, floor, ceiling - 0.12, 0.056, white);
    else
      fbox(out, 'metal', f, a - mullion, a + mullion, floor, ceiling - 0.12, -0.16, 0.056, white);
    if (open && i === mid) {
      fbox(out, 'metal', f, a, b, floor + 2.56, floor + 2.66, -0.1, 0.05, white);
      quad4(
        out,
        'glazing',
        P(a, floor + 2.65, -0.04),
        P(b, floor + 2.65, -0.04),
        P(b, ceiling, -0.04),
        P(a, ceiling, -0.04),
        glazing,
      );
    }
    if (detail === 3 && i !== mid)
      fbox(out, 'metal', f, a, b, floor + 0.08, floor + 0.135, -0.08, 0.048, white);
  }
  fbox(
    out,
    'metal',
    f,
    f.length - 0.04,
    f.length + 0.037,
    floor,
    ceiling - 0.12,
    -0.155,
    0.048,
    white,
  );
}

function floorCap(out, part, lower, upper, wall, top) {
  const ring = outwardRing(part);
  walls(out, 'concrete', ring, lower, upper, wall);
  cap(out, 'concrete', ring, upper, top);
}

function inset(ring, [x, z], amount) {
  return ring.map(([a, b]) => [x + (a - x) * amount, z + (b - z) * amount]);
}
function inside([x, z], ring) {
  let yes = false;
  for (const [i, [a, b]] of ring.entries()) {
    const [c, d] = ring[(i + 1) % ring.length];
    if (b > z !== d > z && x < a + ((c - a) * (z - b)) / (d - b)) yes = !yes;
  }
  return yes;
}

function plantedRoof(out, part, detail) {
  const { outline, center, roof } = part;
  const green = inset(outline, center, 0.92);
  cap(out, 'bed', green, roof + 0.025, soil);
  const bounds = [0, 1].map((i) => [
    Math.min(...green.map((p) => p[i])),
    Math.max(...green.map((p) => p[i])),
  ]);
  if (detail > 0) {
    const patch = detail === 3 ? 2.4 : 4.5;
    for (let x = bounds[0][0] + patch; x < bounds[0][1] - patch; x += patch) {
      for (let z = bounds[1][0] + patch; z < bounds[1][1] - patch; z += patch) {
        const wobble = (Math.sin(x * 2.43 + z * 4.21) + 1) * 0.35;
        const p = [
          [x - wobble, z - 0.45],
          [x + 0.9, z - 0.55],
          [x + 0.57, z + 0.93],
          [x - 0.6, z + 0.58],
        ];
        if (p.every((v) => inside(v, green)))
          quad4(
            out,
            'bed',
            [p[3][0], roof + 0.052, p[3][1]],
            [p[2][0], roof + 0.057, p[2][1]],
            [p[1][0], roof + 0.052, p[1][1]],
            [p[0][0], roof + 0.06, p[0][1]],
            wobble > 0.37 ? dry : rgb('677a55'),
          );
      }
    }
  }
  if (detail > 0) walls(out, 'metal', outwardRing(outline), roof - 0.07, roof + 0.15, white, 0.039);
}

function solarRoof(out, part, detail) {
  const F = facade(part.center, [0.61, -0.792]);
  const y = part.roof + 0.045,
    radius = detail < 2 ? 7.9 : 2.79;
  const b = detail < 2 ? 5.0 : 2.63;
  for (let u = -22; u < 29; u += radius * 2 + 0.35) {
    for (let v = -19.7; v < 22; v += b * 2 + 0.22) {
      const vertices = [
        [u - radius, v + b],
        [u + radius, v + b],
        [u + radius, v - b],
        [u - radius, v - b],
      ].map(([x, z]) => F.P(x, y, z));
      if (vertices.some(([x, , z]) => !inside([x, z], part.outline))) continue;
      quad4(out, 'solar', ...vertices, solar);
      if (detail > 1)
        fbox(
          out,
          'metal',
          F,
          u - radius,
          u + radius,
          y - 0.045,
          y + 0.044,
          v - 0.037,
          v + 0.036,
          rgb('8f969d'),
        );
    }
  }
}

function pavilion(out, part, detail) {
  const { outline, floor, roof, kind } = part;
  floorCap(out, outline, base, floor + 0.04, concrete, interior);
  const ring = outwardRing(outline);
  for (const [i, a] of ring.entries()) {
    const f = wallFace(a, ring[(i + 1) % ring.length]);
    if (f.length < 0.088) continue;
    const glass =
      kind === 'atrium' ||
      kind === 'terrace' ||
      (kind === 'wakil' && (f.normal[1] > 0.3 || f.normal[0] < -0.28)) ||
      (kind === 'east' && f.normal[1] < -0.36) ||
      (kind === 'lower' && f.normal[0] > 0.42);
    if (glass && f.length > 2.65)
      glassWall(
        out,
        f,
        floor,
        roof - 0.3,
        detail,
        kind === 'wakil' && f.normal[1] > 0.68 && f.length > 8,
      );
    else panel(out, 'limestone', f, 0, f.length, floor, roof - 0.28, 0, stone);
  }
  walls(out, 'limestone', ring, roof - 0.33, roof, stone, 0.075);
  cap(out, 'concrete', inset(outline, part.center, 1.003), roof, white);
  if (kind === 'east' || kind === 'lower' || kind === 'garden') plantedRoof(out, part, detail);
  if (kind === 'wakil') solarRoof(out, part, detail);
  if (kind === 'terrace' && detail > 0) curvedSteps(out, roof);
  if (kind === 'atrium') {
    // The public atrium reads through the glass as a shallow second level and an open stair.
    if (detail > 0) {
      const [x, z] = part.center;
      abox(
        out,
        'concrete',
        [x - 4.25, floor + 3.12, z - 5.3],
        [x + 4.1, floor + 3.29, z + 5.3],
        interior,
      );
    }
  }
}

function column(out, position, floor, roof, detail) {
  const n = [4, 8, 12, 16][detail];
  const r = (y, r) => radialRing(y, r, r, n, position);
  loft(out, 'metal', [r(floor, 0.117), r(roof, 0.113)], white);
}

function canopy(out, part, detail) {
  const face = wallFace(...site.canopyAxis);
  const { floor, roof } = part;
  const inner = part.outline[7];
  const far =
    (inner[0] - face.origin[0]) * face.normal[0] + (inner[1] - face.origin[1]) * face.normal[1];
  floorCap(out, part.outline, floor - 0.63, floor, paving, paving);
  const strips = [6, 13, 16, 18][detail],
    segments = [2, 4, 6, 9][detail];
  const pitch = face.length / strips;
  const wave = (u, t) => roof - 0.182 * Math.cos(t * Math.PI * 2) - (0.018 * u) / face.length;
  for (let i = 0; i < strips; i++) {
    const c = i * pitch;
    for (let j = 0; j < segments; j++) {
      const t0 = j / segments,
        t1 = (j + 1) / segments,
        a = c + t0 * pitch,
        b = c + t1 * pitch;
      const p = face.P;
      quad4(
        out,
        'canopy',
        p(a, wave(a, t0), 0.2),
        p(b, wave(b, t1), 0.2),
        p(b, wave(b, t1), far),
        p(a, wave(a, t0), far),
        skyGlass,
      );
    }
    if (detail > 0)
      fbox(out, 'metal', face, c - 0.028, c + 0.028, roof - 0.221, roof - 0.175, far, 0.24, white);
  }
  const rows = detail === 0 ? 3 : 5,
    columns = detail === 0 ? 4 : 5;
  for (let i = 0; i < rows; i++) {
    const d = 0.3 + ((far - 0.3) * i) / (rows - 1);
    fbox(
      out,
      'metal',
      face,
      -0.06,
      face.length + 0.05,
      roof - 0.323,
      roof - 0.258,
      d - 0.056,
      d + 0.056,
      white,
      true,
    );
    for (let j = 0; j < columns; j++) {
      const u = 1.16 + ((face.length - 2.32) * j) / (columns - 1);
      const [x, , z] = face.P(u, 0, d);
      column(out, [x, z], floor, roof - 0.285, detail);
    }
  }
  if (detail > 1)
    fbox(
      out,
      'metal',
      face,
      -0.05,
      face.length + 0.04,
      roof - 0.306,
      roof - 0.241,
      far - 0.066,
      far + 0.044,
      white,
      true,
    );
}

function hub(out, { outline, floor, roof }, detail) {
  const ring = outwardRing(detail === 0 ? outline.filter((_, i) => i % 4 === 0) : outline);
  walls(out, 'limestone', ring, floor, floor + 0.83, white);
  for (const [i, a] of ring.entries()) {
    const f = wallFace(a, ring[(i + 1) % ring.length]);
    if (f.normal[1] > 0.25 && f.length > 0.4) {
      quad4(
        out,
        'glazing',
        f.P(0, floor + 0.84),
        f.P(f.length, floor + 0.84),
        f.P(f.length, roof - 0.38),
        f.P(0, roof - 0.38),
        glazing,
      );
      if (detail > 1)
        fbox(out, 'metal', f, 0, 0.043, floor + 0.83, roof - 0.38, -0.08, 0.055, white);
    } else panel(out, 'limestone', f, 0, f.length, floor + 0.83, roof - 0.38, 0, white);
  }
  floorCap(out, ring, roof - 0.39, roof, white, white);
}

function residual(out, part) {
  const { outline, holes, roof } = part;
  const adapter = {
    ...out,
    addCap(slot, ref, outline, holes, grade, normal, uv, color) {
      const mesh = new MeshBufferBuilder();
      if (!mesh.addCap('roof', ref, outline, holes, grade, normal, uv, color)) return false;
      const { positions, indices } = mesh.finalize();
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
  extrude(adapter, 'concrete', outline, base, roof, concrete, {
    holes,
    topSlot: 'bed',
    topColor: soil,
  });
}

function curvedSteps(out, roof) {
  const F = facade([-0.06, -27.25], [0.986, -0.167]);
  for (let i = 0; i < 6; i++) {
    const y = roof + 0.08 + i * 0.196;
    const path = Array.from({ length: 11 }, (_, j) => {
      const x = (j - 5) * 1.34,
        d = -0.206 * x * x - i * 0.52;
      return F.P(x, y, d);
    });
    beamPath(out, 'concrete', path, 0.66, 0.27, paving);
  }
}

function build(out, detail) {
  for (const part of site.parts) {
    if (part.kind === 'canopy') canopy(out, part, detail);
    else pavilion(out, part, detail);
  }
  for (const part of site.floors) residual(out, part);
  for (const kiosk of site.kiosks) hub(out, kiosk, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
