# Mosul Dam

[Native viewer preview](site-preview.png) · [QA evidence](qa.json) · [Signed map frame](map-frame.json)

The five-gate service spillway, powerhouse, small outlet hall, four surge cylinders and bent crest remain visible. The newly shaped eastern saddle dam and pale dry spillway shoulder follow the photo and map. The crest road stays continuous through the east section.

The signed crest, bridge and canal align with retained PMTiles. The narrowed eastern ground cutout matches the new shoulder. Street and close-up rays show the eastern toe joining the retained terrain on both sides. Independent buildings and the two water stages were preserved in the viewer.

Six existing shared graphs resolve with no embedded images. The renderer releases the asset and restores original ground on unload.

The eastern spillway is a medium-fi exterior interpretation of the aerial and retained PMTiles. Widths and levels are approximate. Water stages are static. The native fixture retains an overlapping water surface near the eastern upstream shore, and farther shores retain the resolution of the source tiles.

The source master has 71,284 triangles. The skyline, district, street and close-up levels have 954, 3,164, 14,910, 25,570 triangles. Skyline and district total 374,448 bytes. Six GLBs passed validation. The review covered 12 portable, 12 shared-material, 31 medium-fi and 16 native-viewer frames.

Rebuild with `node packages/worldgen/scripts/generate-mosul-dam.mjs --ids=mosul_dam`. Add `--check` to compare exact bytes.
