# Structure assets

| Asset | Molen id | Description | Preview |
| --- | --- | --- | --- |
| [Weathered red barn](red-barn/README.md) | `red_barn_weathered` | Textured timber barn with cream trim, doors, windows, metal roof, collision hull, and reproducible source | [Molen capture](red-barn/shots/red-barn-molen.png) |

Structure entries are self-contained asset workspaces. `source.json` inventories their model
master, textures, definitions, generator and documentation; `models/`, `textures/`, and `scripts/`
hold the editable inputs. Their nested `assets/` directory is the canonical output of
`molen asset import`.
