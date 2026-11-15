"""Tipos e utilitários partilhados por todos os serviços de dados."""
from datetime import datetime, timezone
from typing import Any, Callable

from app.utils import cache


class SourceError(Exception):
    """Falha ao consultar uma fonte (rede, formato inesperado, etc.)."""


class DataUnavailable(SourceError):
    """A fonte respondeu, mas não há dados para este local/período."""


class CredentialsRequired(SourceError):
    """A fonte exige credenciais Earthdata que não estão configuradas/válidas."""


class NotConfigured(SourceError):
    """A integração existe, mas falta configuração local (ex.: catálogo GAEZ)."""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def run_source(
    *,
    source: str,
    product: str,
    cache_key: str,
    ttl_seconds: int,
    producer: Callable[[], dict[str, Any]],
) -> dict[str, Any]:
    """Executa um serviço e devolve sempre um bloco com estrutura uniforme.

    status: ok | no_data | credentials_required | not_configured | error
    Nunca lança excepção: falhas ficam descritas no bloco, sem inventar dados.
    """
    block: dict[str, Any] = {
        "status": "error",
        "source": source,
        "product": product,
        "message": None,
        "retrieved_at": _now(),
        "from_cache": False,
        "data": None,
    }
    try:
        data, hit = cache.cached(cache_key, ttl_seconds, producer)
        block.update(status="ok", data=data, from_cache=hit)
    except DataUnavailable as exc:
        block.update(status="no_data", message=str(exc))
    except CredentialsRequired as exc:
        block.update(status="credentials_required", message=str(exc))
    except NotConfigured as exc:
        block.update(status="not_configured", message=str(exc))
    except Exception as exc:  # noqa: BLE001 - isolamos falhas por fonte
        block.update(status="error", message=f"{type(exc).__name__}: {exc}")
    return block


def num(value: Any) -> float | None:
    """Converte para float; NaN/inf/None -> None."""
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if f != f or f in (float("inf"), float("-inf")):
        return None
    return f
