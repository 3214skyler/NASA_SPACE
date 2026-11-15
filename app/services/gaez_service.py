"""FAO GAEZ v4 — adequação agroecológica das culturas.

Acesso programático oficial: os serviços ArcGIS ImageServer públicos da FAO
(https://gaez-services.fao.org/server/rest/services/<serviço>/ImageServer) permitem a
operação REST `identify`, que devolve o valor do raster num ponto.

ESTADO: o catálogo (app/data/gaez_catalog.json) só pode conter entradas CONFIRMADAS por um
`identify` real. Quem o gera é `python scripts/discover_gaez.py` (numa máquina com acesso a
gaez-services.fao.org). Confirmado por metadados REST públicos: res05 é um mosaic dataset
(1 banda int16, 5 arc-min, com campos de atributos: tema, cultura, abastecimento de água, nível
de input, modelo climático, RCP, período, unidades) e LR é temático (U8); ambos suportam
`identify`. Os nomes exatos dos campos e as camadas NÃO estão confirmados e por isso não
estão no código. Enquanto o catálogo estiver vazio: status="not_configured".

Formato de cada entrada (todas as chaves de "required" são obrigatórias):
{
  "id": "...", "label": "...", "crop": "...", "theme": "suitability|...",
  "service_url": ".../res05/ImageServer", "unit": "...",
  "identify_params": {"mosaicRule": {"mosaicMethod": "esriMosaicLockRaster", "lockRasterIds": [N]}},
  "scale_factor": 1.0,                  # opcional: valor_final = raw * scale_factor + offset
  "offset": 0.0,                        # opcional
  "attributes": {...},                  # atributos reais devolvidos pelo serviço (informativo)
  "confirmation": {"test_point": {"latitude": .., "longitude": ..}, "raw_value": .., "confirmed_at": "ISO"}
}
"""
import json
from pathlib import Path
from typing import Any

import requests

from app.core.config import settings
from app.services.base import DataUnavailable, NotConfigured, SourceError, num


REQUIRED_KEYS = ("id", "label", "crop", "theme", "service_url", "unit", "identify_params", "confirmation")


def validate_catalog(layers: list[dict[str, Any]]) -> list[str]:
    """Devolve a lista de problemas (vazia = válido). Só entradas confirmadas são aceites."""
    problems: list[str] = []
    seen: set[str] = set()
    for i, layer in enumerate(layers):
        name = layer.get("id", f"#{i}")
        for key in REQUIRED_KEYS:
            if layer.get(key) in (None, "", {}):
                problems.append(f"{name}: falta '{key}'")
        if name in seen:
            problems.append(f"{name}: id duplicado")
        seen.add(name)
        url = str(layer.get("service_url", ""))
        if not url.startswith("https://gaez-services.fao.org/server/rest/services/") or not url.endswith("/ImageServer"):
            problems.append(f"{name}: service_url não é um ImageServer oficial da FAO")
        conf = layer.get("confirmation") or {}
        if conf and (conf.get("raw_value") is None or not conf.get("confirmed_at") or not conf.get("test_point")):
            problems.append(f"{name}: 'confirmation' incompleta (raw_value/confirmed_at/test_point)")
    return problems


def load_catalog(path: str | None = None) -> list[dict[str, Any]]:
    p = Path(path or settings.GAEZ_CATALOG_PATH)
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return []
    except ValueError as exc:
        raise SourceError(f"Catálogo GAEZ inválido ({p}): {exc}") from exc
    layers = data.get("layers", [])
    problems = validate_catalog(layers)
    if problems:
        raise SourceError("Catálogo GAEZ inválido: " + "; ".join(problems[:5]))
    return layers


def parse_identify_value(body: dict[str, Any]) -> float | None:
    """Interpreta a resposta de `identify`. 'NoData'/vazio -> None."""
    if "error" in body:
        raise SourceError(f"GAEZ devolveu erro: {body['error']}")
    value = body.get("value")
    if value in (None, "", "NoData", "null"):
        return None
    return num(value)


def apply_scale(raw: float | None, layer: dict[str, Any]) -> float | None:
    if raw is None:
        return None
    return raw * float(layer.get("scale_factor", 1.0)) + float(layer.get("offset", 0.0))


def _identify(layer: dict[str, Any], lat: float, lon: float) -> float | None:
    params = {
        "geometry": json.dumps({"x": lon, "y": lat, "spatialReference": {"wkid": 4326}}),
        "geometryType": "esriGeometryPoint",
        "returnGeometry": "false",
        "returnCatalogItems": "false",
        "f": "json",
    }
    for key, value in (layer.get("identify_params") or {}).items():
        params[key] = value if isinstance(value, str) else json.dumps(value)
    url = layer["service_url"].rstrip("/") + "/identify"
    try:
        response = requests.get(url, params=params, timeout=settings.HTTP_TIMEOUT)
        response.raise_for_status()
        return parse_identify_value(response.json())  # valor bruto do raster
    except requests.exceptions.RequestException as exc:
        raise SourceError(f"Erro ao consultar GAEZ ({layer.get('id')}): {exc}") from exc
    except ValueError as exc:
        raise SourceError(f"Resposta GAEZ inválida ({layer.get('id')}).") from exc


def fetch(lat: float, lon: float) -> dict[str, Any]:
    layers = load_catalog()
    if not layers:
        raise NotConfigured(
            "Catálogo GAEZ vazio. Execute `python scripts/discover_gaez.py` numa máquina com acesso a "
            "gaez-services.fao.org e preencha app/data/gaez_catalog.json (ver README)."
        )

    results, errors = [], []
    for layer in layers:
        try:
            raw = _identify(layer, lat, lon)
            value = apply_scale(raw, layer)
        except SourceError as exc:
            errors.append(str(exc))
            continue
        results.append({
            "id": layer["id"], "label": layer.get("label"), "crop": layer.get("crop"),
            "theme": layer.get("theme"), "value": value, "raw_value": raw, "unit": layer.get("unit"),
            "service_url": layer["service_url"],
        })

    with_value = [r for r in results if r["value"] is not None]
    if not with_value:
        raise DataUnavailable("GAEZ sem valores para este ponto." + (f" Erros: {errors[:2]}" if errors else ""))

    suitability = sorted((r for r in with_value if r["theme"] == "suitability"),
                         key=lambda r: r["value"], reverse=True)
    return {
        "product": "FAO GAEZ v4 (serviços ImageServer, operação identify)",
        "request_point": {"latitude": lat, "longitude": lon},
        "layers": results,
        "suitability_ranking": [
            {"crop": r["crop"], "layer_id": r["id"], "value": r["value"], "unit": r["unit"]}
            for r in suitability
        ],
        "notes": ["Ranking = ordenação dos valores GAEZ devolvidos; nenhuma regra fixa por prioridade.", *errors[:3]],
    }
