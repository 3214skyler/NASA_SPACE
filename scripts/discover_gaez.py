"""Descobre, confirma e (opcionalmente) escreve o catálogo GAEZ. Requer acesso a gaez-services.fao.org.

Passos por ImageServer (nada é assumido: tudo vem das respostas REST):
  1. Metadados: GET <svc>/ImageServer?f=json  (campos, tipo de pixel, multidimensional, operações)
  2. Se multidimensional: GET <svc>/ImageServer/multidimensionalInfo
  3. identify no ponto de teste com returnCatalogItems=true -> lista as camadas (rasters) do mosaico,
     os seus atributos reais (cultura, unidades, etc.) e o valor de cada uma nesse ponto.
  4. Os campos "cultura/unidade/tema" são detetados por nome parcial nos campos REAIS do serviço
     (podem ser forçados com --crop-field/--unit-field/--theme-field). Confirme na saída.
  5. Cada candidata selecionada é CONFIRMADA com um identify individual (mosaicRule lockRaster).
     Só entradas com valor numérico confirmado são escritas.

Exemplos:
  python scripts/discover_gaez.py                         # só relatório -> gaez_discovery.json
  python scripts/discover_gaez.py --service res05 --crop maize --crop cassava --write-catalog
  python scripts/discover_gaez.py --service res05 --where "<SQL sobre os campos reais>" --write-catalog

Sem --crop/--where NÃO escreve catálogo (um mosaico pode ter milhares de rasters).
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.gaez_service import apply_scale, parse_identify_value, validate_catalog  # noqa: E402

ROOT = "https://gaez-services.fao.org/server/rest/services"
CATALOG = "app/data/gaez_catalog.json"
SKIP_LABEL_FIELDS = ("url", "shape", "objectid", "geometry")


def get(url: str, **params):
    r = requests.get(url, params={"f": "json", **params}, timeout=90)
    r.raise_for_status()
    body = r.json()
    if "error" in body:
        raise RuntimeError(body["error"])
    return body


def point_params(lat: float, lon: float, **extra) -> dict:
    p = {"geometry": json.dumps({"x": lon, "y": lat, "spatialReference": {"wkid": 4326}}),
         "geometryType": "esriGeometryPoint", "returnGeometry": "false"}
    p.update({k: v if isinstance(v, str) else json.dumps(v) for k, v in extra.items()})
    return p


def detect_field(fields: list[dict], part: str, forced: str | None) -> str | None:
    if forced:
        return forced
    for f in fields:
        if part in f.get("name", "").lower() or part in str(f.get("alias", "")).lower():
            return f["name"]
    return None


def list_services() -> list[str]:
    listing = get(ROOT)
    names = [s["name"] for s in listing.get("services", []) if s.get("type") == "ImageServer"]
    for folder in listing.get("folders", []):
        names += [s["name"] for s in get(f"{ROOT}/{folder}").get("services", []) if s.get("type") == "ImageServer"]
    return names


def catalog_items(url: str, lat: float, lon: float, where: str | None):
    extra = {"returnCatalogItems": "true"}
    if where:
        extra["mosaicRule"] = {"mosaicMethod": "esriMosaicNone", "where": where}
    body = get(f"{url}/identify", **point_params(lat, lon, **extra))
    cat = body.get("catalogItems") or {}
    feats = cat.get("features") or []
    ids = cat.get("objectIds") or []
    values = (body.get("properties") or {}).get("Values")
    out = []
    for i, feat in enumerate(feats):
        attrs = feat.get("attributes", {})
        oid = ids[i] if i < len(ids) else next((v for k, v in attrs.items() if k.lower() == "objectid"), None)
        value = values[i] if isinstance(values, list) and len(values) == len(feats) else None
        out.append({"object_id": oid, "attributes": attrs, "value_at_point": value})
    return body, out


def confirm(url: str, oid: int, lat: float, lon: float):
    rule = {"mosaicMethod": "esriMosaicLockRaster", "lockRasterIds": [oid]}
    body = get(f"{url}/identify", **point_params(lat, lon, mosaicRule=rule, returnCatalogItems="false"))
    return rule, parse_identify_value(body)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--point", nargs=2, type=float, default=[-8.8383, 13.2344], metavar=("LAT", "LON"))
    ap.add_argument("--service", action="append", help="ex.: res05 (repetível). Omitido = todos")
    ap.add_argument("--where", help="filtro SQL do mosaico (campos reais do serviço)")
    ap.add_argument("--crop", action="append", help="filtra pelo valor do campo de cultura (contém, sem maiúsculas)")
    ap.add_argument("--crop-field"); ap.add_argument("--unit-field"); ap.add_argument("--theme-field")
    ap.add_argument("--max", type=int, default=200, help="máx. de entradas a confirmar por serviço")
    ap.add_argument("--write-catalog", action="store_true")
    ap.add_argument("--out", default="gaez_discovery.json")
    args = ap.parse_args()
    lat, lon = args.point

    names = args.service or list_services()
    report, confirmed = [], []
    for name in names:
        url = f"{ROOT}/{name}/ImageServer"
        entry = {"service": name, "url": url}
        try:
            info = get(url)
            fields = info.get("fields") or []
            entry.update(description=info.get("description"), pixel_type=info.get("pixelType"),
                         band_count=info.get("bandCount"), pixel_size=(info.get("pixelSizeX"), info.get("pixelSizeY")),
                         has_multidimensions=info.get("hasMultidimensions"),
                         capabilities=info.get("capabilities"), fields=[(f["name"], f.get("alias"), f.get("type")) for f in fields],
                         raster_functions=[r.get("name") for r in info.get("rasterFunctionInfos", [])])
            if info.get("hasMultidimensions"):
                entry["multidimensional_info"] = get(f"{url}/multidimensionalInfo")
            crop_f = detect_field(fields, "crop", args.crop_field)
            unit_f = detect_field(fields, "unit", args.unit_field)
            theme_f = detect_field(fields, "theme", args.theme_field)
            entry["detected_fields"] = {"crop": crop_f, "unit": unit_f, "theme": theme_f}
            body, items = catalog_items(url, lat, lon, args.where)
            entry["identify_supported"] = bool(items) or "value" in body
            entry["catalog_items_returned"] = len(items)
            entry["sample_attributes"] = [i["attributes"] for i in items[:3]]
            entry["distinct_crops"] = sorted({str(i["attributes"].get(crop_f)) for i in items}) if crop_f else None

            if args.write_catalog and (args.crop or args.where):
                selected = items
                if args.crop:
                    wanted = [c.lower() for c in args.crop]
                    selected = [i for i in items if crop_f and any(w in str(i["attributes"].get(crop_f, "")).lower() for w in wanted)]
                for it in selected[: args.max]:
                    if it["object_id"] is None:
                        continue
                    try:
                        rule, raw = confirm(url, it["object_id"], lat, lon)
                    except Exception as exc:  # noqa: BLE001
                        entry.setdefault("confirm_errors", []).append(f"{it['object_id']}: {exc}")
                        continue
                    if raw is None:
                        continue
                    a = it["attributes"]
                    label = " | ".join(f"{k}={v}" for k, v in a.items()
                                       if v not in (None, "") and not any(s in k.lower() for s in SKIP_LABEL_FIELDS))
                    confirmed.append({
                        "id": f"{name}_{it['object_id']}", "label": label,
                        "crop": a.get(crop_f) if crop_f else None, "theme": a.get(theme_f) if theme_f else None,
                        "service_url": url, "unit": a.get(unit_f) if unit_f else None,
                        "identify_params": {"mosaicRule": rule}, "attributes": a,
                        "confirmation": {"test_point": {"latitude": lat, "longitude": lon}, "raw_value": raw,
                                         "confirmed_at": datetime.now(timezone.utc).isoformat(timespec="seconds")},
                    })
        except Exception as exc:  # noqa: BLE001
            entry["error"] = f"{type(exc).__name__}: {exc}"
        report.append(entry)

    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
    print(f"Relatório: {args.out}")
    for e in report:
        print(f"- {e['service']}: identify={e.get('identify_supported')} itens={e.get('catalog_items_returned')} "
              f"campos detetados={e.get('detected_fields')} {e.get('error', '')}")

    if args.write_catalog:
        if not (args.crop or args.where):
            print("Catálogo NÃO escrito: indique --crop ou --where.")
            return 1
        problems = validate_catalog(confirmed)
        # entradas sem crop/unit/theme detetados ficam de fora (campos obrigatórios)
        valid = [c for c in confirmed if not [p for p in validate_catalog([c])]]
        skipped = len(confirmed) - len(valid)
        existing = []
        if os.path.exists(CATALOG):
            existing = json.load(open(CATALOG, encoding="utf-8")).get("layers", [])
        merged = {l["id"]: l for l in existing}
        merged.update({c["id"]: c for c in valid})
        with open(CATALOG, "w", encoding="utf-8") as fh:
            json.dump({"layers": list(merged.values())}, fh, indent=2, ensure_ascii=False)
        print(f"Catálogo: {len(valid)} entradas confirmadas escritas ({skipped} ignoradas por campos em falta: "
              f"ver 'detected_fields' e use --crop-field/--unit-field/--theme-field). Total: {len(merged)}")
        if problems and skipped:
            print("Exemplo de problema:", problems[0])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
