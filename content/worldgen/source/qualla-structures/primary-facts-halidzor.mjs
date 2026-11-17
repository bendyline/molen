import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const halidzorCase = 'halidzor-mapped-basalt-walls-and-measured-church-section';
export const halidzorModel = 'halidzor_fortress';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const surveyUrl =
  'https://tert.nla.am/archive/NLA%20AMSAGIR/GitutyunEvTexnika/1968%2812%29_ocr.pdf';

function pinned(dir, record, expected) {
  const bytes = fs.readFileSync(path.join(dir, expected));
  if (record.path !== expected || record.sha256 !== hash(bytes))
    throw Error('Evidence hash mismatch');
  return JSON.parse(bytes);
}

/** Bind the measured masonry, footprint and imagery exclusions to the standing model. */
export function inspectHalidzorFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const archive = pinned(
      dir,
      proof.primarySources,
      'reference-rights/architecture-and-restoration-facts.json',
    );
    const excluded = pinned(
      dir,
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const native = pinned(dir, proof.nativeIdentity, 'native-map/fort-controls.json');
    const sources = new Map(archive.sources.map(({ url, facts }) => [url, facts]));
    const survey = sources.get(surveyUrl);
    const register = sources.get('https://www.arlis.am/hy/acts/22116/print/act');
    const recent = sources.get(
      'https://syuniacyerkir.am/ishkhananist-halidzor-berdi-surb-astvatsatsin-ekekhetsin',
    );
    const rejected = new Map(excluded.candidates.map((candidate) => [candidate.path, candidate]));
    if (
      archive.mode !== 'factual-text-only' ||
      archive.imageryUsed !== false ||
      proof.primarySources.use !== archive.mode ||
      excluded.selectedImages !== 0 ||
      rejected.size !== inventory.candidates.length ||
      !inventory.candidates.every(({ path, license, sourceUrl }) => {
        const row = rejected.get(path);
        return (
          row?.license === license &&
          row.sourceUrl === sourceUrl &&
          row.reason.trim() &&
          (/^CC BY(?:-SA)? /u.test(license) ||
            (license === 'Public domain' &&
              sourceUrl === 'https://commons.wikimedia.org/wiki/File:Baghaberd.jpg' &&
              row.reason.includes('different named fortress')))
        );
      }) ||
      register?.holyMotherChurch !== '8.1.2' ||
      register.connectedWingStoreys !== 2 ||
      register.northTombPiers !== 4 ||
      register.separateEasternVillageChurchNaves !== 1 ||
      survey?.towerCorner !== 'southwest' ||
      survey.towerDiameterMeters !== 5 ||
      survey.curtainWidthMeters !== 1 ||
      survey.churchWallWidthMeters !== 1.6 ||
      survey.bellOpeningDiameterMeters !== 2 ||
      recent?.flatDefensiveRoof !== true ||
      recent.bellTowerOverPrayerHall !== true ||
      recent.restoredChurch !== true
    )
      return fail('halidzor-architectural-facts-or-image-exclusions-unbound');

    const [lon, lat] = frame.anchor;
    const m = (6378137 * Math.PI) / 180;
    const sx = m * Math.cos((lat * Math.PI) / 180);
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.001;
    const matches = (id, points, circular) => {
      const way = native.ways.find((row) => row.id === id);
      if (!way || way.geometry.length !== points.length + (circular ? 1 : 0)) return false;
      return points.every((point, i) =>
        near(point, [(way.geometry[i].lon - lon) * sx, (lat - way.geometry[i].lat) * m]),
      );
    };
    const section = controls.dimensions;
    const { church, northTomb, villageChurch, walls, southwestTower, southernGate } = section;
    const length = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const insideSpan = length(church.core[1], church.core[2]) - 2 * church.wallWidth;
    const insideLength = length(church.core[0], church.core[1]) - 2 * church.wallWidth;
    if (
      native.identity.id !== 3791239587 ||
      native.identity.id !== proof.nativeIdentity.nodeId ||
      native.identity.tags.wikidata !== 'Q5556110' ||
      frame.mappedIdentity.wikidataId !== 'Q5556110' ||
      !near(native.identity.coordinate, frame.anchor) ||
      frame.heading !== 0 ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      ![682848205, 541598187].every(
        (id, i) =>
          walls[i]?.id === id &&
          matches(id, walls[i].points, false) &&
          frame.geometry.centerlines[i].every((point, j) => near(point, walls[i].points[j])),
      ) ||
      !near(southernGate.from, walls[0].points[0]) ||
      !near(southernGate.to, walls[1].points.at(-1)) ||
      !matches(541598186, church.measuredOutline, true) ||
      !matches(541598188, northTomb.footprint, true) ||
      !matches(541598185, villageChurch.footprint, true) ||
      section.wallWidth !== survey.curtainWidthMeters ||
      southwestTower.diameter !== survey.towerDiameterMeters ||
      !near(southwestTower.center, [-36.9, 5.05]) ||
      church.wallWidth !== survey.churchWallWidthMeters ||
      insideSpan <= survey.churchClearWidthMinimumMeters ||
      Math.abs(insideSpan - church.clearSpan) > 0.025 ||
      Math.abs(insideLength / insideSpan - survey.churchInteriorLengthToWidth) > 0.025 ||
      church.bellOpeningDiameter !== survey.bellOpeningDiameterMeters ||
      !register.wingSides.every((side) =>
        church.wings.some(
          (wing) =>
            wing.kind === side &&
            wing.levels === register.connectedWingStoreys &&
            wing.lower < wing.upper,
        ),
      ) ||
      northTomb.piers !== register.northTombPiers ||
      villageChurch.naves !== register.separateEasternVillageChurchNaves
    )
      return fail('halidzor-map-wall-and-church-measurements-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Native wall and building controls, measured church wall thickness, tower diameter and the restored southern approach are retained. The belfry shape, roof divisions, and surviving heights are estimates.',
    };
  } catch {
    return fail('halidzor-primary-facts-invalid');
  }
}
