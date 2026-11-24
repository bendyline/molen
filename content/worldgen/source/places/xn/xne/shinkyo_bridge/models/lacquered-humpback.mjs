import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  facade,
  fbox,
  lathe,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  deck: { slot: 'wall', graph: 'wood_plain', roughness: 0.88 },
  lacquer: { slot: 'trim', graph: 'wood_vertical', roughness: 0.75 },
  pier: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  cap: { slot: 'trim', graph: 'metal_copper', roughness: 0.88 },
};

const wood = rgb('86746a');
const lacquer = rgb('a1412f');
const dark = rgb('533f37');
const masonry = rgb('85817a');
const bronze = rgb('62664e');
const { center, along, length, width, abutments, deckHeights, rise } = site.bridge;
const { P } = facade(center, along);
const halfLength = length / 2;
const halfWidth = width / 2;

function deckY(x) {
  const t = x / length + 0.5;
  return deckHeights[0] * (1 - t) + deckHeights[1] * t + rise * (1 - (t * 2 - 1) ** 2);
}

function ribbon(out, slot, a, b, v, V, top, bottom, tint) {
  const A = P(a, deckY(a) + top, v);
  const B = P(a, deckY(a) + top, V);
  const C = P(b, deckY(b) + top, V);
  const D = P(b, deckY(b) + top, v);
  const lower = ([x, y, z]) => [x, y + bottom - top, z];
  quad4(out, slot, A, B, C, D, tint);
  quad4(out, slot, D, lower(D), lower(A), A, tint);
  quad4(out, slot, B, lower(B), lower(C), C, tint);
  quad4(out, slot, lower(D), lower(C), lower(B), lower(A), tint);
}

function build(out, detail) {
  const f = facade(center, along);
  const segments = [8, 14, 22, 40][detail];
  const rail = halfWidth * 0.97;
  const step = length / segments;
  for (let i = 0; i < segments; i++) {
    const a = -halfLength + i * step;
    const b = -halfLength + (i + 1) * step;
    ribbon(out, 'deck', a, b, -halfWidth, halfWidth, 0, -0.22, wood);
    for (const sign of [-1, 1]) {
      const z = sign * rail;
      ribbon(out, 'lacquer', a, b, z - 0.14, z + 0.14, 1.04, 0.87, lacquer);
      ribbon(out, 'lacquer', a, b, z - 0.095, z + 0.095, 0.37, 0.27, lacquer);
      ribbon(out, 'lacquer', a, b, z - 0.16, z + 0.16, -0.09, -0.42, lacquer);
      const depth = detail >= 1 ? 0.34 : 0.25;
      ribbon(out, 'deck', a, b, z * 0.67 - depth, z * 0.67 + depth, -0.26, -0.98, dark);
    }
  }
  for (const [i, bank] of abutments.entries()) {
    const x = (i * 2 - 1) * halfLength;
    fbox(
      out,
      'pier',
      f,
      bank.x0,
      bank.x1,
      bank.bottom,
      deckY(x) - 0.39,
      -halfWidth * 0.94,
      halfWidth * 0.94,
      masonry,
    );
    if (detail >= 1)
      fbox(
        out,
        'pier',
        f,
        bank.x0 - 0.13,
        bank.x1 + 0.13,
        deckY(x) - 0.56,
        deckY(x) - 0.37,
        -halfWidth,
        halfWidth,
        masonry,
      );
  }
  const bays = [6, 10, 16, 16][detail];
  for (const sign of [-1, 1]) {
    const z = sign * rail;
    for (let i = 0; i <= bays; i++) {
      const x = -halfLength + 0.11 + ((length - 0.22) * i) / bays;
      const y = deckY(x);
      const postWidth = i === 0 || i === bays || i === bays / 2 ? 0.16 : 0.092;
      fbox(
        out,
        'lacquer',
        f,
        x - postWidth,
        x + postWidth,
        y - 0.16,
        y + 1.13,
        z - postWidth,
        z + postWidth,
        lacquer,
      );
      if (detail >= 2) {
        const [X, , Z] = P(x, 0, z);
        const capRadius = postWidth * 0.89;
        lathe(
          out,
          'cap',
          [X, Z],
          [
            [y + 1.13, capRadius, capRadius],
            [y + 1.2, capRadius * 1.02, capRadius * 1.02],
            [y + 1.35, 0.035, 0.035],
          ],
          7,
          bronze,
        );
      }
      if (detail >= 1 && i < bays) {
        for (const fraction of detail >= 2 ? [0.22, 0.4, 0.6, 0.78] : [0.33, 0.66]) {
          const u = x + (fraction * (length - 0.22)) / bays;
          const Y = deckY(u);
          fbox(
            out,
            'lacquer',
            f,
            u - 0.028,
            u + 0.028,
            Y + 0.33,
            Y + 0.92,
            z - 0.028,
            z + 0.028,
            lacquer,
          );
        }
      }
    }
  }
  if (detail === 3)
    for (let i = 1; i < segments; i++) {
      const x = -halfLength + i * step;
      const y = deckY(x) + 0.004;
      beam(out, 'deck', P(x, y, -halfWidth * 0.94), P(x, y, halfWidth * 0.94), 0.025, 0.008, dark);
    }
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
