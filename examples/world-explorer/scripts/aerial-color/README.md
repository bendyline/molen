# Aerial color comparison

Repeatable check of how the World Explorer's airplane view compares with open orthophotos of the
same ground. For each frame in [frames.json](frames.json) it captures a north-up orthographic
view of the explorer, downloads the matching photograph, and compares the share of the frame
each perceptual color class covers. Seeded buildings and plants are not expected to match one by
one; color proportions are.

Run from the repository root, with the explorer's dev server on port 5225
(`pnpm --filter @bendyline/molen-examples-world-explorer dev`):

```sh
python -I examples/world-explorer/scripts/aerial-color/fetch-references.py
node examples/world-explorer/scripts/aerial-color/capture.mjs
python -I examples/world-explorer/scripts/aerial-color/compare.py
```

Outputs stay in the ignored `.artifacts/aerial-color/` directory: `references/` (photographs and
their source/licence manifest), `captures/` (screenshots, `captures.json` with load state and
console errors, `report.json` and a `<frame>-compare.png` evidence sheet per frame). Photographs
are comparison evidence, never runtime textures.

## Frames and sources

| Frame | Source | Licence |
| --- | --- | --- |
| Seattle, Bellevue, Sammamish, Yuma | USGS NAIP Plus image service | Public domain |
| Kyoto | GSI seamless aerial photographs (zoom 17 tiles) | GSI terms, attribution required |
| Sydney | NSW Imagery (NSW Spatial Services) | CC BY 4.0 |
| New Delhi | Copernicus Sentinel-2 L2A true color, via Microsoft Planetary Computer | Copernicus open data terms |

Each frame covers 2,400 × 1,600 m. Its `date` puts the sun at the azimuth and elevation
estimated from the photograph's own building shadows (Delhi: the satellite overpass). Captures
use `month=0` (neutral leaf-on vegetation), frozen animation, no traffic, WebGL and the
Balanced quality preset; `?aerialOrtho=<meters>` is the explorer's capture mode.

## Metric

Both images are area-averaged to one ground resolution (4 m per pixel, or the reference's own
10 m for Sentinel-2) and converted to CIELAB. Each pixel is softly assigned to nine classes:
shadow, dark, mid and light grey, red-orange, tan-brown, dark green, light green and blue. The
score is the total variation distance between the two class distributions: half the summed
absolute differences, so 0.15 means at most 15% of the frame would have to change class. The
attribution box is masked in both. Photographs first lose their haze offset (dark-object
subtraction), which matters for the hazy GSI mosaic and barely touches NAIP.

The class boundaries are hard thresholds on lightness and chroma, softened by a few units, so a
large uniform surface sitting near a boundary (light urban paving, for instance) can move
several points for a small brightness change. Read the per-class differences, not only the total.

## Diagnostics

`capture.mjs` takes `--ids`, `--alt`, `--pitch`, `--yaw`, `--date`, `--quality`, `--seed`,
`--perspective=1`, `--suffix`, `--frames=<other frames.json>` and `--extra=key:value,...` for
diagnostic query parameters (for example `shadows:0` or `buildingInfill:0`). Captures are
deterministic: repeating one gives the same image.
