"""Testes UNITÁRIOS da lógica (parsing, matemática, erros) com entradas sintéticas.

NÃO provam que as APIs reais respondem: isso é feito por scripts/check_sources.py.
"""
import numpy as np
import pytest
import requests

from app.core.config import settings
from app.services import gaez_service, gpm_service, nasa_power_service as power
from app.services import smap_service, vegetation_service as veg
from app.services.base import CredentialsRequired, DataUnavailable, NotConfigured, SourceError, run_source


# ---------- POWER ----------
def test_power_fill_value_and_units():
    payload = {
        "properties": {"parameter": {"T2M": {"20250101": 25.0, "20250102": -999.0}}},
        "parameters": {"T2M": {"units": "C", "longname": "Temperature at 2 Meters"}},
    }
    dates, variables = power._variables_block(payload)
    assert dates == ["2025-01-01", "2025-01-02"]
    assert variables["T2M"]["values"] == [25.0, None]
    assert variables["T2M"]["units"] == "C"
    assert variables["T2M"]["summary"]["missing_days"] == 1


def test_power_empty_raises_no_data():
    with pytest.raises(DataUnavailable):
        power._variables_block({"properties": {"parameter": {}}})


def test_power_anomaly_uses_last_complete_month():
    dates = [f"2025-03-{d:02d}" for d in range(1, 32)] + [f"2025-04-{d:02d}" for d in range(1, 11)]
    precip = [2.0] * 31 + [5.0] * 10
    clim = {3: [1.0, 2.0, 3.0] * 4}  # média 2.0
    out = power._precipitation_analysis(dates, precip, clim)
    anomaly = out["anomaly"]
    assert anomaly["reference_month"] == "2025-03"
    assert anomaly["observed_mean_mm_per_day"] == 2.0
    assert anomaly["anomaly_mm_per_day"] == 0.0
    assert out["last_30_days_total_mm"] == round(5.0 * 10 + 2.0 * 20, 2)


def test_power_http_error_is_source_error(monkeypatch):
    class R:
        status_code = 422
        text = "invalid parameter"
    monkeypatch.setattr(power.requests, "get", lambda *a, **k: R())
    with pytest.raises(SourceError, match="422"):
        power._get("http://x", {})


def test_power_connection_error(monkeypatch):
    def boom(*a, **k):
        raise requests.exceptions.ConnectionError("down")
    monkeypatch.setattr(power.requests, "get", boom)
    with pytest.raises(SourceError, match="ligação"):
        power._get("http://x", {})


# ---------- SMAP ----------
def test_ease2_index_luanda_and_bounds():
    row, col = smap_service.ease2_index(-8.8383, 13.2344)
    assert (row, col) == (936, 2069)  # mesmo valor calculado com pyproj independentemente
    with pytest.raises(DataUnavailable):
        smap_service.ease2_index(89.0, 0.0)


def test_smap_daily_selection_uses_latest_version_one_per_day():
    def g(ts, ver):
        return {"umm": {"TemporalExtent": {"RangeDateTime": {"BeginningDateTime": ts}},
                        "CollectionReference": {"Version": ver}}, "meta": {}}
    granules = [g("2025-01-01T01:30:00Z", "007"), g("2025-01-01T01:30:00Z", "008"),
                g("2025-01-01T22:30:00Z", "008"), g("2025-01-02T10:30:00Z", "008")]
    chosen = smap_service.select_daily_granules(granules, 7)
    assert [x["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"] for x in chosen] == \
        ["2025-01-02T10:30:00Z", "2025-01-01T22:30:00Z"]


def test_smap_fill_value_is_none():
    ds = np.full((3, 3), -9999.0, dtype="float32")
    ds[1, 1] = 0.31
    assert smap_service._read_cell(ds, 0, 0) is None
    assert smap_service._read_cell(ds, 1, 1) == pytest.approx(0.31, abs=1e-6)


def test_no_credentials_raises(monkeypatch):
    from app.services import earthdata_auth
    for name in ("EARTHDATA_TOKEN", "EARTHDATA_USERNAME", "EARTHDATA_PASSWORD"):
        monkeypatch.delenv(name, raising=False)
        monkeypatch.setattr(settings, name, None)
    earthdata_auth.reset_auth()
    with pytest.raises(CredentialsRequired):
        smap_service.fetch(-8.8, 13.2)
    with pytest.raises(CredentialsRequired):
        gpm_service.fetch(-8.8, 13.2)


