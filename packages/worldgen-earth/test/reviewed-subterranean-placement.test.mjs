import { describe, expect, it } from 'vitest';
import { subterraneanIdentityResolved } from '../scripts/reviewed-subterranean-placement.mjs';

function reviewFixture() {
  const placement = {
    id: 'cistern',
    asset: 'molen.worldgen.structure.cistern',
    status: 'preview',
    groundCutout: {
      outline: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      preservePaving: true,
    },
  };
  return {
    recommendation: { reasonCode: 'subterranean' },
    geographicReviewed: true,
    sharedReviewed: true,
    placement,
    placementHash: 'placement',
    runtimeHash: 'runtime',
    inspectedFrames: ['medium-fi/interior.png'],
    capture: {
      placementHash: 'placement',
      runtimeHash: 'runtime',
      frames: [
        {
          path: 'medium-fi/interior.png',
          state: {
            mode: 'geographic-native-terrain',
            assetId: placement.asset,
            placementId: placement.id,
            runtimeHash: 'runtime',
            visibleDraws: 4,
          },
        },
      ],
      eviction: { disposed: true, liveModelGeometries: 0 },
      placementChecks: ['skyline', 'district', 'street', 'closeup'].map((level) => ({
        level,
        cutoutActive: true,
        portals: [{ openSurface: null, bottom: 2, nearbySurface: 7 }],
        interior: level === 'skyline' ? null : { deck: 2, ceiling: 6, ground: 7 },
        unload: { groundRetained: true, liveGeometries: 0 },
      })),
    },
  };
}

describe('subterranean landmark readiness', () => {
  it('accepts a reviewed native placement with open portals and a buried hall', () => {
    expect(subterraneanIdentityResolved(reviewFixture())).toBe(true);
  });

  it('retains the blocker for stale, inactive or unreviewed placement evidence', () => {
    for (const change of [
      (r) => {
        r.recommendation.reasonCode = 'historical';
      },
      (r) => {
        r.placement.status = 'draft';
      },
      (r) => {
        r.geographicReviewed = false;
      },
      (r) => {
        r.sharedReviewed = false;
      },
      (r) => {
        r.placementHash = 'changed';
      },
      (r) => {
        r.runtimeHash = 'changed';
      },
      (r) => {
        r.inspectedFrames = [];
      },
      (r) => {
        r.capture.frames[0].state.mode = 'geographic-flat-terrain';
      },
    ]) {
      const review = reviewFixture();
      change(review);
      expect(subterraneanIdentityResolved(review)).toBe(false);
    }
  });

  it('requires covered chambers, unobstructed stairs and surface restoration', () => {
    for (const change of [
      (r) => {
        r.placement.groundCutout.preservePaving = false;
      },
      (r) => {
        r.capture.placementChecks.pop();
      },
      (r) => {
        r.capture.placementChecks[0].portals[0].openSurface = 7;
      },
      (r) => {
        r.capture.placementChecks[1].interior.ground = 3;
      },
      (r) => {
        r.capture.placementChecks[3].unload.groundRetained = false;
      },
      (r) => {
        r.capture.eviction.liveModelGeometries = 1;
      },
    ]) {
      const review = reviewFixture();
      change(review);
      expect(subterraneanIdentityResolved(review)).toBe(false);
    }
  });
});
