/** Authored geographic structures: each source recipe owns its identity and review inputs. */

import { kensington13Model } from './structure-kensington-palace-gardens-13.mjs';
import { anneModel } from './structure-anne-frank-house.mjs';
import { biltmoreModel } from './structure-arizona-biltmore.mjs';
import { bachModel } from './structure-bach-house.mjs';
import { banffModel } from './structure-banff-springs-hotel.mjs';
import { beethovenModel } from './structure-beethoven-house.mjs';
import { brandenburgModel } from './structure-brandenburg-gate.mjs';
import { frontenacModel } from './structure-chateau-frontenac.mjs';
import { laurierModel } from './structure-chateau-laurier.mjs';
import { chatsworthModel } from './structure-chatsworth-house.mjs';
import { easternStateModel } from './structure-eastern-state-penitentiary.mjs';
import { ennisModel } from './structure-ennis-house.mjs';
import { fallingwaterModel } from './structure-fallingwater.mjs';
import { faneuilModel } from './structure-faneuil-hall.mjs';
import { fordTowerModel } from './structure-ford-island-control-tower.mjs';
import { fordsModel } from './structure-fords-theatre.mjs';
import { frauncesModel } from './structure-fraunces-tavern.mjs';
import { gambleModel } from './structure-gamble-house.mjs';
import { gettyModel } from './structure-getty-villa.mjs';
import { hangar37Model } from './structure-hangar-37.mjs';
import { hearstModel } from './structure-hearst-castle.mjs';
import { hemingwayModel } from './structure-hemingway-house.mjs';
import { hollyhockModel } from './structure-hollyhock-house.mjs';
import { hollywoodModel } from './structure-hollywood-sign.mjs';
import { chelseaModel } from './structure-hotel-chelsea.mjs';
import { coronadoModel } from './structure-hotel-del-coronado.mjs';
import { indesModel } from './structure-hotel-des-indes.mjs';
import { majapahitModel } from './structure-hotel-majapahit.mjs';
import { jamaicaModel } from './structure-jamaica-inn.mjs';
import { jeffersonModel } from './structure-jefferson-memorial.mjs';
import { liebermannModel } from './structure-liebermann-villa.mjs';
import { lincolnModel } from './structure-lincoln-memorial.mjs';
import { lorraineModel } from './structure-lorraine-motel.mjs';
import { palaceModel } from './structure-palace-hotel.mjs';
import { ponceModel } from './structure-ponce-de-leon-hotel.mjs';
import { reichstagModel } from './structure-reichstag.mjs';
import { ritzModel } from './structure-ritz-london.mjs';
import { robbenLighthouseModel } from './structure-robben-island-lighthouse.mjs';
import { robbenPrisonModel } from './structure-robben-island-prison.mjs';
import { stonewallModel } from './structure-stonewall-inn.mjs';
import { watergateModel } from './structure-watergate-complex.mjs';
import { winchesterModel } from './structure-winchester-mystery-house.mjs';

export { landmarkSurfaces } from './landmark-model-helpers.mjs';
export const authoredPlaceModels = [
  lorraineModel,
  fordsModel,
  anneModel,
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
];
export function buildAuthoredPlace(out, model, frame) {
  return model.build(out, frame);
}
