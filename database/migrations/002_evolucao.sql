-- 002: evolução da base pedida pelo Backend/Frontend

-- Limites do terreno desenhados no mapa (o ponto central continua em "localizacao")
ALTER TABLE propriedades ADD COLUMN limites GEOGRAPHY(Polygon, 4326);
CREATE INDEX idx_prop_limites ON propriedades USING GIST (limites);

-- Autenticação: guarda-se só o hash da palavra-passe (gerado pelo Backend), nunca a palavra-passe
ALTER TABLE agricultores ADD COLUMN password_hash TEXT;

-- Benefícios e riscos de cada estratégia (o Backend já devolve estes campos)
ALTER TABLE estrategias_rotacao ADD COLUMN beneficios TEXT, ADD COLUMN riscos TEXT;

-- Distinguir dados de demonstração de dados reais da NASA
ALTER TABLE dados_ambientais ADD COLUMN demonstracao BOOLEAN NOT NULL DEFAULT false;

-- Recomendações do sistema, com justificação e dados usados
CREATE TABLE recomendacoes (
  id SERIAL PRIMARY KEY,
  propriedade_id INT NOT NULL REFERENCES propriedades(id) ON DELETE CASCADE,
  estrategia_id INT REFERENCES estrategias_rotacao(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  justificacao TEXT NOT NULL,
  dados_utilizados JSONB,
  riscos TEXT,
  confianca NUMERIC CHECK (confianca BETWEEN 0 AND 1),
  origem TEXT NOT NULL DEFAULT 'estimado'
    CHECK (origem IN ('confirmado','estimado','declarado','desconhecido')),
  criado_em TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_recom_prop ON recomendacoes (propriedade_id);
