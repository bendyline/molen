import { beam } from '../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { withFootprintCaps } from '../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const halfStep = (sides) => (sides === 4 ? Math.PI / 4 : Math.PI / 8);
const scaleTint = (value, factor) => value.map((component) => Math.min(1, component * factor));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const earth = rgb('958576');

export function chileanTimberChurch(plan) {
  const surfaces = {
    siding: { slot: 'wall', graph: plan.sidingGraph, roughness: 0.94 },
    paint: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.88 },
    carpentry: { slot: 'trim', graph: 'wood_plain', roughness: 0.89 },
    foundation: { slot: 'foundation', graph: 'stone_granite', roughness: 0.97 },
    roof: { slot: 'roof', graph: plan.roofGraph, roughness: 0.88 },
    glazing: { slot: 'window', localRef: 'palette:#ffffff', name: 'dark-glass', roughness: 0.81 },
  };
  const colors = Object.fromEntries(
    Object.entries(plan.colors).map(([name, tint]) => [name, rgb(tint)]),
  );
  const { wall, front, trim, roof, spire, window, door } = colors;
  const F = facade([0, 0], plan.axis);
  const heading = Math.atan2(F.along[1], F.along[0]);
  const at = (u, v, y) => F.P(u, y, v);
  const xz = (u, v) => {
    const [x, , z] = at(u, v, 0);
    return [x, z];
  };
  const { lo, hi, rear, outer, doorLine, eave, ridge, grade, foot } = plan;
  const mid = (lo + hi) * 0.5;
  const width = hi - lo;
  const deck = grade + plan.deck;
  const onFront = (d) => facade(xz(0, d), plan.axis);
  const room = (out, slot, u, U, v, V, y, Y, tint, bottom = false) =>
    fbox(out, slot, F, u, U, y, Y, v, V, tint, { bottom });
  const framed = (out, f, u, y, w, h, tint, options = {}) =>
    opening(out, f, u, y, w, h, {
      glassSlot: 'glazing',
      frameSlot: 'carpentry',
      glass: window,
      frame: tint,
      frameWidth: 0.095,
      frameDepth: 0.092,
      sill: false,
      ...options,
    });
  const ring = (center, r, sides, angle) =>
    Array.from({ length: sides }, (_, i) => {
      const theta = angle + (i * Math.PI * 2) / sides;
      return [center[0] + r * Math.cos(theta), center[1] + r * Math.sin(theta)];
    });
  const rim = (out, c, side, sides, bottom, top, relief, tint) =>
    lathe(
      out,
      'carpentry',
      c,
      [
        [bottom, side, side],
        [bottom + relief * 0.27, side + relief, side + relief],
        [top, side + relief, side + relief],
      ],
      sides,
      tint,
      { rotation: heading + halfStep(sides) },
    );

  function nave(out, level) {
    extrude(out, 'foundation', plan.outline, foot, deck, earth);
    for (const outline of plan.nave) extrude(out, 'siding', outline, deck, eave, wall);
    for (const annex of plan.annexes) {
      extrude(out, 'siding', annex.outline, deck, annex.eave, wall);
      gableRoof(
        out,
        'roof',
        xz(...annex.ridgeStart),
        xz(...annex.ridgeEnd),
        annex.width,
        annex.eave,
        annex.ridge,
        roof,
        { overhang: 0.2, endSlot: 'siding', endColor: wall },
      );
    }
    const bodyTop = plan.gothic ? outer : outer + 0.14;
    gableRoof(out, 'roof', xz(mid, rear), xz(mid, bodyTop), width, eave, ridge, roof, {
      overhang: level ? 0.29 : 0.18,
      endSlot: 'siding',
      endColor: wall,
      ends: [true, false],
    });
    const ends = [at(lo, bodyTop, eave), at(hi, bodyTop, eave), at(mid, bodyTop, ridge)];
    tri(out, 'paint', ...ends, front);
    if (!level) return;
    const rearFace = facade(
      xz(mid, rear),
      F.along.map((x) => -x),
    );
    for (const u of [-width * 0.22, width * 0.22])
      framed(out, rearFace, u, deck + 1.36, 0.78, 1.88, trim, {
        head: plan.gothic ? 'pointed' : 'round',
        frameWidth: level > 1 ? 0.1 : 0,
        mullions: level > 1 ? 1 : 0,
      });
    for (const outline of plan.nave) {
      const shell = outwardRing(outline);
      for (const [i, start] of shell.entries()) {
        const side = wallFace(start, shell[(i + 1) % shell.length]);
        const lengthwise = Math.abs(side.along[0] * F.normal[0] + side.along[1] * F.normal[1]);
        if (lengthwise < 0.95 || side.length < 4.0) continue;
        const count = Math.max(1, Math.round((plan.sideWindows * side.length) / (doorLine - rear)));
        for (let bay = 0; bay < count; bay++) {
          framed(
            out,
            side,
            (side.length * (bay + 0.5)) / count,
            deck + plan.sideSill,
            plan.gothic ? 1.27 : 0.69,
            plan.gothic ? 3.62 : 1.18,
            trim,
            {
              head: plan.gothic ? 'pointed' : 'round',
              frameWidth: level > 1 ? 0.09 : 0,
              d: 0.024,
              mullions: level > 1 ? 1 : 0,
              transoms: level > 2 && plan.gothic ? 1 : 0,
            },
          );
        }
        if (level > 1) {
          fbox(
            out,
            'carpentry',
            side,
            0.025,
            side.length - 0.025,
            deck,
            deck + 0.18,
            -0.026,
            0.064,
            trim,
          );
          fbox(
            out,
            'carpentry',
            side,
            0.025,
            side.length - 0.025,
            eave - 0.32,
            eave - 0.09,
            -0.02,
            0.048,
            trim,
          );
        }
      }
    }
    beam(
      out,
      'carpentry',
      at(mid, rear - 0.25, ridge),
      at(mid, outer + 0.31, ridge),
      0.16,
      0.14,
      spire,
    );
    for (const [p, q] of [
      [ends[0], ends[2]],
      [ends[2], ends[1]],
    ])
      beam(out, 'carpentry', p, q, 0.162, 0.153, trim);
  }
  function facadeBand(out, level, y, count) {
    const length = width / count;
    const v = outer + 0.07;
    const depth = 0.18;
    room(out, 'carpentry', lo - 0.1, hi + 0.1, v - depth, v + 0.09, y, y + 0.24, trim);
    if (level < 2) return;
    for (let i = 0; i < count; i++) {
      const u = lo + (i + 0.5) * length;
      room(out, 'carpentry', u - 0.074, u + 0.074, v - depth, v + 0.1, y - 0.183, y + 0.02, trim);
    }
  }
  function porchArch(out, level, center, radius, y, top, arch, rise, depth, v) {
    const profile =
      arch === 'flat'
        ? [
            [-radius, 0],
            [radius, 0],
          ]
        : arch === 'pointed'
          ? Array.from({ length: level > 1 ? 13 : 7 }, (_, i) => {
              const u = i / (level > 1 ? 6 : 3) - 1;
              return [radius * u, rise * Math.sqrt(1 - Math.abs(u))];
            })
          : roundArch(radius, level > 1 ? 12 : 5).map(([s, h]) => [s, (h * rise) / radius]);
    for (let i = 1; i < profile.length; i++) {
      const [u, h] = profile[i - 1],
        [U, H] = profile[i];
      const a = center + u,
        b = center + U,
        ay = y + h,
        by = y + H;
      quad4(out, 'paint', at(a, v, ay), at(b, v, by), at(b, v, top), at(a, v, top), front);
      quad4(
        out,
        'paint',
        at(b, v - depth, by),
        at(a, v - depth, ay),
        at(a, v - depth, top),
        at(b, v - depth, top),
        front,
      );
      quad4(
        out,
        'carpentry',
        at(a, v - depth, ay),
        at(b, v - depth, by),
        at(b, v, by),
        at(a, v, ay),
        door,
      );
      if (level > 1 && arch !== 'flat') {
        const scale = 1 + 0.117 / radius,
          bump = 0.029;
        quad4(
          out,
          'carpentry',
          at(a, v + bump, ay),
          at(b, v + bump, by),
          at(center + scale * U, v + bump, y + H * scale),
          at(center + scale * u, v + bump, y + h * scale),
          trim,
        );
      }
    }
  }
  function portico(out, level) {
    const { weights, arch, rise, depth, opening, rail, braces } = plan.porch;
    const post = clamp(0.018 * width, 0.17, 0.34);
    const f = outer + 0.035;
    const apron = deck + plan.porch.spring;
    const top = eave + 0.012;
    // Narrow, shingled side returns carry the gable while leaving the porch open across its face.
    for (const u of [lo, hi]) {
      room(
        out,
        'siding',
        u - 0.103,
        u + 0.103,
        doorLine - 0.04,
        outer - 0.19,
        deck,
        eave - 0.021,
        wall,
        true,
      );
      if (level > 2) {
        room(
          out,
          'carpentry',
          u - 0.152,
          u + 0.152,
          doorLine,
          outer - 0.04,
          eave - 0.34,
          eave - 0.095,
          trim,
        );
      }
    }
    const usable = width - 2 * 0.23;
    const total = weights.reduce((sum, w) => sum + w, 0);
    let end = lo + 0.23;
    for (const [i, weight] of weights.entries()) {
      const span = (usable * weight) / total,
        center = end + span * 0.5;
      const radius = span * 0.5 - post;
      const head = Array.isArray(arch) ? arch[i] : arch;
      const height = head === 'flat' ? 0 : Math.min(1.16, top - apron - 0.21, radius * rise);
      porchArch(out, level, center, radius, apron, top, head, height, depth, f);
      const atLeft = center - radius;
      room(out, 'paint', end - post, atLeft, outer - depth, outer + 0.046, deck, top, front);
      if (level) {
        room(
          out,
          'carpentry',
          end - post - 0.022,
          atLeft + 0.023,
          outer - depth - 0.02,
          outer + 0.13,
          deck,
          deck + 0.23,
          trim,
        );
        room(
          out,
          'carpentry',
          end - post - 0.048,
          atLeft + 0.041,
          outer - depth - 0.023,
          outer + 0.116,
          apron - 0.185,
          apron - 0.006,
          trim,
        );
      }
      if (level > 2) {
        const edge = end - post;
        room(
          out,
          'carpentry',
          edge - 0.043,
          atLeft + 0.046,
          outer - depth - 0.038,
          outer + 0.144,
          deck + 0.23,
          deck + 0.3,
          trim,
        );
        room(
          out,
          'carpentry',
          edge - 0.056,
          atLeft + 0.061,
          outer - depth - 0.042,
          outer + 0.137,
          apron - 0.273,
          apron - 0.187,
          trim,
        );
      }
      if (braces && level) {
        const set = outer - depth * 0.53;
        for (const sign of [-1, 1]) {
          const x = center + sign * radius;
          beam(
            out,
            'carpentry',
            at(x, set, deck + 0.53),
            at(x - sign * 0.38, set, apron - 0.043),
            0.127,
            0.14,
            trim,
          );
        }
      }
      if (rail && i !== Math.floor(weights.length * 0.5)) {
        room(
          out,
          'carpentry',
          atLeft,
          center + radius,
          outer - depth,
          outer - 0.023,
          deck + 0.88,
          deck + 1,
          trim,
        );
        if (level > 1)
          for (let k = 0.24; k < radius * 2 - 0.1; k += 0.35) {
            room(
              out,
              'carpentry',
              atLeft + k,
              atLeft + k + 0.056,
              outer - depth,
              outer - 0.047,
              deck + 0.14,
              deck + 0.9,
              trim,
            );
          }
      }
      end += span;
    }
    room(out, 'paint', hi - 0.23 - post, hi, outer - depth, outer + 0.05, deck, top, front);
    if (level > 1)
      room(
        out,
        'carpentry',
        lo,
        hi,
        doorLine + 0.13,
        outer - 0.06,
        eave - 0.26,
        eave - 0.17,
        door,
        true,
      );
    if (level > 2)
      for (let u = lo + 0.33; u < hi - 0.12; u += 0.52) {
        room(
          out,
          'carpentry',
          u - 0.052,
          u + 0.052,
          doorLine + 0.057,
          outer - 0.115,
          eave - 0.34,
          eave - 0.25,
          door,
          true,
        );
      }
    if (level && opening) {
      const back = onFront(doorLine);
      const span = clamp(width * 0.21, 1.58, 3.36);
      for (const u of [mid - width * 0.29, mid, mid + width * 0.29]) {
        const main = u === mid;
        framed(
          out,
          back,
          u,
          deck + 0.014,
          main ? span : span * 0.6,
          main ? Math.min(plan.porch.spring + 0.64, 3.38) : 2.21,
          trim,
          {
            head: plan.porch.doorHead ?? 'round',
            glass: door,
            glassSlot: 'carpentry',
            d: 0.064,
            frameWidth: level > 1 ? 0.092 : 0.047,
            mullions: level > 1 ? 1 : 0,
          },
        );
        if (level > 2) {
          const actualWidth = main ? span : span * 0.6;
          for (const dx of [-0.2, 0.2]) {
            const pane = u + dx * actualWidth;
            room(
              out,
              'carpentry',
              pane - 0.17 * actualWidth,
              pane + 0.17 * actualWidth,
              doorLine + 0.074,
              doorLine + 0.118,
              deck + 0.27,
              deck + 1.16,
              scaleTint(door, 1.14),
            );
          }
          room(
            out,
            'carpentry',
            u - actualWidth * 0.465,
            u + actualWidth * 0.465,
            doorLine + 0.079,
            doorLine + 0.121,
            deck + 1.21,
            deck + 1.3,
            trim,
          );
        }
        if (level > 2 && main)
          for (const x of [-0.22, 0.22])
            room(
              out,
              'carpentry',
              u + x - 0.036,
              u + x + 0.035,
              doorLine + 0.102,
              doorLine + 0.155,
              deck + 1.01,
              deck + 1.09,
              trim,
            );
      }
    }
    facadeBand(out, level, eave - 0.23, Math.ceil(width / 0.6));
    if (plan.gableWindow && level) {
      const high = spanBetween(eave, ridge, plan.gableWindow.at);
      const frontFace = onFront(outer + 0.16);
      framed(out, frontFace, mid, high, plan.gableWindow.width, plan.gableWindow.height, trim, {
        head: plan.gableWindow.head,
        frameWidth: level > 1 ? 0.105 : 0.05,
        mullions: 1,
        frameDepth: 0.07,
      });
    }
    if (level)
      for (const offset of plan.starOffsets ?? []) {
        const point = (i) => {
          const r = i % 2 ? 0.29 : 0.62,
            theta = (i * Math.PI) / 5;
          return at(
            mid + offset + Math.sin(theta) * r,
            outer + 0.175,
            eave + 1.12 + Math.cos(theta) * r,
          );
        };
        for (let i = 0; i < 10; i++)
          tri(
            out,
            'carpentry',
            at(mid + offset, outer + 0.175, eave + 1.12),
            point((i + 1) % 10),
            point(i),
            trim,
          );
      }
  }
  function spanBetween(low, high, t) {
    return low + (high - low) * t;
  }
  function steps(out, level) {
    const lower = Math.max(plan.apron, grade - 0.66);
    const count = level ? Math.max(1, Math.ceil((deck - lower) / 0.19)) : 1;
    const span = plan.gothic ? width * 0.56 : width * 0.51;
    for (let i = 0; i < count; i++) {
      const top = deck - ((deck - lower) * i) / count;
      room(
        out,
        'foundation',
        mid - span,
        mid + span,
        outer - 0.19,
        outer + 0.36 + (i + 1) * 0.265,
        Math.min(top - 0.12, lower - 0.09),
        top,
        earth,
      );
    }
  }

  function tower(out, profile, level) {
    const c = xz(mid + profile.offset, outer - profile.inset);
    const stages = profile.stages;
    for (const [index, [y, h, w, sides]] of stages.entries()) {
      const r = sides === 4 ? w * 0.5 * Math.SQRT2 : (w * 0.5) / Math.cos(Math.PI / 8);
      const turn = heading + halfStep(sides);
      const slot = plan.towerGraph === 'siding' ? 'siding' : 'paint';
      const tint = profile.tint ? rgb(profile.tint) : front;
      lathe(
        out,
        slot,
        c,
        [
          [y, r, r],
          [y + h, r * 0.958, r * 0.958],
        ],
        sides,
        tint,
        { rotation: turn },
      );
      if (!level || index === 0) {
        if (level) rim(out, c, r * 0.96, sides, y + h - 0.19, y + h + 0.025, 0.13, trim);
        continue;
      }
      const edit = outwardRing(ring(c, r * 0.963, sides, turn));
      for (const [i, point] of edit.entries()) {
        if (sides === 8 && i % 2 === 1) continue;
        const f = wallFace(point, edit[(i + 1) % sides]);
        const pane = Math.min(f.length * 0.61, w * 0.365);
        const bottom = y + h * 0.14,
          peak = h * 0.68;
        framed(out, f, f.length / 2, bottom, pane, peak, trim, {
          head: plan.gothic ? 'pointed' : 'flat',
          frameWidth: level > 1 ? 0.097 : 0,
          d: 0.035,
          mullions: level > 1 ? 1 : 0,
        });
        if (level > 1)
          for (let k = 1; k <= 4; k++) {
            const Y = bottom + (peak * 0.53 * k) / 5;
            fbox(
              out,
              'carpentry',
              f,
              (f.length - pane) * 0.5,
              (f.length + pane) * 0.5,
              Y,
              Y + 0.048,
              0.053,
              0.08,
              door,
            );
          }
      }
      rim(out, c, r * 0.959, sides, y + h - 0.235, y + h + 0.03, level > 1 ? 0.2 : 0.14, trim);
    }
    const [y, h, w, sides] = stages.at(-1),
      base = y + h;
    const r = (sides === 4 ? w * 0.5 * Math.SQRT2 : (w * 0.5) / Math.cos(Math.PI / 8)) * 1.018;
    const height = profile.cap;
    const form = profile.capShape;
    const cap =
      form === 'bell'
        ? [
            [base, r, r],
            [base + height * 0.49, r * 0.46, r * 0.46],
            [base + height * 0.74, r * 0.34, r * 0.34],
            [base + height, 0, 0],
          ]
        : form === 'spire'
          ? [
              [base, r, r],
              [base + height * 0.5, r * 0.44, r * 0.44],
              [base + height * 0.84, r * 0.24, r * 0.24],
              [base + height, 0, 0],
            ]
          : [
              [base, r, r],
              [base + height, 0, 0],
            ];
    lathe(out, 'roof', c, cap, sides, spire, {
      rotation: heading + halfStep(sides),
      capTop: false,
    });
    const top = base + height;
    if (level && profile.cross) {
      const cross = facade(c, F.along);
      fbox(
        out,
        'carpentry',
        cross,
        -0.039,
        0.039,
        top - 0.04,
        top + profile.cross,
        -0.036,
        0.036,
        trim,
      );
      fbox(
        out,
        'carpentry',
        cross,
        -profile.cross * 0.32,
        profile.cross * 0.32,
        top + profile.cross * 0.65,
        top + profile.cross * 0.73,
        -0.037,
        0.038,
        trim,
      );
    }
  }

  function medallion(out, u, v, y, radius, level) {
    const n = level > 1 ? 20 : 10;
    const points = (rad) =>
      Array.from({ length: n }, (_, i) => {
        const t = (2 * Math.PI * i) / n;
        return at(u + rad * Math.cos(t), v, y + rad * Math.sin(t));
      });
    const edge = points(radius);
    fan(out, 'glazing', edge, window);
    const rim = points(radius + 0.17);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      quad4(out, 'carpentry', edge[i], rim[i], rim[j], edge[j], trim);
    }
    if (level > 1)
      for (let i = 0; i < n; i += 3)
        beam(out, 'carpentry', at(u, v + 0.034, y), edge[i], 0.062, 0.052, trim);
  }
  function gothic(out, level) {
    const v = outer + 0.21;
    const frontFace = onFront(v);
    const wingFace = onFront(v + 0.1);
    room(out, 'paint', lo - 0.1, hi + 0.1, outer - 0.42, v, deck, eave, front);
    tri(out, 'paint', at(lo, v, eave), at(hi, v, eave), at(mid, v, ridge), front);
    const wings = [mid - width * 0.293, mid + width * 0.293];
    for (const u of wings) {
      const w = width * 0.154;
      room(out, 'paint', u - w, u + w, outer - 3.13, v + 0.1, deck, ridge + 0.68, front);
      room(
        out,
        'carpentry',
        u - w - 0.13,
        u + w + 0.13,
        outer - 3.15,
        v + 0.17,
        eave - 0.27,
        eave + 0.06,
        trim,
      );
      room(
        out,
        'carpentry',
        u - w - 0.17,
        u + w + 0.17,
        outer - 3.21,
        v + 0.22,
        ridge + 0.54,
        ridge + 0.79,
        trim,
      );
      for (const x of [u - w, u + w]) {
        room(
          out,
          'carpentry',
          x - 0.22,
          x + 0.22,
          outer - 0.68,
          v + 0.21,
          deck,
          eave + 0.61,
          scaleTint(front, 1.08),
        );
        lathe(
          out,
          'roof',
          xz(x, v + 0.04),
          [
            [eave + 0.33, 0.39, 0.39],
            [eave + 1.75, 0, 0],
          ],
          4,
          spire,
          { rotation: heading + Math.PI / 4, capTop: false },
        );
      }
    }
    if (!level) return;
    const doors = [mid - width * 0.288, mid, mid + width * 0.288];
    for (const [i, u] of doors.entries()) {
      const w = i === 1 ? 3.11 : 2.25;
      framed(out, i === 1 ? frontFace : wingFace, u, deck + 0.08, w, i === 1 ? 4.45 : 3.6, trim, {
        head: 'pointed',
        glass: door,
        glassSlot: 'carpentry',
        frameWidth: level > 1 ? 0.26 : 0.11,
        mullions: 1,
      });
    }
    framed(out, frontFace, mid, deck + 6.75, width * 0.225, ridge * 0.38, trim, {
      head: 'pointed',
      frameWidth: level > 1 ? 0.19 : 0.09,
      mullions: 3,
      transoms: level > 1 ? 2 : 0,
    });
    for (const u of wings) {
      medallion(out, u, v + 0.137, deck + 8.72, width * 0.053, level);
      for (const t of [-0.75, 0, 0.75])
        framed(out, wingFace, u + t, deck + 5.63, 0.54, 1.57, trim, {
          head: 'pointed',
          frameWidth: level > 1 ? 0.075 : 0,
        });
    }
  }

  function build(target, level) {
    const out = withFootprintCaps(target);
    nave(out, level);
    steps(out, level);
    if (plan.gothic) gothic(out, level);
    else portico(out, level);
    for (const profile of plan.towers) tower(out, profile, level);
  }
  const buildCloseup = (out) => build(out, 3);
  return {
    surfaces,
    buildSkyline: (out) => build(out, 0),
    buildDistrict: (out) => build(out, 1),
    buildStreet: (out) => build(out, 2),
    buildCloseup,
    buildMaster: buildCloseup,
  };
}
