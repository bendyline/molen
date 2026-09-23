# Reusable landmark library

These JSON files are the authored source for recognizable storefronts and mapped street furniture.
The [catalog](catalog.json) maps stable model IDs to individual `molen/landmark@1` files.

- [Burger restaurant](burger_restaurant.landmark.json): a generic restaurant wordmark with an
  initial-based `BR` emblem.
- [Grocery](grocery.landmark.json): the generic grocery treatment.
- Other mapped-business descriptors: [Mart Store](mart_store.landmark.json),
  [Grocery Market](grocery_market.landmark.json),
  [Neighborhood Grocery](neighborhood_grocery.landmark.json),
  [Coffee Shop](coffee_shop.landmark.json), [Food Market](food_market.landmark.json),
  [Pharmacy Store](pharmacy_store.landmark.json), and
  [General Merchandise](general_merchandise.landmark.json).
- Other categories: [restaurant](restaurant.landmark.json), [cafe](cafe.landmark.json),
  [pharmacy](pharmacy.landmark.json), [shop](shop.landmark.json).
- Furniture: [lamp](street_lamp.landmark.json), [bench](bench.landmark.json),
  [bike rack](bike_rack.landmark.json), [charger](charger.landmark.json),
  [fast charger](charger.fast.landmark.json).

Sign recipes include the mark, text, colors, facade appearance and requested storefront widths.
The shared generator adapts these to the building footprint. Box recipes contain ordered
`center`, `size`, `color`, optional `yaw` (radians), and optional `tiers` (0 near, 1 medium,
2 distant). Positions and sizes are meters, +Y up; ground props have their base at Y=0.
Signs have a canonical 4 × 1.35 m panel and face +Z.

Add a file and catalog entry to reuse an existing generator; the build generates imports and
builtin registrations. A new geometric mark requires a generator/schema extension.
The runtime bundles these sources, so rebuild and reload after editing.

Source-ID and name matching lives separately in the
[Earth business catalog](../../earth/businesses/catalog.json).
Base envelopes use the [architectural styles](../styles/generic/store.archstyle.json);
surface patterns use the [material library](../materials/README.md).
Mapped trees currently reuse the existing vegetation generators.

See the [recognizable places guide](../../../../../docs-src/guide/recognizable-places.md)
for loading, validation and extension, and the
[3D art guidelines](../../../../../docs-src/guide/3d-art-guidelines.md) for the shared fidelity baseline.

## Mapped-business descriptors

The library contains 44 generic descriptor signs used when the Earth adapter recognizes a mapped
business, plus nine generic commercial fallbacks. See the
[complete source-to-model mapping](../../earth/businesses/README.md).
The model-facing filenames, IDs, titles and wordmarks are category descriptions such as
`electronics_store`, `hardware_store`, `taco_place` and `pizza_delivery`. Their emblems use the
descriptor's initials through `symbol: "letters"`; no source-business name or shaped logo is part
of these model manifests. Source-inspired palettes remain as visual variants.

An optional `storefront.style` names a reusable architectural envelope; only directly identified
hosts use it, and custom packs without that style keep their normal fallback.

The [review fixture](../../../../worldgen-earth/test/fixtures/us-retail-library.batch.json) covers
the expanded mapped-descriptor set, including shared tenants and a courtyard.

## Source-business matching

Real source names and stable source IDs live only in the separate
[Earth business catalog](../../earth/businesses/catalog.json), where
they are used to recognize mapped data and select one of these generic visual descriptors. This
directory intentionally contains no source-business filenames, model IDs, titles, wordmarks or
logo emblems. The generators never invent a mapped source identity for an unidentified building.

The nine broad commercial fallbacks (`grocery`, `restaurant`, `cafe`, `pharmacy`, `shop`, `mall`,
`department_store`, `outlet_mall`, `strip_mall`) and five street-furniture models remain available
for unidentified places and ordinary scene authoring.
