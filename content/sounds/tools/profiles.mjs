#!/usr/bin/env node
// Write sound-profiles.json (in the engine repository): the voice of every vehicle, aircraft, boat
// and train in molen.entities, as layers the audio director evaluates on each entity. Families are
// defined once below; each entity type is put in one by reading its spec (propulsion, reheat,
// bypass ratio, engine count, body style, powertrain, the engine sound its generator chose), and
// the match rules list the type ids so traffic and parked copies get the same voice. Generic
// rules after them catch types added later.
//
//   node content/sounds/tools/profiles.mjs          # writes content/sounds/sound-profiles.json
//   node content/sounds/tools/profiles.mjs --list   # prints each type's family

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const types = join(root, '..', 'entities', 'types');

// --- signal helpers ---

const curve = (signal, points, smoothS) => ({
  signal,
  curve: points,
  ...(smoothS ? { smoothS } : {}),
});
const DRIVEN = { 'self.occupied': true };
/** Ambient traffic: moving or waiting at a light. Player entities have no ambientAgent. */
const TRAFFIC = { 'ambientAgent.state': ['move', 'wait'] };
/** Only a train's lead unit is voiced: its cars follow it. */
const LEAD = { 'ambientAgent.consist': { exists: false } };
const speed = (points) => curve('self.speed', points);
const rpm = (points) => curve('vehicleState.rpm', points);
const air = (points) => curve('aircraftState.rpm', points);
const ahead = curve('self.listenerAngle', [
  [0, 1.15],
  [90, 0.85],
  [180, 0.45],
]);
const behind = curve('self.listenerAngle', [
  [0, 0.4],
  [90, 0.8],
  [150, 1.2],
  [180, 1.05],
]);

// --- road families ---

/** A combustion car: idle and rev recordings crossfaded by rpm, tires, skid, wind and cabin. */
function car({
  idle,
  rev,
  idleRpm = 800,
  redline = 6500,
  pitch = 1,
  revPitch = 1,
  gain = 1,
  traffic = 0.8,
}) {
  const mid = idleRpm + (redline - idleRpm) * 0.35;
  return [
    {
      name: 'engine',
      sound: idle,
      when: DRIVEN,
      pitch,
      gain,
      pitchFrom: rpm([
        [0, 0.7],
        [idleRpm, 0.8],
        [mid, 1.25],
        [redline, 1.8],
      ]),
      gainFrom: [
        curve('vehicleState.engineLoad', [
          [0, 0.6],
          [1, 1],
        ]),
        rpm([
          [idleRpm, 1],
          [mid, 0.55],
          [redline, 0.35],
        ]),
      ],
    },
    {
      name: 'engine-load',
      sound: rev,
      when: DRIVEN,
      pitch: revPitch,
      gain,
      pitchFrom: rpm([
        [idleRpm, 0.6],
        [mid, 1],
        [redline, 1.55],
      ]),
      gainFrom: [
        rpm([
          [idleRpm * 1.4, 0],
          [mid, 0.75],
          [redline, 1],
        ]),
        curve('vehicleState.engineLoad', [
          [0, 0.45],
          [1, 1],
        ]),
      ],
    },
    // Inside, the engine comes through the floor and firewall: the same note, less of it.
    {
      name: 'engine-cabin',
      sound: idle,
      perspective: 'interior',
      when: DRIVEN,
      pitch,
      gain: 0.35 * gain,
      pitchFrom: rpm([
        [0, 0.7],
        [idleRpm, 0.8],
        [mid, 1.25],
        [redline, 1.8],
      ]),
    },
    {
      name: 'traffic',
      sound: idle,
      when: TRAFFIC,
      pitch,
      gain: traffic,
      pitchFrom: speed([
        [0, 0.85],
        [12, 1.15],
        [30, 1.45],
      ]),
      gainFrom: speed([
        [0, 0.55],
        [10, 0.8],
        [30, 1],
      ]),
    },
    ...ROLLING,
  ];
}

/** Tires, skid, wind and road noise: every road vehicle on four wheels. */
const ROLLING = [
  {
    name: 'tires',
    sound: 'vehicle.tire.asphalt',
    when: { 'listener.surface': { exists: true } },
    gainFrom: speed([
      [1, 0],
      [8, 0.3],
      [30, 0.85],
      [50, 1],
    ]),
    pitchFrom: speed([
      [5, 0.85],
      [40, 1.25],
    ]),
  },
  {
    name: 'tires-loose',
    sound: 'vehicle.tire.gravel',
    when: { 'listener.surface': ['gravel', 'dirt', 'sand', 'mud'], 'self.occupied': true },
    gainFrom: speed([
      [1, 0],
      [6, 0.6],
      [20, 1],
    ]),
    pitchFrom: speed([
      [3, 0.85],
      [25, 1.15],
    ]),
  },
  {
    name: 'skid',
    sound: 'vehicle.skid',
    gainFrom: [
      curve('vehicleState.skid', [
        [0.2, 0],
        [0.6, 0.8],
        [1, 1],
      ]),
      speed([
        [2, 0],
        [6, 1],
      ]),
    ],
  },
  {
    name: 'wind',
    sound: 'vehicle.wind',
    perspective: 'interior',
    gainFrom: speed([
      [12, 0],
      [25, 0.45],
      [45, 1],
    ]),
  },
  {
    name: 'road',
    sound: 'vehicle.cabin.road',
    perspective: 'interior',
    gainFrom: speed([
      [2, 0],
      [15, 0.55],
      [35, 1],
    ]),
  },
];

