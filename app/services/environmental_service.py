"""Orquestra as 5 fontes em paralelo e devolve um bloco uniforme por fonte."""
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

from app.services import gaez_service, gpm_service, nasa_power_service, smap_service, vegetation_service
from app.services.base import run_source
from app.services.risk_assessment_service import (
    assess_drought,
    assess_excess_precipitation,
    assess_vegetation,
)

HOUR, DAY = 3600, 86400


def _spec(name: str, product: str, module, digits: int, ttl: int) -> dict[str, Any]:
    return {"name": name, "product": product, "module": module, "digits": digits, "ttl": ttl}


SOURCES: dict[str, dict[str, Any]] = {
    "nasa_power": _spec("NASA POWER", "POWER daily/monthly point (AG)", nasa_power_service, 2, 6 * HOUR),
    "smap": _spec("NASA SMAP", "SPL4SMGP L4 9 km", smap_service, 2, 3 * HOUR),
    "gpm": _spec("NASA GPM / IMERG", "GPM_3IMERGDL V07", gpm_service, 2, 6 * HOUR),
    "vegetation": _spec("Landsat 8/9 NDVI", "Landsat C2 L2 SR", vegetation_service, 4, DAY),
    "gaez": _spec("FAO GAEZ v4", "ImageServer identify", gaez_service, 2, 30 * DAY),
}


def fetch_source(key: str, lat: float, lon: float) -> dict[str, Any]:
    spec = SOURCES[key]
    rlat, rlon = round(lat, spec["digits"]), round(lon, spec["digits"])
    module = spec["module"]
    return run_source(
        source=spec["name"],
        product=spec["product"],
        cache_key=f"{key}|{rlat}|{rlon}|v2",
        ttl_seconds=spec["ttl"],
        producer=lambda: module.fetch(lat, lon),
    )


def fetch_all(lat: float, lon: float) -> dict[str, Any]:
    keys = list(SOURCES)
    with ThreadPoolExecutor(max_workers=len(keys)) as pool:
        blocks = list(pool.map(lambda k: fetch_source(k, lat, lon), keys))
    environmental = dict(zip(keys, blocks))
    risk_assessments = {
        "drought": assess_drought(environmental),
        "excess_precipitation": assess_excess_precipitation(environmental),
        "vegetation": assess_vegetation(environmental),
    }
    ok = [k for k, b in environmental.items() if b["status"] == "ok"]
    status = "success" if len(ok) == len(keys) else ("partial" if ok else "unavailable")
    return {
        "status": status,
        "location": {"latitude": lat, "longitude": lon},
        "sources_summary": {k: b["status"] for k, b in environmental.items()},
        "environmental_data": environmental,
        "risk_assessments": risk_assessments,
    }
