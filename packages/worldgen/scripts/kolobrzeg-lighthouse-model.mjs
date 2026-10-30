/** Detailed master correction; shared historical recipes remain byte-stable. */
import { addStairSupport } from '../../../content/worldgen/source/places/u3/u3e/kolobrzeg_lighthouse/models/stair-support.mjs';
import { buildKolobrzeg } from './lighthouse-south-baltic-models.mjs';

export function buildSupportedKolobrzeg(out) {
  buildKolobrzeg(out);
  addStairSupport(out);
}
