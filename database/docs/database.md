# Modelo de dados

Base de dados: PostgreSQL + PostGIS. Coordenadas em SRID 4326 (longitude, latitude).

## Convenção de origem dos dados

As colunas `origem` só aceitam: `confirmado`, `estimado`, `declarado`, `desconhecido`.
Servem para distinguir o que veio de uma análise, de uma estimativa por satélite, do agricultor, ou o que não se sabe.

## Tabelas

### agricultores
Pessoas que usam a plataforma.
| Campo | Tipo | Descrição |
|---|---|---|
| id | serial | Identificador |
| nome | texto | Nome do agricultor |
| email | texto único | Email |
| pais | texto | País |
| criado_em | timestamp | Data de registo |

### propriedades
Terrenos de cada agricultor.
| Campo | Tipo | Descrição |
|---|---|---|
| id | serial | Identificador |
| agricultor_id | int | Dono (liga a agricultores) |
| nome | texto | Nome do terreno |
| localizacao | geography(Point) | Ponto central |
| area | geography(Polygon) | Limites (opcional) |
| area_hectares | numérico | Dimensão |
| sistema_producao | texto | Ex.: sequeiro, regadio |
| disponibilidade_agua | texto | Ex.: baixa, média, alta |
| objetivo | texto | Objetivo agrícola |

### caracteristicas_solo
Tipo de solo, pH e matéria orgânica, com `origem`.

### culturas
Culturas conhecidas, com necessidade hídrica e se fixam azoto.

### historico_culturas
O que foi plantado em cada propriedade: cultura, datas e produtividade.

### analises_ambientais
Indicadores da NASA (NDVI, precipitação, humidade do solo, temperatura) por propriedade e data, com `fonte` e `origem`.

### estrategias_rotacao
Rotações calculadas: nome, sequência de culturas, pontuação e explicação.

## Relações

agricultores 1 → N propriedades
propriedades 1 → N caracteristicas_solo, historico_culturas, analises_ambientais, estrategias_rotacao
culturas 1 → N historico_culturas