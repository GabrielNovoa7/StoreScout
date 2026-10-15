"""Builds data/sellers-weekly.json from the Sellers Bros. weekly ad.

Sellers Bros. has no online catalog; its prices are only published in the
weekly-ad PDFs linked from https://sellersbros.com/weekly-ad. This script:

1. fetches the weekly-ad and locations pages with Scrapling's plain HTTP
   fetcher (no stealth mode, honest user agent, a few requests per run),
2. downloads the ad PDFs,
3. reads each word's position and font size with pdfplumber and rebuilds
   products: big digits are prices, heavy-font lines are product names,
4. writes products and store locations to data/sellers-weekly.json, which the
   website searches like a live retailer.

Run from the repository root:
    scrapers/.venv/Scripts/python scrapers/sellers_bros.py      (Windows)
    scrapers/.venv/bin/python scrapers/sellers_bros.py          (macOS/Linux)
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import io
import json
import re
import sys
from pathlib import Path

import pdfplumber
from scrapling.fetchers import Fetcher

BASE = "https://sellersbros.com"
USER_AGENT = "StoreScout/1.0 (personal grocery price comparison project)"
ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "data" / "sellers-weekly.json"

PRICE_MIN_SIZE = 19  # Ad prices are set in 20pt+ type; body text is under 16pt.
NAME_FONT = re.compile(r"Heavy|Black|XBlack|Bold", re.I)
UNIT_WORDS = {"lb.": "lb", "lb": "lb", "ea.": "each", "ea": "each", "pkg.": "pkg", "pkg": "pkg"}
SPANISH = re.compile(
    r"\b(de|del|con|sin|para|paquete|bolsa|lata|latas|variedad|surtid[oa]s?|res|pollo|puerco|"
    r"carne|tomate|uva|pechuga|molida|chuletas|aguacate|frijoles|refresco|caf[eé]|queso|leche|"
    r"huevos|pan|arroz|bistec|hueso|marinada|en rama|lim[oó]n|naranja|manzana|papas?|"
    r"selectas?|tiendas?|disponible|cada|o\b)\b",
    re.I,
)
GENERIC = {"whole", "meat", "blend", "mama", "company", "oil", "chicken", "steaks", "bouquet", "condensed",
           "mesquite", "sausage", "cheese", "beef", "pork", "fresh", "select", "assorted", "original"}
SECTION = re.compile(r"^(MEAT|PRODUCE|GROCERY|DAIRY|FROZEN|DELI|BAKERY|FLORAL|SEAFOOD|BEER|WINE|HOUSEHOLD|HEALTH|BEAUTY)$")
SKIP_NAME = re.compile(r"^(wow!?|incredible!?|that's only|jumbo!?|mix or|match!?|sweet,? juicy|"
                       r"and crunchy!?|juicy|creamy|floral|we accept|we welcome|store hours)\b", re.I)


def fetch(url: str):
    return Fetcher.get(url, stealthy_headers=False, headers={"User-Agent": USER_AGENT}, timeout=60)


def ad_pdf_urls() -> list[str]:
    page = fetch(f"{BASE}/weekly-ad")
    urls = []
    for link in page.css('a[href$=".pdf"]'):
        href = link.attrib.get("href", "")
        name = href.rsplit("/", 1)[-1].lower()
        if "sellers" in name and href not in urls:  # skip privacy/terms PDFs
            urls.append(href if href.startswith("http") else f"{BASE}{href}")
    return urls


def store_locations() -> list[dict]:
    page = fetch(f"{BASE}/locations")
    lines = [l.strip() for l in page.get_all_text(separator="\n").split("\n") if l.strip()]
    stores = []
    for i, line in enumerate(lines):
        match = re.match(r"^(.+?),\s*TX\s+(\d{5})$", line)
        if not match or i == 0:
            continue
        street = lines[i - 1]
        phone = lines[i + 1] if i + 1 < len(lines) and re.match(r"^\(\d{3}\)", lines[i + 1]) else ""
        slug = re.sub(r"[^a-z0-9]+", "-", street.lower()).strip("-")[:40]
        stores.append({
            "id": f"sb-{slug}",
            "name": f"Sellers Bros. - {street}",
            "address": f"{street}, {match.group(1)}, TX {match.group(2)}",
            "zip": match.group(2),
            "phone": phone,
        })
    return stores


def dedupe_doubled(text: str) -> str:
    """Overprinted ad text arrives doubled ("1177" for "17"); undo that."""
    if len(text) >= 2 and len(text) % 2 == 0 and all(text[i] == text[i + 1] for i in range(0, len(text), 2)):
        return text[::2]
    return text


def price_clusters(words: list[dict]) -> list[dict]:
    """Groups the large price glyphs ($, dollars, cents, deal counts) into prices."""
    tokens = [w for w in words if w["size"] >= PRICE_MIN_SIZE and re.fullmatch(r"[\d$]+", w["text"])]
    tokens.sort(key=lambda w: (w["x0"], w["top"]))
    clusters: list[list[dict]] = []
    for token in tokens:
        for cluster in clusters:
            last = max(cluster, key=lambda w: w["x1"])
            if token["x0"] - last["x1"] < 14 and abs(token["top"] - cluster[0]["top"]) < 16:
                cluster.append(token)
                break
        else:
            clusters.append([token])
    out = []
    for cluster in clusters:
        parsed = parse_price(sorted(cluster, key=lambda w: w["x0"]), words)
        if parsed:
            out.append(parsed)
    return out


def parse_price(cluster: list[dict], words: list[dict]) -> dict | None:
    texts = [w["text"] for w in cluster]
    # Only undo doubling when the whole price was overprinted ("$$", "1177", "9999");
    # otherwise cents such as "77" would lose a digit.
    overprinted = all(len(t) % 2 == 0 and dedupe_doubled(t) != t for t in texts)
    parts = [(dedupe_doubled(w["text"]) if overprinted else w["text"], w["size"]) for w in cluster]
    count = None
    seq: list[tuple[str, float]] = []
    seen_dollar = False
    for text, size in parts:
        if "$" in text:
            before, _, after = text.partition("$")
            before, after = before.replace("$", ""), after.replace("$", "")
            if before and not seen_dollar:
                count = int(before)
            seen_dollar = True
            if after:
                seq.append((after, size))
        elif not seen_dollar and seq == [] and count is None and len(parts) > 2 and any("$" in p[0] for p in parts):
            count = int(text)  # "2 $ 5" -> 2 for $5
        else:
            seq.append((text, size))
    if not seen_dollar or not seq:
        return None
    dollars_text, dollars_size = seq[0]
    cents = 0
    if len(seq) > 1 and len(seq[1][0]) == 2 and seq[1][1] < dollars_size:
        cents = int(seq[1][0])
    try:
        total = int(dollars_text) + cents / 100
    except ValueError:
        return None
    left = min(w["x0"] for w in cluster)
    right = max(w["x1"] for w in cluster)
    top = min(w["top"] for w in cluster)
    bottom = max(w["bottom"] for w in cluster)
    near = [w for w in words if w["size"] < PRICE_MIN_SIZE and left - 10 <= w["x0"] <= right + 40 and top - 10 <= w["top"] <= bottom + 25]
    unit = next((UNIT_WORDS[w["text"].lower()] for w in near if w["text"].lower() in UNIT_WORDS), "each")
    is_deal = any(w["text"].lower() == "for" for w in near) and count
    if is_deal and count and count > 1:
        price = round(total / count, 2)
        deal = f"{count} for ${total:.2f}"
    else:
        price, deal = round(total, 2), None
    if not 0.05 <= price <= 300:
        return None
    return {"price": price, "deal": deal, "unit": unit, "box": (left, top, right, bottom)}


def text_lines(words: list[dict]) -> list[dict]:
    """Joins small words into lines (same baseline, same font size, close together)."""
    small = [w for w in words if w["size"] < PRICE_MIN_SIZE - 3]
    small.sort(key=lambda w: (round(w["top"]), w["x0"]))
    lines: list[dict] = []
    for w in small:
        for line in lines:
            if (abs(line["top"] - w["top"]) < 2.5 and abs(line["size"] - w["size"]) < 0.6
                    and 0 <= w["x0"] - line["x1"] < 12 and line["heavy"] == bool(NAME_FONT.search(w["fontname"]))):
                line["text"] += " " + w["text"]
                line["x1"] = w["x1"]
                break
        else:
            lines.append({"text": w["text"], "x0": w["x0"], "x1": w["x1"], "top": w["top"],
                          "size": w["size"], "heavy": bool(NAME_FONT.search(w["fontname"]))})
    for line in lines:
        words_ = [dedupe_doubled(t) if len(t) >= 4 else t for t in line["text"].split()]
        line["text"] = clean_text(" ".join(words_))
    return lines


def clean_text(text: str) -> str:
    """Restores characters the ad's fonts drop (é, á, ú, ó, ’) and tidies spacing."""
    fixes = {"Nescaf� Cl�sico": "Nescafé Clásico", "Rag�": "Ragú", "Lim�n": "Limón"}
    for bad, good in fixes.items():
        text = text.replace(bad, good)
    text = re.sub(r"(?<=[A-Za-z])�(?=s\b)", "’", text)  # Lay�s -> Lay’s
    text = text.replace("�", "·")
    return re.sub(r"\s+", " ", text).strip(" ·")


