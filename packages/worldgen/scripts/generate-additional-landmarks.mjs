/** Additional individual studies reuse the source pipeline without changing earlier recipes. */

import { aleppoStudy } from './aleppo-citadel-model.mjs';
import { bamburghStudy } from './bamburgh-castle-model.mjs';
import { banjaCathedralStudy } from './banja-cathedral-model.mjs';
import { blackChurchStudy } from './black-church-model.mjs';
import { bratislavaStudy } from './bratislava-st-martin-model.mjs';
import { brnoPetrovStudy } from './brno-petrov-model.mjs';
import { cardiffStudy } from './cardiff-castle-model.mjs';
import { cashelStudy } from './cashel-ruins-model.mjs';
import { cefaluStudy } from './cefalu-cathedral-model.mjs';
import { chinonStudy } from './chinon-castle-model.mjs';
import { concepcionStudy } from './concepcion-cathedral-model.mjs';
import { crystalCathedralStudy } from './crystal-cathedral-model.mjs';
import { dresdenStudy } from './dresden-cathedral-model.mjs';
import { dubrovnikCathedralStudy } from './dubrovnik-cathedral-model.mjs';
import { dunnottarStudy } from './dunnottar-castle-model.mjs';
import { esztergomStudy } from './esztergom-model.mjs';
import { etchmiadzinStudy } from './etchmiadzin-cathedral-model.mjs';
import { euphrasianStudy } from './euphrasian-basilica-model.mjs';
import { florenceStudy } from './florence-cathedral-model.mjs';
import { freiburgMinsterStudy } from './freiburg-minster-model.mjs';
import { ghazanchetsotsStudy } from './ghazanchetsots-model.mjs';
import { glasgowCathedralStudy } from './glasgow-cathedral-model.mjs';
import { harlechStudy } from './harlech-castle-model.mjs';
import { havanaCathedralStudy } from './havana-cathedral-model.mjs';
import { heverStudy } from './hever-castle-model.mjs';
import { holySepulchreStudy } from './holy-sepulchre-model.mjs';
import { konigsbergStudy } from './konigsberg-cathedral-model.mjs';
import { krumlovStudy } from './krumlov-castle-model.mjs';
import { lalaStudy } from './lala-mustafa-mosque-model.mjs';
import { liegeCathedralStudy } from './liege-cathedral-model.mjs';
import { linlithgowStudy } from './linlithgow-palace-model.mjs';
import { ljubljanaStudy } from './ljubljana-cathedral-model.mjs';
import { loarreStudy } from './loarre-castle-model.mjs';
import { luccaStudy } from './lucca-model.mjs';
import { lvivStudy } from './lviv-georges-cathedral-model.mjs';
import { magdeburgStudy } from './magdeburg-cathedral-model.mjs';
import { margatStudy } from './margat-castle-model.mjs';
import { matthiasStudy } from './matthias-church-model.mjs';
import { mdinaStudy } from './mdina-model.mjs';
import { minskMaryStudy } from './minsk-mary-model.mjs';
import { modenaStudy } from './modena-cathedral-model.mjs';
import { monacoCathedralStudy } from './monaco-cathedral-model.mjs';
import { monrealeStudy } from './monreale-cathedral-model.mjs';
import { moritzburgStudy } from './moritzburg-castle-model.mjs';
import { nevskyStudy } from './nevsky-cathedral-model.mjs';
import { nidarosStudy } from './nidaros-cathedral-model.mjs';
import { nikortsmindaStudy } from './nikortsminda-model.mjs';
import { odesaStudy } from './odesa-cathedral-model.mjs';
import { olavinlinnaStudy } from './olavinlinna-castle-model.mjs';
import { pannonhalmaStudy } from './pannonhalma-archabbey-model.mjs';
import { pidhirtsiStudy } from './pidhirtsi-castle-model.mjs';
import { polotskSophiaStudy } from './polotsk-sophia-model.mjs';
import { poznanCathedralStudy } from './poznan-cathedral-model.mjs';
import { pristinaStudy } from './pristina-cathedral-model.mjs';
import { rigaStudy } from './riga-cathedral-model.mjs';
import { rioCathedralStudy } from './rio-cathedral-model.mjs';
import { sophiaStudy } from './saint-sophia-nicosia-model.mjs';
import { salzburgStudy } from './salzburg-cathedral-model.mjs';
import { samtavisiStudy } from './samtavisi-model.mjs';
import { sanNicolaBariStudy } from './san-nicola-bari-model.mjs';
import { sanThomeStudy } from './san-thome-model.mjs';
import { saoPauloCathedralStudy } from './sao-paulo-cathedral-model.mjs';
import { sarajevoOrthodoxStudy } from './sarajevo-orthodox-model.mjs';
import { sibenikStudy } from './sibenik-cathedral-model.mjs';
import { signatureTowers } from './signature-tower-models.mjs';
import { stBavoStudy } from './st-bavo-model.mjs';
import { gilesStudy } from './st-giles-cathedral-model.mjs';
import { stMarksStudy } from './st-marks-basilica-model.mjs';
import { stPierreStudy } from './st-pierre-model.mjs';
import { tallinnMaryStudy } from './tallinn-st-mary-model.mjs';
import { thessSophiaStudy } from './thessaloniki-sophia-model.mjs';
import { tintagelStudy } from './tintagel-castle-model.mjs';
import { tokyoMaryStudy } from './tokyo-st-mary-model.mjs';
import { tournaiStudy } from './tournai-cathedral-model.mjs';
import { turkuCathedralStudy } from './turku-cathedral-model.mjs';
import { uspenskiStudy } from './uspenski-model.mjs';
import { utrechtDomStudy } from './utrecht-dom-model.mjs';
import { vallettaStudy } from './valletta-st-john-model.mjs';
import { vankStudy } from './vank-cathedral-model.mjs';
import { vilniusStudy } from './vilnius-cathedral-model.mjs';
import { wawelCathedralStudy } from './wawel-cathedral-model.mjs';
import { yerevanGregoryStudy } from './yerevan-gregory-model.mjs';
import { yorkStudy } from './york-minster-model.mjs';

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
  rigaStudy,
  yorkStudy,
  nidarosStudy,
  sophiaStudy,
  pannonhalmaStudy,
  sibenikStudy,
  matthiasStudy,
  euphrasianStudy,
  modenaStudy,
  concepcionStudy,
  lvivStudy,
  salzburgStudy,
  vilniusStudy,
  vallettaStudy,
  dresdenStudy,
  monrealeStudy,
  bratislavaStudy,
  turkuCathedralStudy,
  vankStudy,
  konigsbergStudy,
  tallinnMaryStudy,
  magdeburgStudy,
  pristinaStudy,
  cefaluStudy,
  gilesStudy,
  odesaStudy,
  ljubljanaStudy,
  thessSophiaStudy,
  blackChurchStudy,
  utrechtDomStudy,
  brnoPetrovStudy,
  glasgowCathedralStudy,
  ghazanchetsotsStudy,
  freiburgMinsterStudy,
  sanNicolaBariStudy,
  sanThomeStudy,
  stBavoStudy,
  tokyoMaryStudy,
  uspenskiStudy,
  yerevanGregoryStudy,
  luccaStudy,
  mdinaStudy,
  minskMaryStudy,
  nikortsmindaStudy,
  rioCathedralStudy,
  polotskSophiaStudy,
  dubrovnikCathedralStudy,
  stPierreStudy,
  monacoCathedralStudy,
  esztergomStudy,
  saoPauloCathedralStudy,
  sarajevoOrthodoxStudy,
  poznanCathedralStudy,
  crystalCathedralStudy,
  samtavisiStudy,
  banjaCathedralStudy,
  havanaCathedralStudy,
  liegeCathedralStudy,
];
signatureTowers.push(...additions);
if (!process.argv.some((arg) => arg.startsWith('--ids='))) {
  process.argv.push(`--ids=${additions.map((study) => study.id).join(',')}`);
}
await import('./generate-signature-towers.mjs');
