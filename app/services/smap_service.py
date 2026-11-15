"""NASA SMAP — humidade do solo (superfície e zona das raízes).

Produto escolhido: SPL4SMGP — SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and
Root Zone Soil Moisture Geophysical Data (NSIDC DAAC).
  - sm_surface  : humidade à superfície (0-5 cm), m³/m³
  - sm_rootzone : humidade na zona das raízes (0-100 cm), m³/m³
  Porquê L4 e não L3 (SPL3SMP_E): L4 é um produto de assimilação (modelo + observações
  SMAP) que dá a zona das raízes, sem falhas de passagem do satélite, a cada 3 h.
  A zona das raízes NÃO é medida diretamente pelo SMAP; é estimada pelo sistema L4.

Acesso: exige login NASA Earthdata (gratuito). Pesquisa via CMR (earthaccess) e leitura
parcial do HDF5 por HTTP (apenas o pixel necessário, sem descarregar o ficheiro inteiro).

Grelha: EASE-Grid 2.0 Global (EPSG:6933), 3856 x 1624, pixel 9008.055 m. O índice do
pixel é calculado analiticamente e VALIDADO contra cell_lat/cell_lon do próprio ficheiro.
"""
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import settings
from app.services import earthdata_auth
from app.services.base import DataUnavailable, SourceError, num

EASE2_X0 = -17367530.445161
EASE2_Y0 = 7314540.830638
EASE2_CELL = 9008.055210146
EASE2_NCOL, EASE2_NROW = 3856, 1624
FILL = -9999.0

SURFACE_CANDIDATES = ["Geophysical_Data/sm_surface"]
ROOT_CANDIDATES = ["Geophysical_Data/sm_rootzone"]


