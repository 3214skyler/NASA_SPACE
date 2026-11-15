# Base de dados do AcreView

PostgreSQL + PostGIS. Coordenadas em SRID 4326 (longitude, latitude).

## Como montar a base localmente

Duas formas, com o mesmo resultado:

- **Docker:** `cd database && docker compose up` (usa `docker-compose.yml`, que carrega `schema.sql` e `seed.sql` na primeira vez que o volume é criado).
- **PostgreSQL instalado (ex.: WSL):**

      sudo -u postgres createdb acreview
      sudo -u postgres psql -v ON_ERROR_STOP=1 -d acreview < schema.sql
      sudo -u postgres psql -v ON_ERROR_STOP=1 -d acreview < seed.sql

O `seed.sql` tem dados de **exemplo fictícios** (não são medições reais da NASA).
O `queries.sql` tem consultas prontas para o backend.

## Convenção de origem dos dados

Algumas colunas `origem` só aceitam: `confirmado`, `estimado`, `declarado`, `desconhecido`.
Servem para distinguir o que veio de uma análise, de uma estimativa por satélite, do agricultor, ou o que não se sabe.

## Tabelas

- **agricultores**: quem usa a plataforma (nome, email único, país).
- **propriedades**: terrenos de cada agricultor. `localizacao` é um ponto `geography(Point,4326)`. Se o agricultor for apagado, os terrenos dele também (`ON DELETE CASCADE`).
- **culturas**: lista de culturas, com `necessidade_hidrica` e `fixa_nitrogenio`.
- **plantacoes**: o que foi plantado em cada terreno (cultura, datas de plantio e colheita, produtividade).
- **dados_ambientais**: uma medição por linha (`variavel` + `valor` + `unidade`), com `fonte` (ex.: SMAP, MODIS), período (`data_inicio` / `data_fim`), `resolucao` e `origem`. Para acrescentar um indicador novo basta inserir linhas com outro nome em `variavel`, sem alterar a tabela.
- **estrategias_rotacao**: rotações de um terreno. `tipo` é `atual` ou `proposta`, com `pontuacao` e `descricao`.
- **itens_rotacao**: as culturas de cada rotação, na ordem (`ordem`, `duracao_meses`). Não há duas culturas na mesma posição da mesma rotação.
- **analises_agricolas**: resumo por período de um terreno (médias de precipitação, humidade do solo, temperatura e evapotranspiração), opcionalmente ligado a uma estratégia.

## Relações

agricultores 1 → N propriedades
propriedades 1 → N plantacoes, dados_ambientais, estrategias_rotacao, analises_agricolas
culturas 1 → N plantacoes, itens_rotacao
estrategias_rotacao 1 → N itens_rotacao, analises_agricolas

## Mudanças em relação à versão anterior

- `historico_culturas` passou a `plantacoes`, e `analises_ambientais` a `dados_ambientais` (com `unidade` e período em vez de uma só data).
- A sequência de culturas deixou de ser um texto e passou para a tabela `itens_rotacao`.
- Campos de `propriedades` removidos por agora: `area`, `area_hectares`, `sistema_producao`, `disponibilidade_agua`, `objetivo`.
- A tabela `caracteristicas_solo` (tipo de solo, pH, matéria orgânica, com `origem`) ainda não existe nesta versão.
- A versão antiga continua guardada na branch `database-backup` (apenas no computador de quem a criou) e no histórico do git.

## Limitações

- Os dados de exemplo são fictícios.
- Os dados de solo oficiais dos EUA (SSURGO, Web Soil Survey) não cobrem Angola; o solo deverá vir do agricultor (`origem = 'declarado'`).

## Migração 002 (evolução da base)

Ficheiro: `migrations/002_evolucao.sql` (já incluída no `schema.sql`).

- **propriedades.limites**: polígono do terreno desenhado no mapa, `geography(Polygon,4326)`. O ponto central continua em `localizacao`.
- **agricultores.password_hash**: só o hash da palavra-passe, gerado pelo Backend. Nunca guardar a palavra-passe.
- **estrategias_rotacao.beneficios / riscos**: texto explicativo de cada estratégia.
- **dados_ambientais.demonstracao**: `true` nos dados fictícios do `seed.sql`. Dados reais da NASA devem entrar com `false`, e o frontend não deve mostrar dados de demonstração como medições reais.
- **recomendacoes** (tabela nova): recomendações com `justificacao`, `dados_utilizados` (JSON), `riscos`, `confianca` (opcional, de 0 a 1), `origem` e data. Pode ligar-se a uma estratégia.

## Ainda por fazer

- Tabelas de planos agrícolas e de histórico de atividades (dependem do que o frontend guarda hoje no `localStorage`).
- Tabela de características do solo (tipo, pH, matéria orgânica), declaradas pelo agricultor.