def name_blocks(lines: list[dict]) -> list[dict]:
    """Stacks adjacent heavy lines into product names, with nearby detail lines."""
    # Product names are Title Case; ALL-CAPS heavy lines are banners ("MEAT SAVINGS").
    heavy = [l for l in lines if l["heavy"] and 8 <= l["size"] < 16 and not SKIP_NAME.match(l["text"])
             and not SECTION.match(l["text"].strip()) and not re.fullmatch(r"[A-Z0-9 &/'’.,!-]+", l["text"])
             and not SPANISH.search(l["text"]) and re.search(r"[A-Za-z]{3}", l["text"])]
    heavy.sort(key=lambda l: (l["top"], l["x0"]))
    blocks: list[dict] = []
    for line in heavy:
        for block in blocks:
            if (-2 <= line["top"] - block["bottom"] < line["size"] * 2.2
                    and line["x0"] < block["x1"] + 5 and line["x1"] > block["x0"] - 5):
                block["lines"].append(line)
                block["bottom"] = line["top"] + line["size"]
                block["x0"], block["x1"] = min(block["x0"], line["x0"]), max(block["x1"], line["x1"])
                break
        else:
            blocks.append({"lines": [line], "top": line["top"], "bottom": line["top"] + line["size"],
                           "x0": line["x0"], "x1": line["x1"]})
    detail_lines = [l for l in lines if not l["heavy"] and 6.5 <= l["size"] < 10 and not SPANISH.search(l["text"])
                    and not SKIP_NAME.match(l["text"]) and l["text"].lower() not in UNIT_WORDS and l["text"].lower() != "for"]
    for block in blocks:
        block["name"] = " ".join(l["text"] for l in block["lines"])
        details = [l["text"] for l in detail_lines
                   if block["top"] - 14 <= l["top"] <= block["bottom"] + 12
                   and l["x0"] < block["x1"] + 10 and l["x1"] > block["x0"] - 10]
        block["details"] = " · ".join(dict.fromkeys(details))[:120]
    return blocks


