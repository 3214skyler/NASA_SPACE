from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Field Shift API"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"

    # --- Credenciais NASA Earthdata (SMAP e GPM). Nunca colocar no código. ---
    # Opção A (recomendada): token gerado em https://urs.earthdata.nasa.gov (Generate Token)
    EARTHDATA_TOKEN: str | None = None
    # Opção B: utilizador e palavra-passe Earthdata
    EARTHDATA_USERNAME: str | None = None
    EARTHDATA_PASSWORD: str | None = None

    # --- Rede e cache ---
    HTTP_TIMEOUT: int = 30
    CACHE_DIR: str = ".cache"
    CACHE_ENABLED: bool = True

    # --- NASA POWER ---
    POWER_HISTORY_DAYS: int = 365          # janela diária devolvida
    POWER_LATENCY_DAYS: int = 7            # o POWER tem atraso de alguns dias
    POWER_CLIM_START_YEAR: int = 1991      # normal climatológica WMO 1991-2020
    POWER_CLIM_END_YEAR: int = 2020

    # --- SMAP ---
    SMAP_SHORT_NAME: str = "SPL4SMGP"      # SMAP L4 Global 3-hourly 9 km
    SMAP_LOOKBACK_DAYS: int = 10           # janela de pesquisa de granulos
    SMAP_HISTORY_DAYS: int = 7             # nº de dias com uma amostra por dia

    # --- GPM / IMERG ---
    GPM_SHORT_NAME: str = "GPM_3IMERGDL"   # IMERG Late diário (latência ~14 h)
    GPM_VERSION: str = "07"
    GPM_DAYS: int = 30
    GPM_HEAVY_RAIN_MM: float = 20.0        # limiar R20mm (dia de chuva intensa)

    # --- Vegetação (Landsat 8/9 via Microsoft Planetary Computer) ---
    STAC_URL: str = "https://planetarycomputer.microsoft.com/api/stac/v1"
    SAS_URL: str = "https://planetarycomputer.microsoft.com/api/sas/v1/token"
    VEG_LOOKBACK_DAYS: int = 120
    VEG_MAX_CLOUD_COVER: float = 70.0
    VEG_MAX_SCENES: int = 10

    # --- FAO GAEZ ---
    GAEZ_CATALOG_PATH: str = "app/data/gaez_catalog.json"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")


settings = Settings()
