import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const tePuawanangaCase = 'auckland-motat-building-5-linz-2024';
export const tePuawanangaModel = 'te_puawananga_auckland';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
function readEvidence(dir, proof, file) {
  if (proof?.path !== file) throw new Error(`Unexpected Te Puawānanga source ${file}`);
  const bytes = fs.readFileSync(path.join(dir, file));
  if (hash(bytes) !== proof.sha256) throw new Error(`Te Puawānanga evidence changed: ${file}`);
  return JSON.parse(bytes);
}

export function inspectTePuawanangaPrimaryFacts({ dir, proof, controls, frame, inventory }) {
  try {
    const architecture = readEvidence(
      dir,
      proof.primarySources,
      'reference-rights/building-5-facts.json',
    );
    const exclusions = readEvidence(
      dir,
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const native = readEvidence(dir, proof.nativeIdentity, 'native-map/footprint.json');
    const field = readEvidence(
      dir,
      proof.elevationSections,
      'native-map/linz-height-controls.json',
    );
    const owner = architecture.sources.find(
      ({ url }) => url === 'https://motat.nz/exhibitions/science-and-technology-centre/',
    );
    const builder = architecture.sources.find(
      ({ url }) => url === 'https://c3construction.co.nz/project/motat-building/',
    );
    const interior = architecture.sources.find(
      ({ url }) =>
        url ===
        'https://jacobsen.co.nz/commercial/projects/public-spaces/te-puawananga-science-and-technology-centre-at-mot/',
    );
    const names = new Map(
      exclusions.candidates.map((candidate) => [candidate.sourceUrl, candidate.reason]),
    );
    const way = native.elements.find(
      (element) => element.type === 'way' && element.id === 221116589,
    );
    const nodes = new Map(
      native.elements
        .filter((element) => element.type === 'node')
        .map((element) => [element.id, element]),
    );
    const [lon, lat] = frame.anchor;
    const metre = (Math.PI / 180) * 6378137;
    const eastMetre = metre * Math.cos((lat * Math.PI) / 180);
    const c = Math.cos(frame.heading),
      s = Math.sin(frame.heading);
    const withinFrame = (node, [x, z]) => {
      const east = (node.lon - lon) * eastMetre;
      const south = (lat - node.lat) * metre;
      return Math.hypot(c * east - s * south - x, s * east + c * south - z) < 0.002;
    };
    if (
      architecture.mode !== 'factual-text-only' ||
      architecture.imageryUsed !== false ||
      owner?.building !== 5 ||
      owner.opened !== 2024 ||
      builder?.work !== 'roof over existing tin warehouse roof' ||
      builder.year !== 2023 ||
      interior?.floorAreaSquareMeters !== 2200 ||
      exclusions.selectedImages !== 0 ||
      !inventory.candidates.every((r) => names.get(r.sourceUrl)?.trim()) ||
      !way ||
      way.tags.name !== frame.mappedIdentity.name ||
      way.tags['name:mi'] !== 'Te Puawānanga' ||
      frame.geometry.outline.length !== way.nodes.length - 1 ||
      !way.nodes
        .slice(0, -1)
        .every((id, i) => withinFrame(nodes.get(id), frame.geometry.outline[i]))
    )
      return { status: 'needs-review', reason: 'motat-building-5-identity-or-evidence-unbound' };

    const section = controls.section;
    const controlsFrame = field.inputFrame;
    const points = new Map(
      field.samples.map(([x, z, surface, ground]) => [`${x},${z}`, [surface, ground]]),
    );
    const centralNorth = points.get('0,-17'),
      centralSouth = points.get('0,19'),
      eastBay = points.get('19,0');
    const [north, south, bay] = [centralNorth, centralSouth, eastBay].map((point) => point[0]);
    if (
      field.sourceCrs !== 'NZGD2000 / New Zealand Transverse Mercator 2000 (EPSG:2193)' ||
      field.verticalDatum !== 'NZVD2016' ||
      field.dataset !== 'Auckland Part 1 LiDAR 1 m, captured 2024' ||
      field.samples.length < 1800 ||
      controlsFrame.heading !== frame.heading ||
      !controlsFrame.anchor.every((v, i) => v === frame.anchor[i]) ||
      !Object.values(field.sourceTiles).every(
        (t) =>
          /^https:\/\/nz-elevation\.s3\.ap-southeast-2\.amazonaws\.com\/.+BA31_10000_0405\.tiff$/.test(
            t.url,
          ) && /^[a-f0-9]{64}$/.test(t.sha256),
      ) ||
      Math.abs(section.mainSlope - (south - north) / 36) > 0.015 ||
      !(section.eastBayHeight < section.mainEaveNorth + 0.1) ||
      eastBay[1] > bay ||
      Math.abs(section.linzDatum + section.eastBayHeight - bay) > 0.5
    )
      return { status: 'needs-review', reason: 'motat-building-5-elevation-controls-unbound' };
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The museum and contractor identify the converted building and roof. Its mapped footprint and numerical 2024 LiDAR observations constrain the shallow slope and lower bay. Exterior finishes and openings are interpreted.',
    };
  } catch {
    return { status: 'needs-review', reason: 'motat-building-5-facts-invalid' };
  }
}
