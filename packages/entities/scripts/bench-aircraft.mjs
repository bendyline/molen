import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performanceLedger, referenceSpeed } from './aircraft-performance.mjs';
import { flyLevel, flyRotorLevel, levelSpeedRoots } from './flight-bench.mjs';

const types = JSON.parse(
  await readFile(
    new URL('../../../content/entities/types/aircraft.types.json', import.meta.url),
    'utf8',
  ),
).types;
const selection = process.argv.find((a) => a.startsWith('--id='))?.slice(5);
const flight = process.argv.includes('--flight');
const rotorEnvelope = (spec, target) =>
  [0, 1500, 3000, 5000].map((altitude) => {
    const at = flyRotorLevel(spec, { speed: target, altitude, seconds: 120 });
    return {
      altitude,
      ktas: (at.state.airspeed * 3600) / 1852,
      mach: at.state.mach,
      altitudeErrorM: at.maxAltitudeError,
      altitudeHeld: at.maxAltitudeError < 100,
      overspeed: at.state.overspeed,
      note: '120-second cruise experiment at 12-degree disc tilt; not a maximum-speed claim',
    };
  });
const results = [];
for (const p of performanceLedger.aircraft) {
  if (selection && ![p.id, p.slug].includes(selection)) continue;
  const spec = types[p.id]?.components.aircraft.spec;
  if (!spec) throw Error(`Missing runtime aircraft ${p.id}`);
  const target = referenceSpeed(p),
    ref = p.reference;
  const config = { power: ref.throttle };
  const envelope = spec.airplane
    ? [0, 3000, 6000, 11000, 15000].map((altitude) => {
        const roots = levelSpeedRoots(spec, altitude, config);
        const fastest = roots.at(-1);
        return {
          altitude,
          ktas: fastest ? (fastest.speed * 3600) / 1852 : null,
          mach: fastest?.mach ?? null,
          branches: roots.length,
          reachableFromBelow: roots.length === 1,
        };
      })
    : flight
      ? rotorEnvelope(spec, target)
      : [];
  const predicted = spec.airplane
    ? levelSpeedRoots(spec, ref.altitudeM, config).at(-1)?.speed
    : undefined;
  const integrated = flight
    ? (spec.airplane ? flyLevel : flyRotorLevel)(spec, {
        speed: target * 0.85,
        altitude: ref.altitudeM,
        power: ref.throttle,
        seconds: 180,
      })
    : undefined;
  const error = spec.airplane
    ? predicted === undefined
      ? Infinity
      : Math.abs(predicted - target) / target
    : 0;
  const flightError = integrated ? Math.abs(integrated.state.airspeed - target) / target : 0;
  const pass =
    (spec.airplane || integrated ? true : null) &&
    error <= ref.tolerance &&
    flightError <= ref.tolerance &&
    (!integrated || integrated.maxAltitudeError < 100);
  results.push({
    id: p.id,
    evidence: ref.evidence,
    reference: ref,
    referenceKtas: (target * 3600) / 1852,
    predictedKtas: predicted === undefined ? null : (predicted * 3600) / 1852,
    ...(integrated
      ? {
          flightKtas: (integrated.state.airspeed * 3600) / 1852,
          altitudeErrorM: integrated.maxAltitudeError,
        }
      : {}),
    pass,
    envelope,
  });
}
if (!results.length) throw Error(`Unknown aircraft: ${selection}`);
const missing = Object.keys(types).filter(
  (id) => !performanceLedger.aircraft.some((p) => p.id === id),
);
if (missing.length) throw Error(`Uncovered aircraft: ${missing.join(', ')}`);
const report = {
  format: 'molen/flight-benchmark@1',
  mode: flight ? 'force-balance-and-180-second-acceleration' : 'force-balance',
  notes:
    'Calibration agreement is not independent validation. Cruise throttle/weight/altitude and estimated anchors are explicit. No speed caps. Multiple roots may be separated by an unaccelerable drag barrier. Rotorcraft require --flight; null means untested. Rotor envelopes are controlled cruise experiments, not maximum speeds.',
  passed: results.filter((r) => r.pass).length,
  total: results.length,
  results,
};
const output = process.argv.find((a) => a.startsWith('--out='))?.slice(6);
if (output) {
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(resolve(output), `${JSON.stringify(report, null, 2)}\n`);
}
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
else {
  console.table(
    results.map((r) => ({
      aircraft: r.id.split('.').at(-1),
      target: Math.round(r.referenceKtas),
      predicted: r.predictedKtas === null ? null : Math.round(r.predictedKtas),
      ...(flight
        ? { flight: Math.round(r.flightKtas), altitudeError: Math.round(r.altitudeErrorM) }
        : {}),
      pass: r.pass,
    })),
  );
  console.log(`${report.passed}/${report.total} passed (${report.mode})`);
}
if (process.argv.includes('--check') && report.passed !== report.total) process.exitCode = 1;