# ---------- GPM ----------
def test_gpm_summary():
    series = [{"date": f"d{i}", "precipitation_mm": v} for i, v in
              enumerate([0.0, 25.0, None, 3.0])]
    s = gpm_service.summarize(series, 20.0)
    assert s["total_last_30_days_mm"] == 28.0
    assert s["heavy_rain_days"] == 1 and s["days_with_data"] == 3 and s["wet_days_ge_1mm"] == 2


# ---------- Vegetação ----------
def test_ndvi_math_and_cloud_mask():
    # reflectância red=0.1, nir=0.4 -> NDVI = 0.6
    dn = lambda r: int(round((r + 0.2) / veg.SCALE))
    red = np.full((3, 3), dn(0.1)); nir = np.full((3, 3), dn(0.4))
    qa = np.zeros((3, 3), dtype="uint16")
    ndvi, n = veg.ndvi_from_dn(red, nir, qa)
    assert n == 9 and ndvi == pytest.approx(0.6, abs=1e-3)
    qa[:] = 1 << 3  # tudo nuvem
    assert veg.ndvi_from_dn(red, nir, qa) == (None, 0)
    qa[:] = 1 << 7  # tudo água
    assert veg.ndvi_from_dn(red, nir, qa)[0] is None


def test_change_indicator_needs_three_obs():
    obs = [{"date": "2025-01-01", "ndvi": 0.5}, {"date": "2025-01-09", "ndvi": 0.6}]
    assert veg.change_indicator(obs) is None
    obs.append({"date": "2025-01-17", "ndvi": 0.4})
    assert veg.change_indicator(obs)["difference"] == pytest.approx(-0.15, abs=1e-3)


# ---------- GAEZ ----------
def test_gaez_not_configured_when_catalog_empty():
    with pytest.raises(NotConfigured):
        gaez_service.fetch(-8.8, 13.2)


def test_gaez_identify_parsing():
    assert gaez_service.parse_identify_value({"value": "5231"}) == 5231.0
    assert gaez_service.parse_identify_value({"value": "NoData"}) is None
    with pytest.raises(SourceError):
        gaez_service.parse_identify_value({"error": {"code": 400}})


def test_gaez_ranking_from_catalog(monkeypatch):
    monkeypatch.setattr(gaez_service, "load_catalog", lambda *_: [
        {"id": "a", "crop": "maize", "theme": "suitability", "service_url": "http://x", "unit": "i"},
        {"id": "b", "crop": "cassava", "theme": "suitability", "service_url": "http://y", "unit": "i"}])
    values = {"http://x/identify": "3000", "http://y/identify": "7000"}

    class R:
        def __init__(self, v): self.v = v
        def raise_for_status(self): pass
        def json(self): return {"value": self.v}
    monkeypatch.setattr(gaez_service.requests, "get", lambda url, **k: R(values[url]))
    out = gaez_service.fetch(-8.8, 13.2)
    assert [r["crop"] for r in out["suitability_ranking"]] == ["cassava", "maize"]


# ---------- run_source / API ----------
def test_run_source_never_raises_and_maps_status():
    def make(exc):
        def p(): raise exc
        return run_source(source="s", product="p", cache_key=f"k-{type(exc).__name__}", ttl_seconds=1, producer=p)
    assert make(DataUnavailable("x"))["status"] == "no_data"
    assert make(CredentialsRequired("x"))["status"] == "credentials_required"
    assert make(NotConfigured("x"))["status"] == "not_configured"
    assert make(RuntimeError("x"))["status"] == "error"


def test_api_partial_failure_returns_200(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app

    monkeypatch.setattr(settings, "CACHE_ENABLED", False)
    monkeypatch.setattr(power, "fetch", lambda lat, lon: {"ok": True})
    for mod in (smap_service, gpm_service, veg, gaez_service):
        monkeypatch.setattr(mod, "fetch", lambda lat, lon: (_ for _ in ()).throw(DataUnavailable("sem dados")))
    client = TestClient(app)
    r = client.get("/api/environmental-data", params={"latitude": -8.8383, "longitude": 13.2344})
    body = r.json()
    assert r.status_code == 200 and body["status"] == "partial"
    assert body["sources_summary"]["nasa_power"] == "ok" and body["sources_summary"]["smap"] == "no_data"
    assert client.get("/api/environmental-data", params={"latitude": 95, "longitude": 0}).status_code == 422
    post = client.post("/api/analyze", json={"latitude": -8.8, "longitude": 13.2, "priority": "soil_health"})
    assert post.status_code == 200 and post.json()["recommended_strategies"] == []
