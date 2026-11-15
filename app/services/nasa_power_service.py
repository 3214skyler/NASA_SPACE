"""NASA POWER — meteorologia diária e normal climatológica.

API: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
- Sem autenticação. Comunidade "AG" (agroclimatologia).
- Valor de preenchimento da API: -999  -> convertido para None.
- Resolução nativa: meteorologia ~0.5° x 0.625° (MERRA-2); radiação ~0.5° (CERES).
  O ponto devolvido é o da célula que contém a coordenada, não uma medição local.

Pedidos:
  1) Núcleo (obrigatório): T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, ALLSKY_SFC_SW_DWN, RH2M
  2) Opcional: GWETTOP, GWETROOT, GWETPROF (humidade do solo MERRA-2, fração 0-1,
     MODELADA — não é SMAP) e EVLAND (evaporação do solo, mm/dia).
     Se este segundo pedido falhar, o bloco continua válido com um aviso.
  3) Normal climatológica mensal de PRECTOTCORR (1991-2020) para calcular a
     anomalia de precipitação com a MESMA fonte (comparação coerente).
"""
import statistics
from datetime import date, datetime, timedelta
from typing import Any

import requests

from app.core.config import settings
from app.services.base import DataUnavailable, SourceError, num

BASE = "https://power.larc.nasa.gov/api/temporal"
FILL_VALUE = -999.0

CORE_PARAMS = ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN", "RH2M"]
OPTIONAL_PARAMS = ["GWETTOP", "GWETROOT", "GWETPROF", "EVLAND"]


def _get(url: str, params: dict[str, Any]) -> dict[str, Any]:
    try:
        response = requests.get(url, params=params, timeout=settings.HTTP_TIMEOUT)
    except requests.exceptions.RequestException as exc:
        raise SourceError(f"Erro de ligação à NASA POWER: {exc}") from exc
    if response.status_code == 429:
        raise SourceError("NASA POWER: limite de pedidos atingido (HTTP 429). Tente mais tarde.")
    if response.status_code >= 400:
        detail = response.text[:300].replace("\n", " ")
        raise SourceError(f"NASA POWER devolveu HTTP {response.status_code}: {detail}")
    try:
        return response.json()
    except ValueError as exc:
        raise SourceError("NASA POWER devolveu uma resposta que não é JSON válido.") from exc


def _clean(series: dict[str, Any]) -> dict[str, float | None]:
    """Converte -999 / valores inválidos em None (sem alterar o dicionário original)."""
    out: dict[str, float | None] = {}
    for key, value in series.items():
        f = num(value)
        out[key] = None if f is None or f == FILL_VALUE else f
    return out


def _summary(values: list[float | None]) -> dict[str, Any]:
    valid = [v for v in values if v is not None]
    return {
        "valid_days": len(valid),
        "missing_days": len(values) - len(valid),
        "mean": round(statistics.fmean(valid), 3) if valid else None,
        "min": min(valid) if valid else None,
        "max": max(valid) if valid else None,
    }


def _daily(lat: float, lon: float, params: list[str], start: str, end: str) -> dict[str, Any]:
    return _get(
        f"{BASE}/daily/point",
        {
            "parameters": ",".join(params),
            "community": "AG",
            "longitude": lon,
            "latitude": lat,
            "start": start,
            "end": end,
            "format": "JSON",
        },
    )


def _fmt_date(key: str) -> str:
    return f"{key[:4]}-{key[4:6]}-{key[6:8]}"


def _variables_block(payload: dict[str, Any]) -> tuple[list[str], dict[str, Any]]:
    """Extrai {nome: {units, long_name, values, summary}} e a lista de datas."""
    parameter = payload.get("properties", {}).get("parameter") or {}
    meta = payload.get("parameters", {})
    if not parameter:
        raise DataUnavailable("A NASA POWER não devolveu parâmetros para este local/período.")
    dates = sorted(next(iter(parameter.values())).keys())
    variables: dict[str, Any] = {}
    for name, series in parameter.items():
        cleaned = _clean(series)
        values = [cleaned.get(d) for d in dates]
        variables[name] = {
            "units": meta.get(name, {}).get("units"),
            "long_name": meta.get(name, {}).get("longname"),
            "values": values,
            "summary": _summary(values),
        }
    return [_fmt_date(d) for d in dates], variables