function electricCar({ gain = 1 } = {}) {
  return [
    {
      name: 'motor',
      sound: 'vehicle.electric.motor',
      gain: 0.55 * gain,
      pitchFrom: speed([
        [0, 0.55],
        [30, 1.6],
      ]),
      gainFrom: [
        speed([
          [0.5, 0],
          [5, 0.45],
          [30, 1],
        ]),
      ],
    },
    // The pedestrian warning sound electric cars must make below about 30 km/h.
    {
      name: 'warning',
      sound: 'vehicle.electric.hum',
      gain: 0.45 * gain,
      pitchFrom: speed([
        [0, 0.9],
        [8, 1.15],
      ]),
      gainFrom: speed([
        [0, 0.6],
        [1, 0.85],
        [7.5, 0.6],
        [8.5, 0],
      ]),
    },
    {
      name: 'motor-cabin',
      sound: 'vehicle.electric.motor',
      perspective: 'interior',
      gain: 0.25,
      pitchFrom: speed([
        [0, 0.55],
        [30, 1.6],
      ]),
      gainFrom: speed([
        [0.5, 0],
        [30, 1],
      ]),
    },
    ...ROLLING,
  ];
}

/** A two-wheeler or a tuk-tuk: one engine, no cabin; the rider hears it all. */
function rider({ sound, idleRpm, redline, pitch = 1, gain = 1, perspective = 'any' }) {
  return [
    {
      name: 'engine',
      sound,
      perspective,
      when: DRIVEN,
      pitch,
      gain,
      pitchFrom: rpm([
        [0, 0.75],
        [idleRpm, 0.85],
        [redline, 2],
      ]),
      gainFrom: curve('vehicleState.engineLoad', [
        [0, 0.55],
        [1, 1],
      ]),
    },
    {
      name: 'traffic',
      sound,
      when: TRAFFIC,
      pitch,
      gain: gain * 0.8,
      pitchFrom: speed([
        [0, 0.85],
        [10, 1.25],
        [25, 1.6],
      ]),
      gainFrom: speed([
        [0, 0.6],
        [15, 1],
      ]),
    },
    {
      name: 'wind',
      sound: 'vehicle.wind',
      perspective: 'any',
      when: DRIVEN,
      gain: 0.7,
      gainFrom: speed([
        [8, 0],
        [20, 0.6],
        [40, 1],
      ]),
    },
    {
      name: 'tires',
      sound: 'vehicle.tire.asphalt',
      gain: 0.5,
      gainFrom: speed([
        [2, 0],
        [10, 0.5],
        [30, 1],
      ]),
    },
  ];
}

/** Pedal, kick and board: no engine, just what rolls. */
function rolling(sound, { freewheel = false, gain = 1 } = {}) {
  return [
    {
      name: 'roll',
      sound,
      perspective: 'any',
      gain,
      gainFrom: speed([
        [0.3, 0],
        [3, 0.6],
        [10, 1],
      ]),
      pitchFrom: speed([
        [1, 0.85],
        [12, 1.2],
      ]),
    },
    ...(freewheel
      ? [
          {
            name: 'freewheel',
            sound: 'vehicle.bicycle.freewheel',
            perspective: 'any',
            when: { 'self.occupied': true },
            gainFrom: [
              speed([
                [0.5, 0],
                [2, 0.8],
              ]),
              // Coasting: the freewheel ticks only while nobody pedals.
              curve('vehicleInput.throttle', [
                [0, 1],
                [0.1, 0],
              ]),
            ],
            pitchFrom: speed([
              [1, 0.8],
              [10, 1.3],
            ]),
          },
        ]
      : []),
    {
      name: 'wind',
      sound: 'vehicle.wind',
      perspective: 'any',
      when: DRIVEN,
      gain: 0.5,
      gainFrom: speed([
        [6, 0],
        [15, 0.6],
        [30, 1],
      ]),
    },
  ];
}

// --- aircraft families ---

const AIRCRAFT_TRAFFIC = { 'ambientAgent.kind': 'aircraft' };
const FAR = { refDistance: 50, maxDistance: 9000, rolloff: 0.15 };
const GROUND_ROLL = {
  name: 'ground-roll',
  sound: 'aircraft.ground.roll',
  when: { 'aircraftState.grounded': true },
  gainFrom: curve('aircraftState.airspeed', [
    [1, 0],
    [10, 0.5],
    [60, 1],
  ]),
  pitchFrom: curve('aircraftState.airspeed', [
    [5, 0.8],
    [70, 1.3],
  ]),
};
const AIRFLOW = (gain = 1) => ({
  name: 'airflow',
  sound: 'aircraft.wind',
  perspective: 'interior',
  gain,
  gainFrom: curve('aircraftState.airspeed', [
    [20, 0],
    [80, 0.4],
    [250, 1],
  ]),
  pitchFrom: curve('aircraftState.airspeed', [
    [40, 0.85],
    [300, 1.25],
  ]),
});
const STALL_HORN = {
  name: 'stall-horn',
  sound: 'aircraft.warning.stall',
  perspective: 'interior',
  when: { 'aircraftState.stalled': true, 'aircraftState.grounded': false },
};

/** An engine recording driven by the aircraft's normalized rpm, plus its traffic copy. */
function engineLoop(
  name,
  sound,
  {
    pitch = [
      [0.18, 0.8],
      [1, 1.15],
    ],
    gain = [
      [0, 0],
      [0.05, 0.3],
      [0.22, 0.6],
      [1, 1],
    ],
    level = 1,
    angle,
    perspective = 'exterior',
    traffic = true,
  } = {},
) {
  return [
    {
      name,
      sound,
      perspective,
      gain: level,
      pitchFrom: air(pitch),
      gainFrom: [air(gain), ...(angle ? [angle] : [])],
    },
    ...(perspective === 'exterior' && traffic
      ? [
          {
            name: `${name}-traffic`,
            sound,
            when: AIRCRAFT_TRAFFIC,
            gain: level,
            spatial: FAR,
            ...(angle ? { gainFrom: angle } : {}),
          },
        ]
      : []),
  ];
}

