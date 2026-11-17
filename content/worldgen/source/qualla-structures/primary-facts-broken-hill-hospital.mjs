import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const brokenHillHospitalCase = 'broken-hill-hospital-native-multipolygon-2000';
export const brokenHillHospitalModel = 'broken_hill_hospital';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function pinned(dir, record, filename) {
  const bytes = readFileSync(path.join(dir, filename));
  if (record.path !== filename || record.sha256 !== hash(bytes)) throw Error('Evidence differs');
  return JSON.parse(bytes);
}

function matchesRings(native, frame, dimensions) {
  const [longitude, latitude] = frame.anchor;
  const radians = Math.PI / 180;
  const meters = 6378137 * radians;
  const cx = Math.cos(frame.heading);
  const sx = Math.sin(frame.heading);
  const longitudeScale = meters * Math.cos(latitude * radians);
  const nodes = new Map(native.nodes.map((node) => [node.id, node]));
  const matches = (way, ring) =>
    way.nodes[0] === way.nodes.at(-1) &&
    ring.length === way.nodes.length - 1 &&
    way.nodes.slice(0, -1).every((id, index) => {
      const { lon, lat } = nodes.get(id);
      const x = (lon - longitude) * longitudeScale;
      const z = (latitude - lat) * meters;
      const [localX, localZ] = ring[index];
      return Math.hypot(cx * x - sx * z - localX, sx * x + cx * z - localZ) < 0.001;
    });
  const outer = native.ways.find((way) => way.role === 'outer');
  const inner = native.ways.filter((way) => way.role === 'inner');
  return (
    outer.id === 671005079 &&
    dimensions.outerWay === outer.id &&
    native.relation.members.length === 7 &&
    native.ways.length === 7 &&
    native.ways.every((way) =>
      native.relation.members.some(({ ref, role }) => ref === way.id && role === way.role),
    ) &&
    matches(outer, frame.geometry.outline) &&
    matches(outer, dimensions.outline) &&
    inner.length === 6 &&
    dimensions.innerWays.length === 6 &&
    dimensions.courtyards.length === 6 &&
    frame.geometry.holes.length === 6 &&
    inner.every(
      (way, i) =>
        way.id === dimensions.innerWays[i] &&
        matches(way, frame.geometry.holes[i]) &&
        matches(way, dimensions.courtyards[i]),
    )
  );
}

export function inspectBrokenHillHospitalFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const archive = pinned(
      dir,
      proof.primarySources,
      'reference-rights/hospital-construction-facts.json',
    );
    const excluded = pinned(
      dir,
      proof.candidateExclusion,
      'reference-rights/story-image-exclusions.json',
    );
    const native = pinned(dir, proof.nativeIdentity, 'native-map/hospital-multipolygon.json');
    const source = (url) => archive.sources.find((row) => row.url === url)?.facts;
    const city = source('https://www.visitbrokenhill.com/Discover/Silver-Trail/30.-Hospital-1941');
    const access = source('https://www.health.nsw.gov.au/news/Pages/20251212_00.aspx');
    const facility = source(
      'https://www.nsw.gov.au/departments-and-agencies/fwlhd/facilities/broken-hill-base-hospital',
    );
    const rejects = new Map(excluded.candidates.map((row) => [row.path, row]));
    if (
      archive.mode !== 'factual-text-only' ||
      archive.imageryUsed !== false ||
      city?.predecessorDemolished !== true ||
      city.era !== 2000 ||
      !['corrugated iron', 'masonry'].every((value) => city.cladding.includes(value)) ||
      facility?.address !== '176 Thomas Street' ||
      access?.frontAccessStreet !== 'Thomas Street' ||
      access?.rearEmergencyAccess !== 'rear car park' ||
      excluded.selectedImages !== 0 ||
      rejects.size !== inventory.candidates.length ||
      !inventory.candidates.every(
        ({ path, sourceUrl, license }) =>
          rejects.get(path)?.sourceUrl === sourceUrl && rejects.get(path)?.license === license,
      )
    )
      return fail('broken-hill-hospital-written-facts-or-image-exclusions-unbound');
    if (
      native.campus.id !== 174881688 ||
      native.campus.tags.name !== 'Broken Hill Base Hospital' ||
      native.relation.id !== 15256286 ||
      native.relation.tags.building !== 'hospital' ||
      native.street.tags.name !== 'Thomas Street' ||
      frame.mappedIdentity.wikidataId !== 'Q16255574' ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      !matchesRings(native, frame, controls.dimensions)
    )
      return fail('broken-hill-hospital-mapped-rings-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Standing hospital envelope and all six mapped courts, with documented cladding and front and rear access. Elevations and finish details are approximate.',
    };
  } catch {
    return fail('broken-hill-hospital-primary-facts-invalid');
  }
}
