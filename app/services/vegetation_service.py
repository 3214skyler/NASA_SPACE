"""Vegetação — NDVI a partir de Landsat 8/9 Collection 2 Level-2 (30 m).

Escolha: Landsat 8/9 SR via Microsoft Planetary Computer (STAC público, sem conta
Earthdata; o token SAS de leitura é anónimo e gratuito). Alternativas oficiais NASA/USGS
(VIIRS VNP13, MODIS MOD13 via AppEEARS/LP DAAC) exigem Earthdata e têm 375 m–1 km.
Landsat dá 30 m — útil para parcelas agrícolas — mas revisita de 8 dias (L8+L9) e
é afetado por nuvens; por isso devolvemos as últimas observações limpas, não "o dia de hoje".

Metodologia (documentada em README):
  1. STAC: cenas Landsat 8/9 que intersectam o ponto, últimos VEG_LOOKBACK_DAYS dias.
  2. Janela 3x3 pixéis (90 m) à volta do ponto em red (SR_B4), nir08 (SR_B5), qa_pixel.
  3. Reflectância = DN * 0.0000275 - 0.2 (fatores USGS C2L2).
  4. Máscara QA_PIXEL: exclui fill, nuvem, nuvem dilatada, cirrus, sombra, neve e ÁGUA.
  5. NDVI = (NIR - RED) / (NIR + RED) por pixel; média dos pixéis limpos (mín. 3 de 9).
  6. Indicador de variação: NDVI mais recente menos a mediana das observações anteriores
     desta janela. É uma variação RELATIVA recente, NÃO um índice de stress calibrado
     (isso exigiria uma climatologia NDVI multianual por época, não calculada aqui).
"""
import statistics
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

from app.core.config import settings
from app.services.base import DataUnavailable, SourceError

COLLECTION = "landsat-c2-l2"
SCALE, OFFSET = 0.0000275, -0.2
# QA_PIXEL: bit0 fill, 1 dilated cloud, 2 cirrus, 3 cloud, 4 shadow, 5 snow, 7 water
BAD_BITS = 0b10111111
MIN_CLEAR_PIXELS = 3

_sas_lock = threading.Lock()
_sas: dict[str, Any] = {"token": None, "expires": 0.0}


def ndvi_from_dn(red_dn, nir_dn, qa) -> tuple[float | None, int]:
    """NDVI médio dos pixéis limpos de uma janela. Devolve (ndvi|None, nº pixéis limpos)."""
    import numpy as np

    red_dn, nir_dn, qa = (np.asarray(a) for a in (red_dn, nir_dn, qa))
    red = red_dn.astype("float64") * SCALE + OFFSET
    nir = nir_dn.astype("float64") * SCALE + OFFSET
    clear = ((qa.astype("uint32") & BAD_BITS) == 0) & (red_dn > 0) & (nir_dn > 0)
    denom = nir + red
    clear &= denom > 0
    n = int(clear.sum())
    if n < MIN_CLEAR_PIXELS:
        return None, n
    ndvi = (nir[clear] - red[clear]) / denom[clear]
    return float(np.clip(ndvi, -1, 1).mean()), n


