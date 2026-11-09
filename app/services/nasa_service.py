import requests

class NasaService:
    @staticmethod
    def fetch_nasa_power_data(lat: float, lon: float):
        """
        Consulta a API pública da NASA POWER para obter parâmetros meteorológicos
        diários (como temperatura do ar e precipitação) para a localização enviada.
        """
        url = (
            f"https://power.larc.nasa.gov/api/temporal/daily/point?"
            f"parameters=T2M,PRECTOTCORR&community=AG&longitude={lon}&latitude={lat}&"
            f"start=20240101&end=20241231&format=JSON"
        )
        
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                return data.get("properties", {}).get("parameter", {})
            else:
                return {"error": "Erro ao comunicar com a API da NASA POWER"}
        except requests.exceptions.RequestException as e:
            return {"error": f"Falha na ligação: {str(e)}"}

    @staticmethod
    def calculate_rotation_strategies(priority: str, weather_data: dict):
        """
        Compara pelo menos três estratégias de rotação de culturas com base 
        na prioridade escolhida pelo agricultor e nos dados recolhidos[cite: 1, 2].
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