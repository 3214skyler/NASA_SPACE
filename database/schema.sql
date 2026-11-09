-- 1. Ativar o suporte a dados geográficos
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Tabela de Agricultores
CREATE TABLE IF NOT EXISTS agricultores (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Propriedades (com polígonos/coordenadas do mapa)
CREATE TABLE IF NOT EXISTS propriedades (
    id SERIAL PRIMARY KEY,
    agricultor_id INT REFERENCES agricultores(id) ON DELETE CASCADE,
    nome_propriedade VARCHAR(100),
    limites_geo GEOMETRY(Polygon, 4326), 
    tamanho_hectares NUMERIC,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);