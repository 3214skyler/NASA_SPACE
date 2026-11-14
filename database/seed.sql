-- Dados de EXEMPLO para testar a base de dados (valores fictícios, não são medições reais da NASA).
-- Corre depois do schema.sql.

INSERT INTO agricultores (nome, email, pais) VALUES
  ('Agricultor Exemplo 1', 'exemplo1@acreview.test', 'Angola'),
  ('Agricultor Exemplo 2', 'exemplo2@acreview.test', 'Angola');

INSERT INTO propriedades (agricultor_id, nome, localizacao) VALUES
  ((SELECT id FROM agricultores WHERE email = 'exemplo1@acreview.test'),
   'Fazenda Viana',
   ST_SetSRID(ST_MakePoint(13.370, -8.900), 4326)::geography),
  ((SELECT id FROM agricultores WHERE email = 'exemplo2@acreview.test'),
   'Campo Huambo',
   ST_SetSRID(ST_MakePoint(15.739, -12.776), 4326)::geography);

INSERT INTO culturas (nome, necessidade_hidrica, fixa_nitrogenio) VALUES
  ('milho',        'média', false),
  ('feijão',       'média', true),
  ('mandioca',     'baixa', false),
  ('amendoim',     'baixa', true),
  ('soja',         'média', true),
  ('batata-doce',  'baixa', false);

-- O que já foi plantado em cada terreno
INSERT INTO plantacoes (propriedade_id, cultura_id, data_plantio, data_colheita, produtividade) VALUES
  ((SELECT id FROM propriedades WHERE nome = 'Fazenda Viana'),
   (SELECT id FROM culturas WHERE nome = 'milho'),    '2025-10-15', '2026-02-20', 2.4),
  ((SELECT id FROM propriedades WHERE nome = 'Fazenda Viana'),
   (SELECT id FROM culturas WHERE nome = 'milho'),    '2026-10-10', NULL,         NULL),
  ((SELECT id FROM propriedades WHERE nome = 'Campo Huambo'),
   (SELECT id FROM culturas WHERE nome = 'mandioca'), '2025-09-01', '2026-06-30', 11.0);

-- Medições ambientais (exemplo). origem: confirmado | estimado | declarado | desconhecido
INSERT INTO dados_ambientais (propriedade_id, fonte, variavel, valor, unidade, data_inicio, data_fim, resolucao, origem) VALUES
  ((SELECT id FROM propriedades WHERE nome = 'Fazenda Viana'), 'MODIS',      'ndvi',          0.52, 'índice', '2026-01-01', '2026-01-31', '250 m',   'estimado'),
  ((SELECT id FROM propriedades WHERE nome = 'Fazenda Viana'), 'GPM IMERG',  'precipitacao',  118,  'mm',     '2026-01-01', '2026-01-31', '10 km',   'estimado'),
  ((SELECT id FROM propriedades WHERE nome = 'Fazenda Viana'), 'SMAP',       'humidade_solo', 0.21, 'm3/m3',  '2026-01-01', '2026-01-31', '9 km',    'estimado'),
  ((SELECT id FROM propriedades WHERE nome = 'Fazenda Viana'), 'NASA POWER', 'temperatura',   26.4, '°C',     '2026-01-01', '2026-01-31', '50 km',   'estimado'),
  ((SELECT id FROM propriedades WHERE nome = 'Campo Huambo'),  'MODIS',      'ndvi',          0.61, 'índice', '2026-01-01', '2026-01-31', '250 m',   'estimado'),
  ((SELECT id FROM propriedades WHERE nome = 'Campo Huambo'),  'GPM IMERG',  'precipitacao',  165,  'mm',     '2026-01-01', '2026-01-31', '10 km',   'estimado'),
  ((SELECT id FROM propriedades WHERE nome = 'Campo Huambo'),  'NASA POWER', 'temperatura',   20.1, '°C',     '2026-01-01', '2026-01-31', '50 km',   'estimado');

-- Rotações: a atual e duas propostas para a Fazenda Viana
INSERT INTO estrategias_rotacao (propriedade_id, nome, descricao, tipo, pontuacao) VALUES
  ((SELECT id FROM propriedades WHERE nome = 'Fazenda Viana'),
   'Milho contínuo', 'Rotação atual: milho todas as épocas.', 'atual', 40),
  ((SELECT id FROM propriedades WHERE nome = 'Fazenda Viana'),
   'Milho + feijão', 'Alterna milho com feijão, que fixa nitrogénio e ajuda a recuperar o solo.', 'proposta', 75),
  ((SELECT id FROM propriedades WHERE nome = 'Fazenda Viana'),
   'Milho + amendoim + mandioca', 'Inclui culturas de menor necessidade de água.', 'proposta', 68);

INSERT INTO itens_rotacao (estrategia_id, cultura_id, ordem, duracao_meses) VALUES
  ((SELECT id FROM estrategias_rotacao WHERE nome = 'Milho contínuo'),               (SELECT id FROM culturas WHERE nome = 'milho'),    1, 6),
  ((SELECT id FROM estrategias_rotacao WHERE nome = 'Milho + feijão'),               (SELECT id FROM culturas WHERE nome = 'milho'),    1, 6),
  ((SELECT id FROM estrategias_rotacao WHERE nome = 'Milho + feijão'),               (SELECT id FROM culturas WHERE nome = 'feijão'),   2, 4),
  ((SELECT id FROM estrategias_rotacao WHERE nome = 'Milho + amendoim + mandioca'),  (SELECT id FROM culturas WHERE nome = 'milho'),    1, 6),
  ((SELECT id FROM estrategias_rotacao WHERE nome = 'Milho + amendoim + mandioca'),  (SELECT id FROM culturas WHERE nome = 'amendoim'), 2, 4),
  ((SELECT id FROM estrategias_rotacao WHERE nome = 'Milho + amendoim + mandioca'),  (SELECT id FROM culturas WHERE nome = 'mandioca'), 3, 10);

-- Resumo do período para uma estratégia
INSERT INTO analises_agricolas (propriedade_id, estrategia_id, precipitacao_media, humidade_solo_media, temperatura_media, periodo_inicio, periodo_fim, observacoes) VALUES
  ((SELECT id FROM propriedades WHERE nome = 'Fazenda Viana'),
   (SELECT id FROM estrategias_rotacao WHERE nome = 'Milho + feijão'),
   118, 0.21, 26.4, '2026-01-01', '2026-01-31',
   'Exemplo: dados fictícios. Precisa de validação com agrónomos locais.');
