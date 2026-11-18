import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const mountElliottCase = 'cloncurry-mount-elliott-five-surviving-plant-groups';

const registerUrl =
  'https://data.des.qld.gov.au/__data/assets/xml_file/0024/404970/heritage-register-2025.xml';
const factsPath = 'reference-rights/qhr-602256-structure-facts.json';
const boundaryPath = 'native-map/queensland-heritage-602256.geojson';
const railwayPath = 'native-map/mount-isa-railway.json';
const digest = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;

function pinned(dir, pin, expectedPath) {
  if (pin?.path !== expectedPath) throw Error('Unexpected evidence path');
  const bytes = readFileSync(join(dir, expectedPath));
  if (digest(bytes) !== pin.sha256) throw Error('Evidence hash mismatch');
  return JSON.parse(bytes);
}

/** Bind the surveyed component sizes and their relative positions to the registered site. */
export function inspectMountElliottFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const facts = pinned(dir, proof.primarySources, factsPath);
    const boundary = pinned(dir, proof.nativeIdentity, boundaryPath);
    const railway = pinned(dir, proof.railway, railwayPath);
    const native = boundary.features[0];
    if (
      facts.sourceUrl !== registerUrl ||
      facts.use !== 'factual-text-only' ||
      facts.placeRef !== 602256 ||
      facts.suburb !== 'Cloncurry' ||
      native.properties.place_id !== facts.placeRef ||
      native.properties.placename !== facts.placename ||
      native.properties.area_sqm !== 85301 ||
      frame.mappedIdentity.heritagePlace !== facts.placeRef ||
      frame.mappedIdentity.wikidataId !== 'Q25641085' ||
      frame.mappedIdentity.railwayWay !== 93414500 ||
      railway.elements[0]?.id !== 93414500 ||
      railway.elements[0]?.tags?.railway !== 'rail' ||
      controls.wikidataId !== 'Q25641085' ||
      frame.heading !== 0 ||
      controls.representedDate !== 'present'
    )
      return fail('mount-elliott-heritage-and-rail-identity-unbound');

    const [lon, lat] = frame.anchor;
    const m = (6378137 * Math.PI) / 180;
    const lonScale = m * Math.cos((lat * Math.PI) / 180);
    const matches = ([x, z], [localX, localZ]) =>
      Math.hypot((x - lon) * lonScale - localX, (lat - z) * m - localZ) < 0.00002;
    const nativeCorners = native.geometry.coordinates[0].slice(0, -1);
    const nativeRail = railway.elements.slice(1);
    const line = frame.geometry.centerlines[0];
    if (
      nativeCorners.length !== frame.geometry.outline.length ||
      !nativeCorners.every((point, i) => matches(point, frame.geometry.outline[i])) ||
      nativeRail.length !== line.length ||
      !nativeRail.every((node, i) => matches([node.lon, node.lat], line[i]))
    )
      return fail('mount-elliott-surveyed-boundary-unbound');

    const reported = facts.survivingGroups;
    const { oreCrusher, roastingFurnace, leaching, electrolyticWorks, laboratory } =
      controls.section;
    const [plantX, plantZ] = electrolyticWorks.center;
    const railEast = line.findIndex(([x]) => x >= plantX);
    if (railEast <= 0) return fail('mount-elliott-railway-segment-missing');
    const [eastX, eastZ] = line[railEast];
    const [westX, westZ] = line[railEast - 1];
    const railZ = westZ + ((plantX - westX) / (eastX - westX)) * (eastZ - westZ);
    if (
      Object.keys(reported).length !== 5 ||
      Object.keys(controls.section).length !== 5 ||
      roastingFurnace.furnaceDiameter !== reported.roastingFurnace.historicalFurnaceDiameter ||
      leaching.squareSide !== reported.leaching.squareSide ||
      leaching.squareHeight !== reported.leaching.squareHeight ||
      leaching.circularCenters.length !== reported.leaching.circularCount ||
      leaching.circularDiameter !== reported.leaching.circularDiameter ||
      leaching.circularHeight !== reported.leaching.circularHeight ||
      electrolyticWorks.tankCenters.length !== reported.electrolyticWorks.tankCount ||
      electrolyticWorks.tankArea !== reported.electrolyticWorks.tankArea ||
      electrolyticWorks.tankDepth !== reported.electrolyticWorks.tankDepth ||
      !reported.laboratory.features.includes('adobe foundations') ||
      !laboratory.foundation.every(Number.isFinite) ||
      roastingFurnace.center[1] >= oreCrusher.center[1] ||
      leaching.squareCenter[0] >= roastingFurnace.center[0] ||
      !leaching.circularCenters.every(([, z]) => z < leaching.squareCenter[1]) ||
      !leaching.circularCenters.every(([, z]) => z > electrolyticWorks.center[1]) ||
      plantZ <= railZ
    )
      return fail('mount-elliott-remains-dimensions-or-layout-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: digest(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Queensland’s register fixes five groups and dimensions of the square vat, four round vats, northern tanks and historical furnace. State boundary, mapped railway and source terrain set the site frame. The internal positions and details are estimates.',
    };
  } catch {
    return fail('mount-elliott-primary-facts-invalid');
  }
}
