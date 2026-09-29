import { describe, expect, it } from 'vitest';
import { hasAuthoredGroundContact } from '../scripts/authored-ground-contact.mjs';

describe('authored landmark ground contact', () => {
  const fort = {
    actualBounds: { min: [-40, -4.35, -40], max: [40, 23, 40] },
    geographicProposal: {
      groundModelY: 0,
      groundContactReviewed: true,
      groundContactBasis: 'Museum courtyard plan: retaining walls extend below the contact plane.',
    },
  };
  it('accepts a reviewed courtyard datum with below-ground retaining walls', () => {
    expect(hasAuthoredGroundContact(fort)).toBe(true);
    expect(hasAuthoredGroundContact({ actualBounds: { min: [-1, 0, -1], max: [1, 8, 1] } })).toBe(
      true,
    );
  });
  it('rejects ambiguous, unsupported, or nonzero contact planes', () => {
    for (const patch of [
      { groundContactReviewed: false },
      { groundContactBasis: '' },
      { groundModelY: 4.35 },
      { groundModelY: undefined },
    ]) {
      expect(
        hasAuthoredGroundContact({
          ...fort,
          geographicProposal: { ...fort.geographicProposal, ...patch },
        }),
      ).toBe(false);
    }
    expect(
      hasAuthoredGroundContact({ ...fort, actualBounds: { min: [-1, 4, -1], max: [1, 8, 1] } }),
    ).toBe(false);
    expect(
      hasAuthoredGroundContact({ ...fort, actualBounds: { min: [-1, -8, -1], max: [1, -4, 1] } }),
    ).toBe(false);
  });
});
