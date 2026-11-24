import { MeshBufferBuilder } from '../../../../packages/worldgen/dist/kernel.mjs';
import { beam } from '../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.96 },
  cut: { slot: 'trim', graph: 'stone_limestone', roughness: 0.92 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.92 },
  timber: { slot: 'trim', graph: 'wood_vertical', roughness: 0.89 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  shadow: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    name: 'troodos-recesses',
    roughness: 0.91,
  },
};

function withCaps(out) {
  return {
    ...out,
    addCap(slot, ref, ring, holes, height, normal, uv, color) {
      const mesh = new MeshBufferBuilder();
      if (!mesh.addCap('wall', ref, ring, holes, height, normal, uv, color)) return false;
      const { positions, indices } = mesh.finalize();
      for (let i = 0; i < indices.length; i += 3) {
        const at = (j) => [...positions.subarray(indices[i + j] * 3, indices[i + j] * 3 + 3)];
        tri(out, slot, at(0), at(1), at(2), color);
      }
      return true;
    },
  };
}

export function churchRecipe(plan) {
  const [a, b] = plan.axis;
  const timber = rgb(plan.colors.timber),
    stone = rgb(plan.colors.stone),
    tile = rgb(plan.colors.tile);
  const cut = rgb(plan.colors.trim),
    pale = rgb('c8bdab'),
    dark = rgb('4b423a');
  const F = facade([0, 0], [a, b]);
  const point = (u, v) => [u * a - v * b, u * b + v * a];
  const at = (u, v, y) => F.P(u, y, v);
  const rect = ([u, U, v, V]) => [point(u, v), point(u, V), point(U, V), point(U, v)];
  const faceOf = ([u, v, side]) => {
    const along = { south: [a, b], north: [-a, -b], west: [-b, a], east: [b, -a] };
    return facade(point(u, v), along[side]);
  };
  const box = (out, slot, [u, U, v, V], lo, hi, color) =>
    fbox(out, slot, F, u, U, lo, hi, v, V, color);

  function body(out, row) {
    const outline = row.ring ? row.ring.map(([u, v]) => point(u, v)) : rect(row.bounds);
    const h = row.height;
    extrude(out, 'masonry', outline, row.plinth ?? plan.foot, h, stone);
    if (row.plinth !== undefined) {
      extrude(out, 'cut', outline, plan.foot, row.plinth, cut, { top: false });
    }
  }

  function roof(out, row, level) {
    const {
      ends: [u, U],
      profiles: [v, mid, V],
      heights: [lo, peak, hi],
    } = row;
    const tint = row.color ? rgb(row.color) : tile;
    const Y0 = at(u, v, lo),
      Y1 = at(u, mid, peak),
      Y2 = at(u, V, hi);
    const Y3 = at(U, v, lo),
      Y4 = at(U, mid, peak),
      Y5 = at(U, V, hi);
    quad4(out, 'tile', Y0, Y1, Y4, Y3, tint);
    quad4(out, 'tile', Y1, Y2, Y5, Y4, tint);
    if (level) {
      const under = (p) => [p[0], p[1] - 0.12, p[2]];
      for (const q of [
        [Y0, Y3, Y4, Y1],
        [Y1, Y4, Y5, Y2],
      ]) {
        quad4(out, 'timber', ...q.map(under), timber);
      }
      const endEdges = [
        [Y0, Y1],
        [Y1, Y2],
        [Y3, Y4],
        [Y4, Y5],
      ];
      for (const [start, end] of endEdges)
        beam(out, 'timber', under(start), under(end), 0.16, 0.16, timber);
      if (level > 1)
        beam(out, 'tile', at(u, mid, peak + 0.031), at(U, mid, peak + 0.031), 0.124, 0.11, tint);
    }
    const inset = row.inset ?? 0.27;
    const span = row.gableSpan ?? [v, V];
    const gable = (k) => [
      at(k, span[0], heightAt(span[0])),
      at(k, mid, peak - 0.12),
      at(k, span[1], heightAt(span[1])),
    ];
    function heightAt(x) {
      return x <= mid
        ? lo + ((peak - lo) * (x - v)) / (mid - v) - 0.13
        : hi + ((peak - hi) * (V - x)) / (V - mid) - 0.13;
    }
    const slot = row.woodGable ? 'timber' : 'masonry';
    const gableColor = row.woodGable ? timber : stone;
    const west = gable(u + inset),
      east = gable(U - inset);
    tri(out, slot, ...west.reverse(), gableColor);
    tri(out, slot, ...east, gableColor);
    if (level && row.tieBeam) {
      for (const [k, offset] of [
        [u + inset, -0.055],
        [U - inset, 0.055],
      ]) {
        beam(
          out,
          'timber',
          at(k + offset, span[0], row.tieBeam),
          at(k + offset, span[1], row.tieBeam),
          0.18,
          0.18,
          timber,
        );
      }
    }
  }

  function apse(out, row, level) {
    const {
      position: [u, v],
      depth,
      halfSpan,
      eave,
      cap,
      side,
    } = row;
    const n = [8, 12, 18, 24][level];
    const boundary = Array.from({ length: n + 1 }, (_, i) => {
      const angle = Math.PI * (i / n - 0.5);
      const x = halfSpan * Math.sin(angle),
        y = depth * Math.cos(angle);
      if (side === 'north') return point(u + x, v - y);
      return point(u + y, v + x);
    });
    extrude(out, 'masonry', boundary, plan.foot, eave, stone);
    const ring = outwardRing(boundary);
    const tip = at(u, v, eave + cap);
    for (const [i, p] of ring.entries()) {
      const q = ring[(i + 1) % ring.length];
      tri(out, 'tile', [p[0], eave, p[1]], [q[0], eave, q[1]], tip, tile);
    }
    if (level && row.slit) {
      const f =
        side === 'north'
          ? faceOf([u, v - depth - 0.025, 'north'])
          : faceOf([u + depth + 0.025, v, 'east']);
      opening(out, f, 0, eave - 1.19, 0.25, 0.64, {
        head: 'round',
        glassSlot: 'shadow',
        frameSlot: 'cut',
        glass: dark,
        frame: cut,
        frameWidth: level > 1 ? 0.074 : 0,
        sill: false,
        d: 0.026,
      });
    }
  }

  function openings(out, level) {
    if (!level) return;
    for (const o of plan.openings) {
      const [u, v, side, bottom, width, height, head] = o;
      const f = faceOf([u, v, side]);
      opening(out, f, 0, bottom, width, height, {
        head,
        glassSlot: width > 0.78 && bottom < 0.65 ? 'timber' : 'shadow',
        frameSlot: 'cut',
        glass: width > 0.78 && bottom < 0.65 ? timber : dark,
        frame: cut,
        frameWidth: level > 1 ? 0.112 : 0,
        frameDepth: 0.126,
        sill: bottom > 1.2 && level > 1,
        d: 0.035,
        rise: Math.min(height * 0.34, width * 0.62),
      });
    }
  }

  function colonnade(out, level) {
    for (const gallery of plan.galleries ?? []) {
      const { from, to, bayCount, bottom, top, depth, wood, lattice, openBay } = gallery;
      const f = wallFace(point(...from), point(...to));
      const n = level ? bayCount : Math.max(2, Math.round(bayCount * 0.6));
      const step = f.length / n;
      const slot = wood ? 'timber' : 'masonry';
      const tint = wood ? timber : stone;
      for (let i = 0; i <= n; i++) {
        const u = i * step,
          w = wood ? 0.104 : 0.18;
        fbox(out, slot, f, u - w, u + w, bottom, top, -depth, 0, tint);
        if (level > 1)
          fbox(
            out,
            'cut',
            f,
            u - w - 0.038,
            u + w + 0.038,
            bottom,
            bottom + 0.14,
            -depth - 0.038,
            0.038,
            cut,
          );
      }
      fbox(out, slot, f, 0, f.length, top - 0.16, top + 0.08, -depth - 0.085, 0.042, tint);
      if (lattice && level) {
        const steps = level === 3 ? 5 : 2;
        for (let i = 0; i < n; i++) {
          if (i === openBay) continue;
          const low = bottom + 0.24,
            high = top - 0.24;
          fbox(
            out,
            'timber',
            f,
            i * step,
            (i + 1) * step,
            low - 0.08,
            low + 0.025,
            -0.13,
            -0.032,
            timber,
          );
          for (let k = 1; k <= steps; k++) {
            const cx = (i + k / (steps + 1)) * step;
            beam(
              out,
              'timber',
              f.P(cx - 0.31, low, -0.1),
              f.P(cx + 0.31, high, -0.1),
              0.061,
              0.061,
              timber,
            );
            if (level > 1)
              beam(
                out,
                'timber',
                f.P(cx + 0.31, low, -0.12),
                f.P(cx - 0.31, high, -0.12),
                0.061,
                0.061,
                timber,
              );
          }
        }
      }
    }
  }

  function bell(out, level, t) {
    const {
      at: [u, v],
      half,
      foundation,
      lower,
      upper,
      ridge,
    } = t;
    const ring = rect([u - half, u + half, v - half, v + half]);
    extrude(out, 'masonry', ring, foundation, lower, stone);
    for (const [i, p] of ring.entries()) {
      const f = wallFace(p, ring[(i + 1) % ring.length]),
        mid = f.length / 2,
        w = half * 0.52;
      const h = upper - lower,
        arc = pointedArch(w, h * 0.24, level > 1 ? 6 : 4).map(([u, y]) => [
          u + mid,
          y + upper - h * 0.29,
        ]);
      fbox(out, 'plaster', f, 0, mid - w, lower, upper, -0.18, 0, pale);
      fbox(out, 'plaster', f, mid + w, f.length, lower, upper, -0.18, 0, pale);
      for (let j = 0; j < arc.length - 1; j++) {
        const [u, y] = arc[j],
          [U, Y] = arc[j + 1];
        quad4(out, 'plaster', f.P(u, y), f.P(U, Y), f.P(U, upper), f.P(u, upper), pale);
        quad4(out, 'plaster', f.P(U, Y), f.P(u, y), f.P(u, y, -0.18), f.P(U, Y, -0.18), cut);
      }
    }
    extrude(
      out,
      'cut',
      rect([u - half - 0.15, u + half + 0.15, v - half - 0.15, v + half + 0.15]),
      upper,
      upper + 0.22,
      cut,
    );
    gableRoof(
      out,
      'tile',
      point(u - half, v),
      point(u + half, v),
      half * 2,
      upper + 0.21,
      ridge,
      tile,
      { overhang: 0.23, endSlot: 'plaster', endColor: pale },
    );
    if (level)
      lathe(
        out,
        'timber',
        point(u, v),
        [
          [lower + 0.42, 0.29, 0.29],
          [lower + 0.54, 0.32, 0.32],
          [lower + 1.16, 0.18, 0.18],
          [lower + 1.24, 0.08, 0.08],
        ],
        10,
        timber,
      );
  }

  function dome(out, level, d) {
    const center = point(...d.at),
      n = level > 1 ? 12 : 8;
    lathe(
      out,
      'masonry',
      center,
      [
        [d.bottom, d.radius, d.radius],
        [d.drum, d.radius, d.radius],
      ],
      n,
      stone,
      { capTop: false },
    );
    lathe(
      out,
      'tile',
      center,
      [
        [d.drum, d.radius + 0.11, d.radius + 0.11],
        [d.drum + 0.29, d.radius * 0.81, d.radius * 0.81],
        [d.top, 0.055, 0.055],
      ],
      n,
      tile,
    );
    if (level && d.cross) {
      const [u, v] = d.at;
      box(out, 'timber', [u - 0.045, u + 0.045, v - 0.045, v + 0.045], d.top, d.top + 0.52, timber);
      box(
        out,
        'timber',
        [u - 0.21, u + 0.21, v - 0.047, v + 0.047],
        d.top + 0.32,
        d.top + 0.4,
        timber,
      );
    }
  }

  function annexRoofs(out, level) {
    for (const wing of plan.angledRoofs ?? []) {
      const endA = point(...wing.from),
        endB = point(...wing.to);
      gableRoof(out, 'tile', endA, endB, wing.width, wing.eave, wing.ridge, tile, {
        overhang: 0.22,
        endSlot: 'masonry',
        endColor: stone,
      });
      if (!wing.balcony || !level) continue;
      const f = wallFace(endA, endB),
        wall = wing.width / 2;
      fbox(out, 'timber', f, 0, f.length, 2.3, 2.45, wall, wall + 1.13, timber);
      fbox(out, 'timber', f, 0, f.length, 3.23, 3.37, wall + 1.08, wall + 1.14, timber);
      const count = Math.ceil(f.length / (level > 1 ? 0.46 : 1.16));
      for (let i = 0; i <= count; i++) {
        const x = (i * f.length) / count;
        fbox(out, 'timber', f, x - 0.045, x + 0.045, 2.4, 3.33, wall + 1.06, wall + 1.16, timber);
      }
      if (level > 1) {
        for (let i = 0; i < 11; i++) {
          const z = wall + 1.1 + (10 - i) * 0.22,
            y = 0.21 + (i + 1) * 0.193;
          fbox(
            out,
            'timber',
            f,
            f.length * 0.3,
            f.length * 0.3 + 1.01,
            y - 0.11,
            y,
            z,
            z + 0.23,
            timber,
          );
        }
      }
    }
  }

  function build(target, level) {
    const out = withCaps(target);
    for (const row of plan.bodies) body(out, row);
    for (const row of plan.roofs) roof(out, row, level);
    for (const row of plan.apses ?? []) apse(out, row, level);
    colonnade(out, level);
    annexRoofs(out, level);
    for (const b of plan.bells ?? []) bell(out, level, b);
    for (const d of plan.domes ?? []) dome(out, level, d);
    openings(out, level);
  }

  const buildSkyline = (out) => build(out, 0);
  const buildDistrict = (out) => build(out, 1);
  const buildStreet = (out) => build(out, 2);
  const buildCloseup = (out) => build(out, 3);
  return {
    surfaces,
    buildSkyline,
    buildDistrict,
    buildStreet,
    buildCloseup,
    buildMaster: buildCloseup,
  };
}
