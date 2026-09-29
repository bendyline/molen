/** Fit the authored +X-south/main-span origin to paired mapped carriageways. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatJson } from '../../worldgen/scripts/format-json.mjs';
import { metricFrame } from './structure-map-geometry.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const evidence = JSON.parse(
  await readFile(resolve(root, 'content/earth/structures/evidence/osm-features.json'), 'utf8'),
);
const ids = [175399633, 175405231];
const ways = ids.map((id) =>
  evidence.elements.find((element) => element.type === 'way' && element.id === id),
);
if (ways.some((way) => way?.tags?.wikidata !== 'Q504710' || way.geometry?.length < 2))
  throw new Error('Pont de Normandie requires its two exact mapped carriageways');
const ends = ways.map((way) =>
  [way.geometry[0], way.geometry.at(-1)].sort((a, b) => a.lat - b.lat),
);
const mean = (points) => [
  points.reduce((sum, point) => sum + point.lon, 0) / points.length,
  points.reduce((sum, point) => sum + point.lat, 0) / points.length,
];
const south = mean(ends.map((end) => end[0])),
  north = mean(ends.map((end) => end[1]));
const anchor = [(south[0] + north[0]) / 2, (south[1] + north[1]) / 2];
const frame = metricFrame(anchor),
  southMeters = frame.project(south),
  northMeters = frame.project(north);
const heading = Math.atan2(southMeters[1] - northMeters[1], southMeters[0] - northMeters[0]);
const c = Math.cos(heading),
  s = Math.sin(heading);
const outline = evidence.elements.find(
  (element) => element.type === 'way' && element.id === 440837974,
);
if (!outline?.geometry) throw new Error('Missing mapped full bridge outline');
const local = outline.geometry.map(({ lon, lat }) => {
  const [east, northing] = frame.project([lon, lat]);
  return [c * east + s * northing, s * east - c * northing];
});
const output = {
  format: 'molen/structure-alignment-study@1',
  candidateId: 'N0002',
  wikidataId: 'Q504710',
  title: 'Pont de Normandie',
  asset: 'molen.worldgen.structure.n0002_pont_de_normandie',
  anchor,
  heading,
  authoredAxis: '+X south, +Y up; horizontal origin halfway between main-span pylon stations',
  measuredPlan: {
    mainSpanBetweenRoadTransitions: Math.hypot(
      southMeters[0] - northMeters[0],
      southMeters[1] - northMeters[1],
    ),
    southEndpoint: south,
    northEndpoint: north,
    fullExtentX: [
      Math.min(...local.map((point) => point[0])),
      Math.max(...local.map((point) => point[0])),
    ],
    fullOutlineLocalXZ: local,
  },
  modelPlan: {
    mainSpan: 856,
    northEndX: -1165.625,
    southEndX: 975.625,
    width: 23.6,
    totalLength: 2141.25,
  },
  verticalDatum: {
    source: 'CMH (Cote Marine du Havre)',
    documentedTargetDatum: 'NGF/IGN69',
    documentedConversionMeters: -4.378,
    documentedConversionSources: [
      'https://www.seine-aval.fr/glossaire/cote-marine-du-havre/',
      'https://www.normandie.developpement-durable.gouv.fr/IMG/pdf/TRI_Le_Havre_Rapport_V5_cle0b1356.pdf',
    ],
    modernChartZeroIgn69Meters: -4.371,
    modernChartZeroSource: 'https://refmar.shom.fr/dataArchaeology/realisations/port-du-havre',
    runtimeDatum: null,
    conversionMeters: null,
    status: 'runtime-datum-unresolved',
    note: 'The operator drawing uses the legacy CMH marine datum. DREAL and Seine-Aval document CMH = IGN69 + 4.378 m. SHOM reports chart zero at -4.371 m IGN69 since 2006, a 7 mm version difference. The viewer has no declared IGN69/EGM96 transform; do not silently equate IGN69 to its global sea-level or terrain elevation.',
  },
  horizontalStatus: 'mapped-axis',
  visualPlacementVerified: false,
  sources: ids.concat(440837974).map((id) => `https://www.openstreetmap.org/way/${id}`),
  geometryLicense: 'ODbL-1.0',
  attribution: '© OpenStreetMap contributors',
  sourceCapturedAt: evidence.capturedAt,
  note: 'Mapped roadway transition spacing differs from the published 856 m main span by about 4 m. This supplies a measured map frame and a sourced CMH-to-IGN69 conversion; runtime terrain-datum conversion and in-terrain visual fitting remain open.',
};
const path = resolve(root, 'content/earth/structures/alignments/n0002_pont_de_normandie.json');
await mkdir(dirname(path), { recursive: true });
await writeFile(path, `${formatJson(output)}\n`);
if (process.argv.includes('--register-draft')) {
  const catalogPath = resolve(root, 'content/earth/structures/placements.json');
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const id = 'france.pont-de-normandie';
  const existing = catalog.entries.find((entry) => entry.id === id);
  if (existing?.status === 'preview')
    throw new Error('Refusing to overwrite a reviewed active placement with a draft');
  const entry = {
    id,
    title: output.title,
    asset: output.asset,
    anchor,
    heading,
    minLevel: 11,
    status: 'draft',
    source: 'https://www.openstreetmap.org/way/440837974',
    note: 'Exact OSM bridge identity and paired carriageways establish the main-span midpoint and +X south axis. Authored Y is CMH; CMH-to-IGN69 offset is -4.378 m, but the host terrain datum and in-terrain fit remain unverified. Draft does not draw or replace roads. See structures/alignments/n0002_pont_de_normandie.json in the authoring source for measurements and sources. © OpenStreetMap contributors.',
  };
  catalog.entries = catalog.entries.filter((item) => item.id !== id);
  catalog.entries.push(entry);
  await writeFile(catalogPath, `${formatJson(catalog)}\n`);
}
console.log(JSON.stringify({ anchor, heading, extent: output.measuredPlan.fullExtentX }));
