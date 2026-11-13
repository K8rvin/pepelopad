import argparse
import datetime
import json
import math
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

DEFAULT_BBOX = (44.48, 48.69, 44.56, 48.75)
SOURCE_URL = "https://www.openstreetmap.org/copyright"
USER_AGENT = "PepelopadMapImporter/0.1 (https://github.com/K8rvin/pepelopad)"


def split_bbox(bbox, tile_size=0.02):
    west, south, east, north = bbox
    tiles = []
    left = west
    while left < east:
        right = min(left + tile_size, east)
        bottom = south
        while bottom < north:
            top = min(bottom + tile_size, north)
            tiles.append((left, bottom, right, top))
            bottom = top
        left = right
    return tiles


def download_tile(bbox, attempts=4):
    west, south, east, north = bbox
    url = (
        "https://api.openstreetmap.org/api/0.6/map?bbox="
        + urllib.parse.quote(f"{west},{south},{east},{north}")
    )
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return response.read().decode("utf-8")
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt == attempts:
                raise
            print(f"Retry {attempt}/{attempts - 1}: {error}", flush=True)
            time.sleep(attempt * 1.5)


def parse_osm_xml(text):
    root = ET.fromstring(text)
    document = {"nodes": {}, "ways": {}, "relations": {}}
    for element in root:
        if element.tag + "s" not in document:
            continue
        entry = {"id": int(element.attrib["id"]), "tags": {}}
        for tag in element.findall("tag"):
            entry["tags"][tag.attrib["k"]] = tag.attrib["v"]
        if element.tag == "node":
            entry["lat"] = float(element.attrib["lat"])
            entry["lon"] = float(element.attrib["lon"])
        elif element.tag == "way":
            entry["node_refs"] = [int(nd.attrib["ref"]) for nd in element.findall("nd")]
        elif element.tag == "relation":
            entry["members"] = [
                {
                    "type": member.attrib["type"],
                    "ref": int(member.attrib["ref"]),
                    "role": member.attrib["role"],
                }
                for member in element.findall("member")
            ]
        document[element.tag + "s"][entry["id"]] = entry
    return document


def merge_documents(documents):
    merged = {"nodes": {}, "ways": {}, "relations": {}}
    for document in documents:
        for kind in merged:
            merged[kind].update(document[kind])
    return merged


def project(lat, lon, origin):
    origin_lat, origin_lon = origin
    meters_per_degree = 111320
    return [
        (lon - origin_lon) * meters_per_degree * math.cos(math.radians(origin_lat)),
        (origin_lat - lat) * meters_per_degree,
    ]


def normalize_osm(document, origin):
    nodes = []
    for node_id, node in sorted(document["nodes"].items()):
        x, y = project(node["lat"], node["lon"], origin)
        nodes.append({"id": node_id, "tags": node["tags"], "x": x, "y": y})
    ways = []
    for way_id, way in sorted(document["ways"].items()):
        points = []
        for ref in way["node_refs"]:
            node = document["nodes"][ref]
            points.append(project(node["lat"], node["lon"], origin))
        ways.append({"id": way_id, "tags": way["tags"], "points": points})
    relations = [
        {"id": relation_id, **relation}
        for relation_id, relation in sorted(document["relations"].items())
    ]
    return {"nodes": nodes, "ways": ways, "relations": relations}


