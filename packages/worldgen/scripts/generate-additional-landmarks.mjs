/** Additional individual studies reuse the source pipeline without changing earlier recipes. */

import { aleppoStudy } from './aleppo-citadel-model.mjs';
import { bamburghStudy } from './bamburgh-castle-model.mjs';
import { cardiffStudy } from './cardiff-castle-model.mjs';
import { cashelStudy } from './cashel-ruins-model.mjs';
import { chinonStudy } from './chinon-castle-model.mjs';
import { dunnottarStudy } from './dunnottar-castle-model.mjs';
import { etchmiadzinStudy } from './etchmiadzin-cathedral-model.mjs';
import { florenceStudy } from './florence-cathedral-model.mjs';
import { harlechStudy } from './harlech-castle-model.mjs';
import { heverStudy } from './hever-castle-model.mjs';
import { holySepulchreStudy } from './holy-sepulchre-model.mjs';
import { krumlovStudy } from './krumlov-castle-model.mjs';
import { lalaStudy } from './lala-mustafa-mosque-model.mjs';
import { linlithgowStudy } from './linlithgow-palace-model.mjs';
import { loarreStudy } from './loarre-castle-model.mjs';
import { margatStudy } from './margat-castle-model.mjs';
import { moritzburgStudy } from './moritzburg-castle-model.mjs';
import { nevskyStudy } from './nevsky-cathedral-model.mjs';
import { olavinlinnaStudy } from './olavinlinna-castle-model.mjs';
import { pidhirtsiStudy } from './pidhirtsi-castle-model.mjs';
import { signatureTowers } from './signature-tower-models.mjs';
import { stMarksStudy } from './st-marks-basilica-model.mjs';
import { tintagelStudy } from './tintagel-castle-model.mjs';
import { tournaiStudy } from './tournai-cathedral-model.mjs';
import { wawelCathedralStudy } from './wawel-cathedral-model.mjs';

const additions = [
  margatStudy,
  tintagelStudy,
  heverStudy,
  cashelStudy,
  aleppoStudy,
  olavinlinnaStudy,
  harlechStudy,
  chinonStudy,
  loarreStudy,
  moritzburgStudy,
  bamburghStudy,
  krumlovStudy,
  linlithgowStudy,
  dunnottarStudy,
  pidhirtsiStudy,
  cardiffStudy,
  holySepulchreStudy,
  florenceStudy,
  stMarksStudy,
  nevskyStudy,
  tournaiStudy,
  etchmiadzinStudy,
  wawelCathedralStudy,
  lalaStudy,
];
signatureTowers.push(...additions);
if (!process.argv.some((arg) => arg.startsWith('--ids='))) {
  process.argv.push(`--ids=${additions.map((study) => study.id).join(',')}`);
}
await import('./generate-signature-towers.mjs');
