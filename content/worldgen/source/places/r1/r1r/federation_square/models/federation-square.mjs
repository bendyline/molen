import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { deform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  zinc: { slot: 'wall', graph: 'metal_painted', roughness: 0.86 },
  cladding: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.91 },
  slab: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.78 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.52 },
};
const mutedMetal = ['858b89', '949894', '797d77', 'b4b2a9', '9ea39f'].map(rgb);
const sandstone = ['af9681', 'c6ab8f', 'bba08b'].map(rgb);
const windowGlass = ['435451', '586660', '6d7772', '4f5c57'].map(rgb);
const plinth = rgb('b6aa9b');
const roof = rgb('898b87');
const joints = rgb('686d68');
const iron = rgb('73766f');

const center = (ring) =>
  ring.reduce(([x, z], [a, b]) => [x + a / ring.length, z + b / ring.length], [0, 0]);
const mix = (a, b, t) => a + (b - a) * t;

function heightAt(member) {
  const [x, z] = center(member.outline);
  const [a, b] = member.slope;
  return (u, d) => member.roof + a * (u - x) + b * (d - z);
}

function face(out, slot, f, u0, u1, y0, y1, d, color) {
  const p = f.P;
  quad4(out, slot, p(u0, y0, d), p(u1, y0, d), p(u1, y1, d), p(u0, y1, d), color);
}

function panelWall(out, detail, f, base, top, seed, glazed) {
  const l = f.length;
  const point = (u, t, depth = 0) => f.P(u, mix(base, top(u), t), depth);
  const n = Math.max(1, Math.round(l / (detail < 2 ? 7.8 : 4.1)));
  const rows = detail < 2 || l < 2 ? 2 : 3;
  const small = l / n;
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < rows; k++) {
      const t = k / rows, next = (k + 1) / rows;
      const a = j * small, b = (j + 1) * small;
      const offset = (column, row) => {
        if (column === 0 || column === n) return 0;
        return ((column + row + seed) % 2 === 0 ? 0.23 : -0.23) * small;
      };
      const points = [
        point(a + offset(j, k), t),
        point(b + offset(j + 1, k), t),
        point(b + offset(j + 1, k + 1), next),
        point(a + offset(j, k + 1), next),
      ];
      const triangles = (j + k + seed) % 2 === 0 ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 3], [1, 2, 3]];
      for (const [i, corners] of triangles.entries()) {
        const code = (j * 7 + k * 11 + i * 5 + seed) % 19;
        const isGlass = glazed || code < 3;
        const isStone = !isGlass && code >= 14;
        const slot = isGlass ? 'glass' : isStone ? 'cladding' : 'zinc';
        const colors = isGlass ? windowGlass : isStone ? sandstone : mutedMetal;
        const p = corners.map(idx => points[idx]);
        tri(out, slot, ...p, colors[code % colors.length]);
        if (detail < 2 || l < 1.25 || i === 1 || (detail === 2 && (l < 2.6 || (j + k) % 3 !== 0)))
          continue;
        const [a, b] = (j + k + seed) % 2 === 0 ? [points[0], points[2]] : [points[1], points[3]];
        const push = ([x, y, z]) => [x + f.normal[0] * 0.028, y, z + f.normal[1] * 0.028];
        beam(out, 'frame', push(a), push(b), 0.055, 0.052, isGlass ? iron : joints);
      }
    }
  }
}