function jet({
  thrust = 'aircraft.turbofan.thrust',
  idle,
  cabin,
  reheat = false,
  pitch = 1,
  level = 1,
  isolationDb = 28,
}) {
  const p = (points) => points.map(([x, y]) => [x, y * pitch]);
  return {
    cabin: { isolationDb, cutoffHz: isolationDb > 25 ? 700 : 1200 },
    layers: [
      ...(idle
        ? engineLoop('core', idle, {
            pitch: p([
              [0.18, 0.9],
              [1, 1.35],
            ]),
            gain: [
              [0, 0],
              [0.05, 0.3],
              [0.2, 0.8],
              [0.6, 1],
              [1, 0.75],
            ],
            level,
          })
        : []),
      ...engineLoop('whine', 'aircraft.jet.whine', {
        pitch: p([
          [0, 0.3],
          [0.18, 0.55],
          [1, 1.12],
        ]),
        gain: [
          [0, 0],
          [0.1, 0.3],
          [0.6, 0.55],
          [1, 0.5],
        ],
        level: 0.8 * level,
        angle: ahead,
        traffic: false,
      }),
      // Heard from the ground, an aircraft overhead is its recorded thrust and roar.
      ...engineLoop('thrust', thrust, {
        pitch: p([
          [0.4, 0.85],
          [1, 1.08],
        ]),
        gain: [
          [0.35, 0],
          [0.7, 0.6],
          [1, 1],
        ],
        level,
        angle: behind,
      }),
      ...engineLoop('roar', 'aircraft.jet.roar', {
        pitch: p([
          [0.3, 0.8],
          [1, 1.1],
        ]),
        gain: [
          [0.2, 0.05],
          [0.7, 0.4],
          [1, 0.75],
        ],
        level: 0.7 * level,
        angle: behind,
      }),
      ...(reheat
        ? [
            {
              name: 'reheat',
              sound: 'aircraft.fighter.afterburner',
              gain: level,
              gainFrom: [
                curve('aircraftState.engines.0.afterburner', [
                  [0, 0],
                  [0.1, 0.5],
                  [1, 1],
                ]),
                behind,
              ],
            },
            {
              name: 'reheat-rumble',
              sound: 'aircraft.jet.reheat',
              gain: 0.8 * level,
              gainFrom: curve('aircraftState.engines.0.afterburner', [
                [0, 0],
                [1, 1],
              ]),
            },
          ]
        : []),
      ...(cabin
        ? [
            {
              name: 'cabin',
              sound: cabin,
              perspective: 'interior',
              gainFrom: air([
                [0.05, 0.25],
                [1, 1],
              ]),
            },
          ]
        : [
            {
              name: 'cockpit',
              sound: 'aircraft.jet.whine',
              perspective: 'interior',
              gain: 0.35,
              pitchFrom: air(
                p([
                  [0, 0.3],
                  [1, 1.1],
                ]),
              ),
              gainFrom: air([
                [0, 0],
                [0.2, 0.5],
                [1, 1],
              ]),
            },
          ]),
      AIRFLOW(cabin ? 0.5 : 1),
      GROUND_ROLL,
    ],
  };
}

function propeller({
  engine,
  idle,
  cabin,
  pitch = 1,
  level = 1,
  turbine = false,
  isolationDb = 20,
  buzz = 0.4,
}) {
  const p = (points) => points.map(([x, y]) => [x, y * pitch]);
  return {
    cabin: { isolationDb, cutoffHz: 1100 },
    layers: [
      ...engineLoop('engine', engine, {
        pitch: p([
          [0.18, 0.75],
          [1, 1.15],
        ]),
        gain: idle
          ? [
              [0.15, 0],
              [0.4, 0.6],
              [1, 1],
            ]
          : [
              [0, 0],
              [0.05, 0.3],
              [0.22, 0.6],
              [1, 1],
            ],
        level,
      }),
      ...(idle
        ? engineLoop('idle', idle, {
            pitch: p([
              [0.18, 0.9],
              [0.45, 1.15],
            ]),
            gain: [
              [0, 0],
              [0.05, 0.6],
              [0.22, 1],
              [0.45, 0.3],
              [0.7, 0],
            ],
            level,
            traffic: false,
          })
        : []),
      ...(turbine
        ? engineLoop('turbine', 'aircraft.turbine.small', {
            pitch: p([
              [0, 0.3],
              [0.2, 0.7],
              [1, 1.1],
            ]),
            gain: [
              [0, 0],
              [0.1, 0.3],
              [1, 0.45],
            ],
            level: 0.7 * level,
            angle: ahead,
            traffic: false,
          })
        : []),
      {
        name: 'prop',
        sound: 'aircraft.prop.buzz',
        gain: buzz * level,
        pitchFrom: air(
          p([
            [0.18, 0.55],
            [1, 1.25],
          ]),
        ),
        gainFrom: [
          air([
            [0.1, 0],
            [0.3, 0.4],
            [1, 1],
          ]),
          curve('aircraftInput.power', [
            [0, 0.4],
            [1, 1],
          ]),
        ],
      },
      {
        name: 'cabin',
        sound: cabin,
        perspective: 'interior',
        pitchFrom: air(
          p([
            [0.2, 0.85],
            [1, 1.05],
          ]),
        ),
        gainFrom: air([
          [0.05, 0.25],
          [1, 1],
        ]),
      },
      AIRFLOW(0.6),
      STALL_HORN,
      GROUND_ROLL,
    ],
  };
}

