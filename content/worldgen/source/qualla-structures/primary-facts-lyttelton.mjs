import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function pinned(dir, record, file) {
  if (record?.path !== file) throw Error('Unexpected evidence path');
  const bytes = fs.readFileSync(path.join(dir, file));
  if (hash(bytes) !== record.sha256) throw Error('Evidence hash mismatch');
  return JSON.parse(bytes);
}

/** Bind the court dimensions to the gaoler's report and the site frame to the council survey. */
export function inspectLytteltonPrimaryFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const archive = pinned(
      dir,
      proof.primarySources,
      'reference-rights/period-architecture-facts.json',
    );
    const museum = pinned(
      dir,
      proof.candidateExclusion,
      'reference-rights/te-uaka-collection-rights.json',
    );
    const { councilSite, ways } = pinned(
      dir,
      proof.nativeIdentity,
      'native-map/site-and-surviving-steps.json',
    );
    const find = (url) => archive.sources.find((source) => source.url === url)?.facts;
    const report = find('https://paperspast.natlib.govt.nz/parliamentary/AJHR1878-I.2.2.4.6');
    const older = find('https://paperspast.natlib.govt.nz/newspapers/LT18730206.2.14');
    const newer = find('https://paperspast.natlib.govt.nz/newspapers/LT18750430.2.16');
    const research = find('https://ojs.victoria.ac.nz/aha/article/download/8319/7386');
    const heritage = find('https://www.heritage.org.nz/list-details/7353/LytteltonGaolSite');
    if (
      archive.mode !== 'factual-text-only' ||
      archive.imageryUsed !== false ||
      proof.primarySources.use !== archive.mode ||
      museum.objectId !== 1136038 ||
      museum.objectNumber !== '14985.30' ||
      museum.copyrightLicence !== 'unknown' ||
      research?.entranceStreet !== 'Oxford Street' ||
      research.principalTerracedCourtyards !== 2 ||
      heritage?.registerNumber !== 7353 ||
      heritage.closureYear !== 1920 ||
      report?.intendedSeparateCells !== 185 ||
      older?.earlierCellRangeStoreys !== 2 ||
      newer?.eastRangeStoreys !== 3 ||
      older.earlierCellCeilingFeet !== 10 ||
      newer.eastRangeCeilingFeet !== 10.25
    )
      return fail('lyttelton-archive-or-excluded-rendition-unbound');

    const s = controls.section;
    const dimensions = {
      exercise: [77, 78],
      work: [70, 76],
      refractory: [67, 11],
      women: [41, 25],
    };
    const close = (a, b) => Math.abs(a - b) < 1e-7;
    if (
      s.courts.length !== Object.keys(dimensions).length ||
      new Set(s.courts.map(({ kind }) => kind)).size !== s.courts.length ||
      s.courts.some(({ kind, width, depth }) => {
        const feet = dimensions[kind];
        if (!feet || feet.some((value, i) => value !== report.yardDimensionsFeet[kind]?.[i]))
          return true;
        const [w, d] = kind === 'refractory' || kind === 'women' ? [...feet].reverse() : feet;
        return !close(width, w * 0.3048) || !close(depth, d * 0.3048);
      }) ||
      s.eastRangeStoreys !== newer.eastRangeStoreys ||
      s.earlierRangeStoreys !== older.earlierCellRangeStoreys ||
      !close(s.floorToCeiling.earlierCells, older.earlierCellCeilingFeet * 0.3048) ||
      !close(s.floorToCeiling.eastCells, newer.eastRangeCeilingFeet * 0.3048) ||
      s.terraceFloors.exercise >= s.terraceFloors.work ||
      controls.representedDate !== '1903-01-01'
    )
      return fail('lyttelton-courtyard-and-storey-dimensions-disagree');

    const data = councilSite.properties,
      identity = frame.mappedIdentity;
    const [lon, lat] = frame.anchor;
    const m = (6378137 * Math.PI) / 180;
    const c = Math.cos(frame.heading),
      sn = Math.sin(frame.heading);
    const scale = Math.cos((lat * Math.PI) / 180);
    const same = (points, local) =>
      points.length === local.length &&
      points.every(([a, b], i) => {
        const x = (a - lon) * m * scale;
        const z = -(b - lat) * m;
        return close(c * x - sn * z, local[i][0]) && close(sn * x + c * z, local[i][1]);
      });
    const legal = councilSite.geometry.coordinates[0].slice(0, -1);
    if (
      proof.nativeIdentity.councilItem !== 425 ||
      data.DPHeritageItemID !== 425 ||
      data.ScheduleReference !== 738 ||
      data.HeritageRegisterNumber !== 7353 ||
      identity.heritageListNumber !== 7353 ||
      identity.councilScheduleReference !== 738 ||
      legal.length !== 26 ||
      !same(legal, frame.geometry.polygons[0]) ||
      ![38319453, 38319454].every(
        (id, i) =>
          ways[i]?.id === id &&
          ways[i].tags.name === 'Gaol Steps' &&
          same(ways[i].coordinates, frame.geometry.centerlines[i]),
      )
    )
      return fail('lyttelton-native-protected-site-or-steps-changed');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The council’s original 26-corner site and surviving steps locate the operating gaol. Period court measurements and storey records inform a terraced reconstruction. Historic building boundaries, entrance details and absolute heights remain estimates.',
    };
  } catch {
    return fail('lyttelton-primary-facts-invalid');
  }
}
