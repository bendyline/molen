import assert from 'node:assert/strict';
import { matchesEvidenceText } from '../../../../packages/worldgen/scripts/evidence-text-hash.mjs';

/** Use the attributed source-local frame when authoring corrected the shared map evidence. */
export function sourceLocalFootprint(spec, bytes) {
  if (spec.geographicProposal?.mapGeometrySource !== 'map-frame.json') return undefined;
  assert(bytes, `${spec.id}: source-local footprint evidence is missing`);
  const hash = spec.geographicProposal.mapGeometryHash;
  assert(matchesEvidenceText(bytes, hash), `${spec.id}: map frame changed`);
  const frame = JSON.parse(bytes.toString('utf8'));
  const label = frame.geometryLabel;
  assert(label === undefined || (typeof label === 'string' && label.length < 200));
  const evidenceUrl = frame.sourceUrl ?? frame.source;
  assert(
    typeof evidenceUrl === 'string' && /^https?:\/\//.test(evidenceUrl),
    'Source-local footprint needs an absolute evidence URL',
  );
  assert(frame.anchor?.length === 2 && Number.isFinite(frame.heading));
  assert(frame.anchor.every(Number.isFinite));
  const polygon = frame.geometry?.outline;
  const centerlines = frame.geometry?.centerlines;
  assert(
    polygon?.length >= 3 || (centerlines?.length && centerlines.every((line) => line.length >= 2)),
    'Source-local evidence needs an outline or open centerlines',
  );
  const [longitude, latitude] = frame.anchor;
  const meters = 111319.49079327358;
  const cosineLatitude = Math.cos((latitude * Math.PI) / 180);
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  const project = (p) => {
    assert(p.length === 2 && p.every(Number.isFinite), 'Invalid source-local footprint point');
    const [x, z] = p;
    return [
      longitude + (x * c + z * s) / (meters * cosineLatitude),
      latitude - (-x * s + z * c) / meters,
    ];
  };
  if (!polygon) return { lines: centerlines.map((line) => line.map(project)), hash, label };
  const footprint = polygon.map(project);
  if (footprint[0].some((value, i) => value !== footprint.at(-1)[i])) footprint.push(footprint[0]);
  return { footprint, hash, label };
}
