import { matchesEvidenceText } from '../../worldgen/scripts/evidence-text-hash.mjs';

/** Accept a source-local frame only after the current model's placement was reviewed.
 * The spec binds evidence text (allowing Git LF/CRLF conversion); the bundle preserves it.
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
    !matchesEvidenceText(frameBytes, proposal.mapGeometryHash)
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
  const point = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  const outline = frame.geometry?.outline;
  const polygons = frame.geometry?.polygons;
  const lines = frame.geometry?.centerlines;
  const orientation = frame.orientationControl;
  const mappedNode = /^https:\/\/(?:www\.)?openstreetmap\.org\/node\/(\d+)\/?$/.exec(
    frame.sourceUrl ?? '',
  );
  // A node establishes identity/location, never facing by itself. A referenced
  // reconstruction can retain a bearing, or explicitly accept an approximate
  // visualization facing after current picture/PMTiles placement review.
  const approximateFacing =
    orientation?.status === 'reviewed-approximation' &&
    proposal?.orientationPolicy === 'approximate-visualization';
  const reviewedPoint =
    frame.coordinateSpace === 'model-local-xz' &&
    point(frame.geometry?.point) &&
    frame.geometry.point.every((v) => v === 0) &&
    mappedNode &&
    /^Q[1-9]\d*$/.test(spec?.wikidataId ?? '') &&
    frame.mappedIdentity?.wikidataId === spec.wikidataId &&
    frame.mappedIdentity?.featureIds?.includes(`node/${mappedNode[1]}`) &&
    (orientation?.status === 'reviewed-reconstruction' || approximateFacing) &&
    /^\d{4}-\d{2}-\d{2}$/.test(orientation.reviewedOn ?? '') &&
    nonempty(orientation.basis) &&
    Number.isFinite(orientation.headingRadians) &&
    Math.abs(
      Math.atan2(
        Math.sin(orientation.headingRadians - frame.heading),
        Math.cos(orientation.headingRadians - frame.heading),
      ),
    ) < 1e-8 &&
    Number.isFinite(orientation.uncertaintyDegrees) &&
    orientation.uncertaintyDegrees >= 0 &&
    (approximateFacing
      ? orientation.uncertaintyDegrees <= 180
      : orientation.uncertaintyDegrees < 90) &&
    Array.isArray(orientation.referencePages) &&
    orientation.referencePages.length > 0 &&
    orientation.referencePages.every((url) => typeof url === 'string' && /^https?:\/\//.test(url));
  // Access paths and bridge crossings resolve a signed axis without a building polygon.
  // Keep that measured line evidence instead of inventing an outline for readiness.
  const usableGeometry =
    (Array.isArray(outline) && outline.length >= 4 && outline.every(point)) ||
    (Array.isArray(polygons) &&
      polygons.length > 0 &&
      polygons.every((ring) => {
        if (!Array.isArray(ring) || ring.length < 3 || !ring.every(point)) return false;
        const area = ring.reduce(
          (sum, p, i) =>
            sum + p[0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * p[1],
          0,
        );
        return Math.abs(area) > 1e-8;
      })) ||
    (Array.isArray(lines) &&
      lines.length > 0 &&
      lines.every(
        (line) =>
          Array.isArray(line) &&
          line.length >= 2 &&
          line.every(point) &&
          line.some((p) => p[0] !== line[0][0] || p[1] !== line[0][1]),
      )) ||
    reviewedPoint;
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
    !usableGeometry ||
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
