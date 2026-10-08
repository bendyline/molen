/** Preserve official IGN ground samples independently of authored bridge geometry. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { modelInputHash } from '../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  knownSourceEntries,
  structureSourcePath,
} from '../../../packages/worldgen/scripts/structure-source-paths.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = resolve(root, 'content/earth/structures/evidence/bridge-terrain/ign');
const cache = resolve(root, '.artifacts/bridge-terrain/ign');
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const ids = (process.argv.find((arg) => arg.startsWith('--ids='))?.slice(6) ?? 'N0019,N0026').split(
  ',',
);
const offline = process.argv.includes('--offline');
const endpoint = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json';
const resource = 'ign_rge_alti_wld';
await mkdir(cache, { recursive: true });
await mkdir(output, { recursive: true });
for (const id of ids) {
  if (!['N0019', 'N0026', 'N0028'].includes(id))
    throw new Error(`No reviewed IGN grid settings for ${id}`);
  const folder = knownSourceEntries().find((entry) => entry.candidateId === id)?.key;
  if (!folder) throw new Error(`Missing model ${id}`);
  const specBytes = await readFile(structureSourcePath(folder, 'spec.json'));
  const spec = JSON.parse(specBytes);
  const inputHash = await modelInputHash(
    dirname(structureSourcePath(folder, 'spec.json')),
    spec.assetId,
  );
  const { anchor, heading } = spec.geographicProposal;
  const factor = Math.cos((anchor[1] * Math.PI) / 180),
    radius = 6378137;
  const center = [
    ((anchor[0] * Math.PI) / 180) * radius * factor,
    -radius * Math.asinh(Math.tan((anchor[1] * Math.PI) / 180)) * factor,
  ];
  const size = id === 'N0019' ? 256 : 768;
  const resolution = id === 'N0019' ? 129 : 257;
  const origin = center.map((value) => value - size / 2);
  const coordinates = [];
  for (let row = 0; row < resolution; row++)
    for (let col = 0; col < resolution; col++) {
      const x = origin[0] + (col * size) / (resolution - 1);
      const z = origin[1] + (row * size) / (resolution - 1);
      coordinates.push([
        ((x / factor / radius) * 180) / Math.PI,
        (Math.atan(Math.sinh(-z / factor / radius)) * 180) / Math.PI,
      ]);
    }
  const heights = [],
    sources = [];
  for (let offset = 0; offset < coordinates.length; offset += 4000) {
    const points = coordinates.slice(offset, offset + 4000);
    const requestBytes = Buffer.from(
      JSON.stringify({
        lon: points.map((point) => point[0].toFixed(10)).join('|'),
        lat: points.map((point) => point[1].toFixed(10)).join('|'),
        resource,
        delimiter: '|',
        indent: 'false',
        measures: 'false',
        zonly: 'true',
      }),
    );
    const key = `${id}-${offset}-${hash(requestBytes).slice(7, 23)}`;
    const requestPath = resolve(cache, `${key}-request.json`);
    const responsePath = resolve(cache, `${key}-response.json`);
    let bytes = await readFile(responsePath).catch(() => undefined);
    if (!bytes) {
      if (offline) throw new Error(`No cached response ${key}`);
      await writeFile(requestPath, requestBytes);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: requestBytes,
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) throw new Error(`IGN ${id}/${offset}: HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(responsePath, bytes);
      // The documented service limit is five requests per second.
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const result = JSON.parse(bytes).elevations;
    if (
      !Array.isArray(result) ||
      result.length !== points.length ||
      result.some((value) => !Number.isFinite(value) || value === -99999)
    )
      throw new Error(`Invalid/uncovered IGN result ${key}`);
    heights.push(...result);
    sources.push({
      url: endpoint,
      method: 'POST',
      resource,
      offset,
      count: points.length,
      requestPath: `.artifacts/bridge-terrain/ign/${key}-request.json`,
      requestHash: hash(requestBytes),
      responsePath: `.artifacts/bridge-terrain/ign/${key}-response.json`,
      responseHash: hash(bytes),
    });
  }
  const document = {
    format: 'molen/bridge-terrain-evidence@1',
    candidateId: id,
    title: spec.title,
    modelFolder: folder,
    inputHash,
    anchor,
    heading,
    factor,
    worldCenter: center,
    worldOrigin: origin,
    size,
    resolution,
    heightRange: [Math.min(...heights), Math.max(...heights)],
    anchorElevation: heights[(heights.length - 1) / 2],
    heights,
    sources,
    reviewHalfLength: id === 'N0019' ? 33.6 : id === 'N0026' ? 156.25 : 98.4,
    reviewDeckHeight: id === 'N0019' ? 8.2 : id === 'N0026' ? 15 : 9,
    ...(id === 'N0026'
      ? {
          // Sample a carriageway lane, avoiding the central barrier. These coordinates
          // follow the authored skew/curve, whose current spec is hash-bound above.
          reviewProbePoints: [-155.75, -117.1875, -78.125, 0, 78.125, 117.1875, 155.75].map((u) => {
            const t = Math.max(0, (u - 70) / 86.25);
            const dz = (-8.5 * (17.15 + 3.42 * t * t)) / 17.3;
            return [u - 1.182 - 0.56 * dz, -3.938 + (u + 156.25) * 0.0315 - 6.426 * t * t + dz];
          }),
          reviewProbeBasis:
            'Negative-Z carriageway lane; follows skewed/curved authored plan. The motorway continues on elevated ramps beyond both modeled ends, so ground clearance there is not by itself an approach-disconnection test.',
          reviewCameraRange: 328.125,
          reviewCameraFov: 55,
        }
      : id === 'N0028'
        ? {
            reviewProbePoints: [-101.4, -74, -49, 0, 49, 74, 96.1].map((x) => [x, 0]),
            reviewProbeBasis:
              'Current modeled road endpoints are asymmetric (-101.9/+96.6 m). Probe 0.5 m inside each endpoint and retain unmodified IGN ground values; upper road bank stations beyond the modeled endpoints are preserved separately in N0028-bank-profile.json.',
          }
        : {}),
    sourceLabel: 'IGN RGE ALTI ground elevation (NGF-IGN69)',
    verticalDatum: 'NGF-IGN69 (metropolitan France)',
    attribution: 'IGN RGE ALTI, Licence Ouverte Etalab 2.0',
    attributionUrl: 'https://www.data.gouv.fr/datasets/rge-alti-r',
    resourceUrl: `https://data.geopf.fr/altimetrie/resources/${resource}`,
    method:
      'Original official elevation service values on a metric world grid. No bridge fitting, channel carving, flattening or vertical conversion.',
    references: [
      'https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/calcul-altimetrique/',
      'https://data.geopf.fr/annexes/ressources/documentation/DC_RGEALTI_2-0.pdf',
    ],
    limitations: [
      'Query spacing is not a guarantee of source resolution or vertical accuracy. The service reports variable source-dependent accuracy.',
      'RGE ALTI represents ground and modeled water surfaces, not bathymetry. Submerged foundation fitting requires separate evidence.',
      'Historical model elevation datums must be compared with current bank surfaces and documentary references before approval.',
    ],
  };
  await writeFile(resolve(output, `${id}.json`), `${JSON.stringify(document, null, 2)}\n`);
  console.log(
    `${id}: ${resolution}x${resolution}, ${size} m, anchor ${document.anchorElevation} m, ${sources.length} preserved IGN responses`,
  );
}
