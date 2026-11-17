import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const yahLehMonumentCase = 'sanam-chandra-yah-leh-measured-inscription-and-cast';
export const yahLehMonumentModel = 'yah_leh_monument';
const archive = 'https://db.sac.or.th/inscriptions/inscribe/detail/937';
const inventory = 'https://api.tat.or.th/upload/live/multimedia/9068/T_Nakhonpathom.pdf';
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function readPin(dir, pin, name) {
  if (pin?.path !== name) throw Error('Unexpected Yah Leh evidence path');
  const bytes = readFileSync(join(dir, name));
  if (hash(bytes) !== pin.sha256) throw Error('Unbound Yah Leh evidence');
  return JSON.parse(bytes);
}

export function inspectYahLehMonumentFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const facts = readPin(
      dir,
      proof.primarySources,
      'reference-rights/yah-leh-monument-facts.json',
    );
    const native = readPin(dir, proof.nativeIdentity, 'native-map/yah-leh-monument.json');
    const point = native.elements.find((node) => node.type === 'node' && node.id === 1123345225);
    if (
      point?.tags?.historic !== 'monument' ||
      point.tags['name:en'] !== 'Yale (Jarlet)’s Monument' ||
      frame.mappedIdentity.name !== point.tags.name ||
      !frame.mappedIdentity.featureIds.includes(`node/${point.id}`) ||
      frame.sourceUrl !== `https://www.openstreetmap.org/node/${point.id}` ||
      !frame.anchor.every(
        (value, index) => Math.abs(value - [point.lon, point.lat][index]) < 1e-9,
      ) ||
      !frame.geometry.point.every((value) => value === 0)
    )
      return fail('yah-leh-named-monument-point-unbound');

    const { plaque, figure } = controls.dimensions;
    if (
      facts.mode !== 'factual-text-only' ||
      facts.imageryUsed !== false ||
      ![archive, inventory].every((url) => facts.sources.some((source) => source.url === url)) ||
      facts.inscription.accession !== 'นฐ. 13' ||
      facts.inscription.width !== 1.12 ||
      facts.inscription.height !== 0.66 ||
      facts.inscription.thickness !== 0.003 ||
      plaque.width !== facts.inscription.width ||
      plaque.height !== facts.inscription.height ||
      plaque.thickness !== facts.inscription.thickness ||
      facts.figure.cast !== 'life-size copper alloy' ||
      facts.figure.pose !== 'standing' ||
      !facts.figure.features.includes('bushy tail') ||
      !facts.figure.features.includes('dropped ears') ||
      !(
        figure.shoulderHeight > 0 &&
        figure.shoulderHeight < figure.headHeight &&
        figure.headHeight < 1.1
      )
    )
      return fail('yah-leh-recorded-material-and-figure-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The named monument point, measured bronze plaque and documented cast supply the site and scale. Pedestal profile, standing pose details and facing are estimates.',
    };
  } catch {
    return fail('yah-leh-primary-facts-invalid');
  }
}
