--
-- PostgreSQL database dump
--


-- Dumped from database version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)
-- Dumped by pg_dump version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agricultores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agricultores (
    id integer NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    pais text,
    criado_em timestamp without time zone DEFAULT now()
);


--
-- Name: agricultores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agricultores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agricultores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agricultores_id_seq OWNED BY public.agricultores.id;


--
-- Name: analises_agricolas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analises_agricolas (
    id integer NOT NULL,
    propriedade_id integer NOT NULL,
    estrategia_id integer,
    precipitacao_media numeric,
    humidade_solo_media numeric,
    temperatura_media numeric,
    evapotranspiracao_media numeric,
    periodo_inicio date NOT NULL,
    periodo_fim date NOT NULL,
    observacoes text
);


--
-- Name: analises_agricolas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.analises_agricolas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: analises_agricolas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.analises_agricolas_id_seq OWNED BY public.analises_agricolas.id;


--
-- Name: culturas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.culturas (
    id integer NOT NULL,
    nome text NOT NULL,
    necessidade_hidrica text,
    fixa_nitrogenio boolean DEFAULT false
);


--
-- Name: culturas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.culturas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: culturas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.culturas_id_seq OWNED BY public.culturas.id;


--
-- Name: dados_ambientais; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dados_ambientais (
    id integer NOT NULL,
    propriedade_id integer NOT NULL,
    fonte text NOT NULL,
    variavel text NOT NULL,
    valor numeric NOT NULL,
    unidade text NOT NULL,
    data_inicio date NOT NULL,
    data_fim date NOT NULL,
    resolucao text,
    origem text DEFAULT 'estimado'::text NOT NULL,
    CONSTRAINT dados_ambientais_origem_check CHECK ((origem = ANY (ARRAY['confirmado'::text, 'estimado'::text, 'declarado'::text, 'desconhecido'::text])))
);


--
-- Name: dados_ambientais_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dados_ambientais_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dados_ambientais_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dados_ambientais_id_seq OWNED BY public.dados_ambientais.id;


--
-- Name: estrategias_rotacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estrategias_rotacao (
    id integer NOT NULL,
    propriedade_id integer NOT NULL,
    nome text NOT NULL,
    descricao text,
    tipo text NOT NULL,
    pontuacao numeric,
    CONSTRAINT estrategias_rotacao_tipo_check CHECK ((tipo = ANY (ARRAY['atual'::text, 'proposta'::text])))
);


--
-- Name: estrategias_rotacao_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.estrategias_rotacao_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: estrategias_rotacao_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.estrategias_rotacao_id_seq OWNED BY public.estrategias_rotacao.id;


--
-- Name: itens_rotacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itens_rotacao (
    id integer NOT NULL,
    estrategia_id integer NOT NULL,
    cultura_id integer NOT NULL,
    ordem integer NOT NULL,
    duracao_meses integer
);


--
-- Name: itens_rotacao_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.itens_rotacao_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: itens_rotacao_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.itens_rotacao_id_seq OWNED BY public.itens_rotacao.id;


--
-- Name: plantacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plantacoes (
    id integer CONSTRAINT palntacoes_id_not_null NOT NULL,
    propriedade_id integer NOT NULL,
    cultura_id integer NOT NULL,
    data_plantio date CONSTRAINT palntacoes_data_plantio_not_null NOT NULL,
    data_colheita date,
    produtividade numeric
);


--
-- Name: plantacoes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plantacoes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plantacoes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plantacoes_id_seq OWNED BY public.plantacoes.id;


--
-- Name: propriedades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.propriedades (
    id integer NOT NULL,
    agricultor_id integer NOT NULL,
    nome text NOT NULL,
    criado_em timestamp without time zone DEFAULT now(),
    localizacao public.geography(Point,4326) NOT NULL
);


--
-- Name: propriedades_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.propriedades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: propriedades_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.propriedades_id_seq OWNED BY public.propriedades.id;


--
-- Name: agricultores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agricultores ALTER COLUMN id SET DEFAULT nextval('public.agricultores_id_seq'::regclass);


--
-- Name: analises_agricolas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analises_agricolas ALTER COLUMN id SET DEFAULT nextval('public.analises_agricolas_id_seq'::regclass);


--
-- Name: culturas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.culturas ALTER COLUMN id SET DEFAULT nextval('public.culturas_id_seq'::regclass);


--
-- Name: dados_ambientais id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dados_ambientais ALTER COLUMN id SET DEFAULT nextval('public.dados_ambientais_id_seq'::regclass);


