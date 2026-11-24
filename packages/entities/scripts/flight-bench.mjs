/**
 * Headless flight experiments. They live in the kernel's trial library, shared with its tests
 * and the trial scorecards; this module keeps the names the calibration and bench scripts use.
 */
export {
  flyLevel,
  flyRotorLevel,
  levelSpeedRoots,
  rotorCruiseTilt,
  steadyFlightPoint as trimPoint,
} from '@bendyline/molen-kernel/trials';
