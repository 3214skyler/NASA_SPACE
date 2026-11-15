"""Avaliação ambiental baseada nos dados das fontes NASA."""

import math


def _result(
    status: str,
    explanation: str,
    evidence: list | None = None,
    limitations: list | None = None,
    attention_level: str | None = None,
) -> dict:
    return {
        "status": status,
        "attention_level": attention_level,
        "evidence": evidence or [],
        "explanation": explanation,
        "limitations": limitations or [],
    }

def _source_data(environmental_data: dict, source: str) -> dict | None:
    block = environmental_data.get(source)

    if not isinstance(block, dict) or block.get("status") != "ok":
        return None

    data = block.get("data")
    return data if isinstance(data, dict) else None


def _number(value) -> float | None:
    if isinstance(value, bool):
        return None

    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    return number if math.isfinite(number) else None

def assess_drought(environmental_data: dict) -> dict:
    power = _source_data(environmental_data, "nasa_power")
    smap = _source_data(environmental_data, "smap")

    evidence = []
    limitations = []

    # Anomalia de precipitação
    anomaly = None
    if power:
        precipitation = power.get("precipitation_analysis", {})
        anomaly = precipitation.get("anomaly")

    if isinstance(anomaly, dict):
        value = _number(anomaly.get("anomaly_percent"))
        if value is not None:
            evidence.append({
                "indicator": "Anomalia de precipitação",
                "value": value,
                "unit": "%",
                "source": "NASA POWER",
                "date": anomaly.get("reference_month"),
            })
    else:
        limitations.append("Anomalia histórica de precipitação indisponível.")

    # Humidade do solo SMAP
    latest = smap.get("latest") if smap else None

    if isinstance(latest, dict):
        root = _number(latest.get("root_zone_soil_moisture"))
        surface = _number(latest.get("surface_soil_moisture"))

        if root is not None:
            evidence.append({
                "indicator": "Humidade da zona radicular",
                "value": root,
                "unit": "m³/m³",
                "source": "NASA SMAP",
                "date": latest.get("observation_time_utc"),
            })
        elif surface is not None:
            evidence.append({
                "indicator": "Humidade superficial do solo",
                "value": surface,
                "unit": "m³/m³",
                "source": "NASA SMAP",
                "date": latest.get("observation_time_utc"),
            })
    else:
        limitations.append("Dados recentes de humidade do solo indisponíveis.")

    # Temperatura média
    temperature = None
    if power:
        temperature = _number(
            power.get("variables", {})
            .get("T2M", {})
            .get("summary", {})
            .get("mean")
        )

    if temperature is not None:
        evidence.append({
            "indicator": "Temperatura média do ar",
            "value": temperature,
            "unit": "°C",
            "source": "NASA POWER",
            "date": power.get("period", {}).get("end"),
        })
    else:
        limitations.append("Temperatura média indisponível.")

    has_precipitation = any(
        item["indicator"] == "Anomalia de precipitação"
        for item in evidence
    )

    has_soil_moisture = any(
        item["source"] == "NASA SMAP"
        for item in evidence
    )

    if not has_precipitation or not has_soil_moisture:
        return _result(
            status="insufficient_data",
            explanation="São necessários dados de precipitação e humidade do solo para avaliar condições de seca.",
            evidence=evidence,
            limitations=limitations + [
                "A avaliação exige indicadores disponíveis tanto do POWER como do SMAP."
            ],
        )

    return _result(
        status="assessed",
        explanation=(
            "Foram recolhidos indicadores de precipitação e humidade do solo. "
            "Estes dados permitem acompanhar condições ambientais, "
            "mas ainda não confirmam a existência de seca."
        ),
        evidence=evidence,
        limitations=limitations + [
            "Não existe ainda uma classificação de risco validada por região e época do ano."
        ],
    )

