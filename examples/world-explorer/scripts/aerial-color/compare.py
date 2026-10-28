"""Compare color proportions between orthophotos and explorer captures.

Usage (from the repository root):
    python -I examples/world-explorer/scripts/aerial-color/compare.py [--dir .artifacts/aerial-color]
        [--captures captures] [--ids a,b] [--target 0.15]

Both images of a frame are area-averaged to the same ground resolution (4 m per pixel, or the
reference's native 10 m for Sentinel-2), converted to CIELAB and softly assigned to nine perceptual
color classes. Photographs first lose their atmospheric haze offset (dark-object subtraction). The
score is the total variation distance between the two class distributions: half the summed
absolute differences, so 0.15 means at most 15% of the frame would have to change class to match. Seeded buildings and plants are not expected to match one by one; proportions are.
"""

import argparse
import json
import pathlib

import numpy as np
from PIL import Image, ImageDraw

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[3]

CLASSES = [
    ('shadow', '#1c1c20'),
    ('dark gray', '#545658'),
    ('mid gray', '#8e8f8f'),
    ('light gray', '#d6d6d4'),
    ('red-orange', '#b4532f'),
    ('tan-brown', '#c3a26c'),
    ('dark green', '#2d5a2c'),
    ('light green', '#8fb85c'),
    ('blue', '#3b6ea6'),
]
NAMES = [name for name, _ in CLASSES]


def ramp(x, a, b):
    return np.clip((x - a) / (b - a), 0.0, 1.0)


def srgb_to_lab(rgb):
    c = rgb / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array(
        [
            [0.4124564, 0.3575761, 0.1804375],
            [0.2126729, 0.7151522, 0.0721750],
            [0.0193339, 0.1191920, 0.9503041],
        ]
    )
    xyz = lin @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    lightness = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return lightness, a, b


def hue_weight(h, start, end, soft=8.0):
    """Trapezoid membership of hue sector [start, end) in degrees, softened by `soft` each side."""
    width = (end - start) % 360
    # Signed offset from the sector's start; every sector here is narrower than 180 - soft.
    offset = (h - start + 180) % 360 - 180
    rising = ramp(offset, -soft, soft)
    falling = 1 - ramp(offset, width - soft, width + soft)
    return np.minimum(rising, falling)


def classify(rgb):
    """Soft class weights, shape (..., len(CLASSES)), summing to one per pixel."""
    lightness, a, b = srgb_to_lab(rgb.astype(np.float64))
    chroma = np.hypot(a, b)
    hue = np.degrees(np.arctan2(b, a)) % 360
    dark = 1 - ramp(lightness, 18, 26)
    lit = 1 - dark
    neutral = (1 - ramp(chroma, 8, 14)) * lit
    chromatic = lit - neutral
    light = ramp(lightness, 62, 70)
    darkish = 1 - ramp(lightness, 38, 46)
    sectors = np.stack(
        [
            hue_weight(hue, 300, 52),  # red, orange, brick, magenta
            hue_weight(hue, 52, 100),  # tan, brown, sand, ochre
            hue_weight(hue, 100, 175),  # vegetation greens
            hue_weight(hue, 175, 300),  # cyan, blue, violet
        ],
        axis=-1,
    )
    sectors /= np.maximum(sectors.sum(axis=-1, keepdims=True), 1e-9)
    green = sectors[..., 2] * chromatic
    weights = np.stack(
        [
            dark,
            neutral * darkish,
            neutral * (1 - light - darkish),
            neutral * light,
            sectors[..., 0] * chromatic,
            sectors[..., 1] * chromatic,
            green * darkish,
            green * (1 - darkish),
            sectors[..., 3] * chromatic,
        ],
        axis=-1,
    )
    return weights


def area_average(image, factor):
    h, w = image.shape[0] // factor * factor, image.shape[1] // factor * factor
    view = image[:h, :w].reshape(h // factor, factor, w // factor, factor, -1)
    return view.mean(axis=(1, 3))


def load(path):
    return np.asarray(Image.open(path).convert('RGB'), dtype=np.float64)


def dehaze(rgb):
    """Dark-object subtraction: remove each channel's haze offset (its 0.1th percentile) in
    linear light and rescale so white stays white. A photo whose darkest pixels are already
    black is unchanged; the explorer captures are taken inside the fog's clear range."""
    lin = np.where(rgb <= 10.31475, rgb / 255 / 12.92, ((rgb / 255 + 0.055) / 1.055) ** 2.4)
    dark = np.percentile(lin.reshape(-1, 3), 0.1, axis=0)
    lin = np.clip((lin - dark) / (1 - dark), 0, 1)
    srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055)
    return srgb * 255


