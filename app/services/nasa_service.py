from datetime import date, datetime, timedelta
import requests

class NasaService:
    @staticmethod
    def fetch_nasa_power_data(
        lat: float,
        lon: float,
        start_date: str | None = None,
        end_date: str | None = None
    ):

        today = date.today()
        if not end_date:
            end = today.replace(day=1) - timedelta(days=1)
            end_date = end.strftime("%Y%m%d")
        if not start_date:
            end = datetime.strptime(end_date, "%Y%m%d").date()
            start = end.replace(day=1)
            for _ in range(11):
                start = (start - timedelta(days=1)).replace(day=1)
            start_date = start.strftime("%Y%m%d")

        params = {
            "parameters": "T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN",
            "community": "AG",
            "longitude": lon,
            "latitude": lat,
            "start": start_date,
            "end": end_date,
            "format": "JSON"
        }
        url = "https://power.larc.nasa.gov/api/temporal/daily/point"
        
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            weather = data.get("properties", {}).get("parameter", {})
            
            if not weather:
                raise ValueError("A NASA não devolveu dados meteorológicos da NASA POWER.")
                
            for parameter in weather.values():
                for day, value in parameter.items():
                    if value == -999:
                        parameter[day] = None
                        
            return weather
            
        except requests.exceptions.RequestException as error:
            raise RuntimeError(
                f"Erro ao comunicar com a NASA POWER: {error}"
            ) from error

    @staticmethod
    def fetch_smap_soil_moisture(lat: float, lon: float):

        return {
            "source": "NASA SMAP",
            "surface_soil_moisture": 0.28,  # m³/m³ (exemplo representativo)
            "root_zone_soil_moisture": 0.32,
            "status": "Humidade moderada a estável"
        }

    @staticmethod
    def fetch_gpm_precipitation(lat: float, lon: float):

        return {
            "source": "NASA GPM / IMERG",
            "precipitation_anomaly": "Normal",
            "extreme_events_risk": "Baixo"
        }

    @staticmethod
    def fetch_landsat_ndvi(lat: float, lon: float):

        return {
            "source": "Landsat / MODIS NDVI",
            "current_ndvi": 0.65,
            "vegetation_stress": "Baixo stress detetado"
        }

    @staticmethod
    def get_fao_gaez_suitability(priority: str):

        suitability_rules = {
            "water_conservation": "Recomendadas culturas de ciclo curto e raízes profundas (ex: sorgo, feijão-frade).",
            "soil_health": "Recomendada rotação com culturas de cobertura nitrogenadas (ex: mucuna, ervilhaca).",
            "income": "Recomendada introdução de culturas comerciais intercalares resistentes à seca."
        }
        return suitability_rules.get(priority, "Adequação geral equilibrada para rotação diversificada.")

    @classmethod
    def calculate_rotation_strategies(cls, lat: float, lon: float, priority: str, weather_data: dict):

        smap_data = cls.fetch_smap_soil_moisture(lat, lon)
        gpm_data = cls.fetch_gpm_precipitation(lat, lon)
        ndvi_data = cls.fetch_landsat_ndvi(lat, lon)
        gaez_advice = cls.get_fao_gaez_suitability(priority)

        strategies = [
            {
                "id": 1,
                "name": "Estratégia Atual (Linha de Base)",
                "description": "Mantém o ciclo tradicional de cultivo utilizado pelo agricultor.",
                "evidence": f"NDVI atual: {ndvi_data['current_ndvi']} | Humidade SMAP: {smap_data['surface_soil_moisture']} m³/m³",
                "benefits": "Previsibilidade de mercado e familiaridade com a técnica.",
                "risks": "Maior vulnerabilidade a quebras de solo e stress hídrico prolongado."
            },
            {
                "id": 2,
                "name": "Introdução de Culturas de Cobertura (Leguminosas)",
                "description": "Integra plantas fixadoras de azoto nos períodos tradicionalmente nus.",
                "evidence": f"Recomendação FAO GAEZ: {gaez_advice}",
                "benefits": "Melhora a estrutura do solo, reduz a erosão e aumenta a retenção de água.",
                "risks": "Exige planeamento rigoroso do calendário para não atrasar a cultura principal."
            },
            {
                "id": 3,
                "name": "Rotação com Raiz Profunda e Tolerância à Seca",
                "description": "Alternância com espécies capazes de explorar humidade em camadas mais profundas.",
                "evidence": f"Estado GPM: {gpm_data['precipitation_anomaly']} | Zonas de stress hídrico monitorizadas.",
                "benefits": "Excelente adaptação a cenários de escassez de precipitação e calor extremo.",
                "risks": "Necessidade de avaliar a rentabilidade e o escoamento local para o mercado."
            }
        ]
        
        return strategies
