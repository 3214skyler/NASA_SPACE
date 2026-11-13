# Base de dados AgroVision-AI

PostgreSQL 16 + PostGIS 3.4, a correr em Docker.

## Arrancar

1. Copia `.env.example` para `.env` e escolhe uma password.
2. Corre: `docker compose up -d`
3. Liga-te em `localhost:5432` com os dados do `.env`.

## Recriar do zero

`docker compose down -v` e depois `docker compose up -d`.

## Ficheiros

- `schema.sql`: tabelas e índices
- `seed.sql`: dados de teste
- `queries.sql`: consultas prontas para o backend

Atenção: coordenadas sempre em (longitude, latitude).