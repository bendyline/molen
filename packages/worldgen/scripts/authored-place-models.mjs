/** Authored geographic structures: each source recipe owns its identity and review inputs. */

import { abseconLighthouseModel } from './structure-absecon-lighthouse.mjs';
import { alcatrazFederalPenitentiaryModel } from './structure-alcatraz-federal-penitentiary.mjs';
import { alcatrazIslandLighthouseModel } from './structure-alcatraz-island-lighthouse.mjs';
import { anneModel } from './structure-anne-frank-house.mjs';
import { apolloTheaterModel } from './structure-apollo-theater.mjs';
import { biltmoreModel } from './structure-arizona-biltmore.mjs';
import { bachModel } from './structure-bach-house.mjs';
import { banffModel } from './structure-banff-springs-hotel.mjs';
import { beethovenModel } from './structure-beethoven-house.mjs';
import { belemTowerModel } from './structure-belem-tower.mjs';
import { belfryOfGhentModel } from './structure-belfry-of-ghent.mjs';
import { bentPyramidModel } from './structure-bent-pyramid.mjs';
import { biloxiLighthouseModel } from './structure-biloxi-lighthouse.mjs';
import { blueHouseModel } from './structure-blue-house-hong-kong.mjs';
import { bradburyBuildingModel } from './structure-bradbury-building.mjs';
import { brandenburgModel } from './structure-brandenburg-gate.mjs';
import { buckinghamPalaceModel } from './structure-buckingham-palace.mjs';
import { cadmansModel } from './structure-cadmans-cottage.mjs';
import { castleClintonModel } from './structure-castle-clinton.mjs';
import { castroTheatreModel } from './structure-castro-theatre.mjs';
import { chambordModel } from './structure-chateau-de-chambord.mjs';
import { chenonceauModel } from './structure-chateau-de-chenonceau.mjs';
import { frontenacModel } from './structure-chateau-frontenac.mjs';
import { laurierModel } from './structure-chateau-laurier.mjs';
import { chatsworthModel } from './structure-chatsworth-house.mjs';
import { clevedonPierModel } from './structure-clevedon-pier.mjs';
import { domTowerOfUtrechtModel } from './structure-dom-tower-of-utrecht.mjs';
import { dresdenCastleModel } from './structure-dresden-castle.mjs';
import { easternStateModel } from './structure-eastern-state-penitentiary.mjs';
import { elMorroModel } from './structure-el-morro.mjs';
import { ennisModel } from './structure-ennis-house.mjs';
import { fallingwaterModel } from './structure-fallingwater.mjs';
import { faneuilModel } from './structure-faneuil-hall.mjs';
import { flagstaffHouseModel } from './structure-flagstaff-house-hong-kong.mjs';
import { fordTowerModel } from './structure-ford-island-control-tower.mjs';
import { fordsModel } from './structure-fords-theatre.mjs';
import { fortZeelandiaModel } from './structure-fort-zeelandia.mjs';
import { frauncesModel } from './structure-fraunces-tavern.mjs';
import { freedomTowerMiamiModel } from './structure-freedom-tower-miami.mjs';
import { gambleModel } from './structure-gamble-house.mjs';
import { gatewayOfIndiaModel } from './structure-gateway-of-india.mjs';
import { gettyModel } from './structure-getty-villa.mjs';
import { grandCentralTerminalModel } from './structure-grand-central-terminal.mjs';
import { graumansChineseTheatreModel } from './structure-graumans-chinese-theatre.mjs';
import { hangar37Model } from './structure-hangar-37.mjs';
import { hayashiDepartmentStoreModel } from './structure-hayashi-department-store.mjs';
import { hearstModel } from './structure-hearst-castle.mjs';
import { hemingwayModel } from './structure-hemingway-house.mjs';
import { hiroshimaPeaceMemorialModel } from './structure-hiroshima-peace-memorial.mjs';
import { hobokenTerminalModel } from './structure-hoboken-terminal.mjs';
import { hollyhockModel } from './structure-hollyhock-house.mjs';
import { hollywoodModel } from './structure-hollywood-sign.mjs';
import { chelseaModel } from './structure-hotel-chelsea.mjs';
import { coronadoModel } from './structure-hotel-del-coronado.mjs';
import { indesModel } from './structure-hotel-des-indes.mjs';
import { majapahitModel } from './structure-hotel-majapahit.mjs';
import { humayunsTombModel } from './structure-humayuns-tomb.mjs';
import { jamaicaModel } from './structure-jamaica-inn.mjs';
import { jeffersonModel } from './structure-jefferson-memorial.mjs';
import { jeronimosMonasteryModel } from './structure-jeronimos-monastery.mjs';
import { kensington13Model } from './structure-kensington-palace-gardens-13.mjs';
import { kobePortTowerModel } from './structure-kobe-port-tower.mjs';
import { kyotoTowerModel } from './structure-kyoto-tower.mjs';
import { liebermannModel } from './structure-liebermann-villa.mjs';
import { lincolnModel } from './structure-lincoln-memorial.mjs';
import { lorraineModel } from './structure-lorraine-motel.mjs';
import { matsumotoCastleModel } from './structure-matsumoto-castle.mjs';
import { nagoyaCastleModel } from './structure-nagoya-castle.mjs';
import { newYorkStockExchangeModel } from './structure-new-york-stock-exchange.mjs';
import { notreDameBasilicaMontrealModel } from './structure-notre-dame-basilica-montreal.mjs';
import { nusretiyeClockTowerModel } from './structure-nusretiye-clock-tower.mjs';
import { oldParliamentModel } from './structure-old-parliament-house-canberra.mjs';
import { palaceModel } from './structure-palace-hotel.mjs';
import { parliamentModel } from './structure-parliament-house-canberra.mjs';
import { penarthPierModel } from './structure-penarth-pier.mjs';
import { phoenixShotTowerModel } from './structure-phoenix-shot-tower.mjs';
import { ponceModel } from './structure-ponce-de-leon-hotel.mjs';
import { presidentialOfficeBuildingTaipeiModel } from './structure-presidential-office-building-taipei.mjs';
import { reichstagModel } from './structure-reichstag.mjs';
import { ritzModel } from './structure-ritz-london.mjs';
import { robbenLighthouseModel } from './structure-robben-island-lighthouse.mjs';
import { robbenPrisonModel } from './structure-robben-island-prison.mjs';
import { royalAlbertHallModel } from './structure-royal-albert-hall.mjs';
import { rymanAuditoriumModel } from './structure-ryman-auditorium.mjs';
import { saltburnPierModel } from './structure-saltburn-pier.mjs';
import { santaMonicaPierModel } from './structure-santa-monica-pier.mjs';
import { sintraNationalPalaceModel } from './structure-sintra-national-palace.mjs';
import { spreckelsOrganPavilionModel } from './structure-spreckels-organ-pavilion.mjs';
import { stonewallModel } from './structure-stonewall-inn.mjs';
import { stoweModel } from './structure-stowe-house.mjs';
import { sunYatSenMemorialHallTaipeiModel } from './structure-sun-yat-sen-memorial-hall-taipei.mjs';
import { taipeiConfuciusTempleModel } from './structure-taipei-confucius-temple.mjs';
import { taipeiGuestHouseModel } from './structure-taipei-guest-house.mjs';
import { taipeiStoryHouseModel } from './structure-taipei-story-house.mjs';
import { tajMahalPalaceHotelModel } from './structure-taj-mahal-palace-hotel.mjs';
import { towerOfTheWindsModel } from './structure-tower-of-the-winds.mjs';
import { treviFountainModel } from './structure-trevi-fountain.mjs';
import { tribuneTowerModel } from './structure-tribune-tower.mjs';
import { washingtonMonumentBaltimoreModel } from './structure-washington-monument-baltimore.mjs';
import { watergateModel } from './structure-watergate-complex.mjs';
import { whiteTowerOfThessalonikiModel } from './structure-white-tower-of-thessaloniki.mjs';
import { winchesterModel } from './structure-winchester-mystery-house.mjs';

