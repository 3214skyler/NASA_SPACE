from fastapi import APIRouter, HTTPException
from app.schemas.farm import FarmInput, FarmAnalysisResponse
from app.services.nasa_service import NasaService

router = APIRouter(prefix="/api", tags=["Farm Analysis"])

@router.post("/analyze", response_model=FarmAnalysisResponse)
async def analyze_farm(data: FarmInput):
    try:
        weather_data = NasaService.fetch_nasa_power_data(data.latitude, data.longitude)
        
        strategies = NasaService.calculate_rotation_strategies(data.priority, weather_data)

        return {
            "status": "success",
            "location": {
                "latitude": data.latitude,
                "longitude": data.longitude
            },
            "user_priority": data.priority,
            "recommended_strategies": strategies
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno no processamento: {str(e)}")