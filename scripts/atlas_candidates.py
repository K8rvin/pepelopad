import json
import os
import zipfile

import numpy as np
from PIL import Image, ImageDraw

ZIP_PATH = "C:/Projects/YandexGames/pixel-art-atlas-1.4m/pixel-art-16x16-1.4m.zip"
OUT_PATH = "tmp/atlas-selected.png"
EXPORT_DIR = "public/assets/sprites"
SELECTION = {
    "wood": 257,
    "scrap": 3068,
    "cloth": 2769,
    "chem": 1015,
    "elec": 1143,
    "can": 5052,
    "bandage": 273,
    "medkit": 4605,
    "armor": 13,
    "arrow": 101,
    "crossbow": 162,
    "pistol": 353,
    "rifle": 489,
    "crate": 309,
    "rock": 452,
    "player": 435300,
    "survivor": 448183,
    "walker": 435079,
    "dog": 435219,
    "brute": 436455,
    "spitter": 435229,
    "riot": 436140,
    "howler": 436432,
    "tree": 408,
}

with zipfile.ZipFile(ZIP_PATH) as archive:
    captions = json.load(archive.open("captions.json"))
    palette = np.load(archive.open("palette.npy"))
    tokens = np.load(archive.open("tokens.npy"))

    scale = 8
    columns = 5
    rows = (len(SELECTION) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * 16 * scale, rows * 48), (20, 20, 24, 255))
    draw = ImageDraw.Draw(sheet)

    for position, (name, index) in enumerate(SELECTION.items()):
        pixels = tokens[index].reshape(16, 16)
        rgba = np.dstack((palette[pixels], (pixels != 0).astype("uint8") * 255))
        sprite = Image.fromarray(rgba).resize((16 * scale, 16 * scale), Image.Resampling.NEAREST)
        x = position % columns * 16 * scale
        y = position // columns * 48
        sheet.paste(sprite, (x, y))
        draw.text((x, y + 16 * scale + 2), f"{name}:{index}", fill="white")
        print(f"{name}: {index} — {captions[index]}")
        os.makedirs(EXPORT_DIR, exist_ok=True)
        sprite.save(f"{EXPORT_DIR}/{name}.png")

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
sheet.save(OUT_PATH)
