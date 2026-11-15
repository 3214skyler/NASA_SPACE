# Field Shift — Backend (FastAPI)

Recebe latitude/longitude e devolve dados ambientais **reais** de 5 fontes. Nenhum valor é fixo ou simulado: quando uma fonte falha, o bloco dela diz porquê (`status` ≠ `ok`) e as restantes continuam a funcionar.

> **Estado de validação (ler primeiro).** O código foi escrito a partir da documentação oficial e a lógica tem 17 testes unitários (dados sintéticos). **As consultas reais às fontes ainda não foram executadas**: o ambiente onde foi desenvolvido não tinha acesso de rede às fontes. Antes de confiar nos dados, corra `python scripts/check_sources.py` (secção "Como testar").

## Arquitetura

```
app/
├── api/endpoints.py            # rotas
├── core/config.py              # configuração por variáveis de ambiente / .env
├── schemas/farm.py             # modelos Pydantic (bloco uniforme por fonte)
├── services/
│   ├── base.py                 # exceções, run_source() (bloco uniforme, nunca lança)
│   ├── earthdata_auth.py       # login Earthdata (SMAP, GPM)
│   ├── nasa_power_service.py
│   ├── smap_service.py
│   ├── gpm_service.py
│   ├── vegetation_service.py   # Landsat 8/9 -> NDVI
│   ├── gaez_service.py
│   └── environmental_service.py# corre as 5 fontes em paralelo + cache
├── utils/cache.py              # cache JSON em disco com TTL (só guarda sucessos)
└── data/gaez_catalog.json      # camadas GAEZ (vazio até ser preenchido)
scripts/check_sources.py        # validação real, fonte a fonte
scripts/discover_gaez.py        # descobre camadas do GAEZ
tests/test_units.py
```

## Fontes e produtos escolhidos

| Fonte | Produto | Resolução | Acesso | Dá |
|---|---|---|---|---|
| NASA POWER | daily/monthly point, comunidade AG | ~0.5° x 0.625° | público | T2M, T2M_MAX/MIN, PRECTOTCORR, radiação, RH2M, GWETTOP/ROOT/PROF (solo **modelado** MERRA-2), EVLAND; anomalia de precipitação vs. normal 1991-2020 |
| NASA SMAP | **SPL4SMGP** (L4, 3 h, 9 km) | 9 km | Earthdata (grátis) | humidade superficial (0-5 cm) e zona das raízes (0-100 cm), m³/m³ |
| NASA GPM | **GPM_3IMERGDL** V07 (Late, diário) | 0.1° | Earthdata (grátis) | precipitação diária (mm), acumulados 7/30 dias, dias de chuva intensa |
| Vegetação | **Landsat 8/9 C2 L2** via Planetary Computer | 30 m | público (token anónimo) | NDVI das últimas observações limpas |
| FAO GAEZ v4 | ImageServer `identify` | ~9 km | público | adequação por cultura (**depende do catálogo**) |

Decisões e limitações de cada escolha:

- **SMAP L4 e não L3**: L4 dá a zona das raízes (estimada por assimilação, não medida) e não tem falhas de passagem. O pixel é localizado analiticamente na grelha EASE-Grid 2.0 e **validado** contra `cell_lat/cell_lon` do ficheiro.
- **IMERG Late e não Final**: Late tem ~14 h de atraso; Final é mais preciso mas chega ~3,5 meses depois (`GPM_SHORT_NAME=GPM_3IMERGDF` para mudar).
- **Anomalia de precipitação** calculada só com POWER (mês completo mais recente vs. média e desvio-padrão 1991-2020 do mesmo mês, mesma variável). Com IMERG não é fiável sem uma normal longa, por isso `gpm.anomaly` é `null`.
- **NDVI**: janela 3x3 de pixéis, reflectância `DN*0.0000275-0.2`, máscara `QA_PIXEL` (nuvem, sombra, cirrus, neve, água), média dos pixéis limpos (mín. 3). Só devolve **variação relativa** do último NDVI face à mediana das anteriores; `stress_indicator` é `null` porque um índice de stress calibrado exigiria climatologia NDVI multianual. VIIRS/MODIS (Earthdata, 375 m–1 km) ficam como alternativa, não implementada.
- **GAEZ**: o acesso oficial programático são os ImageServer da FAO (`identify`). Os nomes das variáveis têm de ser lidos do serviço, e isso não foi possível aqui; por isso não foram adivinhados. Enquanto `gaez_catalog.json` estiver vazio, `gaez.status = "not_configured"`. **Sem catálogo não há adequação de culturas.**
- O antigo `calculate_rotation_strategies` (texto fixo) foi removido. `POST /api/analyze` mantém o formato anterior, mas `recommended_strategies` vem vazio até o motor C++ ser integrado (`recommendation_engine.status = "pending"`).

