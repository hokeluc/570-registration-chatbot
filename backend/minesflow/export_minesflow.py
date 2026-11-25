#!/usr/bin/env python3
"""Export every major/track flowchart from minesflow.com as JSON and Mermaid.

The site is a static React app that reads its data from a public, unauthenticated
API Gateway endpoint. This script mirrors the app's own loading logic:

  /list?folder=prod/curriculums        one semester-plan file per major/track
  /list?folder=prod/additional_tracks  one file per major holding track
                                       requirement buckets (CSCI, MECHE); these
                                       overlay that major's General Track plan
  /read?file_name=prod/combined_courses.json  catalog with prereqs/coreqs/postreqs

Usage: python3 export_minesflow.py [output_dir]
Standard library only.
"""
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://u4bnbwcta1.execute-api.us-east-1.amazonaws.com"
DELAY = 0.25  # seconds between requests, to be polite


def get(path, **params):
    url = f"{BASE}/{path}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=30) as r:
        body = r.read().decode("utf-8")
    time.sleep(DELAY)
    return body


def list_folder(folder):
    return json.loads(get("list", folder=folder))["files"]


def read_json(name):
    return json.loads(get("read", file_name=name))


def split_camel(s):
    return re.sub(r"([a-z])([A-Z])", r"\1 \2", s).strip()


def req_codes(reqs):
    """The app splits each requirement on 'or' and keeps the first 7 chars."""
    return sorted({part.strip()[:7] for r in reqs for part in re.split(r"\s*or\s*", r, flags=re.I) if part.strip()})


def slug(s):
    return re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")


def build_flowchart(plan, catalog, buckets=None):
    """Attach catalog info to each planned course and compute arrows."""
    semesters, codes_in_plan = [], set()
    for year, terms in plan.items():
        for term, courses in terms.items():
            rows = []
            for c in courses:
                info = catalog.get(c["code"], {})
                codes_in_plan.add(c["code"][:7])
                rows.append({
                    **c,
                    "desc": info.get("desc", ""),
                    "prereqs": info.get("prereqs", []),
                    "coreqs": info.get("coreqs", []),
                    "postreqs": info.get("postreqs", []),
                })
            semesters.append({"year": year, "term": term, "courses": rows})

    # Arrows only render between courses that are both on the chart.
    edges = []
    for sem in semesters:
        for c in sem["courses"]:
            to = c["code"][:7]
            for kind in ("prereqs", "coreqs"):
                for frm in req_codes(c[kind]):
                    if frm in codes_in_plan and frm != to:
                        edges.append({"from": frm, "to": to, "type": kind[:-1]})

    out = {"semesters": semesters, "edges": edges}
    if buckets is not None:
        out["track_requirements"] = buckets
    return out


def to_mermaid(name, chart):
    lines = ["flowchart LR", f"  %% {name}"]
    ids, n = {}, 0  # 7-char code -> first node id, for edge drawing
    for i, sem in enumerate(chart["semesters"]):
        lines.append(f'  subgraph S{i}["{sem["year"]} {sem["term"]}"]')
        for c in sem["courses"]:
            nid = f'n{n}_{slug(c["code"])}'
            n += 1
            ids.setdefault(c["code"][:7], nid)
            label = f'{c["code"]}<br/>{c["title"]}'.replace('"', "'")
            lines.append(f'    {nid}["{label}"]')
        lines.append("  end")
    for e in chart["edges"]:
        arrow = "-->" if e["type"] == "prereq" else "-.->"
        lines.append(f'  {ids[e["from"]]} {arrow} {ids[e["to"]]}')
    return "\n".join(lines) + "\n"


def main():
    out_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "minesflow_export")
    out_dir.mkdir(parents=True, exist_ok=True)

    catalog = read_json("prod/combined_courses.json")
    (out_dir / "combined_courses.json").write_text(json.dumps(catalog, indent=2))

    plans, general = {}, {}
    for f in list_folder("prod/curriculums"):
        prefix, major, track = Path(f).stem.split("_")[:3]
        key = (prefix, split_camel(major), split_camel(track))
        plans[key] = f
        if key[2] == "General Track":
            general[prefix] = f

    charts = {}
    plan_cache = {}

    def plan_for(f):
        if f not in plan_cache:
            plan_cache[f] = read_json(f)
        return plan_cache[f]

    # Majors with additional_tracks replace their General Track entry, as the app does.
    for f in list_folder("prod/additional_tracks"):
        if f.endswith("/"):
            continue
        prefix, major = Path(f).stem.split("_")[:2]
        major = split_camel(major)
        plans.pop((prefix, major, "General Track"), None)
        for track, buckets in read_json(f).items():
            name = f"{prefix} - {major} - {html.unescape(track)}"
            charts[name] = build_flowchart(plan_for(general[prefix]), catalog, buckets)

    for (prefix, major, track), f in plans.items():
        charts[f"{prefix} - {major} - {track}"] = build_flowchart(plan_for(f), catalog)

    index = []
    for name, chart in sorted(charts.items()):
        s = slug(name)
        (out_dir / f"{s}.json").write_text(json.dumps({"name": name, **chart}, indent=2))
        (out_dir / f"{s}.mmd").write_text(to_mermaid(name, chart))
        n = sum(len(x["courses"]) for x in chart["semesters"])
        index.append({"name": name, "file": f"{s}.json", "courses": n, "edges": len(chart["edges"])})
    (out_dir / "index.json").write_text(json.dumps(index, indent=2))
    print(f"Exported {len(index)} flowcharts to {out_dir}/")


if __name__ == "__main__":
    main()
