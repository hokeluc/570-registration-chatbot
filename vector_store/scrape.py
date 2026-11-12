"""Scrape A/B priority Mines pages listed in reference/sources.json into documents/.

Each page becomes documents/{subdomain}_{slug}_{MMDDYYYY}Scraped.json with fields:
url, title, source_site, priority, modified, modified_source, scraped, text.

WordPress sites (registrar, CASA, departments, ...) sit behind Cloudflare, so all
requests go through a real Chromium browser via Playwright. WordPress page bodies and
their `modified` dates come from the site's REST API (/wp-json/wp/v2/pages).
Non-WordPress pages (catalog.mines.edu, www.mines.edu) are rendered and their main
content extracted; their `modified` is taken from HTML meta tags if present, else
set to the scrape date.

Usage:
    ../venv/bin/python scrape.py            # full run
    ../venv/bin/python scrape.py --test     # a few pages per source type
    ../venv/bin/python scrape.py --headed   # visible browser, if Cloudflare blocks headless
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
from datetime import date
from pathlib import Path
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from playwright.sync_api import Page, sync_playwright

HERE = Path(__file__).resolve().parent
SOURCES = HERE / "reference" / "sources.json"
OUT_DIR = HERE / "documents"
REPORT = HERE / "scrape_report.json"

TODAY = date.today()
TODAY_ISO = TODAY.isoformat()
TODAY_STAMP = TODAY.strftime("%m%d%Y")

# Below this many characters, REST content is assumed to miss page-builder or
# template content, and the rendered page is used for the text instead.
MIN_REST_CHARS = 400
STATIC_DELAY_S = 1.0
BLOCKED_TITLES = ("Attention Required", "Just a moment")

WP_REST_JS = """
async () => {
  const out = [];
  for (let p = 1; ; p++) {
    const r = await fetch(`/wp-json/wp/v2/pages?per_page=100&page=${p}` +
      `&_fields=link,title,modified,modified_gmt,content`);
    if (!r.ok) { if (p === 1) return {error: r.status}; break; }
    const j = await r.json();
    if (!j.length) break;
    out.push(...j);
    if (j.length < 100) break;
  }
  return {pages: out};
}
"""


# ---------------------------------------------------------------- text helpers

def html_to_text(fragment: str) -> str:
    """Convert an HTML fragment to plain text, keeping headings, list items and table rows."""
    soup = BeautifulSoup(fragment, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "iframe", "form", "button"]):
        tag.decompose()
    for tr in soup.find_all("tr"):
        cells = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
        tr.replace_with(soup.new_string("\n" + " | ".join(c for c in cells if c) + "\n"))
    for level in range(1, 7):
        for h in soup.find_all(f"h{level}"):
            h.insert_before("\n\n" + "#" * level + " ")
            h.insert_after("\n")
    for li in soup.find_all("li"):
        li.insert_before("\n- ")
    for br in soup.find_all("br"):
        br.replace_with("\n")
    for block in soup.find_all(["p", "div", "section", "article", "table", "ul", "ol", "dd", "dt"]):
        block.insert_after("\n")
    text = soup.get_text()
    lines = [re.sub(r"[ \t ]+", " ", ln).strip() for ln in text.splitlines()]
    text = "\n".join(lines)
    text = re.sub(r"\n(#+ )\n+", r"\n\1", text)   # heading marker split from its text
    text = re.sub(r"\n- \n+", "\n- ", text)        # list marker split from its text
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


QUOTE = "[\"”″“]"  # wptexturize turns attribute quotes into curly ones
NOT_QUOTE = "[^\"”″“]"
# Builder shortcodes seen on Mines sites: et_pb_* (Divi), dipi_* (Divi Pixel), googleapps.
BUILDER = r"(?:et_pb_|dipi_|googleapps)[a-z0-9_]*"


def clean_divi(text: str) -> str:
    """Strip page-builder shortcodes from REST text, keeping tab/toggle titles as headings."""
    text = re.sub(rf"\[{BUILDER}\b[^\]]*?\stitle={QUOTE}({NOT_QUOTE}*){QUOTE}[^\]]*\]",
                  lambda m: f"\n\n### {m.group(1).strip()}\n", text)
    text = re.sub(rf"\[/?{BUILDER}\b[^\]]*\]", "\n", text)
    # Any other shortcode: opening tags with attributes, or closing tags.
    text = re.sub(rf"\[[a-z][a-z0-9_-]*(?:\s+[a-z_]+={QUOTE}{NOT_QUOTE}*{QUOTE})+\s*/?\]", "\n", text)
    text = re.sub(r"\[/[a-z][a-z0-9_-]*\]", "\n", text)
    text = re.sub(r"\n(#+ )\n+", r"\n\1", text)
    text = "\n".join(ln.strip() for ln in text.splitlines())
    return re.sub(r"\n{3,}", "\n\n", text).strip()


MAIN_SELECTORS = [
    "#textcontainer",                     # CourseLeaf catalog body
    "#content",
    "main",
    "#main",
    ".entry-content",
    "article",
]
STRIP_SELECTORS = [
    "header", "footer", "nav", "#breadcrumb", ".breadcrumb", "#sidebar", ".sidebar",
    "#col-nav", "#print-dialog", ".print-dialog", ".skip-link", "#cookie-notice",
]


def rendered_main_text(page_html: str) -> tuple[str, str | None]:
    """Return (text, html_meta_modified) from a full rendered page."""
    soup = BeautifulSoup(page_html, "html.parser")
    modified = None
    for attrs in ({"property": "article:modified_time"}, {"name": "last-modified"},
                  {"itemprop": "dateModified"}):
        m = soup.find("meta", attrs=attrs)
        if m and m.get("content"):
            modified = m["content"][:10]
            break
    for sel in STRIP_SELECTORS:
        for el in soup.select(sel):
            el.decompose()
    tabs = soup.select("div[id$='textcontainer']")  # catalog tabs; faculty tab is 'facultycontainer'
    if len(tabs) > 1:
        return "\n\n".join(html_to_text(str(el)) for el in tabs), modified
    main = None
    for sel in MAIN_SELECTORS:
        main = soup.select_one(sel)
        if main and len(main.get_text(strip=True)) > 200:
            break
    main = main or soup.body or soup
    return html_to_text(str(main)), modified


def page_title(page_html: str) -> str:
    soup = BeautifulSoup(page_html, "html.parser")
    h1 = soup.find("h1")
    if h1 and h1.get_text(strip=True):
        return h1.get_text(" ", strip=True)
    t = soup.title.get_text(strip=True) if soup.title else ""
    return re.split(r"\s+[|\-–]\s+", t)[0]


# ---------------------------------------------------------------- naming

def norm_url(url: str) -> str:
    p = urlparse(url)
    path = p.path if p.path.endswith("/") else p.path + "/"
    return f"https://{p.netloc.lower()}{path}"


def out_name(url: str) -> str:
    p = urlparse(url)
    sub = p.netloc.split(".")[0]
    slug = p.path.strip("/").replace("/", "-") or "home"
    slug = re.sub(r"[^A-Za-z0-9._-]", "-", slug)
    return f"{sub}_{slug}_{TODAY_STAMP}Scraped.json"


def write_doc(record: dict) -> Path:
    path = OUT_DIR / out_name(record["url"])
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


# ---------------------------------------------------------------- browser helpers

def goto(page: Page, url: str) -> str:
    resp = page.goto(url, wait_until="domcontentloaded", timeout=60_000)
    title = page.title()
    if any(b in title for b in BLOCKED_TITLES):
        page.wait_for_timeout(6000)  # give an interstitial check time to pass
        title = page.title()
    if any(b in title for b in BLOCKED_TITLES):
        raise RuntimeError(f"Cloudflare blocked {url}; retry with --headed")
    if resp is not None and resp.status >= 400:
        raise RuntimeError(f"HTTP {resp.status} for {url}")
    return page.content()


# ---------------------------------------------------------------- manifest

def build_targets(page: Page, sources: dict, test: bool) -> tuple[dict, list]:
    """Return ({host: [(url, priority)]} for WordPress, [(url, priority)] for static)."""
    wp: dict[str, list[tuple[str, str]]] = {}
    for host, groups in sources["wordpress"].items():
        for prio in ("A", "B"):
            for path in groups.get(prio, []):
                url = f"https://{host}/{path.strip('/')}/" if path else f"https://{host}/"
                wp.setdefault(host, []).append((norm_url(url), prio))

    static: dict[str, str] = {}
    for item in sources["static"]:
        static[norm_url(item["url"])] = item["priority"]

    sitemap_locs: list[str] | None = None
    for ex in sources["expand"]:
        if ex["from"] == "sitemap":
            if sitemap_locs is None:
                r = page.request.get("https://catalog.mines.edu/sitemap.xml")
                sitemap_locs = re.findall(r"<loc>([^<]+)</loc>", r.text())
            found = [u for u in sitemap_locs if u.startswith(ex["prefix"])]
        else:
            r = page.request.get(ex["index_url"])
            hrefs = re.findall(r'href="([^"#?]+)"', r.text())
            found = [urljoin(ex["index_url"], h) for h in hrefs]
            found = [u for u in found if u.startswith(ex["prefix"])
                     and not u.lower().endswith(".pdf")]
        for u in found:
            u = norm_url(u)
            if u == norm_url(ex.get("index_url", "")):
                continue
            # Keep the higher priority if a URL appears twice.
            if static.get(u) != "A":
                static[u] = ex["priority"]

    static_list = sorted(static.items())
    if test:
        wp = {h: v[:2] for h, v in list(wp.items())[:3]}
        static_list = [s for s in static_list if "coursesaz/compsci" in s[0]
                       or "bsincomputerscience" in s[0] or "academicregulations" in s[0]
                       or "quantum-systems" in s[0]]
    return wp, static_list


# ---------------------------------------------------------------- scraping

def scrape_wordpress(page: Page, host: str, targets: list, report: list) -> None:
    goto(page, f"https://{host}/")
    result = page.evaluate(WP_REST_JS)
    by_url = {}
    if "error" in result:
        print(f"  ! REST API returned {result['error']} on {host}; using rendered pages")
    else:
        by_url = {norm_url(p["link"]): p for p in result["pages"]}

    for url, prio in targets:
        try:
            rec = by_url.get(url)
            modified, modified_source = TODAY_ISO, "scrape_date"
            text, title, text_source = "", "", "wp_rest"
            if rec:
                title = html.unescape(rec["title"]["rendered"])
                text = clean_divi(html_to_text(rec["content"]["rendered"]))
                if rec.get("modified"):
                    modified, modified_source = rec["modified"][:10], "wordpress"
            if len(text) < MIN_REST_CHARS:
                page_html = goto(page, url)
                rendered, _ = rendered_main_text(page_html)
                if len(rendered) > len(text):
                    text, text_source = rendered, "rendered_page"
                title = title or page_title(page_html)
                time.sleep(STATIC_DELAY_S)
            save(url, title, prio, modified, modified_source, text, text_source, report)
        except Exception as e:  # keep going; record the failure
            print(f"  ! {url}: {e}")
            report.append({"url": url, "status": "error", "error": str(e)})


def scrape_static(page: Page, targets: list, report: list) -> None:
    for url, prio in targets:
        try:
            page_html = goto(page, url)
            text, meta_mod = rendered_main_text(page_html)
            modified, source = (meta_mod, "html_meta") if meta_mod else (TODAY_ISO, "scrape_date")
            save(url, page_title(page_html), prio, modified, source, text, "rendered_page", report)
        except Exception as e:
            print(f"  ! {url}: {e}")
            report.append({"url": url, "status": "error", "error": str(e)})
        time.sleep(STATIC_DELAY_S)


def save(url, title, prio, modified, modified_source, text, text_source, report) -> None:
    record = {
        "url": url,
        "title": title,
        "source_site": urlparse(url).netloc,
        "priority": prio,
        "modified": modified,
        "modified_source": modified_source,
        "scraped": TODAY_ISO,
        "text_source": text_source,
        "text": text,
    }
    path = write_doc(record)
    status = "ok" if len(text) >= 200 else "thin"
    report.append({"url": url, "file": path.name, "status": status, "chars": len(text),
                   "modified": modified, "modified_source": modified_source,
                   "text_source": text_source})
    print(f"  {status:4} {len(text):>7}c  {path.name}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--test", action="store_true", help="scrape a small sample only")
    ap.add_argument("--headed", action="store_true", help="show the browser window")
    args = ap.parse_args()

    sources = json.loads(SOURCES.read_text())
    OUT_DIR.mkdir(exist_ok=True)
    report: list[dict] = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=not args.headed)
        page = browser.new_page()
        wp, static = build_targets(page, sources, args.test)
        total = sum(len(v) for v in wp.values()) + len(static)
        print(f"{total} pages: {sum(len(v) for v in wp.values())} WordPress, {len(static)} static")

        for host, targets in wp.items():
            print(f"[{host}] {len(targets)} pages")
            try:
                scrape_wordpress(page, host, targets, report)
            except Exception as e:
                print(f"  ! site failed: {e}")
                report.extend({"url": u, "status": "error", "error": str(e)} for u, _ in targets)
        print(f"[static] {len(static)} pages")
        scrape_static(page, static, report)
        browser.close()

    REPORT.write_text(json.dumps(report, indent=2))
    counts = {s: sum(r["status"] == s for r in report) for s in ("ok", "thin", "error")}
    print(f"done: {counts}  report -> {REPORT.name}")
    return 1 if counts["error"] else 0


if __name__ == "__main__":
    sys.exit(main())
