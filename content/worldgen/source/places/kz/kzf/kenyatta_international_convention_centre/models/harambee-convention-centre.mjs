import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  extrude, fbox, outwardRing, quad4, rgb, tri, wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_panel', roughness: 0.92 },
  foundation: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.96 },
  fascia: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.87 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.86 },
  railing: { slot: 'trim', graph: 'metal_painted', roughness: 0.78 },
  deck: { slot: 'roof', graph: 'stone_granite', roughness: 0.93 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.55 },
};

const cream = rgb('caa28c'), light = rgb('d5b59c'), tawny = rgb('b98469');
const brown = rgb('956146'), terracotta = rgb('b37856'), root = rgb('8b654f');
const glass = rgb('46514e'), darkGlass = rgb('58615b'), trim = rgb('73594a');
const grey = rgb('a09b8e'), darkRoof = rgb('74675e');
const { tower, podium, amphitheatre } = site;
const shaft = outwardRing(tower.outline), canopy = outwardRing(tower.canopy);
const cone = outwardRing(amphitheatre.outline);

function scale(ring, [cx, cz], factor) {
  return ring.map(([x, z]) => [cx + (x - cx) * factor, cz + (z - cz) * factor]);
}

function taperedBand(out, slot, lower, upper, lowY, highY, colors) {
  for (const [i, a] of lower.entries()) {
    const j = (i + 1) % lower.length;
    const b = lower[j], c = upper[j], d = upper[i];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.035) continue;
    quad4(out, slot, [a[0], lowY, a[1]], [b[0], lowY, b[1]],
      [c[0], highY, c[1]], [d[0], highY, d[1]], colors[i % colors.length]);
  }
}

function linearFaces(out, detail, footprint, bottom, top, width) {
  const outline = outwardRing(footprint);
  for (const [i, a] of outline.entries()) {
    const f = wallFace(a, outline[(i + 1) % outline.length]);
    if (f.length < 1.1) continue;
    const bays = Math.max(1, Math.round(f.length / width));
    for (let j = 0; j < bays; j++) {
      const left = f.length * j / bays, right = f.length * (j + 1) / bays;
      const u = (left + right) / 2;
      const p = f.P;
      if (detail < 2) {
        quad4(out, 'concrete', p(u - .22, bottom, -.39), p(u + .22, bottom, -.39),
          p(u + .22, top, -.39), p(u - .22, top, -.39), light);
      } else {
        fbox(out, 'concrete', f, u - .22, u + .22, bottom, top, -.76, -.13, light);
      }
      if (detail > 1 && right - left > 1.4) {
        const count = detail === 2 ? 2 : 4;
        for (let k = 1; k < count; k++) {
          const x = left + (right - left) * k / count;
          if (detail === 2) {
            quad4(out, 'railing', p(x - .025, bottom, -.89), p(x + .025, bottom, -.89),
              p(x + .025, top, -.89), p(x - .025, top, -.89), trim);
          } else {
            fbox(out, 'railing', f, x - .025, x + .025, bottom, top, -.96, -.89, trim);
          }
        }
      }
    }
  }
}

