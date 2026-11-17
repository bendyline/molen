import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const birdsvilleHospitalCase =
  'birdsville-heritage-survey-and-four-mapped-hospital-outlines';
export const birdsvilleHospitalModel = 'australian_inland_mission_hospital_birdsville';
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
function pinned(dir, record, name) {
  const bytes = fs.readFileSync(path.join(dir, name));
  if (record.path !== name || record.sha256 !== hash(bytes)) throw Error('Evidence differs');
  return JSON.parse(bytes);
}

/** Keep the 1953 building and its surviving ward anchored to the correct heritage parcel. */
export function inspectBirdsvilleHospitalFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const archive = pinned(
      dir,
      proof.primarySources,
      'reference-rights/queensland-register-architecture.json',
    );
    const excluded = pinned(
      dir,
      proof.candidateExclusion,
      'reference-rights/candidate-exclusions.json',
    );
    const commons = pinned(
      dir,
      excluded.commonsOriginal,
      'reference-rights/commons-birdsville-opening.json',
    );
    const native = pinned(dir, proof.nativeIdentity, 'native-map/compound-controls.json');
    const boundary = pinned(dir, proof.registerBoundary, 'native-map/qhr-boundary.geojson')
      .features[0];
    const release = Object.values(commons.query.pages)[0];
    const wiki = release.revisions[0].slots.main['*'];
    const register = archive.sources.find((s) => s.item === 602635)?.facts;
    const scope = controls.dimensions;
    if (
      archive.mode !== 'factual-text-only' ||
      archive.imageryUsed !== false ||
      proof.primarySources.use !== archive.mode ||
      !register ||
      register.mainStoreys !== 1 ||
      register.representedHospitalOpened !== 1953 ||
      register.structure !== 'prefabricated steel' ||
      register.finish !== 'corrugated iron' ||
      register.roof !== 'gabled hip' ||
      register.centralEntrance !== true ||
      register.coveredEntranceWalkway !== true ||
      scope.hospital.verandahSides !== register.enclosedVerandahSides ||
      register.ward.atSoutheast !== true ||
      register.ward.roof !== scope.ward.roof ||
      register.ward.openFrontVerandah !== true ||
      excluded.selectedImages !== 0 ||
      excluded.status !== 'excluded-domestic-expiry-only' ||
      !wiki.includes('{{PD-Australia}}') ||
      /PD-1996|Cc-zero/i.test(wiki) ||
      !wiki.includes('http://trove.nla.gov.au/work/7812627') ||
      !wiki.includes('|author=Andrew Leslie McKay') ||
      inventory.candidates.length !== excluded.candidates.length ||
      !inventory.candidates.every((r) =>
        excluded.candidates.some(
          (e) => r.path === e.path && r.sourceUrl === e.sourceUrl && r.license === e.license,
        ),
      )
    )
      return fail('birdsville-archive-description-or-candidate-exclusions-unbound');

    const [lon, lat] = frame.anchor;
    const rad = Math.PI / 180,
      m = 6378137 * rad,
      sx = m * Math.cos(lat * rad);
    const c = Math.cos(frame.heading),
      s = Math.sin(frame.heading);
    const local = (x, y) => [
      c * (x - lon) * sx - s * (lat - y) * m,
      s * (x - lon) * sx + c * (lat - y) * m,
    ];
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.001;
    const controlsById = new Map([
      [scope.hospital.way, scope.hospital.footprint],
      [scope.ward.way, scope.ward.footprint],
      ...scope.outbuildings.map(({ id, points }) => [id, points]),
    ]);
    const polygon = boundary.geometry.coordinates[0].slice(0, -1);
    const hospital = native.ways.find((w) => w.id === 499859118);
    if (
      boundary.properties.place_id !== 602635 ||
      proof.registerBoundary.place !== 602635 ||
      hospital?.tags.wikidata !== 'Q28035305' ||
      frame.mappedIdentity.wikidataId !== 'Q28035305' ||
      scope.hospital.way !== proof.nativeIdentity.primaryWay ||
      scope.hospital.way !== hospital.id ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      scope.ward.way !== 1026090392 ||
      frame.geometry.protectedParcel.length !== polygon.length ||
      !polygon.every(([x, y], i) => near(local(x, y), frame.geometry.protectedParcel[i])) ||
      controlsById.size !== 4 ||
      ![499859118, 1026090391, 1026090392, 1026090393].every((id) => {
        const way = native.ways.find((r) => r.id === id);
        const points = controlsById.get(id);
        return (
          points?.length === way.geometry.length - 1 &&
          way.geometry.slice(0, -1).every(({ lon, lat }, i) => near(local(lon, lat), points[i]))
        );
      })
    )
      return fail('birdsville-heritage-parcel-or-native-outlines-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Queensland Heritage Register parcel 602635 and four native outlines establish the standing 1953 hospital yard. The registry description informs the prefabricated construction, enclosed verandahs, covered walkway, hipped gable and former ward. Elevations and smaller facade details are estimates.',
    };
  } catch {
    return fail('birdsville-primary-facts-invalid');
  }
}
