# Recognizable-place fixtures

- `store-library.batch.json` is an authored art-review block: eight branded buildings,
  three tenants sharing one strip, and the five mapped prop kinds. Generated through the Earth
  adapter from `examples/world-explorer/src/business-showcase.ts`. No network is needed to preview.
- `sammamish-businesses.semantic.json` preserves four actual building footprints and ten contained
  business POIs from tile 15/5276/11442 of the bundled Sammamish `world.pmtiles`, inspected
  2026-09-06. Road geometry from that tile is retained for frontage estimation. Land/water and
  unrelated buildings/POIs are omitted. Geometry remains in normalized source tile coordinates.
  Regression tests check real names, IDs and shared tenancy without requiring the archive.

Source: Protomaps basemap / © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
(ODbL). This is a source-data fixture, not a survey of present-day occupants.

```sh
molen worldgen preview --batch packages/worldgen-earth/test/fixtures/store-library.batch.json --out .artifacts/store-library.png --angles 4
```
