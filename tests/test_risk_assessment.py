from app.services.risk_assessment_service import (
    assess_drought,
    assess_excess_precipitation,
    assess_vegetation,
)

def test_drought_with_insufficient_data():
    data = {
        "nasa_power": {
            "status": "error",
            "data": None,
        },
        "smap": {
            "status": "no_data",
            "data": None,
        },
    }

    result = assess_drought(data)

    assert result["status"] == "insufficient_data"
    assert result["attention_level"] is None
    assert result["evidence"] == []

def test_drought_requires_soil_moisture_data():
    data = {
        "nasa_power": {
            "status": "ok",
            "data": {
                "precipitation_analysis": {
                    "anomaly": {
                        "anomaly_percent": -40.0,
                        "reference_month": "2026-10",
                    }
                },
                "variables": {
                    "T2M": {
                        "summary": {"mean": 30.0}
                    }
                },
                "period": {"end": "2026-10-31"},
            },
        },
        "smap": {
            "status": "no_data",
            "data": None,
        },
    }

    result = assess_drought(data)

    assert result["status"] == "insufficient_data"
    assert result["attention_level"] is None

def test_drought_with_sufficient_data():
    data = {
        "nasa_power": {
            "status": "ok",
            "data": {
                "precipitation_analysis": {
                    "anomaly": {
                        "anomaly_percent": -40.0,
                        "reference_month": "2026-10",
                    }
                },
                "variables": {
                    "T2M": {
                        "summary": {"mean": 30.0}
                    }
                },
                "period": {"end": "2026-10-31"},
            },
        },
        "smap": {
            "status": "ok",
            "data": {
                "latest": {
                    "root_zone_soil_moisture": 0.15,
                    "observation_time_utc": "2026-11-10",
                }
            },
        },
    }

    result = assess_drought(data)

    assert result["status"] == "assessed"
    assert result["attention_level"] is None
    assert len(result["evidence"]) == 3

from app.services.risk_assessment_service import (
    assess_drought,
    assess_excess_precipitation,
)


def test_excess_precipitation_with_sufficient_data():
    data = {
        "gpm": {
            "status": "ok",
            "data": {
                "summary": {
                    "total_last_7_days_mm": 85.0,
                    "total_last_30_days_mm": 210.0,
                    "max_daily_mm": 35.0,
                    "heavy_rain_days": 3,
                }
            },
        },
        "nasa_power": {
            "status": "ok",
            "data": {
                "precipitation_analysis": {
                    "anomaly": {
                        "anomaly_percent": 45.0,
                        "reference_month": "2026-10",
                    }
                }
            },
        },
    }

    result = assess_excess_precipitation(data)

    assert result["status"] == "assessed"
    assert len(result["evidence"]) == 5

def test_vegetation_with_sufficient_data():
    data = {
        "vegetation": {
            "status": "ok",
            "data": {
                "latest": {
                    "ndvi": 0.65,
                    "date": "2026-11-10",
                },
                "change_indicator": {
                    "difference": -0.12,
                },
            },
        },
    }

    result = assess_vegetation(data)

    assert result["status"] == "assessed"
    assert len(result["evidence"]) == 2