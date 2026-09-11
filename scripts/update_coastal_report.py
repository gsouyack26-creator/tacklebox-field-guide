#!/usr/bin/env python3
"""Build the static NJ coastal report used by the offline field guide."""
from __future__ import annotations

import html
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
try:
    from zoneinfo import ZoneInfo
except ImportError:
    ZoneInfo = None
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "coastal-report.json"
try:
    EASTERN = ZoneInfo("America/New_York") if ZoneInfo else timezone(timedelta(hours=-4), "EDT")
except Exception:
    EASTERN = timezone(timedelta(hours=-4), "EDT")
USER_AGENT = "TackleboxFieldGuide/1.0 (public GitHub Pages data refresh)"
FORECAST_URL = "https://tgftp.nws.noaa.gov/data/raw/fz/fzus51.kphi.cwf.phi.txt"
REPORT_FEEDS = {
    "north":"https://www.thefisherman.com/area/northern-new-jersey/feed/",
    "central":"https://www.thefisherman.com/area/central-new-jersey/feed/",
    "south":"https://www.thefisherman.com/area/southern-new-jersey/feed/",
    "lbi":"https://fishinglbi.com/feed/",
}
COOPS = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"

ZONES = [
    {"id":"sandy-hook","name":"Raritan Bay & Sandy Hook","station":"8531680","forecast":"ANZ450","reportFeed":"north","techniques":["inshore-spin","inshore-structure"]},
    {"id":"monmouth-ocean","name":"Monmouth & Ocean County Surf","station":"8531680","forecast":"ANZ451","reportFeed":"north","techniques":["salt-surf","inshore-spin"]},
    {"id":"lbi","name":"Barnegat Bay & LBI","station":"8534720","forecast":"ANZ451","reportFeed":"lbi","techniques":["inshore-wade","salt-surf","nearshore-jig"]},
    {"id":"atlantic-city","name":"Atlantic City & Great Bay","station":"8534720","forecast":"ANZ452","reportFeed":"south","techniques":["inshore-spin","pier-bait"]},
    {"id":"cape-may","name":"Cape May Coast","station":"8536110","forecast":"ANZ453","reportFeed":"south","techniques":["salt-surf","nearshore-jig"]},
    {"id":"delaware-bay","name":"Delaware Bay","station":"8536110","forecast":"ANZ431","reportFeed":"south","techniques":["inshore-structure","offshore-bottom"]},
]


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read()