def pair(prices: list[dict], blocks: list[dict]) -> list[tuple[dict, dict]]:
    """Greedy nearest pairing of each price with one product name."""
    def center(box):
        return ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)
    candidates = []
    for pi, price in enumerate(prices):
        px, py = center(price["box"])
        for bi, block in enumerate(blocks):
            bx, by = center((block["x0"], block["top"], block["x1"], block["bottom"]))
            dx, dy = abs(px - bx), abs(py - by)
            if dx < 170 and dy < 150:
                candidates.append((dx + dy * 1.2, pi, bi))
    used_p, used_b, pairs = set(), set(), []
    for _, pi, bi in sorted(candidates):
        if pi in used_p or bi in used_b:
            continue
        used_p.add(pi)
        used_b.add(bi)
        pairs.append((prices[pi], blocks[bi]))
    return pairs


def products_from_pdf(data: bytes, source: str) -> list[dict]:
    items = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page_no, page in enumerate(pdf.pages, start=1):
            words = page.extract_words(extra_attrs=["size", "fontname"])
            for price, block in pair(price_clusters(words), name_blocks(text_lines(words))):
                name = re.sub(r"\s+", " ", block["name"]).strip()
                # One generic word ("Whole", "Meat", "Blend") is a fragment, not a product.
                if len(name) < 3 or (" " not in name and name.lower() in GENERIC):
                    continue
                items.append({
                    "name": name[:200],
                    "details": block["details"],
                    "price": price["price"],
                    "deal": price["deal"],
                    "unit": price["unit"],
                    "page": page_no,
                    "source": source,
                })
    return items


