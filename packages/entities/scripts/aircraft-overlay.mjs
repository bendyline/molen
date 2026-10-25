/** Uniform-scale, auditable reference overlays. PNG inputs; local evidence only.
 * The camera and aircraft transform come from aircraft-compare.mjs, never inferred by fitting.
 * This creates comparison evidence, never a visual acceptance result.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

const ids = process.argv
  .find((a) => a.startsWith('--ids='))
  ?.slice(6)
  .split(',');
if (!ids?.length) throw Error('Select aircraft with --ids=...');
const sha = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
const read = async (p) => {
  const bytes = await readFile(p);
  return { png: PNG.sync.read(bytes), hash: sha(bytes) };
};
for (const slug of ids) {
  const folder = `content/entities/source/aircraft/${slug}`,
    config = JSON.parse(await readFile(`${folder}/reference-review.json`)),
    captures = JSON.parse(await readFile(`.artifacts/aircraft/comparisons/${slug}.json`)),
    reports = [];
  await mkdir(`.artifacts/aircraft/overlays/${slug}`, { recursive: true });
  for (const c of config.overlays) {
    const view = captures.views.find((v) => v.name === c.view);
    if (!view) throw Error(`Missing ${slug}/${c.view} capture`);
    const model = await read(view.output),
      ref = await read(c.reference),
      camera = view.scene.camera,
      ppm = model.png.height / camera.viewHeight,
      scale = ppm / (c.scaleControls.pixels / c.scaleControls.meters);
    const crop = c.crop,
      rotated = c.rotate === 270,
      w = rotated ? crop.height : crop.width,
      h = rotated ? crop.width : crop.height;
    let anchor = [c.referenceAnchor[0] - crop.left, c.referenceAnchor[1] - crop.top];
    if (rotated) anchor = [anchor[1], crop.width - 1 - anchor[0]];
    const modelPixel = [
        model.png.width / 2 + (c.modelAnchor[0] - camera.center[0]) * ppm,
        model.png.height / 2 + (c.modelAnchor[1] - camera.center[1]) * ppm,
      ],
      left = Math.round(modelPixel[0] - anchor[0] * scale),
      top = Math.round(modelPixel[1] - anchor[1] * scale);
    const pad = {
      left: Math.max(20, 20 - left),
      top: Math.max(20, 20 - top),
      right: Math.max(20, 20 + left + w * scale - model.png.width),
      bottom: Math.max(20, 20 + top + h * scale - model.png.height),
    };
    const out = new PNG({
      width: Math.ceil(model.png.width + pad.left + pad.right),
      height: Math.ceil(model.png.height + pad.top + pad.bottom),
    });
    out.data.fill(245);
    for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255;
    PNG.bitblt(model.png, out, 0, 0, model.png.width, model.png.height, pad.left, pad.top);
    const lum = (x, y) => {
      x = Math.max(0, Math.min(ref.png.width - 1, x));
      y = Math.max(0, Math.min(ref.png.height - 1, y));
      const i = (y * ref.png.width + x) * 4;
      return 0.299 * ref.png.data[i] + 0.587 * ref.png.data[i + 1] + 0.114 * ref.png.data[i + 2];
    };
    for (let y = 0; y < Math.ceil(h * scale); y++)
      for (let x = 0; x < Math.ceil(w * scale); x++) {
        const u = x / scale,
          v = y / scale,
          sx = Math.round(crop.left + (rotated ? crop.width - 1 - v : u)),
          sy = Math.round(crop.top + (rotated ? u : v));
        const ink =
          c.edgeMode === 'photo'
            ? Math.min(
                255,
                Math.abs(lum(sx + 1, sy) - lum(sx - 1, sy)) * 3 +
                  Math.abs(lum(sx, sy + 1) - lum(sx, sy - 1)) * 3,
              )
            : 255 - lum(sx, sy);
        const a = (ink / 255) * 0.68,
          ox = x + left + pad.left,
          oy = y + top + pad.top,
          i = (oy * out.width + ox) * 4;
        if (ox < 0 || ox >= out.width || oy < 0 || oy >= out.height) continue;
        for (let k = 0; k < 3; k++)
          out.data[i + k] = Math.round(out.data[i + k] * (1 - a) + [0, 130, 190][k] * a);
      }
    const output = `.artifacts/aircraft/overlays/${slug}/${c.view}.png`,
      bytes = PNG.sync.write(out);
    await writeFile(output, bytes);
    reports.push({
      ...c,
      referenceHash: ref.hash,
      render: view.output,
      renderHash: model.hash,
      camera,
      modelTransform: view.scene.entities[0].components.transform,
      pixelsPerMeter: ppm,
      uniformImageScale: scale,
      modelPixel,
      translation: { left, top },
      padding: pad,
      output,
      outputHash: sha(bytes),
      inspected: false,
    });
  }
  await writeFile(
    `.artifacts/aircraft/overlays/${slug}/report.json`,
    JSON.stringify(
      {
        id: captures.id,
        sourceHash: captures.sourceHash,
        runtimeHash: captures.hash,
        references: config.references,
        reports,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`${slug}: ${reports.length} overlays; inspection still required`);
}
