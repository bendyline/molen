# Aircraft livery authoring

Every aircraft carries three to eight liveries, each a real operator's scheme studied from
photographs. They are written as design modules here and built into
`content/entities/source/liveries.json` (the `molen/fleet-liveries@1` catalog), which
`generate-models.mjs` copies into the type catalogs.

## What a livery may show

- **Military:** real national insignia, tail codes, serials, modex numbers, unit titles
  (NAVY, U.S. AIR FORCE, ARMY, RAF ...) and squadron tail art. All artwork is **redrawn as
  original vector art** from the photographs: no traced or copied image pixels.
- **Civil operators (airlines, charter, police, ambulance, corporate):** their real colors,
  cheatlines, tail patterns and paint layouts, but **no operator names, logos or wordmarks**.
  Leave titles off, or use a plain generic word only where the photographed scheme has
  plain functional lettering (POLICE, AMBULANCE, RESCUE). A civil variant's `id` and `label`
  describe its colors (`white-navy-belly-navy-tail`, "White over navy belly, navy tail"); name
  the operator only in the provenance note, to identify the photograph. Government operators
  (coast guards, gendarmeries, national police air arms) follow the military rule.
- **Registrations:** military serials as photographed; civil registrations in the right
  national format but not the photographed aircraft's own (use a plausible fictional one).
- **Never:** trademarked characters or mascots, even on military aircraft (VF-31's Felix the
  Cat, cartoon nose art), manufacturer logos, or anything presented as an official replica.
- Every variant links at least one photograph (Wikimedia Commons file page, public domain or
  CC) and its note says what was approximated or omitted.

## Workflow

```sh
# What can be painted: materials and node paths of the imported (runtime) model
node packages/entities/scripts/build-aircraft-liveries.mjs --ids=<slug> --surfaces
# Build the design module into liveries.json; applies every variant through the client
node packages/entities/scripts/build-aircraft-liveries.mjs --ids=<slug>
# Look at them (repo-local review tool, not shipped)
node .artifacts/aircraft-fidelity/review.mjs --ids=<slug> --livery=all --views=q3f,q3r,side,top --gpu
```

The build loads the **imported runtime model** (`content/entities/assets/.../model.glb`). Slot
materials and node names are runtime names (import dedupes identical materials).

## A design module

`aircraft/<slug>.mjs`:

```js
export function slots(existing) {            // optional: paint regions (default: existing)
  return { ...existing, 'fin-1': { materials: ['F14-upper'], node: 'F14-fin-1-F14-upper' } };
}
export default function design({ kit: k, space, slots, bounds, entry }) {
  return { selected, anchors, graphics, variants };
}
```

See `aircraft/f-14d.mjs` for a complete example (VF-103 and VF-84 Jolly Rogers, VF-2, VF-213).

- **Slots** bind paint to model materials, optionally restricted to a named node subtree. Every
  slot a variant paints must exist; slots a variant leaves out keep the authored color.
- **Paint**: `{ color, roughness?, metalness?, camouflage?, zones? }`.
  - `camouflage: { colors: [2–4], scale, seed, style: 'blotch' | 'splinter' | 'digital' }`
    projects a model-space pattern (equal area per color).
  - `zones: [{ color, planes }]` paints over part of a slot where every plane holds, cut
    exactly along the planes: two-tone splits, cheatlines, fin tip bands, belly colors.
    Build planes in metres with `space.plane(slot, normal, point)`, `space.above(slot, y)`,
    `space.below(slot, y)`, `space.ahead(slot, z)`, `space.behind(slot, z)` and
    `space.sideLine(slot, [z0, y0], [z1, y1], side)` (a sloped cheatline edge). Limits: 12 zones
    per paint, 8 planes per zone, 64 markings per variant.
- **Raised parts in their own slot** (strakes, strips, fairings) hide a marking projected only on
  the skin beneath. Give the marking a second anchor on the raised part's slot with the same
  placement.
- **Anchors** are box projectors: `space.anchor(slot, { center, facing, up, width, height,
  depth })` in metres in the model frame (+Z nose, +X the aircraft's LEFT, +Y up). The artwork's
  +X is the reader's right when looking at the surface along -facing; text reads correctly on
  both sides with the side's own anchor (no mirroring needed). Keep `depth` just thick enough
  to reach the skin (thin parts: 0.3–0.6 m) so the opposite face is not painted.
- **Graphics** are drawn on `new k.Canvas(width, height)` in metres (origin bottom-left,
  y up) and finished with `.graphic(label)`. Put reused art in `graphics` and reference it by
  id; `flip: true` on a marking mirrors it (art that faces forward on both sides).
  - `c.text(color, label, { x, y, height, face, align, maxWidth, tracking, slant })` sets real
    lettering (faces: `technical` Overpass SemiBold, `regular`, `geometric` Jost, `mono`).
  - `c.rect`, `c.box` (rotated), `c.circle`, `c.ring`, `c.star`, `c.add(color, points, holes)`,
    `c.path(color, svgPathData, { viewBox, x, y, w, h })` for drawn art.
  - Insignia: `k.usInsignia(c, cx, cy, r, { style: 'full' | 'lowvis', color })` (4r wide),
    `k.roundel(c, cx, cy, r, k.ROUNDELS.raf)` and the other `ROUNDELS`, `k.balkenkreuz`,
    `k.swedenRoundel`, `k.swissMark`, `k.hinomaru`, `k.israelMark`, `k.russianStar`,
    `k.australiaRoundel`, `k.canadaRoundel`, `k.finlandRoundel`, `k.polandMark`,
    `k.koreaRoundel`, `k.checks`. Add others to `kit.mjs` as original drawings.

## Pitfalls

- `Canvas.text` centres the cap height on `y`; it does not sit on a baseline at `y`. Leave
  half the text height above and below, or the tops or bottoms of the digits are clipped.
- Fins, wings and stabilizers are often one double-sided material. A projector deeper than the
  skin also paints the opposite face, mirrored. Measure the skin and keep `depth` to a few
  centimetres there, one anchor per face. Twin canted fins need an anchor per side of each fin.
- A rudder or elevator in its own slot is a separate skin set into the fin. Art that crosses
  the hinge needs a twin anchor on the control surface's slot, or it stops at the hinge.
- Camouflage `scale` counts pattern repeats across each slot's longest side. Set it per slot
  from `bounds` so the patch size matches between a fuselage and a small fin.
- Outlined lettering costs points: every glyph is a polygon with holes, and an outline or
  shadow copy repeats it. Prefer fill-only lettering and modest curve resolution.
- On a Wikimedia Commons file page, the `Special:FilePath/<name>?width=1000` link downloads a
  reference quickly when the Commons API is rate-limited.

## Quality bar

- Recognizable at a glance as the photographed scheme: base colors, the big color areas
  (zones), the tail, and the marks a spotter would look for (insignia position and size,
  codes, cheatlines).
- Lettering is real type at the photographed size; markings sit on the surface (check close
  renders from both sides, from above and below).
- Budget: about 150 KiB of livery JSON per aircraft (the build prints the size); reuse shared
  graphics; keep curves at modest resolution.
