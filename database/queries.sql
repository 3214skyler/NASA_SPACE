-- Consultas úteis para o backend. Podem ser testadas no psql.

-- 1. Terrenos de um agricultor, com a posição legível
SELECT p.id, p.nome, ST_AsText(p.localizacao) AS posicao
FROM propriedades p
JOIN agricultores a ON a.id = p.agricultor_id
WHERE a.email = 'exemplo1@acreview.test';

-- 2. Terrenos num raio de 50 km de um ponto (longitude, latitude)
SELECT id, nome,
       round((ST_Distance(localizacao, ST_SetSRID(ST_MakePoint(13.289, -8.839), 4326)::geography) / 1000)::numeric, 1) AS distancia_km
FROM propriedades
WHERE ST_DWithin(localizacao, ST_SetSRID(ST_MakePoint(13.289, -8.839), 4326)::geography, 50000)
ORDER BY distancia_km;

-- 3. Histórico de plantações de um terreno
SELECT c.nome AS cultura, pl.data_plantio, pl.data_colheita, pl.produtividade
FROM plantacoes pl
JOIN culturas c ON c.id = pl.cultura_id
JOIN propriedades p ON p.id = pl.propriedade_id
WHERE p.nome = 'Fazenda Viana'
ORDER BY pl.data_plantio;

-- 4. Últimas medições ambientais de um terreno (uma por variável)
SELECT DISTINCT ON (d.variavel)
       d.variavel, d.valor, d.unidade, d.fonte, d.origem, d.data_inicio, d.data_fim
FROM dados_ambientais d
JOIN propriedades p ON p.id = d.propriedade_id
WHERE p.nome = 'Fazenda Viana'
ORDER BY d.variavel, d.data_fim DESC;

-- 5. Comparar as estratégias de rotação de um terreno, com as culturas na ordem
SELECT e.nome, e.tipo, e.pontuacao,
       string_agg(c.nome, ' → ' ORDER BY i.ordem) AS sequencia,
       bool_or(c.fixa_nitrogenio) AS inclui_fixadora_de_azoto
FROM estrategias_rotacao e
JOIN itens_rotacao i ON i.estrategia_id = e.id
JOIN culturas c ON c.id = i.cultura_id
JOIN propriedades p ON p.id = e.propriedade_id
WHERE p.nome = 'Fazenda Viana'
GROUP BY e.id, e.nome, e.tipo, e.pontuacao
ORDER BY e.pontuacao DESC;
