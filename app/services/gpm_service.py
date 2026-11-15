"""NASA GPM / IMERG — precipitação diária.

Produto escolhido: GPM_3IMERGDL (IMERG Late Run, diário, 0.1° x 0.1°, V07), GES DISC.
  - Latência ~14 h: adequado para acompanhar a campanha agrícola atual.
  - O "Final Run" (GPM_3IMERGDF) é mais preciso (calibrado com pluviómetros) mas só fica
    disponível ~3,5 meses depois. Configurável em GPM_SHORT_NAME.
  - Variável: precipitation (mm/dia).

Anomalia de precipitação: NÃO é calculada aqui. Uma anomalia fiável exige uma normal
IMERG de várias décadas (≥ 20 anos x 30 dias de ficheiros). A anomalia é calculada
com NASA POWER (mesma fonte nos dois termos) — ver nasa_power_service.

Acesso: login NASA Earthdata (gratuito). Leitura parcial dos NetCDF4/HDF5 por HTTP.
"""
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import settings
from app.services import earthdata_auth
from app.services.base import DataUnavailable, SourceError, num

VAR_CANDIDATES = ["precipitation", "precipitationCal"]


def _granule_date(granule) -> str:
    rng = granule["umm"]["TemporalExtent"]["RangeDateTime"]
    return rng["BeginningDateTime"][:10]


def _point_value(file_obj, lat: float, lon: float) -> tuple[float | None, str]:
    import xarray as xr

    last_error: Exception | None = None
    for group in (None, "Grid"):
        try:
            ds = xr.open_dataset(file_obj, engine="h5netcdf", group=group, decode_times=False)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            continue
        with ds:
            name = next((v for v in VAR_CANDIDATES if v in ds.variables), None)
            if name is None:
                continue
            value = ds[name].sel(lat=lat, lon=lon, method="nearest")
            f = num(value.squeeze().values)
            units = ds[name].attrs.get("units", "mm/day")
            return (None if f is None or f < 0 else f), units
    raise SourceError(f"Variável de precipitação não encontrada no ficheiro IMERG ({last_error}).")


def summarize(series: list[dict[str, Any]], heavy_mm: float) -> dict[str, Any]:
    """Acumulados e indicadores a partir da série diária (dict com date, precipitation_mm)."""
    values = [s["precipitation_mm"] for s in series]
    valid = [v for v in values if v is not None]

    def total(last_n: int) -> float | None:
        window = [v for v in values[-last_n:] if v is not None]
        return round(sum(window), 2) if window else None

    wet = [v for v in valid if v >= 1.0]
    return {
        "days_with_data": len(valid),
        "days_requested": len(values),
        "total_last_7_days_mm": total(7),
        "total_last_30_days_mm": total(30),
        "max_daily_mm": max(valid) if valid else None,
        "wet_days_ge_1mm": len(wet),
        "heavy_rain_days": sum(1 for v in valid if v >= heavy_mm),
        "heavy_rain_threshold_mm": heavy_mm,
        "definition": "Dia de chuva intensa = precipitação diária ≥ limiar (índice R20mm por omissão).",
    }


def fetch(lat: float, lon: float) -> dict[str, Any]:
    earthdata_auth.get_auth()
    import earthaccess

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=settings.GPM_DAYS + 1)
    try:
        granules = earthaccess.search_data(
            short_name=settings.GPM_SHORT_NAME,
            version=settings.GPM_VERSION,
            temporal=(start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")),
            count=settings.GPM_DAYS + 5,
        )
    except Exception as exc:  # noqa: BLE001
        raise SourceError(f"Erro na pesquisa CMR do GPM/IMERG: {exc}") from exc

    per_day = {_granule_date(g): g for g in granules}
    days = sorted(per_day)[-settings.GPM_DAYS:]
    if not days:
        raise DataUnavailable(
            f"Nenhum granulo {settings.GPM_SHORT_NAME} v{settings.GPM_VERSION} nos últimos {settings.GPM_DAYS} dias."
        )
    chosen = [per_day[d] for d in days]

    try:
        files = earthaccess.open(chosen)
    except Exception as exc:  # noqa: BLE001
        raise SourceError(f"Não foi possível abrir os ficheiros IMERG: {exc}") from exc

    series, errors, units = [], [], "mm/day"
    for day, file_obj in zip(days, files):
        try:
            value, units = _point_value(file_obj, lat, lon)
            series.append({"date": day, "precipitation_mm": value})
        except Exception as exc:  # noqa: BLE001
            series.append({"date": day, "precipitation_mm": None})
            errors.append(f"{day}: {exc}")

    if not any(s["precipitation_mm"] is not None for s in series):
        raise DataUnavailable("Sem valores IMERG válidos para este ponto." + (f" Erros: {errors[:2]}" if errors else ""))

    return {
        "product": f"{settings.GPM_SHORT_NAME} v{settings.GPM_VERSION}",
        "units": units,
        "temporal_resolution": "daily",
        "spatial_resolution": "0.1° x 0.1° (~10 km)",
        "period": {"start": days[0], "end": days[-1]},
        "request_point": {"latitude": lat, "longitude": lon},
        "series": series,
        "summary": summarize(series, settings.GPM_HEAVY_RAIN_MM),
        "anomaly": None,
        "notes": [
            "Anomalia de precipitação: ver nasa_power.precipitation_analysis (IMERG não tem normal longa aqui).",
            "Late Run é provisório; o Final Run (GPM_3IMERGDF) é calibrado mas chega com ~3,5 meses de atraso.",
            *errors[:3],
        ],
    }
