import {
  quad4, rgb, tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_drywall', roughness: 0.98 },
  coping: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.96 },
  recess: { slot: 'trim', graph: 'stone_granite', roughness: 0.98 },
};
const ashlar = ['b59977', 'aa8c71', 'baa084', 'ab9578', 'beaa8c'].map(rgb);
const crest = rgb('baab8c'), shadows = rgb('625344'), footing = rgb('928069');
const granite = ['a99e82', 'aa9b81', '817764', 'a59178'].map(rgb);

function normal(a,b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx,dz);
  return [-dz / length, dx / length];
}

function wallStations(terrace) {
  const points = terrace.points.slice().reverse();
  return points.map(([x, z, floor, top], i) => {
    const a = normal(points[Math.max(0, i - 1)], points[Math.max(1, i)]);
    const b = normal(points[Math.min(i, points.length - 2)], points[Math.min(i + 1, points.length - 1)]);
    const width = terrace.width * .5 / (1 + a[0] * b[0] + a[1] * b[1]);
    const nx = (a[0] + b[0]) * width, nz = (a[1] + b[1]) * width;
    const y = top + .035 * Math.sin(x * .52 + z * .37);
    return {
      front: [x + nx, floor - .88, z + nz],
      crown: [x + nx * .72, y, z + nz * .72],
      coping: [x - nx * .84, y - .063, z - nz * .84],
      back: [x - nx, floor - .88, z - nz],
    };
  });
}

const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);

function masonryFace(out, detail, a, b, pattern, tint) {
  const dx = b.front[0] - a.front[0], dz = b.front[2] - a.front[2];
  const length = Math.hypot(dx, dz), nx = -dz / length, nz = dx / length;
  function at(u, below, offset = 0) {
    const cap = mix(a.crown, b.crown, u), base = mix(a.front, b.front, u);
    const p = mix(cap, base, below / (cap[1] - base[1]));
    return [p[0] + nx * offset, p[1], p[2] + nz * offset];
  }
  const face = (slot, u, v, low, high, inset, color) => quad4(out, slot,
    at(u, low, inset), at(v, low, inset), at(v, high, inset), at(u, high, inset), color);
  if (!pattern || detail < 2) {
    quad4(out, 'wall', a.front, b.front, b.crown, a.crown, tint);
    if (pattern && detail === 1) face('recess', 0, 1, .49, .27, .014, footing);
  } else {
    const bottom = .57, row = .146, inset = -.098;
    quad4(out, 'wall', a.front, b.front, at(1, bottom), at(0, bottom), tint);
    face('wall', 0, 1, bottom - 2 * row, 0, 0, tint);
    face('recess', 0, 1, bottom, bottom - 2 * row, inset, shadows);
    for (const d of [bottom, bottom - row * 2]) {
      const points = [at(0, d), at(1, d), at(1, d, inset), at(0, d, inset)];
      quad4(out, 'coping', ...(d === bottom ? points.slice().reverse() : points), footing);
    }
    const count = Math.max(4, Math.round(length / (detail === 3 ? .26 : .48)));
    for (let i = 0; i < count; i++) {
      const u = i / count, v = (i + .98) / count;
      const low = bottom - row * (i % 2), high = low - row;
      face('wall', u, v, low, high, .002, ashlar[i % ashlar.length]);
      if (detail === 3) {
        quad4(out, 'coping', at(u, low, inset), at(u, low), at(u, high), at(u, high, inset), footing);
        quad4(out, 'coping', at(v, low), at(v, low, inset), at(v, high, inset), at(v, high), footing);
      }
    }
  }
  if (detail !== 3 || length < .8) return;
  const seams = [pattern ? .71 : .21, .95, 1.16, 1.33];
  for (const [j,y] of seams.entries()) {
    if (Math.min(a.crown[1] - a.front[1], b.crown[1] - b.front[1]) < y + .17) continue;
    face('coping', 0, 1, y + .019, y, .012, footing);
    const count = Math.round(length / .64);
    for (let k = 1; k < count; k++) {
      const u = (k + .22 * (j % 2)) / count;
      face('coping', u, u + .022 / length, y, y - .12, .015, footing);
    }
  }
}

function buildTerrace(out, detail, terrace) {
  const stations = wallStations(terrace);
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1], b = stations[i];
    const tint = ashlar[i % ashlar.length];
    masonryFace(out, detail, a, b, terrace.pattern, tint);
    quad4(out, 'wall', b.back, a.back, a.coping, b.coping, tint);
    quad4(out, 'coping', a.crown, b.crown, b.coping, a.coping, crest);
  }
  const a = stations[0], b = stations.at(-1);
  quad4(out, 'wall', a.back, a.front, a.crown, a.coping, footing);
  quad4(out, 'wall', b.front, b.back, b.coping, b.crown, footing);
}

function buildBoulder(out, detail, rock, phase) {
  const [x, z] = rock.center, [rx, rz] = rock.radius;
  const sides = [6, 7, 9, 11][detail];
  const ring = (s, y, turns) => Array.from({ length: sides }, (_, i) => {
    const a = -2 * Math.PI * i / sides + phase + turns;
    const r = s * (1 + .13 * Math.sin(3 * a + phase));
    return [x + rx * r * Math.cos(a), rock.base + rock.height * (y + .06 * Math.cos(2 * a)), z + rz * r * Math.sin(a)];
  });
  const low = ring(.94, -.23, 0), hip = ring(1, .27, 0), upper = ring(.54, .83, .1);
  const peak = [x - .25 * rx, rock.base + rock.height, z + .17 * rz];
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides, color = granite[(i + phase) % granite.length];
    quad4(out, 'recess', low[i], low[j], hip[j], hip[i], color);
    quad4(out, 'recess', hip[i], hip[j], upper[j], upper[i], color);
    tri(out, 'recess', upper[i], upper[j], peak, granite[(i + phase + 1) % granite.length]);
  }
}

function build(out, detail) {
  for (const terrace of site.terraces) buildTerrace(out, detail, terrace);
  const count = [3, 6, 9, 12][detail];
  for (let i = 0; i < count; i++) buildBoulder(out, detail, site.boulders[i], i);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
