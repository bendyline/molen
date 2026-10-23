/** Touring motorhomes: two Class Cs, three Class As and one Class B. */
export const MOLEN_RV_ENTITY_IDS = [
  'molen.entities.vehicle.winnebago_view_2022',
  'molen.entities.vehicle.bendy_class_c_family',
  'molen.entities.vehicle.bendy_class_a_compact',
  'molen.entities.vehicle.bendy_class_a_touring',
  'molen.entities.vehicle.bendy_class_a_grand',
  'molen.entities.vehicle.bendy_class_b_camper',
] as const;

export type MolenRvEntityId = (typeof MOLEN_RV_ENTITY_IDS)[number];
