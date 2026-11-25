"""GET /api/options: onboarding dropdown data.

Majors and tracks come from the Minesflow export (index.json), filtered by
catalog_metadata.json. Minors and catalog years are a static fallback list that
mirrors frontend/src/api/fallbackOptions.ts.
"""
import json
import logging
from functools import lru_cache
from pathlib import Path

from flask import Blueprint, jsonify

HERE = Path(__file__).resolve().parent
EXPORT_DIR = HERE / "minesflow" / "minesflow_export"
FALLBACK_PATH = HERE / "options_fallback.json"

log = logging.getLogger(__name__)

# Display names that differ from Minesflow's. Key: (prefix, Minesflow major name).
MAJOR_NAME_OVERRIDES = {
    ("AMS", "Applied Mathematics And Statistics"): "Applied Mathematics & Statistics",
    ("ECON", "Economics And Business"): "Business Engineering and Management Science",
    ("EDNS", "Engineering Design And Society"): "Design Engineering",
    ("GEOPHYS", "Geophysics"): "Geophysical Engineering",
    ("PHYS", "Physics"): "Engineering Physics",
}

# Minesflow files one major with several tracks, but Mines lists these as separate majors.
# Key: full index.json name. Value: (major name, major id). The track is served as "General".
SPLIT_MAJORS = {
    "CIVENVIRO - Civil Engineering - Construction Track": ("Construction Engineering", "construction"),
    "CIVENVIRO - Civil Engineering - Environmental Track": ("Environmental Engineering", "enviro"),
}

# Mines majors with no Minesflow flowchart yet. Served with no tracks.
EXTRA_MAJORS = [{"id": "qse", "name": "Quantum Systems Engineering", "tracks": []}]

# Majors whose prefix alone is not a unique id.
ID_OVERRIDES = {
    ("CHEM", "Biochemistry"): "biochem",
    ("MME", "Ceramic Engineering"): "mme_ceramic",
    ("MME", "Metallurgical And Materials Engineering"): "mme_metmat",
}

BASE_TRACK_NAMES = {"Computer Science": "General"}


def _major_name(prefix, raw):
    name = MAJOR_NAME_OVERRIDES.get((prefix, raw), raw)
    return name.replace(" And ", " and ")


def _track_name(raw):
    name = raw.removeprefix("CS + ").removesuffix(" Track")
    return BASE_TRACK_NAMES.get(name, name).replace(" And ", " and ")


@lru_cache(maxsize=1)
def _load():
    index = json.loads((EXPORT_DIR / "index.json").read_text())
    meta = json.loads((EXPORT_DIR / "catalog_metadata.json").read_text())
    fallback = json.loads(FALLBACK_PATH.read_text())

    majors, files = {}, {}
    for entry in index:
        prefix, raw_major, raw_track = entry["name"].split(" - ", 2)
        if prefix not in meta:
            log.warning("Prefix %s missing from catalog_metadata.json", prefix)
        elif not meta[prefix].get("major_granting", False):
            continue
        if entry["name"] in SPLIT_MAJORS:
            name, major_id = SPLIT_MAJORS[entry["name"]]
            key, track = (prefix, name), "General"
        else:
            key = (prefix, raw_major)
            name, major_id = _major_name(prefix, raw_major), ID_OVERRIDES.get(key, prefix.lower())
            track = _track_name(raw_track)
        major = majors.setdefault(key, {"id": major_id, "name": name, "tracks": []})
        major["tracks"].append(track)
        files[(name, track)] = entry["file"]

    out = []
    for major in majors.values():
        rest = sorted(t for t in major["tracks"] if t != "General")
        major["tracks"] = (["General"] if "General" in major["tracks"] else []) + rest
        out.append(major)
    out += [dict(m) for m in EXTRA_MAJORS]
    out.sort(key=lambda m: m["name"])
    return {
        "majors": out,
        "minors": fallback["minors"],
        "catalog_years": fallback["catalog_years"],
    }, files


def build_options():
    return _load()[0]


def resolve_track_file(major_name, track_name):
    """Map the name strings stored in profile.majors / profile.track to a flowchart file, or None."""
    return _load()[1].get((major_name, track_name))


bp = Blueprint("options", __name__)


@bp.get("/api/options")
def get_options():
    return jsonify(build_options())
