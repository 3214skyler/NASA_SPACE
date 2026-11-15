from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

SourceStatus = Literal["ok", "no_data", "credentials_required", "not_configured", "error"]
SourceKey = Literal["nasa_power", "smap", "gpm", "vegetation", "gaez"]



class FarmInput(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)

    # Dados da propriedade
    property_id: str | None = None
    area: float | None = Field(None, gt=0)
    soil: str | None = None
    irrigation: str | None = None
    current_crops: str | None = None

    # Preferências do agricultor
    priority: str
    desired_crops: list[str] = Field(default_factory=list)
    priorities: list[str] = Field(default_factory=list)
    goals: list[str] = Field(default_factory=list)

    # Culturas planeadas
    planned_crops: list[dict[str, Any]] = Field(default_factory=list)



class SourceBlock(BaseModel):
    """Resultado de uma fonte. `data` só existe quando status == 'ok'."""
    status: SourceStatus
    source: str
    product: str | None = None
    message: str | None = Field(None, description="Motivo quando status != ok")
    retrieved_at: datetime
    from_cache: bool = False
    data: dict[str, Any] | None = None


class EnvironmentalDataResponse(BaseModel):
    status: Literal["success", "partial", "unavailable"]
    location: dict[str, float]
    sources_summary: dict[str, SourceStatus]
    environmental_data: dict[str, SourceBlock]


class StrategyResponse(BaseModel):
    id: int
    name: str
    description: str
    benefits: str
    risks: str


class FarmAnalysisResponse(EnvironmentalDataResponse):
    """Compatível com a resposta anterior (location, user_priority, recommended_strategies)."""
    user_priority: str
    recommended_strategies: list[StrategyResponse] = Field(default_factory=list)
    recommendation_engine: dict[str, str] = Field(
        default_factory=lambda: {
            "status": "pending",
            "message": "O motor de recomendação (C++) ainda não está integrado; "
                       "nenhuma estratégia é gerada a partir de valores fixos.",
        }
    )
