# 3D art guidelines

Molen's baseline is a readable polygonal world: strong silhouettes, restrained palettes, clear
material blocks, and modest surface detail. A building or prop should remain recognizable when
textures are disabled. Textures add material character such as brick courses; they do not carry
the entire identity.

These guidelines apply to imported static GLBs, built-in instanced props, and parameterized
worldgen buildings. They are authoring targets, not new runtime hard limits. Use the existing
[model asset workflow](3d-model-assets.md) for import, validation, hashes, hosting, and captures.

## Recognition and shape

Work from large to small: footprint and height, roof and massing, entrance and facade rhythm,
then sign and surface detail. For a mapped business, use a generic category wordmark, an
initial-based emblem, a controlled accent color, and an entrance treatment. Source-inspired
palettes may distinguish descriptor variants, but model IDs, filenames, displayed names and
emblem geometry stay generic.

Keep mapped footprints, courtyards, height, and minimum height when supplied. Missing height is
unknown: the category recipe supplies a conservative default. An identified tenant does not
own an entire strip mall. Apply its facade locally and retain other tenants.

Flat or gently faceted surfaces are the default. Use hard normals on architecture and metal
edges; smooth normals only on deliberately round shapes. Curved identity marks should still
read at low polygon counts. Avoid tiny bevels, microdisplacement, alpha-card foliage and surface
noise that shimmer at street-view distance. Signs face +Z in their own frame and must read from
the street; never mirror text to compensate for an incorrectly oriented facade.

## Scale and pivots

Use meters, +Y up, and transforms near unit scale. Ground-standing props have their base at
Y=0. Wall-mounted signs have a documented attachment plane. Record front direction and native
dimensions alongside each model.

| Reference | Baseline |
| --- | --- |
| Adult scale reference | 1.75 m |
| Child figure | 1.1–1.4 m |
| Dog at the shoulder | 0.5–0.7 m |
| Horse at the withers | 1.5–1.7 m |
| Ordinary door | 0.9–1.1 m wide, 2.1–2.4 m high |
| Commercial double entrance | 1.6–2.2 m wide, up to 2.6 m high |
| Bench | About 1.8 m wide; seat about 0.48 m high |
| Bicycle hoop | About 0.85 m high |
| Street lamp | About 7 m; use a mapped height when present |
| Charging pedestal | About 1.8 m |
| Canonical facade sign | 4 × 1.35 m; base Y=0, front +Z |

Check scale beside a person, a door, and a road. Make signs readable through proportions and
contrast before increasing their size. Do not stretch a mark independently in X and Y.
Mapped tree height and crown diameter scale normalized tree models independently in height
and horizontal diameter; missing species remains an estimate.

## Fidelity and geometry budgets

Use the lowest detail that survives the intended view. These targets describe one reusable
model; scene and tile budgets still control total instances and building vertices.

| Asset | Near target | Medium/distant treatment |
| --- | --- | --- |
| Identity sign | Under 650 triangles, one material | Remove small lettering first; retain symbol and color |
| Bench, rack, charger, lamp | 50–500 triangles | Merge slats/cables; retain silhouette |
| Ordinary tree | 300–2,000 triangles | Fewer crown clusters, then a faceted crown/cone |
| Small static building | 1,000–8,000 triangles | Remove furniture and small facade details |
| Procedural building | Budgeted per outline | Keep measured envelope, main roof and identity where feasible |
| Figure (human or animal) | 1,000–4,000 triangles, one vertex-color material | 600–900 medium tier; 100–300 rigid distant tier |

Higher budgets need a visible reason and a distance fallback. Repeated street furniture and signs
should be instanced by model reference. Prefer a shared vertex-color material; do not allocate
one material or texture per store. Never put an unlimited number of signs on a complex outline:
the current frontage contract admits at most twelve per generated building.

The sign library preserves exact geometry between instances. Source business identity controls
matching; stable feature identity controls placement and variation. Do not use wall-clock time,
unseeded randomness, or locale-dependent sorting to generate geometry.

## Figures