def summarize(image, mask, factor):
    small = area_average(image, factor)
    keep = area_average(mask[..., None].astype(np.float64), factor)[..., 0] > 0.999
    weights = classify(small)
    proportions = weights[keep].mean(axis=0)
    return proportions, weights, keep


def class_map(weights, keep):
    palette = np.array(
        [[int(color[i : i + 2], 16) for i in (1, 3, 5)] for _, color in CLASSES], dtype=np.uint8
    )
    picture = palette[weights.argmax(axis=-1)]
    picture[~keep] = (255, 0, 255)
    return Image.fromarray(picture)


def bar(draw, x, y, width, proportions, label):
    draw.text((x, y), label, fill='black')
    left = x
    for (name, color), p in zip(CLASSES, proportions):
        span = int(round(p * width))
        draw.rectangle([left, y + 14, left + span, y + 34], fill=color)
        left += span


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--dir', default=str(ROOT / '.artifacts/aerial-color'))
    parser.add_argument('--captures', default='captures')
    parser.add_argument('--ids', default='')
    parser.add_argument('--target', type=float, default=0.15)
    args = parser.parse_args()
    base = pathlib.Path(args.dir)
    config = json.loads((HERE / 'frames.json').read_text(encoding='utf8'))
    references = json.loads((base / 'references/references.json').read_text(encoding='utf8'))
    capture_dir = base / args.captures
    captures = json.loads((capture_dir / 'captures.json').read_text(encoding='utf8'))
    wanted = {i for i in args.ids.split(',') if i}
    meters_per_pixel = config['extentMeters'][0] / 1200
    report = {'classes': NAMES, 'target': args.target, 'frames': {}}
    header = f'{"frame":<11}{"TVD":>6}  ' + ' '.join(f'{n[:10]:>10}' for n in NAMES)
    print(header)
    for frame in config['frames']:
        frame_id = frame['id']
        if (wanted and frame_id not in wanted) or frame_id not in captures:
            continue
        record = captures[frame_id]
        if not record.get('loaded'):
            print(f'{frame_id:<11} skipped: capture incomplete')
            continue
        reference = dehaze(load(base / 'references' / references[frame_id]['image']))
        capture = load(capture_dir / f'{frame_id}.png')
        mask = np.ones(reference.shape[:2], dtype=bool)
        if 'maskRect' in record:
            x0, y0, x1, y1 = record['maskRect']
            mask[max(0, y0) : y1, max(0, x0) : x1] = False
        native = references[frame_id].get('nativeMetersPerPixel') or 4
        factor = max(1, round(native / meters_per_pixel))
        p, pw, keep = summarize(reference, mask, factor)
        q, qw, _ = summarize(capture, mask, factor)
        tvd = 0.5 * float(np.abs(p - q).sum())
        report['frames'][frame_id] = {
            'tvd': round(tvd, 4),
            'pass': tvd <= args.target,
            'metersPerPixel': meters_per_pixel * factor,
            'reference': dict(zip(NAMES, np.round(p, 4).tolist())),
            'capture': dict(zip(NAMES, np.round(q, 4).tolist())),
        }
        print(f'{frame_id:<11}{tvd:6.3f}  ' + ' '.join(f'{v:10.3f}' for v in p))
        print(f'{"":<11}{"":6}  ' + ' '.join(f'{v:10.3f}' for v in q))
        print(f'{"":<11}{"diff":>6}  ' + ' '.join(f'{v:+10.3f}' for v in q - p))
        # Evidence sheet: photo | capture over their class maps, with proportion bars.
        w, h = 600, 400
        sheet = Image.new('RGB', (w * 2, h * 2 + 90), 'white')
        sheet.paste(Image.fromarray(reference.astype(np.uint8)).resize((w, h)), (0, 0))
        sheet.paste(Image.fromarray(capture.astype(np.uint8)).resize((w, h)), (w, 0))
        sheet.paste(class_map(pw, keep).resize((w, h), Image.Resampling.NEAREST), (0, h))
        sheet.paste(class_map(qw, keep).resize((w, h), Image.Resampling.NEAREST), (w, h))
        draw = ImageDraw.Draw(sheet)
        bar(draw, 8, h * 2 + 4, w * 2 - 16, p, f'{frame_id} photo')
        bar(draw, 8, h * 2 + 44, w * 2 - 16, q, f'molen  (TVD {tvd:.3f})')
        sheet.save(capture_dir / f'{frame_id}-compare.png')
    scores = [f['tvd'] for f in report['frames'].values()]
    if scores:
        print(f'mean TVD {np.mean(scores):.3f}; worst {max(scores):.3f}; target {args.target}')
    (capture_dir / 'report.json').write_text(
        json.dumps(report, indent=2) + '\n', encoding='utf8', newline='\n'
    )


if __name__ == '__main__':
    main()
