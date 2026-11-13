-- Ativa o PostGIS (dá ao PostgreSQL a capacidade de trabalhar com mapas)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Quem usa a plataforma
CREATE TABLE agricultores (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  pais TEXT,
  criado_em TIMESTAMP DEFAULT now()
);

-- Terrenos de cada agricultor, com localização no mapa
CREATE TABLE propriedades (
  id SERIAL PRIMARY KEY,
  agricultor_id INT NOT NULL REFERENCES agricultores(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  localizacao GEOGRAPHY(Point, 4326) NOT NULL,  -- ponto central (longitude, latitude)
  area GEOGRAPHY(Polygon, 4326),                -- limites do terreno (opcional)
  area_hectares NUMERIC,
  sistema_producao TEXT,
  disponibilidade_agua TEXT,
  objetivo TEXT,
  criado_em TIMESTAMP DEFAULT now()
);

-- Informação sobre o solo, com indicação de onde vem o dado
CREATE TABLE caracteristicas_solo (
  id SERIAL PRIMARY KEY,
  propriedade_id INT NOT NULL REFERENCES propriedades(id) ON DELETE CASCADE,
  tipo_solo TEXT,
  ph NUMERIC,
  materia_organica NUMERIC,
  origem TEXT NOT NULL DEFAULT 'declarado'
    CHECK (origem IN ('confirmado','estimado','declarado','desconhecido')),
  registado_em TIMESTAMP DEFAULT now()
);

-- Lista de culturas conhecidas
CREATE TABLE culturas (
  id SERIAL PRIMARY KEY,
  nome TEXT UNIQUE NOT NULL,
  necessidade_hidrica TEXT,
  fixa_nitrogenio BOOLEAN DEFAULT false
);

-- O que foi plantado em cada propriedade e quando
CREATE TABLE historico_culturas (
  id SERIAL PRIMARY KEY,
  propriedade_id INT NOT NULL REFERENCES propriedades(id) ON DELETE CASCADE,
  cultura_id INT NOT NULL REFERENCES culturas(id),
  data_plantio DATE NOT NULL,
  data_colheita DATE,
  produtividade NUMERIC
);

-- Dados ambientais (NDVI, chuva, humidade do solo...) vindos da NASA
CREATE TABLE analises_ambientais (
  id SERIAL PRIMARY KEY,
  propriedade_id INT NOT NULL REFERENCES propriedades(id) ON DELETE CASCADE,
  indicador TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  fonte TEXT,
  data_observacao DATE NOT NULL,
  origem TEXT NOT NULL DEFAULT 'estimado'
    CHECK (origem IN ('confirmado','estimado','declarado','desconhecido'))
);

-- Estratégias de rotação calculadas e guardadas
CREATE TABLE estrategias_rotacao (
  id SERIAL PRIMARY KEY,
  propriedade_id INT NOT NULL REFERENCES propriedades(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  sequencia_culturas TEXT NOT NULL,
  pontuacao NUMERIC,
  explicacao TEXT,
  criado_em TIMESTAMP DEFAULT now()
);

-- Índices: tornam as pesquisas mais rápidas
CREATE INDEX idx_prop_loc ON propriedades USING GIST (localizacao);
CREATE INDEX idx_prop_area ON propriedades USING GIST (area);
CREATE INDEX idx_prop_agricultor ON propriedades (agricultor_id);
CREATE INDEX idx_hist_prop ON historico_culturas (propriedade_id);
CREATE INDEX idx_analises_prop ON analises_ambientais (propriedade_id, indicador);