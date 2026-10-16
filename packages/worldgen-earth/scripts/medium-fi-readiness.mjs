/** A new-style review must cover the shipped LODs and every required lighting/mode view. */
import { createHash } from 'node:crypto';
import { matchesEvidenceText } from '../../worldgen/scripts/evidence-text-hash.mjs';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
export async function reviewedMediumFi({ qa, reportBytes, sidecar, readImage }) {
  if (
    !reportBytes ||
    !matchesEvidenceText(reportBytes, qa?.mediumFiReview?.captureReportHash) ||
    qa?.mediumFiReview?.status !== 'passed'
  )
    return false;
  const report = JSON.parse(reportBytes);
  if (
    report.sourceHash !== qa.sourceHash ||
    report.runtimeHash !== sidecar.hash ||
    report.assetId !== sidecar.id ||
    report.errors?.length ||
    report.rig?.toneMapping !== 'neutral' ||
    report.rig?.exposure !== 1
  )
    return false;
  const budgets = { skyline: 1000, district: 4000, street: 16000, closeup: 64000 };
  for (const [name, budget] of Object.entries(budgets)) {
    const level = sidecar.runtimeLods?.levels?.find((l) => l.name === name);
    const captured = report.runtimeLods?.find((l) => l.name === name);
    if (
      !level ||
      !captured ||
      captured.hash !== level.hash ||
      level.triangles > budget ||
      level.drawCalls > 8
    )
      return false;
  }
  const inspected = new Set(qa.mediumFiReview.inspectedFrames ?? []);
  const frames = report.frames ?? [];
  for (const distance of ['street', 'block', 'skyline'])
    for (const time of ['noon', 'late'])
      for (const mode of ['economy', 'high'])
        if (
          !frames.some(
            (f) =>
              f.path === `medium-fi/${distance}-${time}-${mode}.png` &&
              f.state?.distance === distance &&
              f.state?.time === time &&
              f.state?.mode === mode &&
              inspected.has(f.path),
          )
        )
          return false;
  for (const name of ['silhouette', ...Object.keys(budgets).map((n) => `transition-${n}`)])
    if (!frames.some((f) => f.path === `medium-fi/${name}.png` && inspected.has(f.path)))
      return false;
  for (const path of inspected) {
    // Source-local evidence only; never allow a report path to escape its bundle.
    if (!/^medium-fi\/[a-z0-9-]+\.png$/.test(path)) return false;
    const frame = frames.find((f) => f.path === path),
      image = await readImage(path);
    if (!frame || !image || hash(image) !== frame.hash) return false;
  }
  return true;
}
