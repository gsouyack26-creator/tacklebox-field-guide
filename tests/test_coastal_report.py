import importlib.util
import json
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("coastal_generator", ROOT / "scripts" / "update_coastal_report.py")
GEN = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GEN)

class CoastalReportTests(unittest.TestCase):
    def setUp(self):
        self.report = json.loads((ROOT / "coastal-report.json").read_text(encoding="utf-8"))

    def test_schema_and_zones(self):
        self.assertEqual(self.report["schemaVersion"], 1)
        self.assertEqual(len(self.report["zones"]), 6)
        self.assertEqual(len({zone["id"] for zone in self.report["zones"]}), 6)
        for zone in self.report["zones"]:
            self.assertTrue(zone["name"])
            self.assertTrue(zone["conditions"] or zone["forecast"])
            self.assertIn(zone["reportStatus"], {"verified", "stale", "conditions-only"})
            self.assertTrue(zone["techniques"])
            self.assertEqual(set(zone["sourceStatus"]), {"conditions", "forecast", "localReport"})

    def test_reports_are_attributed(self):
        for zone in self.report["zones"]:
            local = zone.get("localReport")
            if local:
                self.assertTrue(local["source"])
                self.assertTrue(local["url"].startswith("https://"))
                self.assertTrue(local["publishedAt"])

    def test_sources_are_https(self):
        self.assertGreaterEqual(len(self.report["sources"]), 3)
        for source in self.report["sources"]:
            self.assertTrue(source["url"].startswith("https://"))

    def test_full_live_noaa_outage_preserves_previous_file(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "coastal-report.json"
            previous = {"schemaVersion": 1, "generatedAt": "previous", "zones": []}
            output.write_text(json.dumps(previous), encoding="utf-8")
            with patch.object(GEN, "OUTPUT", output), patch.object(GEN, "fetch", side_effect=OSError("offline")):
                self.assertEqual(GEN.main(), 0)
            self.assertEqual(json.loads(output.read_text(encoding="utf-8")), previous)

if __name__ == "__main__":
    unittest.main()