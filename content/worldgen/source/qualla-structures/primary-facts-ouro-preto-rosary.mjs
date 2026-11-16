import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const ouroPretoRosaryCase = 'ouro-preto-rosary-mapped-double-oval-church';
export const ouroPretoRosaryModel = 'church_of_our_lady_of_the_rosary_of_black_men_ouro_preto';
const city = 'https://www.ouropreto.mg.gov.br/turismo/atrativo-item/593';
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export function inspectOuroPretoRosaryFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  function read(record, expected) {
    const bytes = fs.readFileSync(path.join(dir, expected));
    if (record.path !== expected || hash(bytes) !== record.sha256)
      throw new Error('Evidence path or hash mismatch');
    return JSON.parse(bytes);
  }
  try {
    const sources = read(proof.primarySources, 'reference-rights/church-facts.json');
    const excluded = read(
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const native = read(proof.nativeIdentity, 'native-map/footprint.json');
    const church = sources.sources.find(({ url }) => url === city)?.facts;
    const rejected = new Set(
      excluded.candidates.filter(({ reason }) => reason).map(({ path }) => path),
    );
    if (
      sources.imageryUsed !== false ||
      church?.mainRooms !== 'interlocking elliptical nave and chancel' ||
      church?.bellTowers !== 'two cylindrical towers' ||
      church?.pediment !== 'compound curves' ||
      excluded.selectedImages !== 0 ||
      !inventory.candidates.every(({ path }) => rejected.has(path))
    )
      return fail('ouro-preto-architecture-or-image-exclusions-unbound');
    const way = native.elements.find(
      (item) => item.type === 'way' && item.id === proof.nativeIdentity.way,
    );
    const nodes = new Map(
      native.elements.filter((item) => item.type === 'node').map((item) => [item.id, item]),
    );
    const [lon, lat] = frame.anchor;
    const scale = (Math.PI / 180) * 6378137;
    const xScale = scale * Math.cos((Math.PI / 180) * lat);
    if (
      way?.id !== 194416472 ||
      way.tags.name !== 'Igreja de Nossa Senhora do Rosário dos Pretos' ||
      way.tags.building !== 'church' ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      frame.heading !== 0 ||
      frame.geometry.outline.length !== way.nodes.length - 1 ||
      controls.dimensions.facadeArches !== 3 ||
      controls.dimensions.towers.length !== 2 ||
      !frame.geometry.outline.every(([x, z], i) => {
        const node = nodes.get(way.nodes[i]);
        return Math.hypot((node.lon - lon) * xScale - x, (lat - node.lat) * scale - z) < 0.001;
      })
    )
      return fail('ouro-preto-footprint-or-facade-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Municipal and historical architectural sources describe the double oval, round towers and bowed three-bay front. Site geometry follows the named 47-point mapped footprint. Exact sections and ornaments are estimates.',
    };
  } catch {
    return fail('ouro-preto-evidence-invalid');
  }
}