function helicopter({
  rotor,
  cabin = 'aircraft.heli.cabin',
  pitch = 1,
  level = 1,
  turbine = true,
  second,
}) {
  const p = (points) => points.map(([x, y]) => [x, y * pitch]);
  const main = (name, sound, extraPitch = 1, gain = level) => [
    {
      name,
      sound,
      gain,
      pitchFrom: [
        air(
          p([
            [0, 0.4 * extraPitch],
            [1, extraPitch],
          ]),
        ),
        curve('aircraftInput.power', [
          [0, 0.97],
          [1, 1.04],
        ]),
      ],
      gainFrom: [
        air([
          [0, 0],
          [0.15, 0.3],
          [1, 1],
        ]),
        curve('aircraftInput.power', [
          [0, 0.8],
          [1, 1.1],
        ]),
      ],
    },
    {
      name: `${name}-traffic`,
      sound,
      when: AIRCRAFT_TRAFFIC,
      gain,
      pitch: pitch * extraPitch,
      spatial: { ...FAR, refDistance: 30 },
    },
  ];
  return {
    cabin: { isolationDb: 16, cutoffHz: 1000 },
    layers: [
      ...main('rotor', rotor),
      ...(second ? main('rotor-2', second.sound, second.pitch, level * 0.8) : []),
      ...(turbine
        ? engineLoop('turbine', 'aircraft.turbine.small', {
            pitch: p([
              [0, 0.3],
              [0.3, 0.75],
              [1, 1.05],
            ]),
            gain: [
              [0, 0],
              [0.3, 0.3],
              [1, 0.45],
            ],
            level: 0.6 * level,
            traffic: false,
          })
        : []),
      {
        name: 'cabin',
        sound: cabin,
        perspective: 'interior',
        gainFrom: air([
          [0.05, 0.25],
          [1, 1],
        ]),
      },
      AIRFLOW(0.5),
    ],
  };
}

// --- rail and water ---

const RAIL_FAR = { refDistance: 10, maxDistance: 1200, rolloff: 0.5 };
function locomotive() {
  return [
    {
      name: 'engine',
      sound: 'rail.locomotive.diesel',
      when: DRIVEN,
      pitchFrom: curve('vehicleInput.throttle', [
        [-1, 0.62],
        [0, 0.55],
        [0.5, 0.78],
        [1, 1],
      ]),
      gainFrom: curve('vehicleInput.throttle', [
        [-1, 0.75],
        [0, 0.6],
        [1, 1],
      ]),
    },
    {
      name: 'traffic',
      sound: 'rail.locomotive.diesel',
      when: { ...TRAFFIC, ...LEAD },
      spatial: RAIL_FAR,
      pitchFrom: speed([
        [0, 0.6],
        [20, 0.9],
      ]),
      gainFrom: speed([
        [0, 0.6],
        [10, 1],
      ]),
    },
    ...railWheels(),
    // A horn every so often on the move; the host says which kind the country uses.
    {
      name: 'horn-us',
      sound: 'rail.horn.us',
      autoplay: false,
      when: { ...TRAFFIC, ...LEAD, 'host.railHorn': 'us' },
      spatial: { refDistance: 15, maxDistance: 2500, rolloff: 0.6 },
      triggerFrom: { signal: 'self.distance', every: 1100 },
    },
    {
      name: 'horn-eu',
      sound: 'rail.horn.eu',
      autoplay: false,
      when: { ...TRAFFIC, ...LEAD, 'host.railHorn': 'eu' },
      spatial: { refDistance: 12, maxDistance: 1500, rolloff: 0.6 },
      triggerFrom: { signal: 'self.distance', every: 1600 },
    },
  ];
}
function railWheels(when = {}) {
  return [
    {
      name: 'wheels',
      sound: 'rail.wheels',
      when,
      spatial: RAIL_FAR,
      gainFrom: speed([
        [1, 0],
        [8, 0.6],
        [25, 1],
      ]),
      pitchFrom: speed([
        [3, 0.8],
        [30, 1.2],
      ]),
    },
  ];
}
function tram() {
  return [
    {
      name: 'motor',
      sound: 'rail.traction.hum',
      gainFrom: speed([
        [0, 0.25],
        [5, 0.7],
        [15, 1],
      ]),
      pitchFrom: speed([
        [0, 0.7],
        [15, 1.3],
      ]),
    },
    {
      name: 'ride',
      sound: 'rail.tram.ride',
      perspective: 'interior',
      gainFrom: speed([
        [0, 0.4],
        [10, 1],
      ]),
    },
    {
      name: 'wheels',
      sound: 'rail.wheels',
      perspective: 'exterior',
      gain: 0.6,
      spatial: RAIL_FAR,
      gainFrom: speed([
        [1, 0],
        [10, 0.7],
        [20, 1],
      ]),
    },
    {
      name: 'bell',
      sound: 'rail.tram.bell',
      autoplay: false,
      when: { ...TRAFFIC, ...LEAD },
      triggerFrom: { signal: 'self.distance', every: 700 },
    },
  ];
}
function boat({ engine, size = 1, sail = false }) {
  const far = { refDistance: 6 * size, maxDistance: 800 * size, rolloff: 0.8 };
  return [
    ...(engine
      ? [
          {
            name: 'engine',
            sound: engine,
            when: DRIVEN,
            pitchFrom: speed([
              [0, 0.75],
              [12 / size, 1.25],
            ]),
            gainFrom: speed([
              [0, 0.55],
              [8 / size, 1],
            ]),
          },
          {
            name: 'traffic',
            sound: engine,
            when: TRAFFIC,
            spatial: far,
            pitchFrom: speed([
              [0, 0.8],
              [10, 1.1],
            ]),
            gainFrom: speed([
              [0, 0.5],
              [6, 1],
            ]),
          },
        ]
      : []),
    {
      name: 'wash',
      sound: 'boat.wash',
      spatial: far,
      gainFrom: speed([
        [0.5, 0],
        [4, 0.6],
        [15, 1],
      ]),
      pitchFrom: speed([
        [1, 0.8],
        [15, 1.2],
      ]),
    },
    {
      name: 'lapping',
      sound: 'boat.lapping',
      perspective: 'any',
      when: DRIVEN,
      gainFrom: speed([
        [0, 1],
        [2, 0.6],
        [5, 0],
      ]),
    },
    ...(sail
      ? [
          {
            name: 'rigging',
            sound: 'boat.rigging',
            perspective: 'any',
            when: DRIVEN,
            gainFrom: curve('weather.windSpeed', [
              [0, 0.3],
              [10, 1],
            ]),
          },
        ]
      : []),
  ];
}