def write_outputs(document, bbox, output_dir, name):
    os.makedirs(output_dir, exist_ok=True)
    west, south, east, north = bbox
    origin = ((south + north) / 2, (west + east) / 2)
    retrieved_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    metadata = {
        "name": name,
        "bbox": bbox,
        "origin": origin,
        "source": SOURCE_URL,
        "license": "ODbL-1.0",
        "attribution": "© OpenStreetMap contributors",
        "retrievedAt": retrieved_at,
    }
    root = ET.Element("osm", {"version": "0.6", "generator": "osm_import.py"})
    comment = ET.Comment(" © OpenStreetMap contributors — ODbL-1.0 ")
    root.append(comment)
    for kind in ("nodes", "ways", "relations"):
        singular = kind[:-1]
        for entry_id, entry in sorted(document[kind].items()):
            attrs = {"id": str(entry_id)}
            if kind == "nodes":
                attrs.update({"lat": str(entry["lat"]), "lon": str(entry["lon"])})
            element = ET.SubElement(root, singular, attrs)
            for ref in entry.get("node_refs", []):
                ET.SubElement(element, "nd", {"ref": str(ref)})
            for member in entry.get("members", []):
                ET.SubElement(element, "member", {k: str(v) for k, v in member.items()})
            for key, value in entry["tags"].items():
                ET.SubElement(element, "tag", {"k": key, "v": value})
    tree = ET.ElementTree(root)
    ET.indent(tree, space="  ")
    tree.write(os.path.join(output_dir, name + ".xml"), encoding="utf-8", xml_declaration=True)
    normalized = normalize_osm(document, origin)
    normalized["metadata"] = metadata
    with open(os.path.join(output_dir, name + ".json"), "w", encoding="utf-8") as output:
        json.dump(normalized, output, ensure_ascii=False, indent=2)
    with open(os.path.join(output_dir, name + ".source.json"), "w", encoding="utf-8") as output:
        json.dump(metadata, output, ensure_ascii=False, indent=2)
    public_dir = os.path.join("public/assets/maps")
    os.makedirs(public_dir, exist_ok=True)
    with open(os.path.join(public_dir, name + ".json"), "w", encoding="utf-8") as output:
        json.dump(normalized, output, ensure_ascii=False, separators=(",", ":"))
    return normalized


def download_bbox(bbox, output_dir, name, tile_size):
    documents = []
    tiles = split_bbox(bbox, tile_size)
    for index, tile in enumerate(tiles, 1):
        print(f"Downloading {index}/{len(tiles)}: {tile}", flush=True)
        documents.append(parse_osm_xml(download_tile(tile)))
        time.sleep(0.25)
    return merge_documents(documents)


def self_test():
    sample = '''<osm version="0.6">
      <node id="1" lat="48.7" lon="44.5"><tag k="name" v="Origin"/></node>
      <node id="2" lat="48.701" lon="44.501" />
      <way id="10"><nd ref="1"/><nd ref="2"/><tag k="building" v="yes"/></way>
    </osm>'''
    document = parse_osm_xml(sample)
    assert len(split_bbox((44.48, 48.69, 44.56, 48.75), 0.04)) == 6
    assert project(48.7, 44.5, (48.7, 44.5)) == [0, 0]
    normalized = normalize_osm(document, (48.7, 44.5))
    assert normalized["ways"][0]["tags"]["building"] == "yes"
    assert normalized["ways"][0]["points"][0] == [0, 0]
    assert normalized["ways"][0]["points"][1][0] > 0
    assert normalized["ways"][0]["points"][1][1] < 0
    merged = merge_documents([document, document])
    assert len(merged["nodes"]) == 2 and len(merged["ways"]) == 1
    print("OSM import self-test: OK")


def main():
    parser = argparse.ArgumentParser(description="Download and normalize OSM city data")
    parser.add_argument("--bbox", default=",".join(map(str, DEFAULT_BBOX)))
    parser.add_argument("--out", default="data/osm")
    parser.add_argument("--name", default="volgograd-center")
    parser.add_argument("--tile-size", type=float, default=0.01)
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    bbox = tuple(float(value) for value in args.bbox.split(","))
    if len(bbox) != 4:
        raise ValueError("bbox must be west,south,east,north")
    xml_path = os.path.join(args.out, args.name + ".xml")
    if args.download:
        document = download_bbox(bbox, args.out, args.name, args.tile_size)
    else:
        with open(xml_path, encoding="utf-8") as source:
            document = parse_osm_xml(source.read())
    normalized = write_outputs(document, bbox, args.out, args.name)
    print(
        f"OSM import: {len(normalized['nodes'])} nodes, "
        f"{len(normalized['ways'])} ways, {len(normalized['relations'])} relations"
    )


if __name__ == "__main__":
    main()