--
-- Name: estrategias_rotacao id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estrategias_rotacao ALTER COLUMN id SET DEFAULT nextval('public.estrategias_rotacao_id_seq'::regclass);


--
-- Name: itens_rotacao id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itens_rotacao ALTER COLUMN id SET DEFAULT nextval('public.itens_rotacao_id_seq'::regclass);


--
-- Name: plantacoes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantacoes ALTER COLUMN id SET DEFAULT nextval('public.plantacoes_id_seq'::regclass);


--
-- Name: propriedades id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propriedades ALTER COLUMN id SET DEFAULT nextval('public.propriedades_id_seq'::regclass);


--
-- Name: agricultores agricultores_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agricultores
    ADD CONSTRAINT agricultores_email_key UNIQUE (email);


--
-- Name: agricultores agricultores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agricultores
    ADD CONSTRAINT agricultores_pkey PRIMARY KEY (id);


--
-- Name: analises_agricolas analises_agricolas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analises_agricolas
    ADD CONSTRAINT analises_agricolas_pkey PRIMARY KEY (id);


--
-- Name: culturas culturas_nome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.culturas
    ADD CONSTRAINT culturas_nome_key UNIQUE (nome);


--
-- Name: culturas culturas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.culturas
    ADD CONSTRAINT culturas_pkey PRIMARY KEY (id);


--
-- Name: dados_ambientais dados_ambientais_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dados_ambientais
    ADD CONSTRAINT dados_ambientais_pkey PRIMARY KEY (id);


--
-- Name: estrategias_rotacao estrategias_rotacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estrategias_rotacao
    ADD CONSTRAINT estrategias_rotacao_pkey PRIMARY KEY (id);


--
-- Name: itens_rotacao itens_rotacao_estrategia_id_ordem_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itens_rotacao
    ADD CONSTRAINT itens_rotacao_estrategia_id_ordem_key UNIQUE (estrategia_id, ordem);


--
-- Name: itens_rotacao itens_rotacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itens_rotacao
    ADD CONSTRAINT itens_rotacao_pkey PRIMARY KEY (id);


--
-- Name: plantacoes plantacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantacoes
    ADD CONSTRAINT plantacoes_pkey PRIMARY KEY (id);


--
-- Name: propriedades propriedades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propriedades
    ADD CONSTRAINT propriedades_pkey PRIMARY KEY (id);


--
-- Name: idx_prop_loc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prop_loc ON public.propriedades USING gist (localizacao);


--
-- Name: analises_agricolas analises_agricolas_estrategia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analises_agricolas
    ADD CONSTRAINT analises_agricolas_estrategia_id_fkey FOREIGN KEY (estrategia_id) REFERENCES public.estrategias_rotacao(id);


--
-- Name: analises_agricolas analises_agricolas_propriedade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analises_agricolas
    ADD CONSTRAINT analises_agricolas_propriedade_id_fkey FOREIGN KEY (propriedade_id) REFERENCES public.propriedades(id);


--
-- Name: dados_ambientais dados_ambientais_propriedade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dados_ambientais
    ADD CONSTRAINT dados_ambientais_propriedade_id_fkey FOREIGN KEY (propriedade_id) REFERENCES public.propriedades(id);


--
-- Name: estrategias_rotacao estrategias_rotacao_propriedade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estrategias_rotacao
    ADD CONSTRAINT estrategias_rotacao_propriedade_id_fkey FOREIGN KEY (propriedade_id) REFERENCES public.propriedades(id);


--
-- Name: itens_rotacao itens_rotacao_cultura_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itens_rotacao
    ADD CONSTRAINT itens_rotacao_cultura_id_fkey FOREIGN KEY (cultura_id) REFERENCES public.culturas(id);


--
-- Name: itens_rotacao itens_rotacao_estrategia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itens_rotacao
    ADD CONSTRAINT itens_rotacao_estrategia_id_fkey FOREIGN KEY (estrategia_id) REFERENCES public.estrategias_rotacao(id);


--
-- Name: plantacoes plantacoes_cultura_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantacoes
    ADD CONSTRAINT plantacoes_cultura_id_fkey FOREIGN KEY (cultura_id) REFERENCES public.culturas(id);


--
-- Name: plantacoes plantacoes_propriedade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantacoes
    ADD CONSTRAINT plantacoes_propriedade_id_fkey FOREIGN KEY (propriedade_id) REFERENCES public.propriedades(id);


--
-- Name: propriedades propriedades_agricultor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propriedades
    ADD CONSTRAINT propriedades_agricultor_id_fkey FOREIGN KEY (agricultor_id) REFERENCES public.agricultores(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


