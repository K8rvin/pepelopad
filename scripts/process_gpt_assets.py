import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets-src" / "generated"
IMPORT_DIR = ROOT / "tmp"
OUTPUT_DIR = ROOT / "public" / "assets" / "gen"


def asset(asset_id, import_name, kind, prompt):
    return {
        "id": asset_id,
        "import": import_name,
        "source": f"gpt_{asset_id}_v1.png",
        "target": f"{asset_id}.png",
        "kind": kind,
        "prompt": prompt,
    }


ASSETS = [
    asset("tree_dead", "Грозное древо без листьев.png", "tree", "Isolated 2D isometric game sprite of a dead leafless tree with dark twisted branches, muted ash-grey palette, transparent RGBA background, no ground or shadow."),
    asset("tree_birch", "Изометрическая берёза с осенней листвой.png", "tree", "Isolated 2D isometric birch with sparse pale autumn foliage and opaque white-grey bark, transparent gaps between branches, no ground or shadow."),
    asset("win_intact", "Старинное окно с шестью мутными стёклами.png", "window", "A single intact frontal suburban window with weathered white wooden frame, six dark grey-blue panes in a 2 by 3 grid, a sill and no wall."),
    asset("win_broken", "Потрёпанная рама разбитого окна.png", "window", "The same window broken for human passage: remove glass and inner mullions, leave a large genuinely transparent opening, edge shards, outer frame and sill."),
    asset("win_lit", "Старинное окно с тёплым светом.png", "window", "The same intact window at night with softly glowing warm glass, unchanged frame and transparent background, no wall or external glow."),
    asset("survivor", "Постапокалиптический выживший в капюшоне.png", "character", "Full-body neutral playable survivor in a grey-blue hooded jacket and dark jeans, empty hands, no weapons, quiver or backpack, transparent RGBA."),
    asset("survivor_bow_draw", "Лучник в капюшоне с натянутым луком.png", "character", "The same survivor at full bow draw aiming right, left arm extended, right hand at cheek, full body and bow, no backpack or quiver, transparent RGBA."),
    asset("npc_oleg", "Суровый выживший с топором и сумкой.png", "character", "Full-body Oleg, broad-stocky man around 50 with short grey beard, olive work jacket, rust scarf, tool satchel and belt hatchet, transparent RGBA."),
    asset("npc_vera", "Уставшая полевая медик с сумкой.png", "character", "Full-body Vera, former teacher and shelter medic around 45, low bun, burgundy cardigan, medical satchel and plain armband, transparent RGBA."),
    asset("npc_sanych", "Суровый полицейский с дубинкой.png", "character", "Full-body Sanych, heavyset man around 55 with shaved head and grey moustache, dark navy police jacket and baton, no firearm, transparent RGBA."),
    asset("npc_raya", "Бдительная медсестра-выжившая.png", "character", "Full-body Raya, sturdy hospital orderly around 60, grey headscarf, teal scrubs and quilted vest, stern protective stance, transparent RGBA."),
    asset("npc_masha", "Измождённая выжившая с перевязанной рукой.png", "character", "Full-body Masha, young exhausted but human survivor in ochre sweater with a bandaged bitten forearm, no zombie features, transparent RGBA."),
    asset("furn_sink", "Старая раковина с тумбой.png", "furniture", "Single isometric worn off-white kitchen cabinet with two doors, dark wooden counter, integrated metal sink and faucet, no wall or floor."),
    asset("furn_stove", "Винтажная кухонная плита с потертостями.png", "furniture", "Single isometric four-burner off-white enamel stove with oven and four knobs, light wear, no cookware, wall or floor."),
    asset("furn_toilet", "Потёртый фарфоровый туалет с поднятым сиденьем.png", "furniture", "Single isometric aged porcelain toilet with rear tank and visible bowl, subtle grime, no bathroom walls or floor."),
    asset("furn_bathtub", "Винтажная ванна с потёртой эмалью.png", "furniture", "Single isometric rectangular empty enamel bathtub with faucet, two handles and simple feet, no water, walls or floor."),
    asset("furn_bathroom_sink", "Старинная раковина с пьедесталом.png", "furniture", "Single isometric off-white porcelain bathroom pedestal sink with faucet and two handles, no mirror, walls or floor."),
    asset("furn_nightstand", "Старинная деревянная тумбочка с патиной.png", "furniture", "Single isometric dark wooden bedside nightstand with one drawer and lower cabinet, empty top, no decorations or room."),
    asset("furn_dresser", "Старинный деревянный комод с потертыми ручками.png", "furniture", "Single isometric wide dark wooden four-drawer dresser with worn handles and empty top, no mirror, decorations or room."),
    asset("furn_armchair", "Потёртое оливковое кресло на прозрачном фоне.png", "furniture", "Single isometric worn olive-brown upholstered armchair with wooden feet, no person, blanket, pillow or room."),
    asset("furn_tv", "Винтажный телевизор на деревянной тумбе.png", "furniture", "Single isometric CRT television with blank dark screen and antenna on a low wooden stand, no logo, glow, cables or room."),
    asset("furn_bookcase", "Старинный книжный шкаф с потёртыми книгами.png", "furniture", "Single isometric tall dark wooden four-shelf bookcase with muted old books and empty space, no readable titles, ornaments or room."),
]


