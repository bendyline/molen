/** Additional individual studies reuse the source pipeline without changing earlier recipes. */

import { abujaStudy } from './abuja-model.mjs';
import { ajantaStudy } from './ajanta-model.mjs';
import { akhtamarStudy } from './akhtamar-model.mjs';
import { akshardhamStudy } from './akshardham-model.mjs';
import { alAqsaStudy } from './al-aqsa-model.mjs';
import { aleppoStudy as aleppoCitadelStudy } from './aleppo-citadel-model.mjs';
import { aleppoStudy as aleppoMosqueStudy } from './aleppo-model.mjs';
import { aliStudy } from './ali-model.mjs';
import { amaStudy } from './ama-model.mjs';
import { amrStudy } from './amr-model.mjs';
import { ankaraStudy } from './ankara-model.mjs';
import { antoninusStudy } from './antoninus-model.mjs';
import { apolloPompeiiStudy } from './apollo-pompeii-model.mjs';
import { askariStudy } from './askari-model.mjs';
import { azharStudy } from './azhar-model.mjs';
import { baalshaminStudy } from './baalshamin-model.mjs';
import { babStudy } from './bab-model.mjs';
import { badshahiStudy } from './badshahi-model.mjs';
import { baidichengStudy } from './baidicheng-model.mjs';
import { baitulStudy } from './baitul-model.mjs';
import { bakseiStudy } from './baksei-model.mjs';
import { bamburghStudy } from './bamburgh-castle-model.mjs';
import { banjaCathedralStudy } from './banja-cathedral-model.mjs';
import { banteayStudy } from './banteay-model.mjs';
import { banyaStudy } from './banya-model.mjs';
import { baphuonStudy } from './baphuon-model.mjs';
import { bayezidStudy } from './bayezid-model.mjs';
import { bayonStudy } from './bayon-model.mjs';
import { beijingImmaculateStudy } from './beijing-immaculate-model.mjs';
import { beijingJosephStudy } from './beijing-joseph-model.mjs';
import { belStudy } from './bel-model.mjs';
import { bibiStudy } from './bibi-model.mjs';
import { blackChurchStudy } from './black-church-model.mjs';
import { bratislavaStudy } from './bratislava-st-martin-model.mjs';
import { brnoPetrovStudy } from './brno-petrov-model.mjs';
import { bulguksaStudy } from './bulguksa-model.mjs';
import { bursaStudy } from './bursa-model.mjs';
import { caesarStudy } from './caesar-model.mjs';
import { capelaStudy } from './capela-model.mjs';
import { cardiffStudy } from './cardiff-castle-model.mjs';
import { cashelStudy } from './cashel-ruins-model.mjs';
import { cataniaCathedralStudy } from './catania-cathedral-model.mjs';
import { cefaluStudy } from './cefalu-cathedral-model.mjs';
import { charminarStudy } from './charminar-model.mjs';
import { chinonStudy } from './chinon-castle-model.mjs';
import { choraStudy } from './chora-model.mjs';
import { concepcionStudy } from './concepcion-cathedral-model.mjs';
import { concordStudy } from './concord-model.mjs';
import { crystalCathedralStudy } from './crystal-cathedral-model.mjs';
import { dakshineswarStudy } from './dakshineswar-model.mjs';
import { denderaStudy } from './dendera-model.mjs';
import { deogarhStudy } from './deogarh-model.mjs';
import { divrigiStudy } from './divrigi-model.mjs';
import { djenneStudy } from './djenne-model.mjs';
import { domeRockStudy } from './dome-rock-model.mjs';
import { dresdenStudy } from './dresden-cathedral-model.mjs';
import { dubrovnikCathedralStudy } from './dubrovnik-cathedral-model.mjs';
import { dunnottarStudy } from './dunnottar-castle-model.mjs';
import { eannaStudy } from './eanna-model.mjs';
import { earthTempleStudy } from './earth-temple-model.mjs';
import { edfuStudy } from './edfu-model.mjs';
import { esztergomStudy } from './esztergom-model.mjs';
import { etchmiadzinStudy } from './etchmiadzin-cathedral-model.mjs';
import { euphrasianStudy } from './euphrasian-basilica-model.mjs';
import { faisalStudy } from './faisal-model.mjs';
import { fatihStudy } from './fatih-model.mjs';
import { ferraraCathedralStudy } from './ferrara-cathedral-model.mjs';
import { florenceStudy } from './florence-cathedral-model.mjs';
import { freiburgMinsterStudy } from './freiburg-minster-model.mjs';
import { futuhStudy } from './futuh-model.mjs';
import { gaziStudy } from './gazi-model.mjs';
import { generateKarnakGround } from './generate-karnak-ground.mjs';
import { ggantijaStudy } from './ggantija-model.mjs';
import { ghazanchetsotsStudy } from './ghazanchetsots-model.mjs';
import { glasgowCathedralStudy } from './glasgow-cathedral-model.mjs';
import { goharshadStudy } from './goharshad-model.mjs';
import { grazCathedralStudy } from './graz-cathedral-model.mjs';
import { gurkCathedralStudy } from './gurk-cathedral-model.mjs';
import { harlechStudy } from './harlech-castle-model.mjs';
import { hassanStudy } from './hassan-model.mjs';
import { havanaCathedralStudy } from './havana-cathedral-model.mjs';
import { heavenStudy } from './heaven-model.mjs';
import { heratStudy } from './herat-model.mjs';
import { herculesVictorStudy } from './hercules-victor-model.mjs';
import { heverStudy } from './hever-castle-model.mjs';
import { holySepulchreStudy } from './holy-sepulchre-model.mjs';
import { husaynStudy } from './husayn-model.mjs';
import { ibrahimStudy } from './ibrahim-model.mjs';
import { idkahStudy } from './idkah-model.mjs';
import { isfahanStudy } from './isfahan-model.mjs';
import { istanbulHagiaSophiaStudy } from './istanbul-hagia-sophia-model.mjs';
import { istiqlalStudy } from './istiqlal-model.mjs';
import { jamaDelhiStudy } from './jama-delhi-model.mjs';
import { jamekStudy } from './jamek-model.mjs';
import { jupiterStudy } from './jupiter-model.mjs';
import { kadyrovStudy } from './kadyrov-model.mjs';
import { kairouanStudy } from './kairouan-model.mjs';
import { kapaliStudy } from './kapali-model.mjs';
import { karnakStudy } from './karnak-model.mjs';
import { kdeiStudy } from './kdei-model.mjs';
import { kocatepeStudy } from './kocatepe-model.mjs';
import { komOmboStudy } from './kom-ombo-model.mjs';
import { konigsbergStudy } from './konigsberg-cathedral-model.mjs';
import { kosiceCathedralStudy } from './kosice-cathedral-model.mjs';
import { kotorCathedralStudy } from './kotor-cathedral-model.mjs';
import { koutoubiaStudy } from './koutoubia-model.mjs';
import { krumlovStudy } from './krumlov-castle-model.mjs';
import { kukulcanStudy } from './kukulcan-model.mjs';
import { lalaStudy } from './lala-mustafa-mosque-model.mjs';
import { lausanneCathedralStudy } from './lausanne-cathedral-model.mjs';
import { liegeCathedralStudy } from './liege-cathedral-model.mjs';
import { linlithgowStudy } from './linlithgow-palace-model.mjs';
import { linzCathedralStudy } from './linz-cathedral-model.mjs';
import { littleHagiaStudy } from './little-hagia-model.mjs';
import { ljubljanaStudy } from './ljubljana-cathedral-model.mjs';
import { loarreStudy } from './loarre-castle-model.mjs';
import { lotfStudy } from './lotf-model.mjs';
import { lotusStudy } from './lotus-model.mjs';
import { luccaStudy } from './lucca-model.mjs';
import { luxorStudy } from './luxor-model.mjs';
import { lvivStudy } from './lviv-georges-cathedral-model.mjs';
import { magdeburgStudy } from './magdeburg-cathedral-model.mjs';
import { margatStudy } from './margat-castle-model.mjs';
import { masjidHaramStudy } from './masjid-al-haram-model.mjs';
import { matthiasStudy } from './matthias-church-model.mjs';
import { mayorStudy } from './mayor-model.mjs';
import { mazarStudy } from './mazar-model.mjs';
import { mdinaStudy } from './mdina-model.mjs';
import { metekhiStudy } from './metekhi-model.mjs';
import { minskMaryStudy } from './minsk-mary-model.mjs';
import { modenaStudy } from './modena-cathedral-model.mjs';
import { monacoCathedralStudy } from './monaco-cathedral-model.mjs';
import { monrealeStudy } from './monreale-cathedral-model.mjs';
import { monzaCathedralStudy } from './monza-cathedral-model.mjs';
import { moritzburgStudy } from './moritzburg-castle-model.mjs';
import { moscowStudy } from './moscow-model.mjs';
import { muhammadAliStudy } from './muhammad-ali-model.mjs';
import { nasirStudy } from './nasir-model.mjs';
import { negaraStudy } from './negara-model.mjs';
import { nevskyStudy } from './nevsky-cathedral-model.mjs';
import { nidarosStudy } from './nidaros-cathedral-model.mjs';
import { nikortsmindaStudy } from './nikortsminda-model.mjs';
import { niujieStudy } from './niujie-model.mjs';
import { nuriStudy } from './nuri-model.mjs';
import { odesaStudy } from './odesa-cathedral-model.mjs';
import { olavinlinnaStudy } from './olavinlinna-castle-model.mjs';
import { omarStudy } from './omar-model.mjs';
import { ortakoyStudy } from './ortakoy-model.mjs';
import { paduaCathedralStudy } from './padua-cathedral-model.mjs';
import { pannonhalmaStudy } from './pannonhalma-archabbey-model.mjs';
import { parisMosqueStudy } from './paris-mosque-model.mjs';
import { pashupatinathStudy } from './pashupatinath-model.mjs';
import { passauCathedralStudy } from './passau-cathedral-model.mjs';
import { patriarchsStudy } from './patriarchs-model.mjs';
import { peaceStudy } from './peace-model.mjs';
import { petersburgStudy } from './petersburg-model.mjs';
import { philaeStudy } from './philae-model.mjs';
import { pidhirtsiStudy } from './pidhirtsi-castle-model.mjs';
import { polotskSophiaStudy } from './polotsk-sophia-model.mjs';
import { ponagarStudy } from './ponagar-model.mjs';
import { portoCathedralStudy } from './porto-cathedral-model.mjs';
import { portunusStudy } from './portunus-model.mjs';
import { poznanCathedralStudy } from './poznan-cathedral-model.mjs';
import { pragueNicholasStudy } from './prague-nicholas-model.mjs';
import { pristinaStudy } from './pristina-cathedral-model.mjs';
import { pulaAugustusStudy } from './pula-augustus-model.mjs';
import { putraStudy } from './putra-model.mjs';
import { qaboosStudy } from './qaboos-model.mjs';
import { qiblatainStudy } from './qiblatain-model.mjs';
import { qolStudy } from './qol-model.mjs';
import { qubaDiwaneStudy } from './quba-diwane-model.mjs';
import { qubaStudy } from './quba-model.mjs';
import { rigaStudy } from './riga-cathedral-model.mjs';
import { rioCathedralStudy } from './rio-cathedral-model.mjs';
import { romaStudy } from './roma-model.mjs';
import { romulusStudy } from './romulus-model.mjs';
import { rustemStudy } from './rustem-model.mjs';
import { saigonNotreDameStudy } from './saigon-notre-dame-model.mjs';
import { sophiaStudy } from './saint-sophia-nicosia-model.mjs';
import { salzburgStudy } from './salzburg-cathedral-model.mjs';
import { samarraStudy } from './samarra-model.mjs';
import { samreStudy } from './samre-model.mjs';
import { samtavisiStudy } from './samtavisi-model.mjs';
import { sanNicolaBariStudy } from './san-nicola-bari-model.mjs';
import { sanThomeStudy } from './san-thome-model.mjs';
import { santacruzStudy } from './santacruz-model.mjs';
import { saoPauloCathedralStudy } from './sao-paulo-cathedral-model.mjs';
import { sarajevoOrthodoxStudy } from './sarajevo-orthodox-model.mjs';
import { sarenaStudy } from './sarena-model.mjs';
import { sarlatCathedralStudy } from './sarlat-cathedral-model.mjs';
import { sarmizegetusaStudy } from './sarmizegetusa-model.mjs';
import { saturnStudy } from './saturn-model.mjs';
import { selimiyeStudy } from './selimiye-model.mjs';
import { serabitStudy } from './serabit-model.mjs';
import { serapeumStudy } from './serapeum-model.mjs';
import { shahStudy } from './shah-model.mjs';
import { sibenikStudy } from './sibenik-cathedral-model.mjs';
import { signatureTowers } from './signature-tower-models.mjs';
import { sokolluStudy } from './sokollu-model.mjs';
import { somanathapuraStudy } from './somanathapura-model.mjs';
import { stBavoStudy } from './st-bavo-model.mjs';
import { gilesStudy } from './st-giles-cathedral-model.mjs';
import { stMarksStudy } from './st-marks-basilica-model.mjs';
import { stPierreStudy } from './st-pierre-model.mjs';
import { sukuhStudy } from './sukuh-model.mjs';
import { suleymaniyeStudy } from './suleymaniye-model.mjs';
import { sultanAhmedStudy } from './sultan-ahmed-model.mjs';
import { sunPyramidStudy } from './sun-pyramid-model.mjs';
import { tabrizBlueStudy } from './tabriz-blue-model.mjs';
import { tallinnMaryStudy } from './tallinn-st-mary-model.mjs';
import { tampereCathedralStudy } from './tampere-cathedral-model.mjs';
import { thessSophiaStudy } from './thessaloniki-sophia-model.mjs';
import { tintagelStudy } from './tintagel-castle-model.mjs';
import { tokyoMaryStudy } from './tokyo-st-mary-model.mjs';
import { tournaiStudy } from './tournai-cathedral-model.mjs';
import { tulunStudy } from './tulun-model.mjs';
import { turkuCathedralStudy } from './turku-cathedral-model.mjs';
import { umayyadStudy } from './umayyad-model.mjs';
import { uspenskiStudy } from './uspenski-model.mjs';
import { utrechtDomStudy } from './utrecht-dom-model.mjs';
import { vallettaStudy } from './valletta-st-john-model.mjs';
import { vankStudy } from './vank-cathedral-model.mjs';
import { venusGenetrixStudy } from './venus-genetrix-model.mjs';
import { venusStudy } from './venus-model.mjs';
import { vespasianStudy } from './vespasian-model.mjs';
import { vestaStudy } from './vesta-model.mjs';
import { vilniusStudy } from './vilnius-cathedral-model.mjs';
import { wawelCathedralStudy } from './wawel-cathedral-model.mjs';
import { wazirStudy } from './wazir-model.mjs';
import { westMebonStudy } from './west-mebon-model.mjs';
import { xianStudy } from './xian-model.mjs';
import { yeniStudy } from './yeni-model.mjs';
import { yerevanGregoryStudy } from './yerevan-gregory-model.mjs';
import { yerevanStudy } from './yerevan-model.mjs';
import { yorkStudy } from './york-minster-model.mjs';
import { zayedStudy } from './zayed-model.mjs';

