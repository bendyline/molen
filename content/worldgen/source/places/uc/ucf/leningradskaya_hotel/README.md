# Leningradskaya Hotel

This is a distinct member of the Seven Sisters collection. The Moscow hotel’s mapped wings, entrance pavilion, tower and receding crown are generated from [the native map frame](map-frame.json) and [the model recipe](models/hotel-model.mjs). The entrance faces the square. Reference photos inform the arched glazing, limestone ribs and copper spire. Ornament and individual window details are approximate.

The master and four authored levels use shared limestone, brick, granite and metal surfaces. Window color comes from the mesh. Run `node packages/worldgen/scripts/generate-leningradskaya-hotel.mjs` to reproduce the source GLB.

The mapped envelope retains the recessed courts. Forecourt terrain sets the entrance grade. The map frame records the tile hashes and the local relief samples.
