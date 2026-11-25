/**
 * Trial cards: what each card measures on the production solver, the ledgers of published
 * figures they are scored against, and the scorecard a run produces. See
 * content/entities/source/DYNAMICS-V2.md.
 */
import { readFileSync } from 'node:fs';
import { sampleAtmosphere } from '@bendyline/molen-kernel/aircraft';
import {
  accelerationTime,
  atMass,
  bestRotorClimb,
  figureEight,
  flyLevel,
  flyRotorLevel,
  hoverCeiling,
  leanResponse,
  levelSpeedRoots,
  measureClimbAndTopSpeed,
  measureDutchRoll,
  measurePhugoid,
  measureRoll,
  measureShortPeriod,
  measureSpiral,
  measureStallAndGlide,
  measureTakeoff,
  rotorAutorotation,
  rotorClimb,
  rotorCruiseTilt,
  rotorTopSpeed,
  scoreTrial,
  stallSpeedEstimate,
  standingDistance,
  steadyCeiling,
  steadyCornering,
  steadyTurn,
  stoppingDistance,
  topSpeed,
} from '@bendyline/molen-kernel/trials';
import { SKID_HEIGHT } from './aircraft-performance.mjs';
import {
  aircraftTrialLedger,
  anchorThrottle,
  cardKey,
  sourceDocument,
  vehicleTrialLedger,
} from './trial-ledgers.mjs';

const catalog = (name) =>
  JSON.parse(
    readFileSync(new URL(`../../../content/entities/types/${name}`, import.meta.url), 'utf8'),
  ).types;

const KT = 3600 / 1852;
const FT = 1 / 0.3048;
const FPM = 60 * FT;
const MPH = 0.44704;
const defined = (value, scale = 1) => (value === undefined ? undefined : value * scale);
/** True airspeed in m/s for an equivalent airspeed in knots at an altitude. */
const trueSpeed = (knots, altitude = 0) =>
  knots / KT / Math.sqrt(sampleAtmosphere({}, altitude).densityKgM3 / 1.225);

/** Run each distinct procedure once per vehicle: several cards read the same run. */
function once(memo, key, run) {
  if (!memo.has(key)) memo.set(key, run());
  return memo.get(key);
}

/** The highest level speed at an altitude and throttle: the force balance, then flown. */
function levelTopSpeed(spec, altitude, power) {
  const root = levelSpeedRoots(spec, altitude, { power }).at(-1);
  if (!root) return undefined;
  // Started just below the balance point, the airplane must settle onto it.
  return flyLevel(spec, { speed: root.speed * 0.97, altitude, power, seconds: 90 }).state.airspeed;
}