function building(out, detail, member) {
  const outline = outwardRing(member.outline);
  const roofHeight = heightAt(member);
  const roofSkin = deform(out, ([x, , z]) => [x, roofHeight(x, z), z]);
  const { form, base } = member;
  const isGlass = ['glass', 'atrium'].includes(form);
  const canopy = form === 'canopy';
  const podium = member.id === 800163541 ? 2.65 : form === 'panel' ? 1.35 : 0.76;
  const firstFloor = base + podium;
  for (const [i, a] of outline.entries()) {
    const f = wallFace(a, outline[(i + 1) % outline.length]);
    const l = f.length;
    if (l < 0.03) continue;
    const top = (u) => {
      const [x, , z] = f.P(u, 0);
      return roofHeight(x, z);
    };
    if (canopy) {
      const post = f.P(0.18, base);
      if (l > 0.8) beam(out, 'frame', post, f.P(0.18, top(0.18) - 0.06), 0.25, 0.22, iron);
      continue;
    }
    face(out, 'slab', f, 0, l, site.foundationBottom, base, 0, plinth);
    const salt = (member.id + 7 * i) % 19;
    if (detail > 0)
      face(out, form === 'shard' ? 'cladding' : 'glass', f, 0, l, base, firstFloor, 0, windowGlass[i % 4]);
    if (detail === 0 || l < 0.55) {
      const bottom = detail === 0 ? base : firstFloor;
      quad4(out, isGlass ? 'glass' : 'zinc', f.P(0, bottom), f.P(l, bottom),
        f.P(l, top(l)), f.P(0, top(0)), isGlass ? windowGlass[i % 4] : mutedMetal[i % 5]);
    } else {
      panelWall(out, detail, f, firstFloor, top, salt, isGlass || form === 'shard');
      if (detail > 1) {
        const posts = Math.max(1, Math.floor(l / 3.1));
        for (let j = 0; j < posts; j++) {
          const u = (j + 0.5) * l / posts;
          fbox(out, 'frame', f, u - 0.059, u + 0.059, base, firstFloor, -0.02, 0.06, iron);
        }
      }
    }
    if (detail > 1 && l > 1.0)
      beam(out, 'frame', f.P(0, top(0) + 0.04, 0.02), f.P(l, top(l) + 0.04, 0.02), 0.12, 0.13, roof);
  }
  cap(roofSkin, isGlass && form === 'atrium' ? 'glass' : 'roof', outline, 0, isGlass ? windowGlass[2] : roof);
  if (form === 'atrium' && detail > 0) atriumRoof(out, detail, member, roofHeight);
}

function atriumRoof(out, detail, member, height) {
  const r = member.outline;
  const south = [mix(r[0][0], r[1][0], 0.34), mix(r[0][1], r[1][1], 0.34)];
  const north = [mix(r[5][0], r[4][0], 0.31), mix(r[5][1], r[4][1], 0.31)];
  const side = (a, b, t, rise = 0) => {
    const x = mix(a[0], b[0], t), z = mix(a[1], b[1], t);
    return [x, height(x, z) + rise, z];
  };
  const n = [0, 9, 14, 18][detail];
  for (let i = 0; i < n; i++) {
    const t = i / n, next = (i + 1) / n;
    const left = side(r[0], r[6], t, 0.07), right = side(r[2], r[4], t, 0.07);
    const peak = side(south, north, t, 0.72);
    const peakNext = side(south, north, next, 0.72);
    const l = side(r[0], r[6], next, 0.07), rr = side(r[2], r[4], next, 0.07);
    const color = windowGlass[i % 4];
    quad4(out, 'glass', left, peak, peakNext, l, color);
    quad4(out, 'glass', peak, right, rr, peakNext, windowGlass[(i + 1) % 4]);
    beam(out, 'frame', left, peak, 0.095, 0.11, iron);
    beam(out, 'frame', peak, right, 0.095, 0.11, iron);
    if (detail > 1) {
      beam(out, 'frame', peak, peakNext, 0.11, 0.11, iron);
      beam(out, 'frame', left, peakNext, 0.066, 0.076, iron);
    }
  }
}

function plazaSteps(out, detail) {
  const member = site.members[0];
  const front = wallFace(member.outline[24], member.outline[25]);
  const count = detail < 2 ? 3 : 6;
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / count;
    fbox(out, 'cladding', front, 0.24, front.length - 0.24,
      -0.92, member.base - t * 1.06, 0, t * 3.47, sandstone[i % 3]);
  }
}

function build(out, detail) {
  for (const member of site.members) building(out, detail, member);
  plazaSteps(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
