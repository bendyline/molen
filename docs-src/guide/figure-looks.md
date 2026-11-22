# Figure looks and the character designer

A **figure look** is a person and their outfit chosen from a catalogue of named options: skin
tone, head, hair style, texture and colour, facial hair, eye colour, body shape and height, then
a top, a bottom, footwear and accessories. Looks are small JSON documents
(`molen/figure-look@1`) that a game stores for its player or its characters. `figureFromLook`
turns one into the [figure](figures.md) descriptor every figure API takes, and
`@bendyline/molen-figures-react` lets players design their own.

## Looks

`@bendyline/molen-figures/look` is plain data: no three.js, no zod and no kernel runtime, so a
page can make or repair a player's look before it loads any 3D.

```ts
import { figureFromLook, normalizeFigureLook, randomFigureLook } from '@bendyline/molen-figures/look';

const saved = JSON.parse(localStorage.getItem('look') ?? 'null');
const look = saved ? normalizeFigureLook(saved).look : randomFigureLook(crypto.randomUUID());
view.walker.setAvatar({ figure: figureFromLook(look) });
```

| Function | Does |
| --- | --- |
| `randomFigureLook(seed, { steer, age, keep })` | A complete look for a seed; the same seed and catalogue give the same look. `keep` copies parts of an existing look (`'person'`, `'outfit'`, a category) |
| `normalizeFigureLook(value)` | Repairs anything into a valid look and lists what it fixed. Total and idempotent |
| `figureFromLook(look, { outfit })` | The figure descriptor. `outfit` dresses the person in another outfit, such as a uniform, without changing who they are |
| `setFigureLookOption`, `setFigureLookColor`, `setFigureLookHeight` | Immutable edits |
| `figureLookOptions(category, { steer })` | A category's options, suggested ones first |
| `figureLookReplaced(outfit)` | The garments the worn items cover (a dress covers the bottom) |
| `figureLookPool(seed, { count, age })` | A fixed set of varied looks for a crowd, so its bodies share geometry |

A look has two halves. `person` holds who someone is (`body`, `head`, `hair`, `hairTexture`,
`facialHair` option ids, `skin`, `hairColor` and `eyes` colours, `height` in meters, `age`), and
`outfit` holds what they wear (`top`, `bottom`, `footwear` and optional `accessories`, each an
option id with its colours).

> [!TIP]
> Store the look, not its seed. A look keeps its meaning across catalogue revisions; a seed
> draws a different person once options are added.

## Steering and neutrality

A steer, `masculine`, `feminine` or `unspecified`, orders options and weights random looks. It is
designer state and never part of a look, so a shared look does not disclose it. The default
catalogue keeps three rules, and `validateFigureLookCatalog` enforces the first two for any
catalogue:

- Skin tone, head, hair style, hair texture, hair colour and eye colour are never steered. A
  random look draws each of them independently of every other choice and of the steer.
- A steer only reorders body shapes, facial hair and clothing, and never removes an option. Under
  `masculine` or `feminine` the options it does not suggest are listed after the rest, and random
  looks do not draw them. Under `unspecified` every option is suggested.
- Skin tones are one ramp of ten, evenly spaced in lightness and named "Tone 1 of 10" to "Tone 10
  of 10". Option labels describe shapes and colours, never groups of people.

## Catalogues

`DEFAULT_FIGURE_LOOK_CATALOG` (`molen.people`, revision 4) is built from the features the body
generator draws:

- nine body shapes, three on each body form, shaped by waist, bust, belly and seat;
- twelve faces, the [head presets](figures.md#heads);
- eighteen hair styles and four textures, plus facial hair;
- eleven tops: long- and short-sleeved shirts, a T-shirt, a polo, a sleeveless top, a sweater, a
  hoodie, a jacket, a coat and two dresses ([garments](figures.md#garments));
- six bottoms: trousers, slim, wide and cropped trousers, shorts and a skirt;
- shoes, sneakers, boots and sandals;
- accessories, one slot each: a cap, beanie or sun hat; glasses or sunglasses; a scarf; a
  backpack; headphones; a watch; a shoulder bag ([accessories](figures.md#accessories)). Each
  slot has a `chance`, how often a random look wears something there, and is empty otherwise;
- palettes of skin, hair, eye, fabric, footwear and belt colours, and `gear` (frames,
  headphones, watch straps).

An item lists the colours it lets the wearer choose in `colors`, main colour first. A jacket or
coat has two: `outer` for itself and `top` for the shirt under it. An option may also `replaces`
other garments: a dress replaces the bottom, so while it is worn `figureFromLook` leaves the
bottom out, `figureLookReplaced(outfit)` names it, and the designer hides its picker. The look
keeps the bottom, so choosing another top brings it back.

Every function takes `catalog` for a host's own.

Option ids are stable. A look records its catalogue as `<id>@<revision>`; when a revision retires
an option it adds an alias (old id to replacement). `normalizeFigureLook` follows aliases, and
replaces an unknown id with a draw seeded from the look itself, so retired ids spread over the
catalogue instead of collapsing onto one default person. A look from a newer revision than the
reader's comes back with a `newer-catalog` issue: show the repaired look, but do not save it over
the original.

## The designer

`@bendyline/molen-figures-react` is the shipped designer: a 3D preview beside the person's choices
and their clothing, as two tabs. It is controlled: the host owns the look and saves it.

```tsx
import { FigureDesigner } from '@bendyline/molen-figures-react';
import '@bendyline/molen-figures-react/style.css';

<FigureDesigner
  look={look}
  onChange={(next, change) => {
    setLook(next);
    if (change.committed) save(next);
  }}
  strings={{ 'steer.masculine': 'Male', 'steer.feminine': 'Female', 'steer.unspecified': 'Non-binary' }}
/>;
```

Options and colours are native radio groups with visible labels, the arrow keys move between tabs,
every target is at least 44 px, and a polite live region announces each change. `strings` renames
anything: a map or a lookup function over the keys `figureDesignerStringKeys()` lists. `sections`
shows only the person or only the outfit, `hide` leaves parts out, and `outfit` shows a uniform on
the figure while the look keeps its own clothes. The stylesheet uses `:where()` selectors and
`--molen-figure-designer-*` custom properties; its fallbacks are system colours, so set
`color-scheme` on your page for them to follow dark mode.

`@bendyline/molen-figures/designer` holds the framework-free parts for a host building its own
UI: `createFigureDesignerModel` (edits, undo, transient drags that commit as one step),
`mountFigurePreview` and `describeFigureLook`.

## The preview

`mountFigurePreview(canvas, { figure, pose, framing, lighting })` draws one figure on a turntable
into a 2D canvas, and `preview.thumbnail(target, figure, framing)` draws small pictures of others.
Both use one WebGL context on a hidden canvas, so a designer with dozens of option pictures holds
one context beside an Earth view's. It needs no kernel world and loads no SES. Drawing is on demand:
a still pose draws once per change, a walk animates. Lighting defaults to the Earth view's
clear-day rig; without WebGL `available` is false and the host keeps its controls.

## In the Earth view

```ts
const view = await mountEarthView({ ...options, avatar: { figure: figureFromLook(look) }, walkView: 'third' });
view.walker.setAvatar({ figure: figureFromLook(next) }); // re-dresses the body on screen
```

`avatar` gives the viewer a body from the first frame and `walkView: 'third'` starts on foot behind
it. A later `setAvatar` swaps the body in place: the old one stays on screen until the new one's
shaders are built.
