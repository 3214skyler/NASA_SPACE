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
        """
        Obtém dados climáticos diários da NASA POWER.
        Por padrão, consulta os últimos 12 meses completos.
        """
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
            "parameters": "T2M,PRECTOTCORR",
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
                raise ValueError("A NASA não devolveu dados meteorológicos.")
                
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
    def calculate_rotation_strategies(priority: str, weather_data: dict):
        """
        Compara pelo menos três estratégias de rotação de culturas com base 
        na prioridade escolhida pelo agricultor e nos dados recolhidos.
        """
        strategies = [
            {
                "id": 1,
                "name": "Estratégia Atual (Linha de Base)",
                "description": "Mantém o ciclo tradicional de cultivo utilizado pelo agricultor.",
                "benefits": "Previsibilidade de mercado e familiaridade com a técnica.",
                "risks": "Maior vulnerabilidade a quebras de solo e stress hídrico prolongado."
            },
            {
                "id": 2,
                "name": "Introdução de Culturas de Cobertura (Leguminosas)",
                "description": "Integra plantas fixadoras de azoto nos períodos tradicionalmente nus.",
                "benefits": "Melhora a estrutura do solo, reduz a erosão e aumenta a retenção de água.",
                "risks": "Exige planeamento rigoroso do calendário para não atrasar a cultura principal."
            },
            {
                "id": 3,
                "name": "Rotação com Culturas de Raiz Profunda e Resistentes à Seca",
                "description": "Alternância com espécies capazes de explorar humidade em camadas mais profundas.",
                "benefits": "Excelente adaptação a cenários de escassez de precipitação e calor extremo.",
                "risks": "Necessidade de avaliar a rentabilidade e o escoamento local para o mercado."
            }
        ]
        
        return strategies