def compact(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def strip_markup(text: str) -> str:
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return compact(html.unescape(text))


def parse_forecasts(raw: str) -> dict[str, dict]:
    issued = re.search(r"National Weather Service Mount Holly NJ\s+([^\n]+)", raw)
    blocks = {}
    for code in {zone["forecast"] for zone in ZONES}:
        match = re.search(rf"{code}-\d+-\n([^$]+?)(?=\n\$\$)", raw, re.S)
        if not match:
            continue
        block = match.group(1)
        lines = [compact(line) for line in block.splitlines() if line.strip()]
        title = lines[0].rstrip("-") if lines else code
        period_matches = re.findall(r"\.([A-Z][A-Z ]+?)\.\.\.(.*?)(?=\n\.[A-Z][A-Z ]+?\.\.\.|\Z)", block, re.S)
        periods = [{"label": compact(label).title(), "text": compact(text)} for label, text in period_matches[:2]]
        blocks[code] = {"title": title, "periods": periods, "url":"https://www.ndbc.noaa.gov/data/Forecasts/FZUS51.KPHI.html"}
    return {"issued": compact(issued.group(1)) if issued else "Unknown", "zones": blocks}


def coops_json(params: dict[str, str]) -> dict:
    from urllib.parse import urlencode
    return json.loads(fetch(f"{COOPS}?{urlencode(params)}").decode("utf-8"))


def station_conditions(station: str, now: datetime) -> dict:
    base = {"station":station,"datum":"MLLW","time_zone":"lst_ldt","units":"english","format":"json"}
    temperature = coops_json({**base,"date":"latest","product":"water_temperature"})
    end = now + timedelta(days=1)
    tides = coops_json({**base,"begin_date":now.strftime("%Y%m%d"),"end_date":end.strftime("%Y%m%d"),"product":"predictions","interval":"hilo"})
    metadata = temperature.get("metadata", {})
    reading = (temperature.get("data") or [{}])[0]
    def local_time(value: str) -> datetime:
        return datetime.strptime(value, "%Y-%m-%d %H:%M").replace(tzinfo=EASTERN)
    future_tides = [item for item in tides.get("predictions", []) if local_time(item.get("t")) >= now]
    return {
        "stationId": station,
        "stationName": metadata.get("name", station),
        "waterTempF": reading.get("v"),
        "observedAt": local_time(reading["t"]).isoformat() if reading.get("t") else None,
        "tides": [{"time":local_time(item["t"]).isoformat(),"heightFt":item.get("v"),"type":item.get("type")} for item in future_tides[:4]],
        "url": f"https://tidesandcurrents.noaa.gov/stationhome.html?id={station}",
    }


def latest_local_report(raw: bytes, now: datetime, source: str, scope: str, require_category: bool = False) -> dict | None:
    root = ET.fromstring(raw)
    for item in root.findall("./channel/item"):
        categories = [compact(node.text or "") for node in item.findall("category")]
        if require_category and "Fishing Reports" not in categories:
            continue
        published_text = item.findtext("pubDate")
        if not published_text:
            continue
        published = parsedate_to_datetime(published_text).astimezone(EASTERN)
        content = item.findtext("{http://purl.org/rss/1.0/modules/content/}encoded") or item.findtext("description") or ""
        description = strip_markup(content)
        description = re.sub(r"The post .*? appeared first on.*$", "", description, flags=re.I).strip()
        return {
            "title": compact(item.findtext("title") or "Regional fishing report"),
            "summary": description[:520].rstrip(),
            "publishedAt": published.isoformat(),
            "ageHours": round((now - published).total_seconds() / 3600, 1),
            "source":source,
            "url": compact(item.findtext("link") or REPORT_FEEDS["lbi"]),
            "scope":scope,
        }
    return None


def load_previous() -> dict:
    try:
        return json.loads(OUTPUT.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def main() -> int:
    now = datetime.now(EASTERN)
    previous = load_previous()
    errors = []
    try:
        forecast_data = parse_forecasts(fetch(FORECAST_URL).decode("utf-8", "replace"))
    except Exception as exc:
        errors.append(f"Marine forecast unavailable: {type(exc).__name__}")
        forecast_data = {"issued":"Unavailable","zones":{}}

    station_cache = {}
    for station in sorted({zone["station"] for zone in ZONES}):
        try:
            station_cache[station] = station_conditions(station, now)
        except Exception as exc:
            errors.append(f"Station {station} unavailable: {type(exc).__name__}")

    report_specs = {
        "north":("The Fisherman · Northern New Jersey","Raritan Bay, Sandy Hook, Monmouth County and nearby waters",False),
        "central":("The Fisherman · Central New Jersey","Ocean County, Barnegat Bay, LBI and nearby waters",False),
        "south":("The Fisherman · Southern New Jersey","Atlantic County, Cape May and Delaware Bay",False),
        "lbi":("FishingLBI / Fisherman’s Headquarters","Barnegat Bay, Long Beach Island surf, inlet and nearby waters",True),
    }
    local_reports = {}
    for key, (source, scope, require_category) in report_specs.items():
        try:
            local_reports[key] = latest_local_report(fetch(REPORT_FEEDS[key]), now, source, scope, require_category)
        except Exception as exc:
            errors.append(f"Local report {key} unavailable: {type(exc).__name__}")

    zones = []
    for config in ZONES:
        old_zone = next((item for item in previous.get("zones", []) if item.get("id") == config["id"]), {})
        live_conditions = station_cache.get(config["station"])
        live_forecast = forecast_data["zones"].get(config["forecast"])
        live_local = local_reports.get(config["reportFeed"])
        conditions = live_conditions or old_zone.get("conditions")
        forecast = live_forecast or old_zone.get("forecast")
        local = live_local or old_zone.get("localReport")
        if local and local.get("publishedAt"):
            try:
                published = datetime.fromisoformat(local["publishedAt"]).astimezone(EASTERN)
                local = {**local, "ageHours":round((now - published).total_seconds() / 3600, 1)}
            except (TypeError, ValueError):
                pass
        zones.append({
            "id":config["id"], "name":config["name"], "techniques":config["techniques"],
            "conditions":conditions, "forecast":forecast, "localReport":local,
            "sourceStatus":{
                "conditions":"current" if live_conditions else ("retained" if conditions else "unavailable"),
                "forecast":"current" if live_forecast else ("retained" if forecast else "unavailable"),
                "localReport":"current" if live_local else ("retained" if local else "unavailable"),
            },
            "reportStatus":"verified" if local and local.get("ageHours", 1e9) <= 72 else ("stale" if local else "conditions-only"),
        })

    live_noaa = bool(station_cache or forecast_data["zones"])
    if not live_noaa:
        print("No usable live NOAA data; retaining previous report", file=sys.stderr)
        return 0 if previous else 1
    payload = {
        "schemaVersion":1,
        "generatedAt":now.isoformat(),
        "forecastIssued":forecast_data["issued"],
        "timezone":"America/New_York",
        "zones":zones,
        "sources":[
            {"name":"NOAA/NWS Mount Holly Coastal Waters Forecast","url":FORECAST_URL,"kind":"official conditions"},
            {"name":"NOAA CO-OPS Tides & Currents","url":"https://api.tidesandcurrents.noaa.gov/api/prod/","kind":"official observations and predictions"},
            {"name":"The Fisherman regional NJ reports","url":REPORT_FEEDS["north"],"kind":"attributed regional fishing reports"},
            {"name":"FishingLBI / Fisherman’s Headquarters","url":REPORT_FEEDS["lbi"],"kind":"attributed LBI fishing report"},
        ],
        "errors":errors,
        "disclaimer":"Conditions are official observations or forecasts. Catch reports are attributed local reports, not guarantees. No report means no verified recent fishing claim, not no fish. Check marine warnings, access and current regulations before leaving.",
    }
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.name}: {len(zones)} zones, {len(errors)} source errors")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
