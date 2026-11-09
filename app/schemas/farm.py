from pydantic import BaseModel, Field

class FarmInput(BaseModel):
    latitude: float = Field(..., description="Latitude do campo agrícola", example=-8.8383)
    longitude: float = Field(..., description="Longitude do campo agrícola", example=13.2344)
    priority: str = Field(
        ..., 
        description="Prioridade principal do agricultor (ex: 'water_conservation', 'soil_health')", 
        example="water_conservation"
    )

class StrategyResponse(BaseModel):
    id: int
    name: str
    description: str
    benefits: str
    risks: str

class FarmAnalysisResponse(BaseModel):
    status: str
    location: dict
    user_priority: str
    recommended_strategies: list[StrategyResponse]