def clean_alpha(image):
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A").point(lambda value: 0 if value < 4 else 255 if value == 254 else value)
    rgba.putalpha(alpha)
    return rgba


def significant_bbox(image, threshold=16):
    mask = image.getchannel("A").point(lambda value: 255 if value >= threshold else 0)
    bbox = mask.getbbox()
    if not bbox:
        raise ValueError("Image has no visible pixels")
    return bbox


def padded_box(image, bbox, padding):
    return (
        max(0, bbox[0] - padding),
        max(0, bbox[1] - padding),
        min(image.width, bbox[2] + padding),
        min(image.height, bbox[3] + padding),
    )


def resize_runtime(image, kind):
    if kind in {"tree", "character"}:
        height = 768 if kind == "tree" else 512
        if image.height > height:
            width = max(1, round(image.width * height / image.height))
            image = image.resize((width, height), Image.Resampling.LANCZOS)
    elif kind == "furniture":
        image.thumbnail((512, 512), Image.Resampling.LANCZOS)
    return image


def save_png(image, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True, compress_level=9)


def process_standard(item):
    source = SOURCE_DIR / item["source"]
    with Image.open(source) as original:
        image = clean_alpha(original)
    padding = 24 if item["kind"] in {"tree", "character"} else 16
    image = image.crop(padded_box(image, significant_bbox(image), padding))
    image = resize_runtime(image, item["kind"])
    save_png(image, OUTPUT_DIR / item["target"])
    return image.size, {"cropThreshold": 16, "padding": padding}


def process_windows(items):
    loaded = {}
    boxes = {}
    for item in items:
        with Image.open(SOURCE_DIR / item["source"]) as original:
            loaded[item["id"]] = clean_alpha(original)
        boxes[item["id"]] = significant_bbox(loaded[item["id"]])
    master = boxes["win_intact"]
    crop_box = padded_box(loaded["win_intact"], master, 16)
    crop_size = (crop_box[2] - crop_box[0], crop_box[3] - crop_box[1])
    sizes = {}
    for item in items:
        image = loaded[item["id"]]
        if item["id"] == "win_intact":
            output = image.crop(crop_box)
            alignment = "master"
        else:
            source_box = boxes[item["id"]]
            sx = (source_box[2] - source_box[0]) / (master[2] - master[0])
            sy = (source_box[3] - source_box[1]) / (master[3] - master[1])
            coeffs = (
                sx,
                0,
                source_box[0] + (crop_box[0] - master[0]) * sx,
                0,
                sy,
                source_box[1] + (crop_box[1] - master[1]) * sy,
            )
            output = image.transform(
                crop_size,
                Image.Transform.AFFINE,
                coeffs,
                resample=Image.Resampling.BICUBIC,
                fillcolor=(0, 0, 0, 0),
            )
            output = clean_alpha(output)
            alignment = "aligned to win_intact outer frame"
        height = 256
        output = output.resize((round(output.width * height / output.height), height), Image.Resampling.LANCZOS)
        save_png(output, OUTPUT_DIR / item["target"])
        sizes[item["id"]] = output.size
        item["alignment"] = alignment
    return sizes


def write_metadata(item, runtime_size, processing):
    source = SOURCE_DIR / item["source"]
    target = OUTPUT_DIR / item["target"]
    stat = source.stat()
    with Image.open(source) as original:
        original_size = list(original.size)
    metadata = {
        "id": item["id"],
        "source": "GPT",
        "prompt": item["prompt"],
        "originalImport": f"tmp/{item['import']}",
        "createdAt": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
        "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "originalSize": original_size,
        "runtime": str(target.relative_to(ROOT)).replace("\\", "/"),
        "runtimeSize": list(runtime_size),
        "processing": {
            "alphaBelow4Removed": True,
            "alpha254PromotedTo255": True,
            **processing,
        },
    }
    source.with_suffix(".png.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--import", action="store_true", dest="import_sources")
    args = parser.parse_args()
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    if args.import_sources:
        for item in ASSETS:
            shutil.copy2(IMPORT_DIR / item["import"], SOURCE_DIR / item["source"])
    processing = {}
    windows = [item for item in ASSETS if item["kind"] == "window"]
    window_sizes = process_windows(windows)
    for item in windows:
        processing[item["id"]] = (
            window_sizes[item["id"]],
            {"cropThreshold": 16, "padding": 16, "alignment": item["alignment"]},
        )
    for item in ASSETS:
        if item["kind"] != "window":
            processing[item["id"]] = process_standard(item)
    for item in ASSETS:
        size, details = processing[item["id"]]
        write_metadata(item, size, details)
        print(f"{item['id']}: {size[0]}x{size[1]}")


if __name__ == "__main__":
    main()
