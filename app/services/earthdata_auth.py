"""Autenticação NASA Earthdata (partilhada por SMAP e GPM).

Credenciais vêm apenas de variáveis de ambiente / ficheiro .env:
  EARTHDATA_TOKEN   ou   EARTHDATA_USERNAME + EARTHDATA_PASSWORD
"""
import os
import threading

from app.core.config import settings
from app.services.base import CredentialsRequired

_lock = threading.Lock()
_auth = None


def get_auth():
    """Devolve o objeto de sessão `earthaccess` autenticado (login feito uma vez)."""
    global _auth
    with _lock:
        if _auth is not None:
            return _auth

        # earthaccess lê os valores de os.environ; o .env só é lido pelo pydantic.
        for name in ("EARTHDATA_TOKEN", "EARTHDATA_USERNAME", "EARTHDATA_PASSWORD"):
            value = getattr(settings, name)
            if value:
                os.environ[name] = value

        has_token = bool(os.environ.get("EARTHDATA_TOKEN"))
        has_pair = bool(os.environ.get("EARTHDATA_USERNAME") and os.environ.get("EARTHDATA_PASSWORD"))
        if not (has_token or has_pair):
            raise CredentialsRequired(
                "Credenciais NASA Earthdata em falta. Defina EARTHDATA_TOKEN "
                "(ou EARTHDATA_USERNAME e EARTHDATA_PASSWORD). Ver README."
            )

        import earthaccess  # import tardio: só é necessário para SMAP/GPM

        auth = earthaccess.login(strategy="environment", persist=False)
        if not getattr(auth, "authenticated", False):
            raise CredentialsRequired(
                "Login Earthdata falhou. Verifique as credenciais e se aprovou as "
                "aplicações 'NASA GESDISC DATA ARCHIVE' e 'NSIDC DATAPOOL' em "
                "https://urs.earthdata.nasa.gov (Applications > Authorized Apps)."
            )
        _auth = auth
        return _auth


def reset_auth() -> None:
    global _auth
    with _lock:
        _auth = None
