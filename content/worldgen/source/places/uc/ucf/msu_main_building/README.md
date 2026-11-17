# Moscow State University main building

The [model recipe](models/msu-model.mjs) reconstructs the main academic tower, two residence wings, four instrument towers, four open driveway arches, four terminal dormitory pavilions and both ceremonial halls. The gilt star and wheat silhouette, the ceramic wall bands and the portico use the exterior reference photographs. The [site frame](map-frame.json) records the mapped outlines, northeast heading and sampled plaza and driveway grades.

Run `node packages/worldgen/scripts/generate-msu-main-building.mjs` to regenerate the source GLB. The detailed master and four streaming levels use five shared materials. Dial hands are fixed. Fine ornament, courtyard openings and forecourt stair transitions are approximate at the available terrain resolution.
