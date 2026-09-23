import type { MatGraphDoc, PixelGridDoc } from '@bendyline/molen-materials';
import { bakeMatGraph, bakePixelGrid } from '@bendyline/molen-materials';

// Browser half of the Node-vs-browser material byte-equality test. Bundled by the test with
// esbuild and loaded in Chromium; it bakes the same documents the Node side bakes and hands back
// the raw RGBA bytes, so the comparison is on pixels rather than on a rendered screenshot.

declare global {
  interface Window {
    __bakeMaterials(docs: {
      graphs: MatGraphDoc[];
      grids: PixelGridDoc[];
    }): Record<string, number[]>;
  }
}

function slotsOf(prefix: string, baked: ReturnType<typeof bakeMatGraph>): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [slot, image] of Object.entries(baked.slots)) {
    if (image === undefined) continue;
    out[`${prefix}:${slot}`] = Array.from(image.data);
  }
  return out;
}

window.__bakeMaterials = (docs) => {
  const out: Record<string, number[]> = {};
  docs.graphs.forEach((doc, i) => {
    Object.assign(out, slotsOf(`graph${i}`, bakeMatGraph(doc)));
  });
  docs.grids.forEach((doc, i) => {
    Object.assign(out, slotsOf(`grid${i}`, bakePixelGrid(doc)));
  });
  return out;
};