def ad_week(pdf_names: list[str], today: dt.date) -> tuple[str | None, str | None]:
    """Ad files are named ..._MMDD.pdf; the ad runs Wednesday to Tuesday."""
    for name in pdf_names:
        match = re.search(r"_(\d{2})(\d{2})\.pdf$", name)
        if match:
            start = dt.date(today.year, int(match.group(1)), int(match.group(2)))
            if start > today + dt.timedelta(days=60):
                start = start.replace(year=today.year - 1)
            return start.isoformat(), (start + dt.timedelta(days=6)).isoformat()
    return None, None


def downloaded_ads() -> list[tuple[str, bytes]]:
    urls = ad_pdf_urls()
    if not urls:
        raise SystemExit("No weekly-ad PDFs found on the Sellers Bros. site.")
    ads = []
    for url in urls:
        response = fetch(url)
        if response.status != 200:
            print(f"skip {url}: HTTP {response.status}", file=sys.stderr)
            continue
        ads.append((url, response.body))
    return ads


def local_ads(folder: Path) -> list[tuple[str, bytes]]:
    files = sorted(folder.glob("Sellers*.pdf"))
    if not files:
        raise SystemExit(f"No Sellers*.pdf files in {folder}.")
    return [(f"{BASE}/s/{f.name}", f.read_bytes()) for f in files]


def build(today: dt.date, pdf_dir: Path | None = None, previous: dict | None = None) -> dict:
    ads = local_ads(pdf_dir) if pdf_dir else downloaded_ads()
    urls = [url for url, _ in ads]
    products, seen = [], set()
    for url, body in ads:
        source = "In-store ad" if "instore" in url.lower() else "Mailer"
        for item in products_from_pdf(body, source):
            key = (item["name"].lower(), item["price"], item["unit"])
            if key in seen:
                continue
            seen.add(key)
            digest = hashlib.sha1(f"{item['name']}|{item['price']}|{item['unit']}".encode()).hexdigest()[:12]
            item["productId"] = digest
            products.append(item)
    valid_from, valid_to = ad_week(urls, today)
    return {
        "retailer": "sellers",
        "source": f"{BASE}/weekly-ad",
        "adFiles": urls,
        "validFrom": valid_from,
        "validTo": valid_to,
        "fetchedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        # Offline runs keep the last fetched store list instead of re-requesting it.
        "stores": (previous or {}).get("stores", []) if pdf_dir else store_locations(),
        "products": products,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--pdf-dir", type=Path, help="parse saved ad PDFs instead of downloading them")
    args = parser.parse_args()
    previous = None
    if args.output.exists():
        try:
            previous = json.loads(args.output.read_text(encoding="utf-8"))
        except ValueError:
            previous = None
    data = build(dt.date.today(), args.pdf_dir, previous)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(data['products'])} products and {len(data['stores'])} stores to {args.output}")


if __name__ == "__main__":
    main()
