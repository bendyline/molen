/** Travel assist: four times the distance with ordinary control response times. */
export const BOOST_SPEED_MULTIPLIER = 4;

export function boostSpeedMultiplier(enabled: boolean | undefined): number {
  return enabled ? BOOST_SPEED_MULTIPLIER : 1;
}