def _precipitation_analysis(
    dates: list[str], precip: list[float | None], clim: dict[int, list[float]]
) -> dict[str, Any]:
    """Totais mensais e anomalia do último mês completo face à normal 1991-2020 (POWER)."""
    by_month: dict[str, list[float | None]] = {}
    for d, v in zip(dates, precip):
        by_month.setdefault(d[:7], []).append(v)

    monthly = {}
    for month, vals in by_month.items():
        valid = [v for v in vals if v is not None]
        monthly[month] = {
            "total_mm": round(sum(valid), 2) if valid else None,
            "mean_mm_per_day": round(sum(valid) / len(valid), 3) if valid else None,
            "valid_days": len(valid),
            "days_in_window": len(vals),
        }

    last30 = [v for v in precip[-30:] if v is not None]
    result: dict[str, Any] = {
        "monthly": monthly,
        "last_30_days_total_mm": round(sum(last30), 2) if last30 else None,
        "last_30_days_valid_days": len(last30),
        "anomaly": None,
    }

    # Último mês CALENDÁRIO completo com >=90% de dias válidos.
    if dates:
        last_date = date.fromisoformat(dates[-1])
        # o mês da última data está completo se o dia seguinte já é de outro mês
        if (last_date + timedelta(days=1)).month != last_date.month:
            candidate = last_date
        else:
            candidate = last_date.replace(day=1) - timedelta(days=1)  # fim do mês anterior
        key = candidate.strftime("%Y-%m")
        info = monthly.get(key)
        month_clim = clim.get(candidate.month)
        if info and month_clim and len(month_clim) >= 10 and info["days_in_window"] >= 28 \
                and info["valid_days"] >= 0.9 * info["days_in_window"]:
            mean = statistics.fmean(month_clim)
            std = statistics.pstdev(month_clim)
            observed = info["mean_mm_per_day"]
            result["anomaly"] = {
                "reference_month": key,
                "observed_mean_mm_per_day": observed,
                "climatology_mean_mm_per_day": round(mean, 3),
                "climatology_std_mm_per_day": round(std, 3),
                "anomaly_mm_per_day": round(observed - mean, 3),
                "anomaly_percent": round(100 * (observed - mean) / mean, 1) if mean > 0 else None,
                "z_score": round((observed - mean) / std, 2) if std > 0 else None,
                "climatology_period": f"{settings.POWER_CLIM_START_YEAR}-{settings.POWER_CLIM_END_YEAR}",
                "method": "Média diária do mês observado (POWER PRECTOTCORR) vs média e desvio-padrão "
                          "da mesma variável, para o mesmo mês, na normal climatológica (POWER mensal).",
            }
    return result


def _climatology(lat: float, lon: float) -> dict[int, list[float]]:
    payload = _get(
        f"{BASE}/monthly/point",
        {
            "parameters": "PRECTOTCORR",
            "community": "AG",
            "longitude": lon,
            "latitude": lat,
            "start": settings.POWER_CLIM_START_YEAR,
            "end": settings.POWER_CLIM_END_YEAR,
            "format": "JSON",
        },
    )
    series = payload.get("properties", {}).get("parameter", {}).get("PRECTOTCORR", {})
    clim: dict[int, list[float]] = {m: [] for m in range(1, 13)}
    for key, value in series.items():
        # chaves YYYYMM; YYYY13 é a média anual -> ignorar
        if len(key) != 6:
            continue
        month = int(key[4:])
        f = num(value)
        if 1 <= month <= 12 and f is not None and f != FILL_VALUE:
            clim[month].append(f)
    return clim


def fetch(lat: float, lon: float) -> dict[str, Any]:
    end = date.today() - timedelta(days=settings.POWER_LATENCY_DAYS)
    start = end - timedelta(days=settings.POWER_HISTORY_DAYS - 1)
    start_s, end_s = start.strftime("%Y%m%d"), end.strftime("%Y%m%d")

    core = _daily(lat, lon, CORE_PARAMS, start_s, end_s)
    dates, variables = _variables_block(core)
    warnings: list[str] = []

    try:
        optional = _daily(lat, lon, OPTIONAL_PARAMS, start_s, end_s)
        opt_dates, opt_vars = _variables_block(optional)
        if opt_dates == dates:
            variables.update(opt_vars)
        else:
            warnings.append("Parâmetros opcionais com datas diferentes do núcleo; ignorados.")
    except SourceError as exc:
        warnings.append(f"Parâmetros opcionais (humidade do solo MERRA-2, evaporação) indisponíveis: {exc}")

    clim: dict[int, list[float]] = {}
    try:
        clim = _climatology(lat, lon)
    except SourceError as exc:
        warnings.append(f"Normal climatológica indisponível; sem anomalia de precipitação: {exc}")

    header = core.get("header", {})
    coords = (core.get("geometry") or {}).get("coordinates") or []
    return {
        "period": {"start": dates[0], "end": dates[-1], "days": len(dates)},
        "temporal_resolution": "daily",
        "spatial_resolution_note": "Meteorologia ~0.5° x 0.625° (MERRA-2); radiação ~0.5° (CERES). "
                                   "Valor da célula de grelha, não medição local.",
        "community": "AG",
        "api_version": header.get("api", {}).get("version") if isinstance(header.get("api"), dict) else header.get("api_version"),
        "fill_value_replaced": FILL_VALUE,
        "elevation_m": coords[2] if len(coords) > 2 else None,
        "request_point": {"latitude": lat, "longitude": lon},
        "dates": dates,
        "variables": variables,
        "precipitation_analysis": _precipitation_analysis(
            dates, variables["PRECTOTCORR"]["values"], clim
        ) if clim else {"monthly": {}, "anomaly": None},
        "notes": [
            "GWETTOP/GWETROOT/GWETPROF são humidade do solo MODELADA (MERRA-2, fração 0-1), "
            "não observação SMAP.",
            *warnings,
        ],
        "retrieved_for_period_end": datetime.strptime(end_s, "%Y%m%d").date().isoformat(),
    }
