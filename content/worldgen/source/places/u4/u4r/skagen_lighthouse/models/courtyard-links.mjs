/** Photo-proportioned side passages; dimensions and symmetry are reconstruction controls. */
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { buildSkagen } from '../../../../../../../../packages/worldgen/scripts/lighthouse-south-baltic-models.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const wall = [0.82, 0.81, 0.735];

export function courtyardLinks(out, segments = 12) {
  for (const [left, right] of [
    [-12.97, -10.43],
    [10.43, 12.84],
  ]) {
    const cx = (left + right) / 2,
      half = 0.7,
      spring = 1.53,
      top = 2.68,
      front = 23.12,
      back = 22.69;
    box(out, 'plaster', [left, 0, back], [cx - half, top, front], wall);
    box(out, 'plaster', [cx + half, 0, back], [right, top, front], wall);
    for (let i = 0; i < segments; i++) {
      const a = (i * Math.PI) / segments,
        b = ((i + 1) * Math.PI) / segments,
        p = [cx + half * Math.cos(a), spring + half * Math.sin(a), front],
        q = [cx + half * Math.cos(b), spring + half * Math.sin(b), front];
      for (const z of [front, back]) {
        const ps = [
          [p[0], p[1], z],
          [p[0], top, z],
          [q[0], top, z],
          [q[0], q[1], z],
        ];
        if (normalFor(...ps.slice(0, 3))[2] * (z === front ? 1 : -1) < 0) ps.reverse();
        quad(out, 'plaster', ps, normalFor(...ps.slice(0, 3)), wall);
      }
      const soffit = [p, q, [q[0], q[1], back], [p[0], p[1], back]];
      quad(out, 'plaster', soffit, normalFor(...soffit.slice(0, 3)), wall);
    }
    quad(
      out,
      'plaster',
      [
        [cx - half, top, front],
        [cx + half, top, front],
        [cx + half, top, back],
        [cx - half, top, back],
      ],
      [0, 1, 0],
      wall,
    );
  }
}

export function buildSkagenWithPassages(out) {
  let removed = 0;
  const wrapper = {
    addQuad(slot, ref, points, ...args) {
      if (
        slot === 'plaster' &&
        [-11.65, 11.6].some((x) =>
          points.every(
            ([px, y, z]) =>
              px >= x - 0.85 - 1e-8 &&
              px <= x + 0.85 + 1e-8 &&
              y >= 0.12 - 1e-8 &&
              y <= 2.68 + 1e-8 &&
              z >= 22.69 - 1e-8 &&
              z <= 23.12 + 1e-8,
          ),
        )
      ) {
        removed++;
        return;
      }
      out.addQuad(slot, ref, points, ...args);
    },
    addTriangle(...args) {
      out.addTriangle(...args);
    },
    addConvexPolygon(...args) {
      out.addConvexPolygon(...args);
    },
  };
  buildSkagen(wrapper);
  if (removed !== 12) throw new Error(`Expected twelve old courtyard-link faces; found ${removed}`);
  courtyardLinks(out, 16);
}
