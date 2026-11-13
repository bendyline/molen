/** Negative foundations may surround a reviewed Y=0 courtyard/contact plane. */
export function hasAuthoredGroundContact(spec) {
  const min = spec.actualBounds?.min?.[1];
  const max = spec.actualBounds?.max?.[1];
  if (!Number.isFinite(min) || !Number.isFinite(max)) return false;
  if (Math.abs(min) <= 0.01) return true;
  const proposal = spec.geographicProposal;
  const absoluteDatum =
    proposal?.elevationMode === 'sea-level' && Number.isFinite(proposal.elevationMeters);
  return (
    ((min < 0 && max >= 0) || absoluteDatum) &&
    proposal?.groundModelY === 0 &&
    proposal.groundContactReviewed === true &&
    typeof proposal.groundContactBasis === 'string' &&
    proposal.groundContactBasis.trim().length > 0
  );
}
