import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function readEvidence(dir, record, filename) {
  if (record?.path !== filename) throw Error('Unexpected Lagos evidence path');
  const bytes = fs.readFileSync(path.join(dir, filename));
  if (hash(bytes) !== record.sha256) throw Error('Lagos evidence hash mismatch');
  return JSON.parse(bytes);
}

/** The Federal photograph shows the event inside. Written records and native map fix the exterior. */
export function inspectLagosTheatrePrimaryFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const archive = readEvidence(
      dir,
      proof.primarySources,
      'reference-rights/period-architecture-facts.json',
    );
    const exclusion = readEvidence(
      dir,
      proof.candidateExclusion,
      'reference-rights/commons-candidate-and-exclusions.json',
    );
    const { way, coordinates } = readEvidence(
      dir,
      proof.nativeIdentity,
      'native-map/theatre-footprint.json',
    );
    const fact = (url) => archive.sources.find((source) => source.url === url)?.facts;
    const theatre = fact(
      'https://nationaltheatre.gov.ng/wp-content/uploads/2023/01/NATMOS-Volume-2.pdf',
    );
    const architecture = fact('https://pubhtml5.com/crlf/mshn/basic/');
    const event = fact('https://catalog.archives.gov/id/178583');
    const { excludedCandidate } = archive;
    const original = Object.values(exclusion.query.pages).find(
      (page) => page.imageinfo?.[0]?.descriptionurl === excludedCandidate.sourceUrl,
    );
    if (
      archive.mode !== 'factual-text-only' ||
      archive.imageryUsed !== false ||
      proof.primarySources.use !== archive.mode ||
      theatre?.heightMetersApproximate !== 31 ||
      theatre.storeys !== 7 ||
      architecture?.radialSectors !== 4 ||
      architecture.rampedEntrances !== 4 ||
      architecture.terraceRings !== 3 ||
      architecture.glazedTiers !== 2 ||
      !architecture.opaqueUpperTier ||
      architecture.roofShell !== 'saddle' ||
      event?.eventDate !== controls.representedDate ||
      event.exteriorVisible !== false ||
      !excludedCandidate.originalFederalPhoto ||
      original?.imageinfo?.[0]?.sha1 !== excludedCandidate.nativeSha1 ||
      !original.revisions[0].slots.main['*'].includes('{{PD-USGov}}')
    )
      return fail('lagos-theatre-written-architecture-or-indoor-image-unbound');

    const {
      saddle,
      roofTerraceRings,
      entranceDatum,
      maximumRoofHeightAboveEntrance,
      radialSectorControlIndices,
      rampedEntrances,
    } = controls.section;
    if (
      maximumRoofHeightAboveEntrance !== theatre.heightMetersApproximate ||
      Math.abs(saddle.highestPoint - entranceDatum - maximumRoofHeightAboveEntrance) > 1e-8 ||
      roofTerraceRings.length !== architecture.terraceRings ||
      roofTerraceRings.filter((ring) => ring.glazed).length !== architecture.glazedTiers ||
      radialSectorControlIndices.length !== architecture.radialSectors ||
      rampedEntrances !== architecture.rampedEntrances
    )
      return fail('lagos-theatre-section-and-rings-disagree');

    const [lon, lat] = frame.anchor;
    const m = (6378137 * Math.PI) / 180;
    const scale = Math.cos((lat * Math.PI) / 180);
    const c = Math.cos(frame.heading);
    const s = Math.sin(frame.heading);
    const outline = frame.geometry.polygons[0];
    if (
      proof.nativeIdentity.way !== 217574079 ||
      way.id !== proof.nativeIdentity.way ||
      proof.nativeIdentity.wikidata !== 'Q6970499' ||
      way.tags.wikidata !== proof.nativeIdentity.wikidata ||
      frame.mappedIdentity.wikidataId !== way.tags.wikidata ||
      coordinates.length !== 47 ||
      outline.length !== 46 ||
      !coordinates.slice(0, -1).every(([a, b], i) => {
        const x = (a - lon) * m * scale;
        const z = (lat - b) * m;
        return Math.hypot(c * x - s * z - outline[i][0], s * x + c * z - outline[i][1]) < 1e-7;
      })
    )
      return fail('lagos-theatre-native-46-corner-footprint-changed');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The original named footprint establishes the four radial sectors. Written sources supply the approximate overall height, saddle shell and rings. The only cleared Qualla photograph is an interior event view.',
    };
  } catch {
    return fail('lagos-theatre-primary-facts-invalid');
  }
}