function buildPodium(out, detail) {
  const ring = outwardRing(podium.outline);
  if (detail === 0) {
    const center = [7, -8];
    const inset = scale(ring, center, .985);
    extrude(out, 'glazing', inset, podium.foundationBottom, podium.height, darkGlass, { top: false });
    taperedBand(out, 'fascia', ring, ring, 3.15, 3.86, [tawny]);
    taperedBand(out, 'concrete', ring, ring, 7.18, 7.74, [cream]);
    extrude(out, 'fascia', ring, 9.65, podium.height, tawny, { topSlot: 'deck', topColor: grey });
    return;
  }
  extrude(out, 'foundation', ring, podium.foundationBottom, .42, grey, { top: false });
  extrude(out, 'fascia', ring, 3.15, 3.86, tawny);
  extrude(out, 'concrete', ring, 7.18, 7.74, cream);
  extrude(out, 'fascia', ring, 9.65, podium.height, tawny, { topSlot: 'deck', topColor: grey });
  for (const [i, a] of ring.entries()) {
    const f = wallFace(a, ring[(i + 1) % ring.length]), w = f.length;
    for (const [lo, hi] of [[.42, 3.15], [3.86, 7.18], [7.74, 9.65]]) {
      const d = -.98;
      quad4(out, 'glazing', f.P(0, lo, d), f.P(w, lo, d), f.P(w, hi, d), f.P(0, hi, d), darkGlass);
      if (detail > 0 && w > 2.8)
        fbox(out, 'railing', f, .1, w - .1, hi - .47, hi - .42, -.9, -.84, trim);
    }
  }
  for (const [lo, hi] of [[.42, 3.15], [3.86, 7.18], [7.74, 9.65]]) {
    linearFaces(out, detail, ring, lo, hi, detail > 1 ? 4.05 : 6.3);
  }
  const west = ring.findIndex(([x, z]) => x < -50 && z > 50);
  const neighbor = [-1, 1].map(step => ring[(west + step + ring.length) % ring.length])
    .find(([x]) => x > 0);
  const ramp = ring[(west + 1) % ring.length] === neighbor
    ? wallFace(ring[west], neighbor) : wallFace(neighbor, ring[west]);
  const lo = 7.5, hi = 41.3, start = .71, end = 3.86;
  const p = ramp.P;
  quad4(out, 'deck', p(hi, end, -.19), p(lo, start, -.19), p(lo, start, 2.05), p(hi, end, 2.05), grey);
  quad4(out, 'fascia', p(lo, start - .22, 2.05), p(hi, end - .22, 2.05),
    p(hi, end, 2.05), p(lo, start, 2.05), tawny);
  if (detail > 0) {
    quad4(out, 'railing', p(lo, start + .83, 2.08), p(hi, end + .83, 2.08),
      p(hi, end + .91, 2.08), p(lo, start + .91, 2.08), trim);
    for (let j = 0; j <= 12; j++) {
      const u = lo + (hi - lo) * j / 12, y = start + (end - start) * j / 12;
      fbox(out, 'railing', ramp, u - .03, u + .03, y, y + .86, 2, 2.09, trim);
    }
  }
}

function buildTower(out, detail) {
  const inside = scale(shaft, tower.center, .89);
  const collar = scale(shaft, tower.center, .965);
  const base = scale(shaft, tower.center, .69);
  const bottom = podium.height;
  extrude(out, 'glazing', base, bottom, 14.12, glass, { top: false });
  taperedBand(out, 'concrete', base, shaft, bottom + .3, 13.22, [cream, light]);
  taperedBand(out, 'fascia', shaft, inside, 13.22, 14.15, [tawny]);
  const floors = tower.levels - 3, spacing = (101.86 - 14.15) / floors;
  const step = detail === 0 ? 5 : 1;
  if (detail < 2)
    taperedBand(out, 'glazing', inside, inside, 14.15, 101.86, [glass, darkGlass]);
  for (let i = 0; i < floors; i += step) {
    const y = 14.15 + spacing * i, h = spacing * step;
    taperedBand(out, 'fascia', shaft, shaft, y + h * .59, y + h * .97, [cream, cream, tawny, light]);
    if (detail > 1) {
      taperedBand(out, 'glazing', inside, inside, y, y + h * .46, [glass, darkGlass]);
      taperedBand(out, 'concrete', inside, shaft, y + h * .46, y + h * .59, [cream]);
      taperedBand(out, 'concrete', shaft, inside, y + h * .97, y + h, [root]);
      for (const [j, a] of inside.entries()) {
        const f = wallFace(a, inside[(j + 1) % inside.length]), w = f.length;
        if (detail === 2) {
          quad4(out, 'concrete', f.P(.025, y, .11), f.P(.24, y, .11),
            f.P(.24, y + h * .51, .11), f.P(.025, y + h * .51, .11), tawny);
        } else {
          fbox(out, 'concrete', f, .025, .24, y, y + h * .51, .02, .15, tawny);
        }
        const count = detail === 2 ? 1 : 4;
        for (let k = 1; k <= count; k++) {
          const u = w * k / (count + 1);
          const d = detail === 2 ? .024 : .045;
          quad4(out, 'railing', f.P(u - d, y, .018), f.P(u + d, y, .018),
            f.P(u + d, y + h * .47, .018), f.P(u - d, y + h * .47, .018), light);
        }
      }
    }
  }
  extrude(out, 'glazing', collar, 101.86, tower.height + .08, darkGlass, { top: false });
  const crown = detail === 0 ? canopy.filter((_, i) => i % 3 === 0) : canopy;
  const crownBottom = scale(crown, tower.center, .75);
  taperedBand(out, 'roof', crownBottom, crown, tower.height, 104.6, [darkRoof, root, darkRoof]);
  extrude(out, 'roof', crown, 104.6, tower.crownHeight, darkRoof, { topSlot: 'deck', topColor: grey });
  if (detail > 1) {
    for (const [i, a] of canopy.entries()) {
      const f = wallFace(a, canopy[(i + 1) % canopy.length]);
      if (f.length > .21) fbox(out, 'fascia', f, .075, f.length - .075, 104.64, 104.75, .01, .07, tawny);
    }
  }
}

