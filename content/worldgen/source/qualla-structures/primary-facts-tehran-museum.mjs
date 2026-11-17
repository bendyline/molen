import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const tehranMuseumCase = 'tehran-contemporary-art-native-outline-and-noorgirs';
export const tehranMuseumModel = 'tehran_museum_of_contemporary_art';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function load(dir, record, file) {
  if (record?.path !== file) throw Error('Unexpected museum evidence path');
  const bytes = readFileSync(join(dir, file));
  if (hash(bytes) !== record.sha256) throw Error('Museum evidence hash mismatch');
  return JSON.parse(bytes);
}

export function inspectTehranMuseumPrimaryFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const sources = load(dir, proof.primarySources, 'reference-rights/tehran-museum-facts.json');
    const excluded = load(
      dir,
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const native = load(dir, proof.nativeIdentity, 'native-map/osm-tehran-contemporary-art.json');
    const find = (url) => sources.sources.find((record) => record.url === url)?.facts;
    const architect = find(
      'https://www.ardalanassociates.com/tehran-museum-of-contemporary-art.html',
    );
    const archive = find('https://www.archnet.org/sites/75');
    const material = find(
      'https://s3.amazonaws.com/media.archnet.org/system/publications/contents/5314/original/DPC2055.pdf',
    );
    const reasons = new Map(
      excluded.candidates.map(({ sourceUrl, reason }) => [sourceUrl, reason]),
    );
    if (
      sources.mode !== 'factual-text-only' ||
      sources.imageryUsed !== false ||
      proof.primarySources.use !== sources.mode ||
      architect?.completed !== 1977 ||
      architect.court !== 'open central sculpture court' ||
      archive?.roofDirection !== 'steps down north from main hall' ||
      archive.copperClad !== true ||
      material?.foyerHallCatchers !== 4 ||
      material.courtLevels !== 'terraced' ||
      material.baseWall !== 'orange sawn stone' ||
      excluded.selectedImages !== 0 ||
      !inventory.candidates.every(({ sourceUrl }) => reasons.get(sourceUrl)?.trim())
    )
      return fail('tehran-museum-written-sources-or-exclusions-unbound');

    const building = native.elements.find(({ id, type }) => id === 601652789 && type === 'way');
    const site = native.elements.find(({ id, type }) => id === 641200650 && type === 'way');
    const nodes = new Map(
      native.elements.filter(({ type }) => type === 'node').map((n) => [n.id, n]),
    );
    const entrance = nodes.get(8164794375);
    const [lon, lat] = frame.anchor;
    const angle = frame.heading;
    const m = (Math.PI * 6378137) / 180;
    const matches = (node, [a, b]) => {
      const x = (node.lon - lon) * m * Math.cos((lat * Math.PI) / 180);
      const z = (lat - node.lat) * m;
      return (
        Math.hypot(
          Math.cos(angle) * x - Math.sin(angle) * z - a,
          Math.sin(angle) * x + Math.cos(angle) * z - b,
        ) < 0.000008
      );
    };
    const outline = frame.geometry.outline;
    if (
      building?.tags.building !== 'public' ||
      building.tags.wikidata !== 'Q5873838' ||
      building.id !== proof.nativeIdentity.way ||
      site?.tags.wikidata !== 'Q1756399' ||
      site.tags.name !== building.tags.name ||
      site.tags.wikidata !== frame.mappedIdentity.wikidataId ||
      entrance?.tags.entrance !== 'main' ||
      !building.nodes.includes(entrance.id) ||
      !matches(entrance, frame.terrainContact.local) ||
      outline.length !== 103 ||
      building.nodes.length - 1 !== outline.length ||
      !building.nodes.slice(0, -1).every((id, i) => matches(nodes.get(id), outline[i])) ||
      controls.model !== tehranMuseumModel ||
      controls.section.estimated !== true ||
      controls.section.hallCatchers.length !== material.foyerHallCatchers ||
      controls.section.court.length < 6 ||
      !controls.section.court.flat().every(Number.isFinite) ||
      !controls.section.roofTiers.every(
        ([x, y], i, rows) =>
          Number.isFinite(x) && (!i || (x > rows[i - 1][0] && y > rows[i - 1][1])),
      )
    )
      return fail('tehran-museum-native-geometry-or-estimates-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The named building, grounds and main entrance agree with the native map. Written sources establish the stepped roofs, sunken sculpture court and copper-clad light catchers. Interior boundaries and heights are estimates.',
    };
  } catch {
    return fail('tehran-museum-primary-facts-invalid');
  }
}