export { landmarkSurfaces } from './landmark-model-helpers.mjs';
export const authoredPlaceModels = [
  bentPyramidModel,
  biloxiLighthouseModel,
  abseconLighthouseModel,
  presidentialOfficeBuildingTaipeiModel,
  sunYatSenMemorialHallTaipeiModel,
  alcatrazFederalPenitentiaryModel,
  alcatrazIslandLighthouseModel,
  jeronimosMonasteryModel,
  belemTowerModel,
  treviFountainModel,
  elMorroModel,
  castleClintonModel,
  fortZeelandiaModel,
  matsumotoCastleModel,
  nagoyaCastleModel,
  sintraNationalPalaceModel,
  dresdenCastleModel,
  chambordModel,
  chenonceauModel,
  buckinghamPalaceModel,
  domTowerOfUtrechtModel,
  tribuneTowerModel,
  freedomTowerMiamiModel,
  belfryOfGhentModel,
  castroTheatreModel,
  graumansChineseTheatreModel,
  spreckelsOrganPavilionModel,
  apolloTheaterModel,
  lorraineModel,
  fordsModel,
  anneModel,
  bradburyBuildingModel,
  brandenburgModel,
  watergateModel,
  kensington13Model,
  easternStateModel,
  fallingwaterModel,
  faneuilModel,
  fordTowerModel,
  hearstModel,
  hollywoodModel,
  coronadoModel,
  hangar37Model,
  hayashiDepartmentStoreModel,
  humayunsTombModel,
  tajMahalPalaceHotelModel,
  notreDameBasilicaMontrealModel,
  reichstagModel,
  robbenLighthouseModel,
  robbenPrisonModel,
  winchesterModel,
  liebermannModel,
  lincolnModel,
  jeffersonModel,
  biltmoreModel,
  chelseaModel,
  frauncesModel,
  stonewallModel,
  ritzModel,
  indesModel,
  majapahitModel,
  jamaicaModel,
  ponceModel,
  banffModel,
  palaceModel,
  frontenacModel,
  laurierModel,
  hemingwayModel,
  ennisModel,
  hollyhockModel,
  gambleModel,
  gettyModel,
  beethovenModel,
  bachModel,
  chatsworthModel,
  stoweModel,
  cadmansModel,
  blueHouseModel,
  flagstaffHouseModel,
  taipeiConfuciusTempleModel,
  taipeiGuestHouseModel,
  taipeiStoryHouseModel,
  gatewayOfIndiaModel,
  hiroshimaPeaceMemorialModel,
  washingtonMonumentBaltimoreModel,
  phoenixShotTowerModel,
  newYorkStockExchangeModel,
  nusretiyeClockTowerModel,
  kobePortTowerModel,
  kyotoTowerModel,
  whiteTowerOfThessalonikiModel,
  towerOfTheWindsModel,
  grandCentralTerminalModel,
  hobokenTerminalModel,
  clevedonPierModel,
  penarthPierModel,
  saltburnPierModel,
  santaMonicaPierModel,
  rymanAuditoriumModel,
  royalAlbertHallModel,
  oldParliamentModel,
  parliamentModel,
];
export function buildAuthoredPlace(out, model, frame) {
  return model.build(out, frame);
}