// --- the families ---

const CAR_HORN = 'vehicle.horn.car';
const START = 'vehicle.engine.start';
const STOP = 'vehicle.engine.stop';
const roadCar = (description, layers, extra = {}) => ({
  description,
  cabin: { isolationDb: 24, cutoffHz: 900 },
  horn: CAR_HORN,
  start: START,
  stop: STOP,
  maxDistance: 250,
  layers,
  ...extra,
});

const PROFILES = {
  'road.four': roadCar(
    'A four-cylinder petrol car.',
    car({ idle: 'vehicle.engine.car', rev: 'vehicle.engine.small.rev', pitch: 1.05 }),
  ),
  'road.kei': roadCar(
    'A three-cylinder kei car.',
    car({
      idle: 'vehicle.engine.car',
      rev: 'vehicle.engine.small.rev',
      pitch: 1.2,
      revPitch: 1.15,
      redline: 7600,
      gain: 0.85,
    }),
    { cabin: { isolationDb: 20, cutoffHz: 1000 } },
  ),
  'road.six': roadCar(
    'A six-cylinder petrol car.',
    car({
      idle: 'vehicle.engine.car',
      rev: 'vehicle.engine.small.rev',
      pitch: 0.95,
      revPitch: 0.88,
    }),
  ),
  'road.v8': roadCar(
    'A V8: the burble of a muscle car or a full-size pickup.',
    car({
      idle: 'vehicle.engine.v8',
      rev: 'vehicle.engine.v8.high',
      idleRpm: 700,
      redline: 6000,
      gain: 1.1,
    }),
  ),
  'road.sports': roadCar(
    'A sports car: a high-revving six or V8, loud from outside.',
    car({
      idle: 'vehicle.engine.v8',
      rev: 'vehicle.engine.small.rev',
      idleRpm: 900,
      redline: 7500,
      pitch: 1.1,
      revPitch: 0.85,
      gain: 1.15,
    }),
    { cabin: { isolationDb: 20, cutoffHz: 1000 } },
  ),
  'road.hybrid': roadCar(
    'A hybrid: electric at low speed, a four-cylinder under load.',
    [
      ...electricCar({ gain: 0.8 }),
      ...car({
        idle: 'vehicle.engine.car',
        rev: 'vehicle.engine.small.rev',
        pitch: 1.05,
        gain: 0.85,
      }).filter((l) => ['engine', 'engine-load', 'engine-cabin', 'traffic'].includes(l.name)),
    ],
    { start: undefined, stop: undefined },
  ),
  'road.electric': roadCar(
    'An electric car: motor whine, tires and wind, and its warning hum.',
    electricCar(),
    { start: undefined, stop: undefined, cabin: { isolationDb: 27, cutoffHz: 800 } },
  ),
  'road.diesel': roadCar(
    'A light diesel: a pickup or a van.',
    car({
      idle: 'vehicle.engine.diesel',
      rev: 'vehicle.engine.diesel',
      idleRpm: 750,
      redline: 4500,
      pitch: 0.92,
      revPitch: 1.05,
      gain: 1.05,
    }),
  ),
  'road.truck': roadCar(
    'A heavy diesel: a box truck or a motorhome.',
    car({
      idle: 'vehicle.engine.diesel.heavy',
      rev: 'vehicle.engine.diesel.heavy',
      idleRpm: 600,
      redline: 2600,
      revPitch: 1.1,
      gain: 1.15,
    }),
    { horn: 'vehicle.horn.truck', cabin: { isolationDb: 20, cutoffHz: 900 }, maxDistance: 350 },
  ),
  'road.bus': roadCar(
    'A city bus.',
    [
      ...car({
        idle: 'vehicle.engine.diesel.heavy',
        rev: 'vehicle.engine.diesel.heavy',
        idleRpm: 600,
        redline: 2400,
        revPitch: 1.1,
        gain: 1.2,
      }),
    ],
    { horn: 'vehicle.horn.truck', cabin: { isolationDb: 18, cutoffHz: 900 }, maxDistance: 350 },
  ),
  'road.tuktuk': {
    description: 'An auto-rickshaw: a small single-cylinder engine, open sides.',
    horn: 'vehicle.horn.scooter',
    start: START,
    cabin: { isolationDb: 4, cutoffHz: 6000 },
    maxDistance: 200,
    layers: rider({ sound: 'vehicle.engine.tuktuk', idleRpm: 1500, redline: 6000 }),
  },
  'road.snowmobile': {
    description: 'A snowmobile.',
    cabin: { isolationDb: 0, cutoffHz: 20000 },
    start: START,
    maxDistance: 300,
    layers: rider({ sound: 'vehicle.engine.snowmobile', idleRpm: 1500, redline: 8000 }),
  },
  'cycle.motorcycle': {
    description: 'A motorcycle: an inline four.',
    cabin: { isolationDb: 0, cutoffHz: 20000 },
    horn: 'vehicle.horn.scooter',
    start: START,
    maxDistance: 300,
    layers: rider({ sound: 'vehicle.engine.motorcycle', idleRpm: 1200, redline: 12000 }),
  },
  'cycle.cruiser': {
    description: 'A cruiser: a V-twin.',
    cabin: { isolationDb: 0, cutoffHz: 20000 },
    horn: 'vehicle.horn.scooter',
    start: START,
    maxDistance: 300,
    layers: rider({ sound: 'vehicle.engine.cruiser', idleRpm: 900, redline: 5500, gain: 1.1 }),
  },
  'cycle.scooter': {
    description: 'A scooter or moped: a small two-stroke.',
    cabin: { isolationDb: 0, cutoffHz: 20000 },
    horn: 'vehicle.horn.scooter',
    start: START,
    maxDistance: 200,
    layers: rider({ sound: 'vehicle.engine.scooter', idleRpm: 1500, redline: 9000, gain: 0.9 }),
  },
  'cycle.electric': {
    description: 'An electric moped, scooter or board.',
    cabin: { isolationDb: 0, cutoffHz: 20000 },
    maxDistance: 80,
    layers: [
      {
        name: 'motor',
        sound: 'vehicle.electric.motor',
        perspective: 'any',
        gain: 0.35,
        pitchFrom: speed([
          [0, 0.8],
          [12, 1.8],
        ]),
        gainFrom: speed([
          [0.5, 0],
          [4, 0.6],
          [12, 1],
        ]),
      },
      ...rolling('vehicle.bicycle.tire'),
    ],
  },
  'cycle.bicycle': {
    description: 'A bicycle.',
    cabin: { isolationDb: 0, cutoffHz: 20000 },
    maxDistance: 60,
    layers: rolling('vehicle.bicycle.tire', { freewheel: true }),
  },
  'cycle.skateboard': {
    description: 'A skateboard.',
    cabin: { isolationDb: 0, cutoffHz: 20000 },
    maxDistance: 60,
    layers: rolling('vehicle.skateboard.roll'),
  },
  'cycle.snow': {
    description: 'Skis or a snowboard.',
    cabin: { isolationDb: 0, cutoffHz: 20000 },
    maxDistance: 60,
    layers: rolling('vehicle.ski.snow'),
  },
  'rail.locomotive': {
    description: 'A diesel-electric locomotive.',
    horn: 'rail.horn.us',
    maxDistance: 1200,
    cabin: { isolationDb: 16, cutoffHz: 900 },
    layers: locomotive(),
  },
  'rail.car': {
    description: 'A coach or freight car: its wheels, when it leads.',
    maxDistance: 600,
    layers: railWheels(LEAD),
  },
  'rail.tram': {
    description: 'A tram or light rail car.',
    horn: 'rail.tram.bell',
    maxDistance: 400,
    cabin: { isolationDb: 18, cutoffHz: 1000 },
    layers: tram(),
  },
  'boat.outboard': {
    description: 'A small boat with an outboard motor.',
    cabin: { isolationDb: 0, cutoffHz: 20000 },
    horn: 'boat.horn',
    maxDistance: 600,
    layers: boat({ engine: 'boat.outboard' }),
  },
  'boat.inboard': {
    description: 'A fishing boat or a tug: an inboard diesel.',
    horn: 'boat.horn',
    maxDistance: 900,
    layers: boat({ engine: 'boat.inboard', size: 1.5 }),
  },
  'boat.sail': {
    description: 'A sailboat: water and rigging.',
    cabin: { isolationDb: 0, cutoffHz: 20000 },
    maxDistance: 300,
    layers: boat({ sail: true }),
  },
  'boat.ship': {
    description: 'A ship or a ferry: a deep engine drone and its horn.',
    horn: 'boat.horn',
    maxDistance: 2500,
    layers: boat({ engine: 'boat.ship', size: 3 }),
  },
  'aircraft.jet.fighter': {
    description: 'A fighter: low-bypass jets with reheat.',
    start: 'aircraft.start.turbine',
    maxDistance: 8000,
    ...jet({ idle: 'aircraft.fighter.idle', reheat: true, level: 1.2, isolationDb: 22 }),
  },
  'aircraft.jet.harrier': {
    description: 'A Harrier: one vectored Pegasus, no reheat.',
    start: 'aircraft.start.turbine',
    maxDistance: 8000,
    ...jet({ idle: 'aircraft.fighter.idle', level: 1.25, pitch: 1.08, isolationDb: 22 }),
  },
  'aircraft.jet.airliner': {
    description: 'A twin high-bypass airliner.',
    start: 'aircraft.start.turbine',
    maxDistance: 8000,
    ...jet({ cabin: 'aircraft.turbofan.cabin' }),
  },
  'aircraft.jet.heavy': {
    description: 'A four-engine heavy jet.',
    start: 'aircraft.start.turbine',
    maxDistance: 9000,
    ...jet({ cabin: 'aircraft.turbofan.cabin', pitch: 0.9, level: 1.25 }),
  },
  'aircraft.jet.business': {
    description: 'A business or regional jet.',
    start: 'aircraft.start.turbine',
    maxDistance: 6000,
    ...jet({ cabin: 'aircraft.turbofan.cabin', pitch: 1.1, level: 0.85 }),
  },
  'aircraft.prop.flat': {
    description: 'A flat-four or flat-six piston engine and propeller.',
    start: 'aircraft.start.piston',
    maxDistance: 3000,
    ...propeller({
      engine: 'aircraft.piston.flat',
      idle: 'aircraft.piston.flat.idle',
      cabin: 'aircraft.piston.flat.cabin',
      isolationDb: 16,
    }),
  },
  'aircraft.prop.flat-twin': {
    description: 'A light twin with flat piston engines.',
    start: 'aircraft.start.piston',
    maxDistance: 3500,
    ...propeller({
      engine: 'aircraft.piston.flat',
      idle: 'aircraft.piston.flat.idle',
      cabin: 'aircraft.piston.flat.cabin',
      level: 1.2,
      pitch: 1.05,
      isolationDb: 18,
    }),
  },
  'aircraft.prop.radial': {
    description: 'A radial piston engine.',
    start: 'aircraft.start.piston',
    maxDistance: 3500,
    ...propeller({
      engine: 'aircraft.piston.radial',
      cabin: 'aircraft.piston.flat.cabin',
      pitch: 0.95,
      level: 1.15,
      isolationDb: 16,
      buzz: 0.5,
    }),
  },
  'aircraft.prop.merlin': {
    description: "The P-51's Rolls-Royce Merlin.",
    start: 'aircraft.start.piston',
    maxDistance: 4000,
    ...propeller({
      engine: 'aircraft.engine.piston',
      cabin: 'aircraft.piston.flat.cabin',
      pitch: 1,
      level: 1.2,
      isolationDb: 14,
      buzz: 0.35,
    }),
  },
  'aircraft.prop.turboprop': {
    description: 'A PT6-class turboprop.',
    start: 'aircraft.start.turbine',
    maxDistance: 4000,
    ...propeller({
      engine: 'aircraft.turboprop',
      cabin: 'aircraft.turboprop.cabin',
      turbine: true,
      isolationDb: 20,
    }),
  },
  'aircraft.prop.turboprop-large': {
    description: 'A large turboprop transport or airliner.',
    start: 'aircraft.start.turbine',
    maxDistance: 6000,
    ...propeller({
      engine: 'aircraft.turboprop.large',
      cabin: 'aircraft.turboprop.cabin',
      turbine: true,
      pitch: 0.9,
      level: 1.25,
      isolationDb: 24,
      buzz: 0.5,
    }),
  },
  'aircraft.tiltrotor': {
    description: 'A tiltrotor: two big turboshafts and prop-rotors.',
    start: 'aircraft.start.turbine',
    maxDistance: 6000,
    ...propeller({
      engine: 'aircraft.turboprop.large',
      cabin: 'aircraft.heli.cabin',
      turbine: true,
      pitch: 0.8,
      level: 1.3,
      isolationDb: 16,
      buzz: 0.7,
    }),
  },
  'aircraft.heli.light': {
    description: 'A light turbine helicopter.',
    start: 'aircraft.start.turbine',
    maxDistance: 3000,
    ...helicopter({ rotor: 'aircraft.engine.helicopter' }),
  },
  'aircraft.heli.piston': {
    description: 'A piston helicopter (Robinson).',
    start: 'aircraft.start.piston',
    maxDistance: 2500,
    ...helicopter({ rotor: 'aircraft.heli.piston', turbine: false }),
  },
  'aircraft.heli.twoblade': {
    description: "A two-blade utility helicopter: the Huey's slap.",
    start: 'aircraft.start.turbine',
    maxDistance: 4000,
    ...helicopter({ rotor: 'aircraft.heli.twoblade', level: 1.15 }),
  },
  'aircraft.heli.medium': {
    description: 'A medium twin-turbine helicopter.',
    start: 'aircraft.start.turbine',
    maxDistance: 3500,
    ...helicopter({ rotor: 'aircraft.heli.medium', level: 1.1 }),
  },
  'aircraft.heli.utility': {
    description:
      'A Black Hawk class utility helicopter (a medium helicopter recording pitched down).',
    start: 'aircraft.start.turbine',
    maxDistance: 4000,
    ...helicopter({ rotor: 'aircraft.heli.medium', pitch: 0.88, level: 1.2 }),
  },
  'aircraft.heli.tandem': {
    description: 'A tandem-rotor Chinook (two-blade and medium recordings pitched down).',
    start: 'aircraft.start.turbine',
    maxDistance: 5000,
    ...helicopter({
      rotor: 'aircraft.heli.twoblade',
      pitch: 0.75,
      level: 1.2,
      second: { sound: 'aircraft.heli.medium', pitch: 0.85 },
    }),
  },
};

