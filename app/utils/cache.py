"""Cache simples em disco (JSON) com TTL, para evitar chamadas repetidas às APIs.

Só resultados com sucesso são guardados; erros nunca ficam em cache.
"""
import hashlib
import json
import time
from pathlib import Path
from typing import Any, Callable

from app.core.config import settings


def _path(key: str) -> Path:
    digest = hashlib.sha256(key.encode()).hexdigest()[:32]
    return Path(settings.CACHE_DIR) / f"{digest}.json"


def get(key: str, ttl_seconds: int) -> Any | None:
    if not settings.CACHE_ENABLED:
        return None
    path = _path(key)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if time.time() - payload.get("stored_at", 0) > ttl_seconds:
        return None
    return payload.get("value")


def put(key: str, value: Any) -> None:
    if not settings.CACHE_ENABLED:
        return
    try:
        path = _path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps({"stored_at": time.time(), "value": value}), encoding="utf-8")
        tmp.replace(path)
    except (OSError, TypeError, ValueError):
        pass  # cache é opcional: nunca deve quebrar o pedido


def cached(key: str, ttl_seconds: int, producer: Callable[[], Any]) -> tuple[Any, bool]:
    """Devolve (valor, veio_da_cache)."""
    hit = get(key, ttl_seconds)
    if hit is not None:
        return hit, True
    value = producer()
    put(key, value)
    return value, False
