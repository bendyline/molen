# @bendyline/molen-figures-react

An optional React character designer for Molen figures: players pick a skin tone, head, hair
style, texture and colour, body shape and height, then their clothing and accessories, and see the
figure turn in a live 3D preview.

Part of [Molen](https://molen.dev), an AI-legible 3D experience engine: a deterministic headless
kernel, a three.js client, and a dev loop an agent can drive end to end.

## Install

```sh
npm i @bendyline/molen-figures-react @bendyline/molen-figures three react
```

Node >= 22.13, ESM only, one `.` export plus an optional `./style.css`. React 18 or 19 and
three.js are peers. The designer edits figure looks (`molen/figure-look@1`) from
`@bendyline/molen-figures/look`; Preact hosts can use it through `preact/compat`.

## Use

```tsx
import { useState } from 'react';
import { figureFromLook, randomFigureLook, type FigureLook } from '@bendyline/molen-figures/look';
import { FigureDesigner } from '@bendyline/molen-figures-react';
import '@bendyline/molen-figures-react/style.css'; // optional, responsive baseline

function Character({ view }: { view: EarthView }) {
  const [look, setLook] = useState<FigureLook>(() => randomFigureLook(crypto.randomUUID()));
  return (
    <FigureDesigner
      look={look}
      onChange={(next, change) => {
        setLook(next);
        if (change.committed) localStorage.setItem('look', JSON.stringify(next));
        view.walker.setAvatar({ figure: figureFromLook(next) });
      }}
      strings={{ 'section.person': 'You', 'action.randomize': 'Someone new' }}
    />
  );
}
```

The designer is controlled: the host owns the look and its persistence, and the component never
touches storage. `change.committed` is false while a slider or colour picker is still moving.

## What's in it

| Prop | For |
| --- | --- |
| `look`, `onChange` | The look under edit (any value is repaired first) and each new look |
| `steer` | What every random look leans toward. Left out, "Surprise me" rolls a lean per press (masculine or feminine nine times in ten) and "New outfit" follows the person's body shape and facial hair. The designer lists every option together and asks for no presentation |
| `sections`, `hide` | Show only the person or only the outfit (a wardrobe screen), or leave parts out |
| `outfit` | Show an outfit on the figure instead of the look's own, such as a uniform |
| `strings` | Every word, as a map or a lookup function; keys from `figureDesignerStringKeys()` |
| `preview`, `thumbnails`, `lighting`, `motion` | The 3D preview and option pictures (one WebGL context for both), its light rig, reduced motion |
| `catalog` | A host catalogue of options instead of the default people catalogue |
| `./style.css` | A responsive baseline under `:where([data-molen-figure-designer])`, themed with `--molen-figure-designer-*` custom properties |

Without WebGL the designer keeps every control and says the preview is unavailable.
