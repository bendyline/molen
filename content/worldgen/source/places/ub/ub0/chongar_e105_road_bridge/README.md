# Chongar E105 road bridge

The low E105 concrete deck curves through the approach, with two asphalt lanes, light parapets, black and white approach barriers, longitudinal girders and concrete pier caps.

Set the world viewer date to 2023-05-18 for this dated reconstruction. The [map frame](map-frame.json) preserves the independent alignment, control heights and photographic references.

Run `node packages/worldgen/scripts/generate-chongar-bridges.mjs` to regenerate the three source masters. The [bridge recipe](models/bridge-model.mjs) exports the master and four streaming levels. Structural castings and metalwork use shared materials. Detailed hardware, pier spacing and water levels are approximate.