// --- classification ---

function load(file) {
  const doc = JSON.parse(readFileSync(join(types, file), 'utf8'));
  return Object.entries(doc.types ?? doc);
}

const HELI = {
  oh6: 'light',
  bell_206b: 'light',
  bell_407: 'light',
  airbus_h125: 'light',
  robinson_r44: 'piston',
  uh_1h: 'twoblade',
  bell_412ep: 'medium',
  airbus_h145: 'medium',
  aw139: 'medium',
  uh_60m: 'utility',
  ch_47f: 'tandem',
};
const RADIAL = new Set(['dhc_2', 'beech_18', 'dc_3']);

function aircraftFamily(id, spec) {
  const short = id.split('.').pop();
  if (spec.model === 'helicopter') return `aircraft.heli.${HELI[short] ?? 'medium'}`;
  if (short === 'p51d') return 'aircraft.prop.merlin';
  if (short === 'mv_22b') return 'aircraft.tiltrotor';
  const engines = spec.engines ?? (spec.engine ? [spec.engine] : []);
  const e = engines[0] ?? {};
  if (e.propulsion === 'jet') {
    if (e.afterburnerThrust) return 'aircraft.jet.fighter';
    if (e.vectored) return 'aircraft.jet.harrier';
    if (engines.length >= 4) return 'aircraft.jet.heavy';
    const thrust = engines.reduce((n, x) => n + (x.maxThrust ?? 0), 0);
    return thrust < 150_000 ? 'aircraft.jet.business' : 'aircraft.jet.airliner';
  }
  if (RADIAL.has(short)) return 'aircraft.prop.radial';
  // The DA42's Austro engines are diesel pistons: no mixture lever, but no turbine either.
  if (short === 'diamond_da42') return 'aircraft.prop.flat-twin';
  if (e.mixtureControl)
    return engines.length > 1 ? 'aircraft.prop.flat-twin' : 'aircraft.prop.flat';
  // No mixture lever: a turbine. Big ones (or four of them) are the transports.
  const power = engines.reduce((n, x) => n + (x.power ?? 0), 0);
  return power > 3_000_000 || engines.length >= 4
    ? 'aircraft.prop.turboprop-large'
    : 'aircraft.prop.turboprop';
}