Figures ([guide](figures.md)) stay left of the uncanny valley on purpose: a head about one
sixth of the height for adults and closer to a quarter for children, mitten hands, block shoes or
hooves, disc eyes and brows with no mouth, nose or teeth, hair as a solid shell, and clothing as
vertex-color blocks with hard edges at cuffs, hems and collars. Segments are smooth within
themselves and low in ring count (eight to twelve sides), joints share rings with two bone
influences, and each figure uses three to five intentional colors from its palette. Animals
follow the same rules: a barrel body, cone ears, a snout, hooves or paws, and one marking color.
Review every preset from the front, three-quarter, rear and gameplay distance
(`molen figure preview --angles review`) beside a door and a bench before accepting a look.

## Color, light and material response

Use muted wall/ground colors and reserve saturated accents for identity and wayfinding.
Limit each object to roughly three to five intentional colors, excluding small surface variation.
Roof and foundation values should separate from the wall without outlining every edge.

Author with neutral daylight, real cast shadows and a shadow-receiving ground. Base color must
not contain baked directional shadows or highlights. Prefer rough matte paint, brick, concrete,
wood, and coated metal; glass should read as glazing without becoming a mirror everywhere.
Use material variation to explain construction, not to disguise missing geometry.

For GLB PBR assets, base color/emissive are sRGB; normal, roughness, metalness and occlusion are
linear data. Existing worldgen palette helpers and three.js color inputs have different conversion
paths: compare rendered swatches when transferring colors between static and procedural assets,
rather than copying a linear buffer value into an sRGB authoring field.

## Canonical material library

Reuse the default pack's stable material IDs before adding another texture. The library already
contains brick, stucco, concrete, siding, stone, roofing and glazing; the
[material catalog](https://github.com/bendyline/molen/blob/main/content/worldgen/materials/README.md) records intended
uses and physical repeat sizes.

Use 256² or 512² seamless procedural maps for common repeated surfaces. Larger textures belong
to a visibly close hero asset and must fit its memory budget. Start at 64–128 texels per meter
at the closest ordinary view and check mipmapped distance views. Specify physical UV repeat size:
a two-meter facade should not accidentally contain two-meter bricks.

Patterns should have subdued contrast. Prefer a small shared base-color/roughness set over
unique store textures. Normal maps should describe mortar or subtle grain, not change the
silhouette. Pack bitmap GLB textures to KTX2 with mipmaps for shipping, per the asset workflow.
Runtime matgraph textures remain small and shared; they do not pass through asset packing.

## Persisting reusable models

Store individual sign and furniture definitions in the default pack's
[landmark manifests](https://github.com/bendyline/molen/blob/main/content/worldgen/landmarks/README.md), with stable IDs,
versioned parameters and shared generators. Keep source-ID/name matching in the Earth business
catalog. Reuse architectural styles and material graphs instead of copying their rules into each
mapped-business descriptor. A new store palette or an existing sign-symbol variation should be a
data edit.

## Static and procedural parity

A static asset and its procedural counterpart must agree on scale, pivot, front direction,
palette, and intended detail tier. The identity and furniture generators are exported through
the worldgen kernel. Their buffers can be exported with encodeGlb; import the resulting GLB
through the normal asset workflow when a project needs a standalone static asset.

Procedural building bakes currently include the building mesh; attached sign/furniture instances
remain separate placements. To preserve a mapped-business treatment in a static scene, retain those
placements or explicitly assemble and import the complete model. Do not silently ship the bare
shell as an equivalent bake.

## Review before adding to the library

Capture front, three-quarter, rear, and a normal gameplay-distance view. Include a neutral
ground, a scale reference, and a texture-disabled view. Verify outward normals, legible unmirrored
signs, ground contact, and believable shadows. Test at least two scales and a rotated placement.
For storefronts, include one shared building and a footprint with a courtyard or seam.

Compare near and distant representations for popping, silhouette drift and floating pivots.
Record triangles, material groups, model reference, texture sizes, source hashes for imported
assets, and the generator/catalog version. Keep a repeatable scene or batch fixture and a
reviewed visual regression. A successful build without inspected images is not visual approval.

The [recognizable places guide](recognizable-places.md) explains how to extend the first identity
library and use the art-review showcase.