def ease2_index(lat: float, lon: float) -> tuple[int, int]:
    """(linha, coluna) do pixel EASE-Grid 2.0 Global 9 km que contém (lat, lon)."""
    from pyproj import Transformer

    x, y = Transformer.from_crs("EPSG:4326", "EPSG:6933", always_xy=True).transform(lon, lat)
    col = int((x - EASE2_X0) // EASE2_CELL)
    row = int((EASE2_Y0 - y) // EASE2_CELL)
    if not (0 <= row < EASE2_NROW and 0 <= col < EASE2_NCOL):
        raise DataUnavailable("Coordenada fora da grelha SMAP L4 (latitudes acima de ±85°).")
    return row, col


def _first(h5, candidates: list[str]):
    for path in candidates:
        if path in h5:
            return h5[path]
    return None


def _read_cell(ds, row: int, col: int) -> float | None:
    value = ds[0, row, col] if ds.ndim == 3 else ds[row, col]
    f = num(value)
    return None if f is None or f <= FILL + 1 else f


def _validated_index(h5, lat: float, lon: float) -> tuple[int, int, float]:
    """Confirma o índice analítico com cell_lat/cell_lon; procura em 5x5 se necessário."""
    row, col = ease2_index(lat, lon)
    lat_ds, lon_ds = h5.get("cell_lat"), h5.get("cell_lon")
    if lat_ds is None or lon_ds is None:
        raise SourceError("Ficheiro SMAP sem cell_lat/cell_lon: formato inesperado.")

    def dist(r: int, c: int) -> float:
        return ((float(lat_ds[r, c]) - lat) ** 2 + (float(lon_ds[r, c]) - lon) ** 2) ** 0.5

    best = (dist(row, col), row, col)
    if best[0] > 0.1:  # célula ~0.08°; fora disto, procurar vizinhos
        for dr in range(-2, 3):
            for dc in range(-2, 3):
                r, c = row + dr, col + dc
                if 0 <= r < EASE2_NROW and 0 <= c < EASE2_NCOL:
                    best = min(best, (dist(r, c), r, c))
    if best[0] > 0.15:
        raise SourceError(f"Não foi possível localizar o pixel SMAP (distância {best[0]:.3f}°).")
    return best[1], best[2], best[0]


def _granule_time(granule) -> datetime:
    rng = granule["umm"]["TemporalExtent"]["RangeDateTime"]
    return datetime.fromisoformat(rng["BeginningDateTime"].replace("Z", "+00:00"))


def _granule_version(granule) -> str:
    return str(granule["umm"].get("CollectionReference", {}).get("Version", ""))


def select_daily_granules(granules: list, max_days: int) -> list:
    """Do conjunto devolvido, usa só a versão mais recente e 1 granulo por dia (o mais recente)."""
    if not granules:
        return []
    top_version = max(_granule_version(g) for g in granules)
    granules = [g for g in granules if _granule_version(g) == top_version]
    per_day: dict[str, Any] = {}
    for g in sorted(granules, key=_granule_time):
        per_day[_granule_time(g).date().isoformat()] = g  # o último de cada dia prevalece
    days = sorted(per_day)[-max_days:]
    return [per_day[d] for d in reversed(days)]  # mais recente primeiro


def _sample(granule, file_obj, lat: float, lon: float) -> dict[str, Any]:
    import h5py

    with h5py.File(file_obj, "r") as h5:
        row, col, dist = _validated_index(h5, lat, lon)
        surface = _first(h5, SURFACE_CANDIDATES)
        root = _first(h5, ROOT_CANDIDATES)
        if surface is None and root is None:
            raise SourceError("Ficheiro SMAP sem sm_surface/sm_rootzone: formato inesperado.")
        return {
            "observation_time_utc": _granule_time(granule).isoformat(),
            "surface_soil_moisture": _read_cell(surface, row, col) if surface is not None else None,
            "root_zone_soil_moisture": _read_cell(root, row, col) if root is not None else None,
            "grid_cell": {"row": row, "col": col, "center_offset_deg": round(dist, 4)},
            "granule": granule["meta"].get("concept-id"),
        }


def fetch(lat: float, lon: float) -> dict[str, Any]:
    earthdata_auth.get_auth()  # lança CredentialsRequired se faltar login
    import earthaccess

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=settings.SMAP_LOOKBACK_DAYS)
    try:
        granules = earthaccess.search_data(
            short_name=settings.SMAP_SHORT_NAME,
            temporal=(start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")),
            bounding_box=(lon - 0.1, lat - 0.1, lon + 0.1, lat + 0.1),
            count=settings.SMAP_LOOKBACK_DAYS * 8 + 8,
        )
    except Exception as exc:  # noqa: BLE001
        raise SourceError(f"Erro na pesquisa CMR do SMAP: {exc}") from exc

    chosen = select_daily_granules(list(granules), settings.SMAP_HISTORY_DAYS)
    if not chosen:
        raise DataUnavailable(
            f"Nenhum granulo {settings.SMAP_SHORT_NAME} nos últimos {settings.SMAP_LOOKBACK_DAYS} dias."
        )

    try:
        files = earthaccess.open(chosen)
    except Exception as exc:  # noqa: BLE001
        raise SourceError(f"Não foi possível abrir os ficheiros SMAP: {exc}") from exc

    series, errors = [], []
    for granule, file_obj in zip(chosen, files):
        try:
            series.append(_sample(granule, file_obj, lat, lon))
        except SourceError as exc:
            errors.append(str(exc))
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{type(exc).__name__}: {exc}")

    valid = [s for s in series if s["surface_soil_moisture"] is not None or s["root_zone_soil_moisture"] is not None]
    if not valid:
        detail = f" Erros: {errors[:2]}" if errors else ""
        raise DataUnavailable("Sem valores SMAP válidos para este pixel (pode ser água, gelo ou fora de cobertura)." + detail)

    valid.sort(key=lambda s: s["observation_time_utc"])
    latest = valid[-1]
    return {
        "product": f"{settings.SMAP_SHORT_NAME} v{_granule_version(chosen[0])}",
        "units": "m3/m3",
        "temporal_resolution": "3-hourly (uma amostra por dia, a mais recente de cada dia)",
        "spatial_resolution": "9 km (EASE-Grid 2.0 Global)",
        "surface_depth": "0-5 cm",
        "root_zone_depth": "0-100 cm (estimada pelo sistema de assimilação L4)",
        "request_point": {"latitude": lat, "longitude": lon},
        "latest": latest,
        "series": valid,
        "notes": ["Valores de pixel de 9 km; não substituem medições em campo.", *errors[:3]],
    }