function roadFamily(id, c) {
  const spec = c.vehicle?.spec ?? {};
  const style = spec.bodyStyle;
  const short = id.split('.').pop();
  const source = c.audioSource;
  if (style === 'auto-rickshaw') return 'road.tuktuk';
  if (style === 'snowmobile') return 'road.snowmobile';
  if (!source) return 'road.electric';
  const sound = source.sound;
  if (['box-truck', 'motorhome'].includes(style) && sound === 'vehicle.engine.diesel')
    return 'road.truck';
  if (sound === 'vehicle.engine.diesel') return 'road.diesel';
  // Hybrids: their generator gives them a lower engine-load floor (they cruise on the motor).
  const floor = source.gainFrom?.curve?.[0]?.[1];
  if (floor === 0.3) return 'road.hybrid';
  if (short === 'honda_n_box_2024') return 'road.kei';
  const pitch = source.pitch ?? 1;
  const sporty = ['coupe', 'roadster', 'fastback'].includes(style);
  // Every V8 burbles, coupe or pickup; a sporty six is the high-revving sports voice.
  if (pitch <= 0.86) return 'road.v8';
  if (pitch <= 0.98) return sporty ? 'road.sports' : 'road.six';
  return 'road.four';
}

function cycleFamily(id) {
  const short = id.split('.').pop();
  if (short === 'cruiser_motorcycle') return 'cycle.cruiser';
  if (short === 'standard_motorcycle') return 'cycle.motorcycle';
  if (['motor_scooter', 'underbone_moped'].includes(short)) return 'cycle.scooter';
  if (['electric_moped', 'kick_scooter', 'electric_skateboard'].includes(short))
    return 'cycle.electric';
  if (short === 'skateboard') return 'cycle.skateboard';
  if (['skis', 'snowboard'].includes(short)) return 'cycle.snow';
  return 'cycle.bicycle';
}