## Instalação

```bash
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                    # e preencher credenciais
```

`rasterio`, `h5py` e `pyproj` trazem wheels para Python 3.13 em Windows/Linux/macOS.

## Credenciais (SMAP e GPM)

1. Criar conta gratuita em https://urs.earthdata.nasa.gov.
2. Em *Applications > Authorized Apps*, aprovar **NASA GESDISC DATA ARCHIVE** e **NSIDC DATAPOOL** (sem isto o login funciona mas os downloads dão 401/403).
3. *Generate Token* e pôr no `.env`: `EARTHDATA_TOKEN=...` (ou `EARTHDATA_USERNAME` + `EARTHDATA_PASSWORD`). O token expira (~60 dias): renovar quando aparecer `credentials_required`.

POWER, Landsat (Planetary Computer) e GAEZ não precisam de credenciais. Nada depende de serviços pagos.

## Iniciar

```bash
uvicorn app.main:app --reload       # docs em http://127.0.0.1:8000/docs
```

## Endpoints

- `GET /api/environmental-data?latitude=-8.8383&longitude=13.2344` — todas as fontes
- `GET /api/environmental-data/{nasa_power|smap|gpm|vegetation|gaez}?latitude=..&longitude=..` — uma fonte
- `POST /api/analyze` — contrato anterior (`latitude`, `longitude`, `priority`) + dados ambientais
- `GET /api/sources/status` — credenciais/catálogo configurados (sem expor segredos)

`status` global: `success` (todas ok), `partial` (algumas), `unavailable` (nenhuma). Cada fonte: `ok | no_data | credentials_required | not_configured | error`. Cache em `.cache/` (POWER 6 h, SMAP 3 h, GPM 6 h, Landsat 24 h, GAEZ 30 d); erros nunca ficam em cache.

## Como testar

```bash
pytest                                         # lógica, com dados sintéticos
python scripts/check_sources.py                # fontes REAIS, Luanda (-8.8383, 13.2344), sem cache
python scripts/check_sources.py -12.35 13.54   # outro ponto
```

`check_sources.py` imprime por fonte: produto, unidades, datas, valores recebidos e o motivo quando falha. Verifique que `request_point`, a data mais recente e (SMAP) `center_offset_deg` < ~0.1 correspondem ao local pedido.

### Preencher o catálogo GAEZ

```bash
python scripts/discover_gaez.py > gaez_discovery.json
```

Escolha as camadas de adequação (`suitability`) das culturas da região-piloto e acrescente-as a `app/data/gaez_catalog.json` (formato no docstring de `gaez_service.py`). Depois valide com `check_sources.py`.

## Exemplo de resposta (estrutura; valores omitidos de propósito)

```json
{
  "status": "partial",
  "location": {"latitude": -8.8383, "longitude": 13.2344},
  "sources_summary": {"nasa_power": "ok", "smap": "credentials_required", "gpm": "credentials_required", "vegetation": "ok", "gaez": "not_configured"},
  "environmental_data": {
    "nasa_power": {"status": "ok", "source": "NASA POWER", "product": "...", "message": null,
                   "retrieved_at": "...", "from_cache": false,
                   "data": {"period": {"start": "...", "end": "...", "days": 365}, "dates": ["..."],
                            "variables": {"T2M": {"units": "...", "values": ["..."], "summary": {}}},
                            "precipitation_analysis": {"monthly": {}, "anomaly": {}}}},
    "smap": {"status": "credentials_required", "message": "Credenciais NASA Earthdata em falta...", "data": null},
    "gpm": {"status": "credentials_required", "data": null},
    "vegetation": {"status": "ok", "data": {"latest": {"date": "...", "ndvi": 0.0, "scene_id": "..."}, "observations": [], "change_indicator": {}}},
    "gaez": {"status": "not_configured", "data": null}
  }
}
```

## Limitações conhecidas

- Fontes ainda não validadas com consultas reais (ver topo). Pontos de maior risco: nomes de variáveis/estrutura dos ficheiros SMAP L4 e IMERG V07 (o código tenta alternativas e falha com mensagem clara), parâmetros opcionais do POWER (falha apenas gera aviso).
- Todos os valores são de **grelha** (9–50 km), exceto Landsat (30 m); não substituem medições no terreno nem o conhecimento do agricultor.
- Landsat revisita a cada ~8 dias e em Luanda/trópicos húmidos as nuvens podem deixar poucas observações limpas (`no_data`).
- SMAP/GPM: cada pedido abre vários ficheiros remotos (7 e 30); a primeira consulta é lenta, depois a cache ajuda.
- Sem GAEZ configurado não há adequação de culturas; sem o motor C++ não há estratégias.