const additions = [
  samreStudy,
  bakseiStudy,
  ankaraStudy,
  earthTempleStudy,
  qubaDiwaneStudy,
  pulaAugustusStudy,
  baidichengStudy,
  sukuhStudy,
  kapaliStudy,
  metekhiStudy,
  santacruzStudy,
  somanathapuraStudy,
  ponagarStudy,
  deogarhStudy,
  philaeStudy,
  capelaStudy,
  apolloPompeiiStudy,
  romulusStudy,
  westMebonStudy,
  venusGenetrixStudy,
  eannaStudy,
  amaStudy,
  serabitStudy,
  vespasianStudy,
  kdeiStudy,
  serapeumStudy,
  babStudy,
  istiqlalStudy,
  azharStudy,
  patriarchsStudy,
  aliStudy,
  askariStudy,
  charminarStudy,
  choraStudy,
  yerevanStudy,
  samarraStudy,
  bibiStudy,
  koutoubiaStudy,
  petersburgStudy,
  shahStudy,
  aleppoMosqueStudy,
  qolStudy,
  parisMosqueStudy,
  tulunStudy,
  kairouanStudy,
  mazarStudy,
  nasirStudy,
  isfahanStudy,
  hassanStudy,
  faisalStudy,
  zayedStudy,
  djenneStudy,
  jamaDelhiStudy,
  kadyrovStudy,
  fatihStudy,
  baitulStudy,
  moscowStudy,
  lotfStudy,
  littleHagiaStudy,
  negaraStudy,
  qiblatainStudy,
  amrStudy,
  husaynStudy,
  qaboosStudy,
  goharshadStudy,
  muhammadAliStudy,
  tabrizBlueStudy,
  wazirStudy,
  nuriStudy,
  niujieStudy,
  banyaStudy,
  sarenaStudy,
  rustemStudy,
  jamekStudy,
  heratStudy,
  sokolluStudy,
  romaStudy,
  putraStudy,
  idkahStudy,
  ibrahimStudy,
  futuhStudy,
  bayezidStudy,
  bursaStudy,
  gaziStudy,
  abujaStudy,
  ajantaStudy,
  heavenStudy,
  karnakStudy,
  luxorStudy,
  lotusStudy,
  sunPyramidStudy,
  ggantijaStudy,
  edfuStudy,
  pashupatinathStudy,
  bayonStudy,
  kukulcanStudy,
  bulguksaStudy,
  vestaStudy,
  akshardhamStudy,
  saturnStudy,
  antoninusStudy,
  belStudy,
  portunusStudy,
  jupiterStudy,
  denderaStudy,
  sarmizegetusaStudy,
  banteayStudy,
  caesarStudy,
  mayorStudy,
  baphuonStudy,
  venusStudy,
  komOmboStudy,
  peaceStudy,
  herculesVictorStudy,
  concordStudy,
  baalshaminStudy,
  dakshineswarStudy,
  alAqsaStudy,
  domeRockStudy,
  umayyadStudy,
  suleymaniyeStudy,
  badshahiStudy,
  selimiyeStudy,
  qubaStudy,
  sultanAhmedStudy,
  masjidHaramStudy,
  istanbulHagiaSophiaStudy,
  saigonNotreDameStudy,
  passauCathedralStudy,
  pragueNicholasStudy,
  paduaCathedralStudy,
  beijingImmaculateStudy,
  kotorCathedralStudy,
  margatStudy,
  tintagelStudy,
  heverStudy,
  cashelStudy,
  aleppoCitadelStudy,
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
  linzCathedralStudy,
  grazCathedralStudy,
  kosiceCathedralStudy,
  ferraraCathedralStudy,
  beijingJosephStudy,
  monzaCathedralStudy,
  tampereCathedralStudy,
  akhtamarStudy,
  portoCathedralStudy,
  cataniaCathedralStudy,
  sarlatCathedralStudy,
  lausanneCathedralStudy,
  gurkCathedralStudy,
  yeniStudy,
  divrigiStudy,
  xianStudy,
  kocatepeStudy,
  omarStudy,
  ortakoyStudy,
];
const additionIds = new Set();
for (const study of additions) {
  if (additionIds.has(study.id)) throw new Error(`Duplicate additional landmark: ${study.id}`);
  additionIds.add(study.id);
}
signatureTowers.push(...additions);
if (!process.argv.some((arg) => arg.startsWith('--ids='))) {
  process.argv.push(`--ids=${additions.map((study) => study.id).join(',')}`);
}
const requestedIds = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
if (!requestedIds || requestedIds.includes(karnakStudy.id)) await generateKarnakGround();
await import('./generate-signature-towers.mjs');
