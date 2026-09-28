import { createHash } from 'node:crypto';

/** Accept a source-local frame only after the current model's placement was reviewed.
 * The spec binds exact evidence bytes; the source bundle makes that evidence durable.
 */
export function reviewedSourceMapFrame({
  frameBytes,
  sourceManifest,
  spec,
  placement,
  geographicReviewed,
}) {
  const proposal = spec?.geographicProposal;
  if (
    !geographicReviewed ||
    !frameBytes ||
    proposal?.mapGeometrySource !== 'map-frame.json' ||
    !sourceManifest?.files?.documents?.includes('map-frame.json') ||
    proposal.mapGeometryHash !== `sha256:${createHash('sha256').update(frameBytes).digest('hex')}`
  )
    return undefined;
  let frame;
  try {
    frame = JSON.parse(frameBytes);
  } catch {
    return undefined;
  }
  const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
  // Earlier ensemble frames called their explicitly signed coordinate description "basis".
  // Accept that durable field only when it actually names both positive model axes.
  const signedAxes =
    nonempty(frame.axis) ||
    (frame.axis === undefined &&
      nonempty(frame.basis) &&
      /\+X\b/.test(frame.basis) &&
      /\+Z\b/.test(frame.basis));
  if (
    !nonempty(frame.source) ||
    !signedAxes ||
    !nonempty(frame.identityStatus) ||
    typeof frame.sourceUrl !== 'string' ||
    !/^https?:\/\//.test(frame.sourceUrl) ||
    !Array.isArray(frame.anchor) ||
    frame.anchor.length !== 2 ||
    !frame.anchor.every(Number.isFinite) ||
    !Number.isFinite(frame.heading) ||
    !Array.isArray(frame.geometry?.outline) ||
    frame.geometry.outline.length < 4 ||
    !frame.geometry.outline.every(
      (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite),
    ) ||
    !Array.isArray(placement?.anchor) ||
    !Number.isFinite(placement.heading) ||
    !frame.anchor.every((v, i) => Math.abs(v - placement.anchor[i]) < 1e-9) ||
    Math.abs(
      Math.atan2(
        Math.sin(frame.heading - placement.heading),
        Math.cos(frame.heading - placement.heading),
      ),
    ) > 1e-8
  )
    return undefined;
  return frame;
}
