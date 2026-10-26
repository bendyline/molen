/** Authored cockpit capabilities, separate from propulsion type (turbines have no mixture).
 * Minimum governor speeds are normalized gameplay estimates, not operating limitations.
 */
const manualMixture = new Set([
  'p51d',
  'cessna_172s',
  'cessna_182t',
  'baron_g58',
  'beech_18',
  'bonanza_g36',
  'cirrus_sr22t',
  'dc_3',
  'dhc_2',
  'pa_28_180',
  'robinson_r44',
]);
const manualPropeller = new Set([
  'p51d',
  'cessna_182t',
  'baron_g58',
  'beech_18',
  'bonanza_g36',
  'dc_3',
  'dhc_2',
  'cessna_208b',
  'king_air_350i',
  'pc_6',
  'dhc_6',
  'atr_72_600',
  'dash_8_q400',
]);

export function configureEngineControls(id, spec) {
  const key = id.split('.').at(-1);
  for (const engine of spec.engines ?? [spec.engine]) {
    if (manualMixture.has(key)) engine.mixtureControl = true;
    else delete engine.mixtureControl;
    if (manualPropeller.has(key)) engine.propellerControl = { minRpm: 0.6 };
    else delete engine.propellerControl;
  }
}
