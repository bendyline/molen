import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const montrealMuseumCases = {
  'montreal-museum-stewart-native-pavilion-and-architectural-facts':
    'montreal_museum_stewart_pavilion',
  'montreal-museum-desmarais-native-pavilion-and-architectural-facts':
    'montreal_museum_desmarais_pavilion',
  'montreal-museum-peace-native-pavilion-and-architectural-facts':
    'montreal_museum_pavilion_for_peace',
};

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
function pinned(dir, record, name) {
  const bytes = fs.readFileSync(path.join(dir, name));
  if (record.path !== name || record.sha256 !== hash(bytes)) throw Error('Evidence differs');
  return JSON.parse(bytes);
}
const features = { stewart: 107102804, desmarais: 20210130, peace: 374066805 };
const description = {
  stewart:
    'The museum identifies two gallery levels and Fred Lebensold’s Brutalist addition. The native party wall, broad concrete slabs and recessed glazing guide the reconstruction.',
  desmarais:
    'Safdie’s archive identifies the marble entry and retained five-storey brick and stone building. Distinct façade elements are estimated within the mapped four-level museum envelope.',
  peace:
    'The museum and architect describe six levels set in two rotated glazed volumes, aluminum strips and white roofs. Heights and strip spacing are estimated within the mapped envelope.',
};
function documented(kind, sources, dimensions) {
  const facts = (url) => sources.find((source) => source.url === url)?.facts;
  if (kind === 'stewart') {
    const museum = facts('https://www.mbam.qc.ca/en/exhibitions/13488/');
    const heritage = facts(
      'https://blog.heritagemontreal.org/en/musee-des-beaux-arts-de-montreal/',
    );
    return (
      museum?.publicGalleryLevels === 2 &&
      dimensions.publicLevels === 2 &&
      museum.architect === 'Fred David Lebensold' &&
      heritage?.constructionYear === 1976 &&
      heritage.exteriorMaterial === 'concrete'
    );
  }
  if (kind === 'desmarais') {
    const archive = facts(
      'https://cac.mcgill.ca/moshesafdie/virtualexhibit/projectcovers/mmfa/intro.htm',
    );
    return (
      archive?.architect === 'Moshe Safdie' &&
      archive.retainedApartmentYear === 1905 &&
      archive.retainedApartmentStoreys === dimensions.historyLevels &&
      archive.newFrontMaterial === 'Vermont white marble' &&
      archive.preservedCrescentStreetRowhouses === true &&
      dimensions.modernLevels === 4
    );
  }
  const architect = facts(
    'https://archives.jlp.ca/en/project/montreal-museum-of-fine-arts-michal-and-renata-hornstein-pavilion-for-peace/',
  );
  return (
    architect?.levels === 6 &&
    dimensions.levels === 6 &&
    architect.glazedVolumes === dimensions.volumes &&
    dimensions.volumes === 2 &&
    architect.screen === 'aluminum strips' &&
    architect.volumesRotated === true &&
    architect.roofs === 'white'
  );
}

/** Resolve each pavilion through its own native building way and design evidence. */
export function inspectMontrealMuseumFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const archive = pinned(
      dir,
      proof.primarySources,
      'reference-rights/pavilion-architecture-facts.json',
    );
    const excluded = pinned(
      dir,
      proof.candidateExclusion,
      'reference-rights/parent-story-image-exclusions.json',
    );
    const native = pinned(dir, proof.nativeIdentity, 'native-map/pavilion-way.json');
    const dimensions = controls.dimensions,
      kind = dimensions.kind;
    const way = features[kind],
      rejected = new Map(excluded.candidates.map((row) => [row.path, row]));
    if (
      archive.mode !== 'factual-text-only' ||
      archive.imageryUsed !== false ||
      archive.pavilion !== kind ||
      !documented(kind, archive.sources, dimensions) ||
      excluded.selectedImages !== 0 ||
      rejected.size !== inventory.candidates.length ||
      !inventory.candidates.every(
        ({ path, sourceUrl, license }) =>
          rejected.get(path)?.sourceUrl === sourceUrl && rejected.get(path)?.license === license,
      )
    )
      return fail('montreal-pavilion-written-facts-or-image-exclusions-unbound');

    const [lon, lat] = frame.anchor;
    const rad = Math.PI / 180,
      m = 6378137 * rad,
      sx = m * Math.cos(lat * rad);
    const c = Math.cos(frame.heading),
      s = Math.sin(frame.heading);
    const matches = (geometry, points) => {
      if (points.length !== geometry.length - 1) return false;
      return geometry.slice(0, -1).every(({ lon: x, lat: y }, i) => {
        const dx = (x - lon) * sx,
          dz = (lat - y) * m;
        return Math.hypot(c * dx - s * dz - points[i][0], s * dx + c * dz - points[i][1]) < 0.001;
      });
    };
    if (
      native.groupIdentity.id !== 213716077 ||
      native.groupIdentity.tags.wikidata !== 'Q860812' ||
      !way ||
      native.pavilion.id !== way ||
      proof.nativeIdentity.way !== way ||
      dimensions.way !== way ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      !frame.mappedIdentity.wayIds.includes(way) ||
      !matches(native.pavilion.geometry, frame.geometry.outline) ||
      !matches(native.pavilion.geometry, dimensions.footprint) ||
      (kind === 'desmarais' &&
        (native.connector.id !== 21347837 ||
          !matches(native.connector.geometry, dimensions.connector)))
    )
      return fail('montreal-pavilion-native-footprint-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes: description[kind],
    };
  } catch {
    return fail('montreal-pavilion-primary-facts-invalid');
  }
}
