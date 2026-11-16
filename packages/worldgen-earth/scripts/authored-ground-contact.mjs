/** An authored contact plane can use the model origin or an explicit terrain reference. */
export function hasAuthoredGroundContact(spec) {
  const min = spec.actualBounds?.min?.[1];
  const max = spec.actualBounds?.max?.[1];
  if (!Number.isFinite(min) || !Number.isFinite(max)) return false;
  if (Math.abs(min) <= 0.01) return true;
  const proposal = spec.geographicProposal;
  const absoluteDatum =
    proposal?.elevationMode === 'sea-level' && Number.isFinite(proposal.elevationMeters);
  const contact = proposal?.groundModelY;
  const matchesTerrainReference =
    proposal?.elevationMode === 'terrain-contact' &&
    Number.isFinite(contact) &&
    proposal.terrainReference?.modelHeight === contact &&
    contact >= min &&
    contact <= max;
  return (
    ((contact === 0 && ((min < 0 && max >= 0) || absoluteDatum)) || matchesTerrainReference) &&
    proposal.groundContactReviewed === true &&
    typeof proposal.groundContactBasis === 'string' &&
    proposal.groundContactBasis.trim().length > 0
  );
}
