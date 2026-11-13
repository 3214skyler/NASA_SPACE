INSERT INTO agricultores (nome, email, pais) VALUES
('João Manuel', 'joao@email.com', 'Angola'),
('Maria Santos', 'maria@email.com', 'Angola');

INSERT INTO culturas (nome, necessidade_hidrica, fixa_nitrogenio) VALUES
('milho', 'média', false),
('feijão', 'baixa', true),
('mandioca', 'baixa', false);

INSERT INTO propriedades (agricultor_id, nome, localizacao, area_hectares, objetivo) VALUES
(1, 'Fazenda Viana', ST_SetSRID(ST_MakePoint(13.37, -8.90), 4326)::geography, 2.5, 'melhorar saúde do solo'),
(2, 'Horta Catete', ST_SetSRID(ST_MakePoint(13.78, -9.15), 4326)::geography, 1.2, 'aumentar produtividade');

INSERT INTO historico_culturas (propriedade_id, cultura_id, data_plantio, data_colheita, produtividade) VALUES
(1, 1, '2025-10-01', '2026-02-15', 2.8),
(1, 2, '2026-03-01', '2026-06-10', 1.1);

INSERT INTO analises_ambientais (propriedade_id, indicador, valor, fonte, data_observacao) VALUES
(1, 'NDVI', 0.62, 'MODIS', '2026-11-01'),
(1, 'precipitacao_mm', 14.5, 'NASA POWER', '2026-11-01');