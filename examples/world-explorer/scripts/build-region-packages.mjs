import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEFAULT_WORLD_REGION, WORLD_REGIONS } from '../src/regions.ts';

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

const regionId = argument('--region');
const regions = WORLD_REGIONS.filter((region) =>
  regionId ? region.id === regionId : region.id !== DEFAULT_WORLD_REGION.id,
);
if (regions.length === 0) throw new Error(`Unknown region: ${regionId}`);
const pmtilesCli = argument('--pmtiles-cli', process.env.PMTILES_CLI);
if (!pmtilesCli)
  throw new Error('--pmtiles-cli or PMTILES_CLI must name the go-pmtiles executable');
const version = argument('--version', '2026-10-23');
const vectorUrl = argument(
  '--vector-url',
  `https://build.protomaps.com/${version.replaceAll('-', '')}.pmtiles`,
);
const elevationRelease = argument(
  '--elevation-release',
  'AWS open-data snapshot accessed 2026-10-23',
);
const builder = fileURLToPath(new URL('./build-sammamish-package.mjs', import.meta.url));
const globalElevationCredit = {
  text: 'NOAA ETOPO1; Global ETOPO1 terrain data, U.S. National Oceanic and Atmospheric Administration',
  license: 'US public domain',
  licenseUrl: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md#etopo1',
};
const regionalElevationCredits = {
  sydney: {
    text: 'Geoscience Australia; Australia terrain data © Commonwealth of Australia (Geoscience Australia) 2017',
    license: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  yuma: {
    text: 'INEGI; Mexico terrain data source: INEGI, Continental relief, 2016',
    license: 'INEGI free use of information',
    licenseUrl: 'https://www.inegi.org.mx/inegi/terminos.html',
  },
};

for (const region of regions) {
  const extraCredits = [globalElevationCredit];
  if (regionalElevationCredits[region.id]) extraCredits.push(regionalElevationCredits[region.id]);
  const args = [
    builder,
    '--pmtiles-cli',
    pmtilesCli,
    '--output',
    fileURLToPath(new URL(`../public/terrain/${region.id}`, import.meta.url)),
    '--name',
    region.label,
    '--bbox',
    region.detailBounds.join(','),
    '--coverage-bbox',
    region.coverageBounds.join(','),
    '--version',
    version,
    '--vector-url',
    vectorUrl,
    '--elevation-release',
    elevationRelease,
    '--extra-elevation-attribution',
    JSON.stringify(extraCredits),
  ];
  if (process.argv.includes('--skip-vector')) args.push('--skip-vector');
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${region.label} build exited with code ${code}`)),
    );
  });
}