/** Altitude in meters where a helicopter's best climb falls to 100 ft/min. */
function rotorCeiling(spec) {
  const speed = bestRotorClimb(spec, 0)?.speed ?? 30;
  const climbs = (altitude) => rotorClimb(spec, speed, altitude).verticalSpeed >= 0.508;
  if (!climbs(0)) return 0;
  let lo = 0;
  let hi = 9000;
  if (climbs(hi)) return hi;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    if (climbs(mid)) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const densityRatio = (altitude) => sampleAtmosphere({}, altitude).densityKgM3 / 1.225;

/**
 * A handling card's procedure, flown on the bare airframe (direct control) at the card's
 * equivalent airspeed and altitude, or at 1.8 times the clean stall speed at 1,000 m. An
 * airplane without surfaces, or flown only through its flight computers, has no bare airframe
 * to fly: the card is unmeasured.
 */
const handling = (name, procedure) => (spec, card, memo) => {
  const surfaces = spec.airplane?.surfaces;
  if (!surfaces || surfaces.flyByWire) return {};
  const altitude = card.altitudeM ?? 1000;
  const speed =
    card.speedKt === undefined
      ? (1.8 * stallSpeedEstimate(spec)) / Math.sqrt(densityRatio(altitude))
      : trueSpeed(card.speedKt, altitude);
  return once(memo, `${name}-${Math.round(speed * 10)}-${altitude}`, () =>
    procedure(spec, { speed, altitude, direct: true }),
  );
};
const phugoid = handling('phugoid', measurePhugoid);
const shortPeriod = handling('short-period', measureShortPeriod);
const dutchRoll = handling('dutch-roll', measureDutchRoll);

/**
 * Flight cards. `measure(spec, card, memo)` returns the figure in the card's unit, or undefined
 * when the aircraft could not complete the procedure. `tolerance` is the default allowed error
 * as a fraction of the published figure; a ledger row may set its own.
 */
export const FLIGHT_CARDS = {
  'stall-clean': {
    title: 'Stall speed, clean',
    unit: 'kt',
    tolerance: 0.05,
    measure: (spec, _card, memo) =>
      defined(
        once(memo, 'decel-clean', () => measureStallAndGlide(spec, { altitude: 0 })).stallSpeed,
        KT,
      ),
  },
  'stall-landing': {
    title: 'Stall speed, landing configuration',
    unit: 'kt',
    tolerance: 0.05,
    measure: (spec, _card, memo) =>
      defined(
        once(memo, 'decel-landing', () =>
          measureStallAndGlide(spec, { altitude: 0, flaps: 1, gear: true }),
        ).stallSpeed,
        KT,
      ),
  },
  'glide-ratio': {
    title: 'Best glide ratio, power off',
    unit: 'ratio',
    tolerance: 0.1,
    measure: (spec, _card, memo) =>
      once(memo, 'decel-clean', () => measureStallAndGlide(spec, { altitude: 0 })).glideRatio,
  },
  'climb-rate': {
    title: 'Best rate of climb',
    unit: 'ft/min',
    tolerance: 0.1,
    measure: (spec, card, memo) => {
      const altitude = card.altitudeM ?? 0;
      if (spec.model === 'helicopter')
        return defined(
          once(memo, `rotor-climb-${altitude}`, () => bestRotorClimb(spec, altitude))
            ?.verticalSpeed,
          FPM,
        );
      const power = card.power ?? 1;
      return defined(
        once(memo, `accel-${altitude}-${power}`, () =>
          measureClimbAndTopSpeed(spec, { altitude, power }),
        ).climbRate,
        FPM,
      );
    },
  },
  'top-speed': {
    title: 'Maximum level speed',
    unit: 'kt',
    tolerance: 0.05,
    measure: (spec, card, memo) => {
      const altitude = card.altitudeM ?? 0;
      if (spec.model === 'helicopter')
        return defined(once(memo, 'rotor-top', () => rotorTopSpeed(spec, 300))?.speed, KT);
      const speed = once(memo, `top-${altitude}-${card.power ?? 1}`, () =>
        levelTopSpeed(spec, altitude, card.power ?? 1),
      );
      return card.unit === 'mach'
        ? defined(speed, 1 / sampleAtmosphere({}, altitude).speedOfSound)
        : defined(speed, KT);
    },
  },
  'cruise-speed': {
    title: 'Cruise speed at the stated power',
    unit: 'kt',
    tolerance: 0.05,
    measure: (spec, card) => {
      const altitude = card.altitudeM ?? 0;
      // A helicopter's cruise is the fixed-tilt experiment of the performance bench.
      if (spec.model === 'helicopter')
        return (
          flyRotorLevel(spec, {
            speed: (card.value / KT) * 0.85,
            altitude,
            seconds: 180,
            tilt: rotorCruiseTilt(spec, card.value / KT, altitude),
          }).state.airspeed * KT
        );
      return defined(levelTopSpeed(spec, altitude, card.power ?? 1), KT);
    },
  },
  'service-ceiling': {
    title: 'Service ceiling',
    unit: 'ft',
    tolerance: 0.1,
    measure: (spec, card, memo) =>
      spec.model === 'helicopter'
        ? once(memo, 'rotor-ceiling', () => rotorCeiling(spec)) * FT
        : once(memo, `ceiling-${card.power ?? 1}`, () =>
            steadyCeiling(spec, { power: card.power ?? 1 }),
          ) * FT,
  },
  'roll-rate': {
    title: 'Roll rate, full aileron',
    unit: 'deg/s',
    tolerance: 0.15,
    measure: (spec, card, memo) => {
      const altitude = card.altitudeM ?? 1000;
      const speed = trueSpeed(card.speedKt, altitude);
      return (
        (once(memo, `roll-${card.speedKt}-${altitude}`, () =>
          measureRoll(spec, { speed, altitude }),
        ).peakRate *
          180) /
        Math.PI
      );
    },
  },
  'takeoff-roll': {
    title: 'Takeoff ground roll',
    unit: 'm',
    tolerance: 0.15,
    measure: (spec, card, memo) =>
      once(memo, `takeoff-${card.flaps ?? 0}`, () =>
        measureTakeoff(spec, { flaps: card.flaps ?? 0 }),
      ).groundRoll,
  },
  'takeoff-distance': {
    title: 'Takeoff distance over 15 m',
    unit: 'm',
    tolerance: 0.15,
    measure: (spec, card, memo) =>
      once(memo, `takeoff-${card.flaps ?? 0}`, () =>
        measureTakeoff(spec, { flaps: card.flaps ?? 0 }),
      ).distanceOver15m,
  },
  'sustained-turn': {
    title: 'Sustained turn rate',
    unit: 'deg/s',
    tolerance: 0.1,
    measure: (spec, card) => defined(steadyTurn(spec, card.altitudeM ?? 0)?.rate, 180 / Math.PI),
  },
  'phugoid-period': {
    title: 'Phugoid period, hands off',
    unit: 's',
    tolerance: 0.2,
    measure: (...run) => phugoid(...run).period,
  },
  'phugoid-damping': {
    title: 'Phugoid damping ratio',
    unit: '',
    tolerance: 0.2,
    measure: (...run) => phugoid(...run).dampingRatio,
  },
  'short-period-frequency': {
    title: 'Short-period natural frequency',
    unit: 'rad/s',
    tolerance: 0.2,
    measure: (...run) => shortPeriod(...run).naturalFrequency,
  },
  'short-period-damping': {
    title: 'Short-period damping ratio',
    unit: '',
    tolerance: 0.2,
    measure: (...run) => shortPeriod(...run).dampingRatio,
  },
  'dutch-roll-frequency': {
    title: 'Dutch roll natural frequency',
    unit: 'rad/s',
    tolerance: 0.2,
    measure: (...run) => dutchRoll(...run).naturalFrequency,
  },
  'dutch-roll-damping': {
    title: 'Dutch roll damping ratio',
    unit: '',
    tolerance: 0.2,
    measure: (...run) => dutchRoll(...run).dampingRatio,
  },
  'roll-time-constant': {
    title: 'Roll mode time constant',
    unit: 's',
    tolerance: 0.2,
    measure: (...run) => handling('roll', measureRoll)(...run).timeConstant,
  },
  'spiral-bank': {
    title: 'Bank 20 s after release at 10°, hands off',
    unit: '°',
    tolerance: 0.2,
    measure: (...run) => defined(handling('spiral', measureSpiral)(...run).final, 180 / Math.PI),
  },
  'hover-ceiling-oge': {
    title: 'Hover ceiling out of ground effect',
    unit: 'ft',
    tolerance: 0.15,
    measure: (spec) => hoverCeiling(spec) * FT,
  },
  'hover-ceiling-ige': {
    title: 'Hover ceiling in ground effect',
    unit: 'ft',
    tolerance: 0.15,
    measure: (spec, card) => hoverCeiling(spec, card.skidHeightM ?? SKID_HEIGHT) * FT,
  },
  'autorotation-descent': {
    title: 'Autorotation rate of descent',
    unit: 'ft/min',
    tolerance: 0.15,
    measure: (spec, card) =>
      -rotorAutorotation(spec, (card.speedKt ?? 60) / KT).verticalSpeed * FPM,
  },
};

/** Road cards, for cars, trucks, buses and cycles. */
export const ROAD_CARDS = {
  'zero-to-100kmh': {
    title: '0–100 km/h',
    unit: 's',
    tolerance: 0.1,
    measure: (spec) => accelerationTime(spec, 27.78),
  },
  'zero-to-60mph': {
    title: '0–60 mph',
    unit: 's',
    tolerance: 0.1,
    // US magazines start the clock after the first foot of travel.
    measure: (spec, card) =>
      accelerationTime(spec, 60 * MPH) -
      (card.rollout ? (standingDistance(spec, 0.3048)?.seconds ?? 0) : 0),
  },
  'zero-to-30mph': {
    title: '0–30 mph',
    unit: 's',
    tolerance: 0.1,
    measure: (spec) => accelerationTime(spec, 30 * MPH),
  },
  'zero-to-50mph': {
    title: '0–50 mph',
    unit: 's',
    tolerance: 0.1,
    measure: (spec) => accelerationTime(spec, 50 * MPH),
  },
  'quarter-mile': {
    title: 'Standing quarter mile',
    unit: 's',
    tolerance: 0.07,
    measure: (spec, card, memo) =>
      defined(once(memo, 'quarter', () => standingDistance(spec))?.seconds) -
      (card.rollout ? (standingDistance(spec, 0.3048)?.seconds ?? 0) : 0),
  },
  'quarter-mile-speed': {
    title: 'Quarter-mile trap speed',
    unit: 'km/h',
    tolerance: 0.07,
    measure: (spec, _card, memo) =>
      defined(once(memo, 'quarter', () => standingDistance(spec))?.speed, 3.6),
  },
  'top-speed': {
    title: 'Top speed',
    unit: 'km/h',
    tolerance: 0.08,
    measure: (spec) => topSpeed(spec) * 3.6,
  },
  'braking-100-0kmh': {
    title: 'Braking, 100–0 km/h',
    unit: 'm',
    tolerance: 0.1,
    measure: (spec) => stoppingDistance(spec, 27.78),
  },
  'braking-45-0mph': {
    title: 'Braking, 45–0 mph',
    unit: 'm',
    tolerance: 0.1,
    measure: (spec) => stoppingDistance(spec, 45 * MPH),
  },
  'braking-60-0mph': {
    title: 'Braking, 60–0 mph',
    unit: 'm',
    tolerance: 0.1,
    measure: (spec) => stoppingDistance(spec, 60 * MPH),
  },
  'braking-70-0mph': {
    title: 'Braking, 70–0 mph',
    unit: 'm',
    tolerance: 0.1,
    measure: (spec) => stoppingDistance(spec, 70 * MPH),
  },
  skidpad: {
    title: 'Skidpad grip',
    unit: 'g',
    tolerance: 0.05,
    measure: (spec) => steadyCornering(spec).lateralG,
  },
  'lean-in-time': {
    title: 'Time to lean into a turn, steering held over',
    unit: 's',
    tolerance: 0.2,
    measure: (spec) => leanResponse(spec).time,
  },
  'figure-eight-slip': {
    title: 'Largest slip angle round a figure-eight',
    unit: 'deg',
    tolerance: 0.2,
    measure: (spec) => (figureEight(spec).maxSideslip * 180) / Math.PI,
  },
  'lean-angle': {
    title: 'Lean in a steady turn, three-quarter steering',
    unit: 'deg',
    tolerance: 0.15,
    measure: (spec, card) =>
      (Math.abs(
        steadyCornering(spec, card.speedKmh ? card.speedKmh / 3.6 : undefined, 0.75, 1).bodyRoll,
      ) *
        180) /
      Math.PI,
  },
};

const short = (id) => id.slice(id.lastIndexOf('.') + 1);

/**
 * A helicopter limited to a share of its takeoff power, for a figure published at a lower
 * rating (maximum continuous or normal rated power).
 */
function atRating(spec, fraction) {
  if (fraction === undefined || spec.model !== 'helicopter') return spec;
  return { ...spec, engine: { ...spec.engine, power: spec.engine.power * fraction } };
}

function scoreVehicle(definitions, spec, rows, withMass) {
  const memos = new Map();
  const cards = {};
  for (const row of rows) {
    const definition = definitions[row.card];
    if (!definition) throw Error(`Unknown trial card "${row.card}"`);
    const memoKey = `${row.massKg ?? spec.mass}/${row.powerFraction ?? 1}`;
    if (!memos.has(memoKey)) memos.set(memoKey, new Map());
    let measured;
    try {
      measured = definition.measure(
        atRating(withMass(spec, row.massKg), row.powerFraction),
        row,
        memos.get(memoKey),
      );
    } catch {
      measured = undefined;
    }
    if (measured !== undefined && !Number.isFinite(measured)) measured = undefined;
    // A published figure with a tolerance, or the band a standard allows.
    const band = {
      ...(row.min === undefined ? {} : { min: row.min }),
      ...(row.max === undefined ? {} : { max: row.max }),
    };
    const reference =
      row.value !== undefined
        ? { value: row.value, tolerance: row.tolerance ?? definition.tolerance }
        : 'min' in band || 'max' in band
          ? band
          : undefined;
    const score = scoreTrial(measured, reference);
    const key = cardKey(row);
    if (Object.hasOwn(cards, key)) throw Error(`Duplicate trial card ${key}`);
    cards[key] = {
      status: score.status,
      ...(measured === undefined ? {} : { measured: Number(measured.toPrecision(4)) }),
      ...(!reference
        ? {}
        : 'value' in reference
          ? { reference: Number(reference.value.toPrecision(6)), tolerance: reference.tolerance }
          : reference),
      unit: row.unit ?? definition.unit,
      ...(score.error === undefined ? {} : { error: Number(score.error.toFixed(3)) }),
      ...(row.role ? { role: row.role } : {}),
      ...(row.evidence ? { evidence: row.evidence } : {}),
      ...(row.massKg === undefined ? {} : { massKg: row.massKg }),
      title: definition.title,
    };
  }
  return cards;
}

const anchorEngine = (type) => {
  const spec = type?.components.aircraft.spec;
  return spec?.engines?.[0] ?? spec?.engine;
};

/** Every aircraft's ledger rows, with the calibration anchor of the performance ledger first. */
export function aircraftTrialRows(types = catalog('aircraft.types.json')) {
  const rows = new Map();
  for (const profile of sourceDocument('aircraft-performance.json').aircraft) {
    const reference = profile.reference;
    const speedOfSound = sampleAtmosphere({}, reference.altitudeM).speedOfSound;
    rows.set(profile.id, [
      {
        card: reference.kind === 'maximum' ? 'top-speed' : 'cruise-speed',
        key: 'anchor',
        value: reference.ktas ?? reference.mach * speedOfSound * KT,
        tolerance: reference.tolerance,
        altitudeM: reference.altitudeM,
        power: anchorThrottle(
          reference,
          densityRatio(reference.altitudeM),
          profile.ratedDensityRatio,
          anchorEngine(types[profile.id])?.densityExponent,
        ),
        role: 'fit',
        evidence: reference.evidence,
        source: reference.source,
      },
    ]);
  }
  const ledger = aircraftTrialLedger();
  for (const entry of ledger.aircraft) {
    if (!rows.has(entry.id)) throw Error(`${entry.id}: trial cards for an unknown aircraft`);
    rows.get(entry.id).push(...entry.cards);
  }
  // The handling standard holds every airplane a pilot flies by its own surfaces.
  for (const [id, cards] of rows) {
    const surfaces = types[id]?.components.aircraft.spec.airplane?.surfaces;
    if (surfaces && !surfaces.flyByWire)
      cards.push(...(ledger.standards ?? []).map((row) => ({ ...row, key: 'standard' })));
  }
  return rows;
}

/** Every road vehicle's and cycle's ledger rows; the dynamics ledger supplies the fitted two. */
export function vehicleTrialRows() {
  const rows = new Map();
  for (const row of sourceDocument('vehicle-dynamics.json').vehicles)
    rows.set(row.id, [
      // The dynamics ledger's own rows: unsourced estimates, the first two fitted.
      {
        card: 'zero-to-100kmh',
        key: 'ledger',
        value: row.zeroTo100S,
        role: 'fit',
        evidence: 'estimate',
      },
      {
        card: 'skidpad',
        key: 'ledger',
        value: row.lateralG,
        tolerance: 0.03,
        role: 'fit',
        evidence: 'estimate',
      },
      {
        card: 'top-speed',
        key: 'ledger',
        value: row.topSpeedKmh,
        role: 'check',
        evidence: 'estimate',
      },
      { card: 'braking-100-0kmh' },
    ]);
  // Cycles have no published figures yet: they are measured, so a later change shows.
  for (const id of Object.keys(catalog('cycle.types.json')))
    rows.set(id, [
      { card: 'top-speed' },
      { card: 'lean-angle' },
      { card: 'lean-in-time' },
      { card: 'figure-eight-slip' },
    ]);
  for (const entry of vehicleTrialLedger().vehicles) {
    if (!rows.has(entry.id)) rows.set(entry.id, []);
    rows.get(entry.id).push(...entry.cards);
  }
  return rows;
}

/** A card with something to be held to: a published figure or a standard's band. */
const isScored = (card) => 'reference' in card || 'min' in card || 'max' in card;

function scorecard(domain, cards) {
  const scored = Object.values(cards).filter(isScored);
  return {
    format: 'molen/trial-scorecard@1',
    domain,
    passed: scored.filter((card) => card.status === 'pass').length,
    scored: scored.length,
    cards,
  };
}

/** Fly every aircraft's cards. `only` narrows to ids or slugs ending in one of the names. */
export function runAircraftTrials(only) {
  const types = catalog('aircraft.types.json');
  const cards = {};
  for (const [id, rows] of aircraftTrialRows(types)) {
    if (only && !only.includes(short(id))) continue;
    const spec = types[id]?.components.aircraft.spec;
    if (!spec) throw Error(`Missing runtime aircraft ${id}`);
    for (const [key, card] of Object.entries(scoreVehicle(FLIGHT_CARDS, spec, rows, atMass)))
      cards[`${short(id)}/${key}`] = card;
  }
  return scorecard('aircraft', cards);
}

/** Drive every road vehicle's and cycle's cards. */
export function runVehicleTrials(only) {
  const types = {
    ...catalog('vehicle.types.json'),
    ...catalog('transit.types.json'),
    ...catalog('cycle.types.json'),
  };
  const cards = {};
  for (const [id, rows] of vehicleTrialRows()) {
    if (only && !only.includes(short(id))) continue;
    const spec = types[id]?.components.vehicle?.spec;
    if (!spec) throw Error(`Missing runtime vehicle ${id}`);
    const atLoad = (base, mass) => (mass === undefined ? base : { ...base, mass });
    const prefix = id.includes('.cycle.') ? 'cycle.' : '';
    for (const [key, card] of Object.entries(scoreVehicle(ROAD_CARDS, spec, rows, atLoad)))
      cards[`${prefix}${short(id)}/${key}`] = card;
  }
  return scorecard('vehicles', cards);
}

/** The two scorecards: how each is run, where it is recorded and how its page reads. */
export const TRIAL_DOMAINS = {
  aircraft: {
    run: runAircraftTrials,
    scorecard: new URL('../test/trials/aircraft.scorecard.json', import.meta.url),
    page: 'AIRCRAFT-TRIALS.md',
    title: 'Aircraft trial scorecard',
    lede: 'Every aircraft flown through its trial cards on the production flight solver, headless, and scored against the published figures in [aircraft-trials.json](aircraft-trials.json) and the calibration anchors in [aircraft-performance.json](aircraft-performance.json). A figure published at a stated weight is flown at that weight. Method and plan: [DYNAMICS-V2.md](DYNAMICS-V2.md).',
    command: 'pnpm aircraft:trials --write',
  },
  vehicles: {
    run: runVehicleTrials,
    scorecard: new URL('../test/trials/vehicles.scorecard.json', import.meta.url),
    page: 'VEHICLE-TRIALS.md',
    title: 'Road vehicle trial scorecard',
    lede: 'Every road vehicle and cycle driven through its trial cards on the production driving solver, headless, and scored against the figures in [vehicle-dynamics.json](vehicle-dynamics.json) (unsourced estimates, two of them fitted) and the sourced road-test figures in [vehicle-trials.json](vehicle-trials.json). Method and plan: [DYNAMICS-V2.md](DYNAMICS-V2.md).',
    command: 'pnpm vehicles:trials --write',
  },
};

/** Check a ledger: known cards, positive figures, and a declared source behind every figure. */
export function checkTrialLedger(ledger, definitions, entries) {
  const problems = [];
  for (const [name, declared] of Object.entries(ledger.sources)) {
    if (declared.estimate) continue;
    if (!/^https?:\/\//.test(declared.url ?? '')) problems.push(`source ${name}: no url`);
  }
  for (const entry of [...entries, { id: 'standards', cards: ledger.standards ?? [] }])
    for (const row of entry.cards) {
      const at = `${entry.id} ${row.card}`;
      if (!definitions[row.card]) problems.push(`${at}: unknown card`);
      const band = row.min !== undefined || row.max !== undefined;
      if (row.value === undefined && !band) continue;
      if (row.value !== undefined && band) problems.push(`${at}: a figure or a band, not both`);
      if (row.value !== undefined && !(row.value > 0))
        problems.push(`${at}: figure must be positive`);
      if (row.min !== undefined && row.max !== undefined && !(row.max > row.min))
        problems.push(`${at}: band is empty`);
      if (!['fit', 'check'].includes(row.role)) problems.push(`${at}: role must be fit or check`);
      if (!row.evidence) problems.push(`${at}: no evidence class`);
      if (!Object.hasOwn(ledger.sources, row.source ?? ''))
        problems.push(`${at}: source "${row.source}" is not declared`);
    }
  return problems;
}

const figure = (value) =>
  value === undefined
    ? '—'
    : Math.abs(value) >= 1000
      ? Math.round(value).toLocaleString('en-US')
      : String(Number(value.toPrecision(3)));

/** What a card is held to, as it reads in a table: a figure, or the band a standard allows. */
export function publishedFigure(entry) {
  const unit = entry.unit ? ` ${entry.unit}` : '';
  if (entry.reference !== undefined) return `${figure(entry.reference)}${unit}`;
  if (entry.min !== undefined && entry.max !== undefined)
    return `${figure(entry.min)} to ${figure(entry.max)}${unit}`;
  if (entry.min !== undefined) return `at least ${figure(entry.min)}${unit}`;
  if (entry.max !== undefined) return `at most ${figure(entry.max)}${unit}`;
  return '—';
}

/** The scorecard as a Markdown page: one table per vehicle. */
export function scorecardMarkdown(card, { title, lede, command }) {
  const groups = new Map();
  for (const [key, entry] of Object.entries(card.cards)) {
    const [vehicle, name] = key.split('/');
    if (!groups.has(vehicle)) groups.set(vehicle, []);
    groups.get(vehicle).push([name, entry]);
  }
  const lines = [
    `# ${title}`,
    '',
    lede,
    '',
    `Generated by \`${command}\`; do not edit by hand.`,
    '',
    `**${card.passed} of ${card.scored}** scored cards are within tolerance.`,
    '',
  ];
  const count = (role) => {
    const of = Object.values(card.cards).filter((c) => c.role === role && isScored(c));
    return `${of.filter((c) => c.status === 'pass').length} of ${of.length}`;
  };
  lines.push(
    `Fitted figures (calibration may use them): ${count('fit')}. Checks (it may not): ${count('check')}.`,
    '',
  );
  for (const [vehicle, entries] of groups) {
    lines.push(`## ${vehicle}`, '', '| Card | Measured | Published | Error | Role | Evidence | |');
    lines.push('|---|---:|---:|---:|---|---|---|');
    for (const [name, entry] of entries) {
      const error = entry.error === undefined ? '—' : `${(entry.error * 100).toFixed(0)}%`;
      const condition = name.includes('@') ? ` (${name.slice(name.indexOf('@') + 1)})` : '';
      const mass = entry.massKg === undefined ? '' : ` at ${figure(entry.massKg)} kg`;
      lines.push(
        `| ${entry.title}${condition}${mass} | ${figure(entry.measured)} ${entry.unit} | ${publishedFigure(
          entry,
        )} | ${error} | ${entry.role ?? '—'} | ${entry.evidence ?? '—'} | ${entry.status} |`,
      );
    }
    lines.push('');
  }
  return `${lines.join('\n')}`;
}
