"""Testes do catálogo e da consulta `identify` do GAEZ.

- Testes offline: respostas HTTP simuladas (formato documentado do ArcGIS ImageServer).
- Teste live (opcional): GAEZ_LIVE=1 pytest tests/test_gaez.py -k live
  Reconsulta cada entrada do catálogo no ponto de confirmação e compara com o valor guardado.
"""
import importlib.util
import json
import os
from pathlib import Path

import pytest

from app.core.config import settings
from app.services import gaez_service as gz
from app.services.base import DataUnavailable, SourceError

ROOT = Path(__file__).resolve().parent.parent
SVC = "https://gaez-services.fao.org/server/rest/services/res05/ImageServer"


def _entry(**over):
    e = {"id": "res05_1", "label": "x", "crop": "c", "theme": "suitability", "service_url": SVC, "unit": "u",
         "identify_params": {"mosaicRule": {"mosaicMethod": "esriMosaicLockRaster", "lockRasterIds": [1]}},
         "confirmation": {"test_point": {"latitude": -8.8383, "longitude": 13.2344}, "raw_value": 5.0,
                          "confirmed_at": "2026-01-01T00:00:00+00:00"}}
    e.update(over)
    return e


class FakeResp:
    def __init__(self, body): self.body = body
    def raise_for_status(self): pass
    def json(self): return self.body


def _load_discover():
    spec = importlib.util.spec_from_file_location("discover_gaez", ROOT / "scripts" / "discover_gaez.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ---------- catálogo ----------
def test_shipped_catalog_is_valid_and_only_confirmed():
    data = json.loads((ROOT / "app/data/gaez_catalog.json").read_text(encoding="utf-8"))
    assert gz.validate_catalog(data["layers"]) == []  # vazio ou 100% confirmado


def test_validator_accepts_confirmed_entry():
    assert gz.validate_catalog([_entry()]) == []


@pytest.mark.parametrize("override,fragment", [
    ({"confirmation": None}, "confirmation"),
    ({"crop": None}, "crop"),
    ({"unit": ""}, "unit"),
    ({"service_url": "http://evil.example/ImageServer"}, "oficial"),
    ({"confirmation": {"test_point": {"latitude": 0, "longitude": 0}}}, "incompleta"),
])
def test_validator_rejects_bad_entries(override, fragment):
    assert any(fragment in p for p in gz.validate_catalog([_entry(**override)]))


def test_validator_rejects_duplicate_ids():
    assert any("duplicado" in p for p in gz.validate_catalog([_entry(), _entry()]))


def test_load_catalog_raises_on_invalid_file(tmp_path):
    p = tmp_path / "c.json"
    p.write_text(json.dumps({"layers": [_entry(crop=None)]}))
    with pytest.raises(SourceError):
        gz.load_catalog(str(p))


# ---------- identify ----------
def test_identify_request_shape_and_scale(monkeypatch):
    calls = {}

    def fake_get(url, params=None, timeout=None):
        calls.update(url=url, params=params)
        return FakeResp({"objectId": 0, "name": "Pixel", "value": "5231"})

    monkeypatch.setattr(gz.requests, "get", fake_get)
    layer = _entry(scale_factor=0.01, offset=1.0)
    raw = gz._identify(layer, -8.8383, 13.2344)
    assert raw == 5231.0 and gz.apply_scale(raw, layer) == pytest.approx(53.31)
    assert calls["url"] == SVC + "/identify"
    p = calls["params"]
    assert json.loads(p["geometry"]) == {"x": 13.2344, "y": -8.8383, "spatialReference": {"wkid": 4326}}
    assert p["geometryType"] == "esriGeometryPoint" and p["f"] == "json"
    assert json.loads(p["mosaicRule"])["lockRasterIds"] == [1]


@pytest.mark.parametrize("body", [{"value": "NoData"}, {"value": ""}, {}])
def test_identify_nodata_is_none(body):
    assert gz.parse_identify_value(body) is None


def test_fetch_all_nodata_raises_no_data(monkeypatch):
    monkeypatch.setattr(gz, "load_catalog", lambda *_: [_entry()])
    monkeypatch.setattr(gz.requests, "get", lambda *a, **k: FakeResp({"value": "NoData"}))
    with pytest.raises(DataUnavailable):
        gz.fetch(0.0, -30.0)


def test_fetch_reports_scaled_and_raw(monkeypatch):
    monkeypatch.setattr(gz, "load_catalog", lambda *_: [_entry(scale_factor=2.0)])
    monkeypatch.setattr(gz.requests, "get", lambda *a, **k: FakeResp({"value": "10"}))
    out = gz.fetch(-8.8, 13.2)
    assert out["layers"][0]["value"] == 20.0 and out["layers"][0]["raw_value"] == 10.0


# ---------- script de descoberta (lógica pura) ----------
def test_discover_detect_field_and_catalog_items(monkeypatch):
    d = _load_discover()
    fields = [{"name": "OBJECTID"}, {"name": "crop_name", "alias": "Crop"}, {"name": "x", "alias": "Units"}]
    assert d.detect_field(fields, "crop", None) == "crop_name"
    assert d.detect_field(fields, "unit", None) == "x"
    assert d.detect_field(fields, "theme", None) is None
    assert d.detect_field(fields, "theme", "forced") == "forced"

    body = {"value": "NoData", "properties": {"Values": ["1", "2"]},
            "catalogItems": {"objectIds": [10, 11], "features": [{"attributes": {"a": 1}}, {"attributes": {"a": 2}}]}}
    monkeypatch.setattr(d, "get", lambda url, **p: body)
    _, items = d.catalog_items(SVC, 0, 0, None)
    assert [(i["object_id"], i["value_at_point"]) for i in items] == [(10, "1"), (11, "2")]


# ---------- live (opcional) ----------
@pytest.mark.skipif(os.environ.get("GAEZ_LIVE") != "1", reason="defina GAEZ_LIVE=1 (requer internet)")
def test_live_catalog_entries_still_resolve():
    layers = gz.load_catalog()
    if not layers:
        pytest.skip("catálogo vazio: gere-o com scripts/discover_gaez.py")
    for layer in layers:
        pt = layer["confirmation"]["test_point"]
        assert gz._identify(layer, pt["latitude"], pt["longitude"]) == pytest.approx(layer["confirmation"]["raw_value"])