function railFamily(c) {
  if (c.audioSource) return 'rail.locomotive';
  return 'rail.car';
}

function boatFamily(id) {
  const short = id.split('.').pop();
  if (short === 'sailboat') return 'boat.sail';
  if (['speedboat'].includes(short)) return 'boat.outboard';
  if (['fishing_boat', 'tugboat'].includes(short)) return 'boat.inboard';
  return 'boat.ship';
}

const families = new Map();
const assign = (id, family) => {
  if (!PROFILES[family]) throw new Error(`${id}: no profile ${family}`);
  families.set(id, family);
};
for (const [id, t] of load('aircraft.types.json'))
  assign(id, aircraftFamily(id, t.components.aircraft.spec));
for (const [id, t] of load('vehicle.types.json')) assign(id, roadFamily(id, t.components));
for (const [id] of load('cycle.types.json')) assign(id, cycleFamily(id));
for (const [id, t] of load('rail.types.json')) assign(id, railFamily(t.components));
for (const [id] of load('transit.types.json'))
  assign(id, id.endsWith('.bus') ? 'road.bus' : 'rail.tram');
for (const [id] of load('watercraft.types.json')) assign(id, boatFamily(id));

if (process.argv.includes('--list')) {
  for (const [id, f] of [...families].sort()) console.log(`${f.padEnd(32)} ${id}`);
  process.exit(0);
}

const byFamily = new Map();
for (const [id, f] of families) byFamily.set(f, [...(byFamily.get(f) ?? []), id]);
const match = [];
for (const [family, ids] of [...byFamily].sort()) {
  ids.sort();
  match.push({ profile: family, when: { 'renderable.ref': ids } });
  match.push({ profile: family, when: { 'ambientAgent.type': ids } });
}
// Types added later, and other projects' vehicles: a voice by kind.
match.push(
  { profile: 'aircraft.heli.medium', when: { 'aircraft.spec.model': 'helicopter' } },
  {
    profile: 'aircraft.jet.fighter',
    when: { 'aircraft.spec.engines.0.afterburnerThrust': { exists: true } },
  },
  { profile: 'aircraft.jet.airliner', when: { 'aircraft.spec.engines.0.propulsion': 'jet' } },
  { profile: 'aircraft.prop.flat', when: { 'aircraft.spec.engines.0.mixtureControl': true } },
  { profile: 'aircraft.prop.turboprop', when: { 'aircraft.spec.model': 'airplane' } },
  { profile: 'road.electric', when: { 'vehicle.spec.powertrain.curve': 'electric' } },
  {
    profile: 'road.four',
    when: {
      'vehicle.spec.bodyStyle': { exists: true },
      'vehicle.spec.cycle': { exists: false },
      'vehicle.spec.rail': { exists: false },
    },
  },
  { profile: 'aircraft.jet.airliner', when: { 'ambientAgent.kind': 'aircraft' } },
  { profile: 'rail.car', when: { 'ambientAgent.kind': 'train' } },
  { profile: 'boat.inboard', when: { 'ambientAgent.kind': 'boat' } },
  { profile: 'road.four', when: { 'ambientAgent.kind': 'car' } },
);

const strip = (profile) =>
  Object.fromEntries(Object.entries(profile).filter(([, v]) => v !== undefined));
const doc = {
  format: 'molen/sound-profiles@1',
  id: 'molen.sounds',
  title: 'Voices for molen.entities vehicles, aircraft, boats and trains',
  components: ['vehicle', 'aircraft', 'ambientAgent', 'boat'],
  match,
  profiles: Object.fromEntries(Object.entries(PROFILES).map(([id, p]) => [id, strip(p)])),
};
writeFileSync(join(root, 'sound-profiles.json'), `${JSON.stringify(doc, null, 2)}\n`);
// Match the repository formatter so a regeneration leaves `pnpm lint` clean.
const formatted = spawnSync(
  process.execPath,
  [
    fileURLToPath(import.meta.resolve('@biomejs/biome/bin/biome')),
    'format',
    '--write',
    join(root, 'sound-profiles.json'),
  ],
  { stdio: 'inherit' },
);
if (formatted.status !== 0) throw new Error('Formatting sound-profiles.json failed');
console.log(
  `${Object.keys(PROFILES).length} profiles, ${families.size} types, ${match.length} rules`,
);
