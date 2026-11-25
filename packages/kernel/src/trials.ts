/**
 * Trials: scripted pilots and drivers that put the production flight and driving solvers through
 * the procedures of a flight-test or road-test program (a stall, a level acceleration, a roll, a
 * standing start, a skidpad) and measure the result. Tests, calibration and the benches that
 * score a vehicle against published figures all fly the same procedures from here.
 *
 * Everything is headless and deterministic: no DOM, renderer or wall clock.
 */

export { type RotorTrim, rotorShaftPower, rotorTrim } from './helicopter-rotor';
export type {
  DriveTrialOptions,
  DriveTrialPose,
  LeanResponse,
  RidingLap,
  SteadyCornering,
} from './trials/drive';
export {
  accelerationTime,
  driveTrial,
  figureEight,
  leanResponse,
  standingDistance,
  steadyCornering,
  stoppingDistance,
  topSpeed,
} from './trials/drive';
export type {
  ClimbAndTopSpeed,
  FlightConfig,
  FlightTrialOptions,
  FlightTrialPose,
  FreeResponse,
  LevelRun,
  LevelRunSample,
  RollResponse,
  StallAndGlide,
  SteadyFlightPoint,
  TakeoffRun,
} from './trials/flight';
export {
  airborneAircraft,
  atMass,
  bestSteadyClimb,
  FLIGHT_TRIAL_INPUT,
  flightTrial,
  flyLevel,
  holdLevel,
  levelFlightPower,
  levelRun,
  levelSpeedRoots,
  measureClimbAndTopSpeed,
  measureDutchRoll,
  measurePhugoid,
  measureRoll,
  measureShortPeriod,
  measureSpiral,
  measureStallAndGlide,
  measureTakeoff,
  stallSpeedEstimate,
  steadyCeiling,
  steadyFlightPoint,
  steadyGlide,
  steadyTurn,
} from './trials/flight';
export type { RotorFlight } from './trials/rotor';
export {
  airborneHelicopter,
  bestRotorClimb,
  flyRotorLevel,
  hoverCeiling,
  hoverMargin,
  rotorAutorotation,
  rotorClimb,
  rotorCruiseTilt,
  rotorLevel,
  rotorTopSpeed,
} from './trials/rotor';
export type { ScorecardChange, TrialReference, TrialScore, TrialStatus } from './trials/score';
export { compareScorecards, scoreTrial } from './trials/score';
export type { Oscillation, TrialSample } from './trials/series';
export { oscillation, rateOfChange } from './trials/series';
