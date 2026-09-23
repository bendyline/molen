"""Make documentation and QA contact sheets from Molen's captured model PNGs."""

from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
assets = json.loads((ROOT / "asset-src/import-report.json").read_text(encoding="utf-8"))["assets"]
font = ImageFont.load_default(size=16)
small = ImageFont.load_default(size=12)
large = ImageFont.load_default(size=38)
poster = Image.new("RGB", (1470, 1110), "#182831")
draw = ImageDraw.Draw(poster)
draw.text((30, 22), "THE LANTERN VAULT", font=large, fill="#e9d6a3")
draw.text(
    (32, 74),
    "28 ORIGINAL MODELS   /   CREATURES, CARVED STONE, BRASS & SOUL GLASS",
    font=font,
    fill="#94b6b7",
)
for i, a in enumerate(assets):
    x, y = (i % 7) * 210, 120 + (i // 7) * 245
    frame = ROOT / ".artifacts/assets" / a["name"] / "angle_2.png"
    if not frame.exists():
        raise SystemExit("Capture assets first: pnpm assets:shot")
    poster.paste(Image.open(frame).convert("RGB").resize((200, 200)), (x + 5, y))
    draw.text((x + 10, y + 204), a["name"].replace("-", " ").title(), font=small, fill="#f0e4c8")
    draw.text(
        (x + 10, y + 222),
        f'{a["category"]} / {a["stats"]["triangles"]:,} triangles',
        font=small,
        fill="#94b6b7",
    )
poster.save(ROOT / "asset-src/catalog.png")
for batch in range(7):
    sheet = Image.new("RGB", (1024, 1120), "#18252d")
    draw = ImageDraw.Draw(sheet)
    for row, a in enumerate(assets[batch * 4 : batch * 4 + 4]):
        draw.text((12, row * 280 + 5), a["id"], font=small, fill="white")
        for col in range(4):
            frame = ROOT / ".artifacts/assets" / a["name"] / f"angle_{col}.png"
            sheet.paste(
                Image.open(frame).convert("RGB").resize((256, 256)), (col * 256, row * 280 + 24)
            )
    sheet.save(ROOT / ".artifacts/assets" / f"qa-{batch}.jpg", quality=88)
rows = [
    "# Lantern Vault asset catalog",
    "",
    "![All 28 models](catalog.png)",
    "",
    "All IDs are registered in `../project.json`. Bounds and both SHA-256 hashes are in [import-report.json](import-report.json). The scene uses every asset.",
    "",
    "| Asset ID | Description | Triangles | Runtime KiB | Clips |",
    "| --- | --- | ---: | ---: | --- |",
]
for a in assets:
    rows.append(
        f'| [{a["id"]}](../{a["sidecar"]}) | {a["description"]} | {a["stats"]["triangles"]:,} | {a["importedBytes"] / 1024:.1f} | {", ".join(a["clips"]) or "none"} |'
    )
(ROOT / "asset-src/CATALOG.md").write_text("\n".join(rows) + "\n", encoding="utf-8")
print("Wrote the asset catalog and seven sheets covering all 112 turntable views.")