function buildAmphitheatre(out, detail) {
  const { center, baseHeight, eave, peak } = amphitheatre;
  const inner = scale(cone, center, .59);
  const drum = scale(cone, center, .47);
  extrude(out, 'glazing', drum, baseHeight, eave + .035, glass, { top: false });
  taperedBand(out, 'concrete', inner, cone, baseHeight + .91, eave, [root, brown, root]);
  for (const [i, a] of inner.entries()) {
    const b = inner[(i + 1) % inner.length];
    const f = wallFace(a, b);
    if (f.length > 1 && i % 2 === 0)
      fbox(out, 'concrete', f, .1, .42, baseHeight, baseHeight + 2.05, .045, .39, light);
  }
  const upper = scale(cone, center, .41);
  taperedBand(out, 'fascia', cone, upper, eave, eave + (peak - eave) * .59, [terracotta, tawny, terracotta, brown]);
  const point = [center[0], peak, center[1]], shoulder = eave + (peak - eave) * .59;
  for (const [i, a] of upper.entries()) {
    const j = (i + 1) % upper.length, b = upper[j];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < .025) continue;
    tri(out, 'fascia', [a[0], shoulder, a[1]], [b[0], shoulder, b[1]], point, i % 3 === 1 ? tawny : terracotta);
    if (detail === 0 || i % 2 === 1) continue;
    const edge = cone[i], dx = b[0] - a[0], dz = b[1] - a[1], w = Math.hypot(dx, dz);
    const strip = detail > 1 ? .115 : .16;
    const offset = (p, y) => [p[0] + dx / w * strip, y, p[1] + dz / w * strip];
    quad4(out, 'roof', [edge[0], eave + .055, edge[1]], offset(edge, eave + .055),
      offset(a, shoulder + .055), [a[0], shoulder + .055, a[1]], brown);
    tri(out, 'roof', [a[0], shoulder + .055, a[1]], offset(a, shoulder + .055),
      [point[0], point[1] + .04, point[2]], brown);
  }
}

function build(out, detail) {
  const target = {
    ...out,
    addCap(slot, ref, outline, holes, height, normal, texCoord, color) {
      const mesh = new MeshBufferBuilder();
      if (!mesh.addCap(slot, ref, outline, holes, height, normal, texCoord, color)) return false;
      const { indices, positions } = mesh.finalize();
      for (let i = 0; i < indices.length; i += 3) {
        const corners = Array.from(indices.slice(i, i + 3), j => positions.slice(j * 3, j * 3 + 3));
        tri(out, slot, ...corners, color);
      }
      return true;
    },
  };
  buildPodium(target, detail);
  buildTower(target, detail);
  buildAmphitheatre(target, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
