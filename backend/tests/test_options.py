import json
import re
from pathlib import Path

import pytest

from app import create_app
from options import build_options, resolve_track_file, EXPORT_DIR

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def options():
    return build_options()


def test_shape(options):
    assert set(options) == {"majors", "minors", "catalog_years"}
    for m in options["majors"]:
        assert set(m) == {"id", "name", "tracks"}


def test_csci_matches_contract_example(options):
    csci = next(m for m in options["majors"] if m["id"] == "csci")
    assert csci["name"] == "Computer Science"
    assert csci["tracks"][0] == "General"
    assert "Data Science" in csci["tracks"]
    assert "Robotics & Intelligent Systems" in csci["tracks"]


MINES_MAJORS = {
    "Applied Mathematics & Statistics",
    "Chemical Engineering",
    "Biochemistry",
    "Chemistry",
    "Civil Engineering",
    "Construction Engineering",
    "Environmental Engineering",
    "Computer Science",
    "Business Engineering and Management Science",
    "Electrical Engineering",
    "Design Engineering",
    "Geological Engineering",
    "Geophysical Engineering",
    "Mechanical Engineering",
    "Ceramic Engineering",
    "Metallurgical and Materials Engineering",
    "Mining Engineering",
    "Petroleum Engineering",
    "Engineering Physics",
    "Quantum Systems Engineering",
    "Quantitative Bioscience and Engineering",
}


def test_majors_match_the_21_mines_majors(options):
    assert {m["name"] for m in options["majors"]} == MINES_MAJORS
    assert len(options["majors"]) == 21


def test_civil_split_into_three_majors(options):
    by_name = {m["name"]: m for m in options["majors"]}
    for name in ("Civil Engineering", "Construction Engineering", "Environmental Engineering"):
        assert by_name[name]["tracks"] == ["General"]
    assert resolve_track_file("Construction Engineering", "General").startswith("CIVENVIRO_Civil_Engineering_Construction")


def test_quantum_has_no_tracks_and_no_file(options):
    q = next(m for m in options["majors"] if m["name"] == "Quantum Systems Engineering")
    assert q["tracks"] == []
    assert resolve_track_file(q["name"], "General") is None


def test_ids_and_names_unique(options):
    ids = [m["id"] for m in options["majors"]]
    names = [m["name"] for m in options["majors"]]
    assert len(ids) == len(set(ids))
    assert len(names) == len(set(names))


def test_mme_split_into_two_majors(options):
    mme = [m for m in options["majors"] if m["id"].startswith("mme")]
    assert len(mme) == 2


def test_track_names_clean_and_unique(options):
    for m in options["majors"]:
        if m["name"] != "Quantum Systems Engineering":
            assert m["tracks"], m["name"]
        assert len(m["tracks"]) == len(set(m["tracks"]))
        for t in m["tracks"]:
            assert not t.endswith(" Track")
            assert not t.startswith("CS + ")


def test_no_flowchart_dropped(options):
    index = json.load(open(EXPORT_DIR / "index.json"))
    assert sum(len(m["tracks"]) for m in options["majors"]) == len(index)


def test_every_name_track_pair_resolves_to_a_file(options):
    for m in options["majors"]:
        for t in m["tracks"]:
            f = resolve_track_file(m["name"], t)
            assert (EXPORT_DIR / f).exists()


def test_minors_and_years_match_frontend_fallback(options):
    ts = (ROOT / "frontend/src/api/fallbackOptions.ts").read_text()
    minors = re.search(r"minors:\s*\[(.*?)\]", ts, re.S).group(1)
    years = re.search(r"catalog_years:\s*\[(.*?)\]", ts, re.S).group(1)
    assert options["minors"] == re.findall(r"'([^']+)'", minors)
    assert options["catalog_years"] == re.findall(r"'([^']+)'", years)


def test_endpoint():
    client = create_app().test_client()
    res = client.get("/api/options")
    assert res.status_code == 200
    assert set(res.get_json()) == {"majors", "minors", "catalog_years"}