def change_indicator(observations: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Último NDVI vs mediana das anteriores (ordenado por data)."""
    if len(observations) < 3:
        return None
    ordered = sorted(observations, key=lambda o: o["date"])
    latest = ordered[-1]["ndvi"]
    median_prev = statistics.median(o["ndvi"] for o in ordered[:-1])
    return {
        "latest_ndvi": round(latest, 3),
        "median_previous_ndvi": round(median_prev, 3),
        "difference": round(latest - median_prev, 3),
        "observations_used": len(ordered),
        "interpretation": "Variação relativa recente. Não é um índice de stress calibrado.",
    }


def _sas_token() -> str:
    with _sas_lock:
        if _sas["token"] and time.time() < _sas["expires"] - 60:
            return _sas["token"]
        try:
            r = requests.get(f"{settings.SAS_URL}/{COLLECTION}", timeout=settings.HTTP_TIMEOUT)
            r.raise_for_status()
            body = r.json()
            token = body["token"]
        except (requests.exceptions.RequestException, KeyError, ValueError) as exc:
            raise SourceError(f"Não foi possível obter o token de leitura do Planetary Computer: {exc}") from exc
        _sas.update(token=token, expires=time.time() + 600)
        return token


def _search(lat: float, lon: float) -> list[dict[str, Any]]:
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=settings.VEG_LOOKBACK_DAYS)
    body = {
        "collections": [COLLECTION],
        "intersects": {"type": "Point", "coordinates": [lon, lat]},
        "datetime": f"{start.strftime('%Y-%m-%dT%H:%M:%SZ')}/{end.strftime('%Y-%m-%dT%H:%M:%SZ')}",
        "query": {
            "eo:cloud_cover": {"lt": settings.VEG_MAX_CLOUD_COVER},
            "platform": {"in": ["landsat-8", "landsat-9"]},
        },
        "sortby": [{"field": "datetime", "direction": "desc"}],
        "limit": settings.VEG_MAX_SCENES,
    }
    try:
        r = requests.post(f"{settings.STAC_URL}/search", json=body, timeout=settings.HTTP_TIMEOUT)
        r.raise_for_status()
        return r.json().get("features", [])
    except requests.exceptions.RequestException as exc:
        raise SourceError(f"Erro na pesquisa STAC (Planetary Computer): {exc}") from exc
    except ValueError as exc:
        raise SourceError("Resposta STAC inválida.") from exc


def _read_window(href: str, lat: float, lon: float):
    import rasterio
    from rasterio.warp import transform
    from rasterio.windows import Window

    with rasterio.open(href) as ds:
        xs, ys = transform("EPSG:4326", ds.crs, [lon], [lat])
        row, col = ds.index(xs[0], ys[0])
        if row < 1 or col < 1 or row >= ds.height - 1 or col >= ds.width - 1:
            raise DataUnavailable("Ponto na orla da cena.")
        return ds.read(1, window=Window(col - 1, row - 1, 3, 3))


def _observation(item: dict[str, Any], lat: float, lon: float, token: str) -> dict[str, Any] | None:
    import rasterio

    assets = item["assets"]
    hrefs = {k: f"{assets[k]['href']}?{token}" for k in ("red", "nir08", "qa_pixel")}
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MAX_RETRY="3",
                      GDAL_HTTP_RETRY_DELAY="1", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif"):
        try:
            red = _read_window(hrefs["red"], lat, lon)
            nir = _read_window(hrefs["nir08"], lat, lon)
            qa = _read_window(hrefs["qa_pixel"], lat, lon)
        except DataUnavailable:
            return None
    ndvi, n = ndvi_from_dn(red, nir, qa)
    if ndvi is None:
        return None
    props = item["properties"]
    return {
        "date": props["datetime"][:10],
        "datetime_utc": props["datetime"],
        "ndvi": round(ndvi, 4),
        "clear_pixels_used": n,
        "window_pixels": 9,
        "scene_cloud_cover_percent": props.get("eo:cloud_cover"),
        "platform": props.get("platform"),
        "scene_id": item["id"],
    }


def fetch(lat: float, lon: float) -> dict[str, Any]:
    items = _search(lat, lon)
    if not items:
        raise DataUnavailable(
            f"Nenhuma cena Landsat 8/9 com <{settings.VEG_MAX_CLOUD_COVER:.0f}% de nuvens "
            f"nos últimos {settings.VEG_LOOKBACK_DAYS} dias."
        )
    token = _sas_token()

    def work(item):
        try:
            return _observation(item, lat, lon, token), None
        except Exception as exc:  # noqa: BLE001
            return None, f"{item.get('id')}: {type(exc).__name__}: {exc}"

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(work, items))
    observations = sorted((o for o, _ in results if o), key=lambda o: o["date"])
    errors = [e for _, e in results if e]

    if not observations:
        raise DataUnavailable(
            f"{len(items)} cena(s) encontrada(s), mas sem pixéis limpos (nuvem/água/sombra) no ponto."
            + (f" Erros: {errors[:2]}" if errors else "")
        )

    return {
        "product": "Landsat 8/9 Collection 2 Level-2 Surface Reflectance (USGS)",
        "index": "NDVI = (NIR - RED) / (NIR + RED)",
        "units": "adimensional (-1 a 1)",
        "spatial_resolution": "30 m (média de janela 3x3 = 90 m)",
        "request_point": {"latitude": lat, "longitude": lon},
        "latest": observations[-1],
        "observations": observations,
        "change_indicator": change_indicator(observations),
        "stress_indicator": None,
        "notes": [
            "Stress da vegetação não é classificado: faltaria uma climatologia NDVI multianual por época.",
            "Pontos sobre água, nuvem, sombra ou neve são excluídos pela máscara QA_PIXEL.",
            *errors[:3],
        ],
    }
