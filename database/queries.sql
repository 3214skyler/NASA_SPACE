-- 1. Registar uma propriedade nova
INSERT INTO propriedades (agricultor_id, nome, localizacao, area_hectares)
VALUES (1, 'Terreno Novo', ST_SetSRID(ST_MakePoint(13.40, -8.95), 4326)::geography, 3.0);

-- 2. Propriedades de um agricultor (coordenadas em GeoJSON, formato do mapa)
SELECT id, nome, area_hectares, ST_AsGeoJSON(localizacao) AS localizacao
FROM propriedades
WHERE agricultor_id = 1;

-- 3. Propriedades a menos de 20 km de um ponto (distância em metros)
SELECT nome, ST_Distance(localizacao, ST_SetSRID(ST_MakePoint(13.37, -8.90), 4326)::geography) AS distancia_m
FROM propriedades
WHERE ST_DWithin(localizacao, ST_SetSRID(ST_MakePoint(13.37, -8.90), 4326)::geography, 20000)
ORDER BY distancia_m;

-- 4. Que propriedade contém o ponto clicado no mapa (só as que têm polígono)
SELECT id, nome
FROM propriedades
WHERE ST_Intersects(area, ST_SetSRID(ST_MakePoint(13.370, -8.900), 4326)::geography);

-- 5. Histórico de culturas de uma propriedade
SELECT c.nome AS cultura, h.data_plantio, h.data_colheita, h.produtividade
FROM historico_culturas h
JOIN culturas c ON c.id = h.cultura_id
WHERE h.propriedade_id = 1
ORDER BY h.data_plantio;

-- 6. Últimos valores de cada indicador ambiental de uma propriedade
SELECT DISTINCT ON (indicador) indicador, valor, fonte, data_observacao, origem
FROM analises_ambientais
WHERE propriedade_id = 1
ORDER BY indicador, data_observacao DESC;

-- 7. Guardar um indicador novo vindo da NASA
INSERT INTO analises_ambientais (propriedade_id, indicador, valor, fonte, data_observacao)
VALUES (1, 'temperatura_c', 27.4, 'NASA POWER', '2026-11-10');

-- 8. Estratégias de rotação de uma propriedade, da melhor para a pior
SELECT nome, sequencia_culturas, pontuacao, explicacao
FROM estrategias_rotacao
WHERE propriedade_id = 1
ORDER BY pontuacao DESC;