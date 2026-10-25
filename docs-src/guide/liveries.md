# Vehicle liveries

Liveries combine reusable paint regions and surface markings on one model. Cars, aircraft,
RVs, boats, cycles and transit use the same `livery` component. The `molen.entities` content
pack includes three or four choices for each of its 192 vehicle types.

## Choose a livery

Fetch and bind the entities pack as described in [reusable entities](entities.md). Read the
type's `livery.variants` for its ids, labels, paint recipes and provenance. Override only
`selected` when instantiating the type:

```json
{
  "id": "aircraft",
  "type": "molen.entities.aircraft.f_16b",
  "components": {
    "transform": { "pos": [0, 0, 0] },
    "livery": { "selected": "aggressor-blue" }
  }
}
```

The F-16B choices are `authored`, `service-gray`, `aggressor-desert` and `aggressor-blue`.
The aggressor schemes adapt reference photographs of F-16s to the library's
two-seat model; they are explicitly marked as inspired, not serial-specific replicas.
There is currently no F-4 model in this pack.

Change a scene entity from a script with `molen.patch('aircraft', 'livery',
{ selected: 'service-gray' })`. The client retains the model and replaces its appearance;
instances sharing a GLB keep independent liveries. Removing the component restores the
original materials. Selection is serializable and replays with the rest of the entity data;
it does not change vehicle physics.

Earth hosts can use the same choices:

```ts
const id = view.vehicles.spawn({
  type: 'molen.entities.vehicle.winnebago_view_2022',
  latitude: 47.61, longitude: -122.33, heading: 0,
  livery: 'mineral-ii',
});
const choices = view.vehicles.liveries(id);
view.vehicles.setLivery(id, 'bay-mist-ii');
```

Earth preserves the selection across model unloading and terrain frame changes. Its lower-level
`EarthVehicles` and `EarthAircraft` APIs also accept a `livery` spawn option and expose
`setLivery(id, selected)`. A custom car `color` overrides the selected recipe's `body` paint;
choosing another livery replaces that override. Distant dimension-only traffic proxies continue
to show their ordinary body color; detailed markings appear on loaded models.

## Author model bindings once

A component owns three layers:

| Layer | Responsibility |
| --- | --- |
| `slots` | Model-owned semantic names such as `body`, `accent`, `roof`; exact GLB material names and an optional named subtree |
| `anchors` | Model-owned sticker projectors, attached to a slot's bounds in the model's rest pose |
| `variants` | Livery-owned colors, camouflage, artwork and provenance referencing those names |

Keep glass, lights, tires, cabin surfaces and paint in separate materials. Do not put a paint
slot on a material shared with the cockpit. A model revision can rename or split meshes,
change topology or replace its UV layout without rewriting the recipes. Preserve material
names, or update the slot binding once. If the shape changes substantially, review and adjust
its anchors once. The renderer reports missing surfaces and projectors that miss the model.

```json
{
  "selected": "blue",
  "slots": { "body": { "materials": ["body-paint"] } },
  "anchors": {
    "left-door": {
      "slot": "body",
      "position": [1, 0.5, 0.5],
      "size": [0.2, 0.08, 0.06],
      "rotation": [0, 1.5707963267948966, 0]
    }
  },
  "variants": [{
    "id": "blue",
    "label": "Blue with ivory stripe",
    "provenance": { "kind": "original", "note": "Original design.", "references": [] },
    "paints": { "body": { "color": "#557990", "roughness": 0.4, "metalness": 0.2 } },
    "markings": [{
      "anchor": "left-door",
      "graphic": {
        "label": "Ivory stripe",
        "shapes": [{ "color": "#e8e5d9", "points": [[0, 0.3], [1, 0.3], [1, 0.7], [0, 0.7]] }]
      }
    }]
  }]
}
```

Anchor positions are fractions of the selected surface bounds, measured from the minimum
corner. Size is width, height and depth as fractions of the bounds' longest dimension.
Rotation is XYZ Euler radians; the projector's +Z points out of the surface. A +X-side
projector uses `[0, PI/2, 0]`, a -X-side projector `[0, -PI/2, 0]`, and a top projector
`[-PI/2, 0, 0]`. Author each side separately so lettering reads correctly. Bind a slot to a
named subtree when a wing, mirror or other protrusion would make whole-body bounds unsuitable.

Markings clip to matching materials, follow the actual geometry, and remain attached to moving
rigid parts. Projection depth should reach only the intended panel. Thin two-sided panels are
supported. Skinned and morph-deformed surfaces are reported as unsupported. Livery updates use
the original bind pose even if a door or control surface has moved since loading.

## Paint and artwork

Paint replaces base color and vertex tint; original normal, metalness, roughness and AO maps
survive. An empty `paints` object preserves the original finish. Camouflage adds a seeded,
low-frequency pattern using a private model-space UV channel:

```json
{
  "color": "#ffffff",
  "camouflage": { "colors": ["#4f5e49", "#79815a", "#ac9973"], "scale": 1, "seed": 17 }
}
```

This is box projection with seams at changes in dominant face direction, not a reproduction
of an aircraft's official paint masking diagram. The pattern ignores authored UVs and stays
fixed on animated parts. Preserve separate upper/lower paint slots for precise two-tone work.

Graphics are ordered colored polygons in a 0–1 square, Y up. They are rasterized to a small
sRGB texture, with no font or network dependency at runtime. Roundels, stars, bars, stripes,
swoops and labels use this same format. For labels, outline text using `buildTextMesh` from
`@bendyline/molen-materials/text` and a font library; normalize its triangles into the square
while preserving the intended aspect ratio. See [fonts and lettering](typography.md).
The `graphic.label` field describes artwork for tools; it does not itself draw text.

Custom three.js hosts call `applyLivery(modelInstance, data)` from `@bendyline/molen-client`.
Read its `warnings`, then call the returned `dispose()` before selecting another recipe or
disposing the model. It restores original materials and geometry and frees only its own
resources. `createVehicleVisual` and `createAircraftVisual` accept the component as a third
argument and expose `setLivery(data)` to manage this lifetime for you.

## Reference evidence and the fleet

Every variant records `provenance.kind` (`photo`, `inspired` or `original`), an honest scope
note and source URLs. `photo` and `inspired` require references. Do not label a proposed
palette as a real unit or factory option without supporting evidence. Source photographs
are references for original artwork; they are not shipped as textures.

The initial fleet includes original palette alternatives, the existing authored finishes,
and explicitly approximate studies of the [USAF aggressor photographs](https://www.af.mil/News/Photos/igphoto/2000580051/),
[Winnebago's 2022 View exterior schemes](https://www.winnebago.com/Files/Images/Winnebago/brochures/2022/2022_View_Digital.X.pdf),
and [Ford's Mustang color photographs](https://www.ford.com.ph/showroom/performance/all-new-mustang/).
Most alternate fleet palettes are original studies, not individually photo-verified replicas.

In the engine repository, `content/entities/source/liveries.json` is the editable catalog.
`generate-models.mjs` validates and merges it into the runtime type libraries; the individual
base-model definitions stay independent. Copy the `livery` component along with a source
bundle when extracting a standalone vehicle. `generate-liveries.mjs` regenerates the initial
catalog from the authored recipe code and current named-material bindings; running it overwrites
catalog edits. Ordinary model builds only consume the catalog, so geometry work cannot erase
livery edits. The shared `scenes/liveries.scene.json` provides a small scene for inspection.
