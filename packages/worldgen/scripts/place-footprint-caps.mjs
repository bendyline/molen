/** Connect surveyed footprint caps to the architectural surface authoring sink. */
import { MeshBufferBuilder } from '../dist/kernel.mjs';
import { tri } from './place-recipe-kit.mjs';

export function withFootprintCaps(out) {
  return {
    ...out,
    addCap(slot, ref, outline, holes, height, normal, uv, color) {
      const cap = new MeshBufferBuilder();
      if (!cap.addCap('wall', ref, outline, holes, height, normal, uv, color)) return false;
      const { positions, indices } = cap.finalize();
      for (let i = 0; i < indices.length; i += 3) {
        const [a, b, c] = Array.from(indices.slice(i, i + 3), (j) =>
          positions.slice(j * 3, j * 3 + 3),
        );
        tri(out, slot, a, b, c, color);
      }
      return true;
    },
  };
}
