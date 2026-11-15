import farm_engine
from fastapi import APIRouter, Query

from app.core.config import settings
from app.schemas.farm import (
    EnvironmentalDataResponse, FarmAnalysisResponse, FarmInput, SourceBlock, SourceKey,
)
from app.services import environmental_service as env
from app.services import gaez_service

router = APIRouter(prefix="/api", tags=["Farm Analysis"])

Lat = Query(..., ge=-90, le=90, description="Latitude (graus decimais)", examples=[-8.8383])
Lon = Query(..., ge=-180, le=180, description="Longitude (graus decimais)", examples=[13.2344])


# Endpoints síncronos (def): o FastAPI executa-os em threads, pois as consultas bloqueiam.

@router.post("/analyze", response_model=FarmAnalysisResponse)
def analyze_farm(data: FarmInput):
    result = env.fetch_all(data.latitude, data.longitude)

    environmental = result["environmental_data"]

    smap = environmental["smap"]
    gpm = environmental["gpm"]

    soil_moisture = None
    rainfall_30d = None

    if smap["status"] == "ok":
        latest = smap["data"]["latest"]
        soil_moisture = latest.get("root_zone_soil_moisture")

        if soil_moisture is None:
            soil_moisture = latest.get("surface_soil_moisture")

    if gpm["status"] == "ok":
        rainfall_30d = gpm["data"]["summary"].get("total_last_30_days_mm")

    strategies = []
    engine_status = "unavailable"
    engine_message = "Dados SMAP ou GPM insuficientes para gerar recomendações."

    if soil_moisture is not None and rainfall_30d is not None:
        cpp_results = farm_engine.recommend(
            float(soil_moisture),
            float(rainfall_30d),
            data.priority
        )

        strategies = [
            {
                "id": i,
                "name": s.name,
                "description": s.description,
                "benefits": s.benefits,
                "risks": s.risks,
            }
            for i, s in enumerate(cpp_results, start=1)
        ]

        engine_status = "success"
        engine_message = "Estratégias geradas pelo motor C++."

    return {
        **result,
        "user_priority": data.priority,
        "recommended_strategies": strategies,
        "recommendation_engine": {
            "status": engine_status,
            "message": engine_message,
        },
    }


@router.get("/environmental-data", response_model=EnvironmentalDataResponse)
def environmental_data(latitude: float = Lat, longitude: float = Lon):
    """Todas as fontes para uma coordenada. Falhas de uma fonte não derrubam as outras."""
    return env.fetch_all(latitude, longitude)


@router.get("/environmental-data/{source}", response_model=SourceBlock)
def single_source(source: SourceKey, latitude: float = Lat, longitude: float = Lon):
    """Uma só fonte (útil para testar cada integração isoladamente)."""
    return env.fetch_source(source, latitude, longitude)


@router.get("/sources/status")
def sources_status():
    """Configuração local (sem expor segredos)."""
    has_token = bool(settings.EARTHDATA_TOKEN)
    has_pair = bool(settings.EARTHDATA_USERNAME and settings.EARTHDATA_PASSWORD)
    try:
        gaez_layers = len(gaez_service.load_catalog())
    except Exception:  # noqa: BLE001
        gaez_layers = -1
    return {
        "earthdata_credentials_configured": has_token or has_pair,
        "gaez_catalog_layers": gaez_layers,
        "cache_enabled": settings.CACHE_ENABLED,
    }
