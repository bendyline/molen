# Saint Petersburg Flood Barrier

Reviewed 2026-11-18. The visible exterior, placement, and four viewer detail levels passed. [World viewer preview](site-preview.png)

The S-2 lift lies over the mapped navigation gap. S-1 shows both open-water banks, parked gates, and marked approaches descending into the visible yellow portals. The former B-6 terrain obstruction is gone and the north end connects to the retained mainland crossing. Standard terrain and PMTiles establish site fit. [Map and placement evidence](map-frame.json) · [Public approach photograph](https://anashina.com/damba/)

The viewer kept open water at 192 sample points across 64 sluice bays. The terrain cuts expose eight waterways and two road approaches. The source terrain, independent mapped buildings, and the mainland continuation were preserved. Unloading restored the terrain and water. [QA evidence](qa.json)

All six GLBs passed Khronos validation. The master and four browser tiers rebuild from source, reuse five shared material graphs, and embed zero images. The skyline and district total 359,860 bytes.

Tide and individual platform heights are illustrative. The road portals show the public exterior and a recessed opening. The tunnel beyond the visible approach and the operating mechanisms are outside the model scope. The high regional capture is limited by retained map tile coverage. Physical phone and laptop timing remains unmeasured.

Run `node packages/worldgen/scripts/generate-saint-petersburg-dam.mjs --ids=saint_petersburg_dam` to rebuild. Append `--check` for exact source verification. Use `--ids=saint_petersburg_dam` for import, LOD generation, and readiness. GLBs are ignored build outputs.