def assess_excess_precipitation(environmental_data: dict) -> dict:
    gpm = _source_data(environmental_data, "gpm")
    power = _source_data(environmental_data, "nasa_power")

    evidence = []
    limitations = []

    if gpm:
        summary = gpm.get("summary", {})

        indicators = [
            ("Precipitação acumulada em 7 dias", "total_last_7_days_mm", "mm"),
            ("Precipitação acumulada em 30 dias", "total_last_30_days_mm", "mm"),
            ("Maior precipitação diária", "max_daily_mm", "mm"),
            ("Dias de chuva intensa", "heavy_rain_days", "dias"),
        ]

        for label, key, unit in indicators:
            value = _number(summary.get(key))
            if value is not None:
                evidence.append({
                    "indicator": label,
                    "value": value,
                    "unit": unit,
                    "source": "NASA GPM / IMERG",
                    "date": None,
                })

    else:
        limitations.append("Dados de precipitação do NASA GPM indisponíveis.")

    anomaly = None
    if power:
        precipitation = power.get("precipitation_analysis", {})
        anomaly = precipitation.get("anomaly")

    if isinstance(anomaly, dict):
        value = _number(anomaly.get("anomaly_percent"))
        if value is not None:
            evidence.append({
                "indicator": "Anomalia histórica de precipitação",
                "value": value,
                "unit": "%",
                "source": "NASA POWER",
                "date": anomaly.get("reference_month"),
            })
    else:
        limitations.append("Comparação histórica de precipitação indisponível.")

    has_gpm = any(
        item["source"] == "NASA GPM / IMERG"
        for item in evidence
    )
    has_anomaly = any(
        item["indicator"] == "Anomalia histórica de precipitação"
        for item in evidence
    )

    if not has_gpm or not has_anomaly:
        return _result(
            status="insufficient_data",
            explanation="São necessários dados recentes do GPM e uma referência histórica do POWER para avaliar o excesso de precipitação.",
            evidence=evidence,
            limitations=limitations,
        )

    return _result(
        status="assessed",
        explanation=(
            "Foram analisados os acumulados recentes de precipitação "
            "e a comparação com a referência histórica. "
            "Os indicadores permitem acompanhar alterações na chuva, "
            "mas não confirmam, por si só, risco de inundação."
        ),
        evidence=evidence,
        limitations=limitations + [
            "Não existe ainda um modelo validado de risco de inundação."
        ],
    )

def assess_vegetation(environmental_data: dict) -> dict:
    vegetation = _source_data(environmental_data, "vegetation")

    evidence = []
    limitations = []

    if not vegetation:
        return _result(
            status="insufficient_data",
            explanation="Não existem dados Landsat disponíveis para avaliar a vegetação.",
            limitations=["Dados de observação da vegetação indisponíveis."],
        )

    latest = vegetation.get("latest")

    if isinstance(latest, dict):
        ndvi = _number(latest.get("ndvi"))

        if ndvi is not None:
            evidence.append({
                "indicator": "NDVI mais recente",
                "value": ndvi,
                "unit": "adimensional",
                "source": "Landsat 8/9",
                "date": latest.get("date"),
            })

    change = vegetation.get("change_indicator")

    if isinstance(change, dict):
        difference = _number(change.get("difference"))

        if difference is not None:
            evidence.append({
                "indicator": "Variação recente do NDVI",
                "value": difference,
                "unit": "adimensional",
                "source": "Landsat 8/9",
                "date": latest.get("date") if isinstance(latest, dict) else None,
            })
    else:
        limitations.append(
            "São necessárias pelo menos três observações válidas para calcular a variação do NDVI."
        )

    if not evidence:
        return _result(
            status="insufficient_data",
            explanation="Não existem observações válidas de NDVI.",
            limitations=limitations,
        )

    return _result(
        status="assessed",
        explanation=(
            "Foram analisados os valores recentes do NDVI. "
            "A variação indica mudanças na vegetação, mas não confirma "
            "stress vegetal ou perda de produtividade."
        ),
        evidence=evidence,
        limitations=limitations + [
            "Não existe uma referência histórica sazonal para classificar o stress vegetal."
        ],
    )
