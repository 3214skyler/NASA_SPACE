"""Valida cada fonte com dados REAIS (requer internet; SMAP/GPM requerem Earthdata).

Uso:  python scripts/check_sources.py [latitude longitude]
Por omissão usa Luanda (-8.8383, 13.2344). Não usa cache.
"""
import json
import os
import sys

os.environ.setdefault("CACHE_ENABLED", "false")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services import environmental_service as env  # noqa: E402


def brief(key: str, block: dict) -> dict:
    out = {"status": block["status"], "product": block["product"], "message": block["message"]}
    d = block.get("data") or {}
    if key == "nasa_power":
        out.update(period=d.get("period"), units={k: v["units"] for k, v in d.get("variables", {}).items()},
                   last_values={k: v["values"][-1] for k, v in d.get("variables", {}).items()},
                   anomaly=(d.get("precipitation_analysis") or {}).get("anomaly"), notes=d.get("notes"))
    elif key == "smap":
        out.update(units=d.get("units"), latest=d.get("latest"), n_days=len(d.get("series", [])))
    elif key == "gpm":
        out.update(units=d.get("units"), period=d.get("period"), summary=d.get("summary"))
    elif key == "vegetation":
        out.update(latest=d.get("latest"), n_obs=len(d.get("observations", [])), change=d.get("change_indicator"))
    elif key == "gaez":
        out.update(ranking=d.get("suitability_ranking"), n_layers=len(d.get("layers", [])))
    return out


if __name__ == "__main__":
    lat, lon = (float(sys.argv[1]), float(sys.argv[2])) if len(sys.argv) == 3 else (-8.8383, 13.2344)
    print(f"Ponto de teste: lat={lat} lon={lon}\n")
    for key in env.SOURCES:
        print(f"=== {key} ===")
        print(json.dumps(brief(key, env.fetch_source(key, lat, lon)), indent=2, ensure_ascii=False, default=str))
        print()
