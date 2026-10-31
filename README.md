# ledge

Dashboard patrimonial privat per a una household de dues persones.

- Viabilitat de les integracions: [`INTEGRATION_FEASIBILITY.md`](INTEGRATION_FEASIBILITY.md)
- Fases i gates: [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)
- Full de ruta: [`NEXT_STEPS.md`](NEXT_STEPS.md)
- Spikes de la Fase 0 (paquet independent): [`spikes/README.md`](spikes/README.md)

## Estructura

```text
apps/
  web/            Angular 21 (standalone, OnPush, signals, zoneless) + Tailwind (prefix t-)
  api/            NestJS 11 — de moment només GET /health
libs/
  shared/types/   Tipus compartits web ↔ api (@ledge/shared-types)
spikes/           Scripts de la Fase 0, amb el seu propi package.json (fora de Nx)
```

## Requisits

- Node.js ≥ 20.19 (provat amb 22) i npm 10
- Docker amb Compose v2 (només per a l'stack local amb Postgres)

## Arrencar en local

```bash
npm ci
```

Frontend a http://localhost:4200:

```bash
npx nx serve web
```

API a http://localhost:3000 (`GET /health`):

```bash
npx nx serve api
```

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"api","timestamp":"2026-10-31T18:32:07.610Z"}
```

### Amb Docker (Postgres + API)

```bash
cp .env.example .env   # només configuració no secreta
```

```bash
mkdir -p secrets && chmod 700 secrets && openssl rand -base64 32 > secrets/postgres_password
```

```bash
docker compose up --build
```

- L'API es publica només a `127.0.0.1:3000`.
- Postgres **no** publica cap port: és a la xarxa `backend` (interna, sense sortida) i només l'API hi arriba (`db:5432`).
- Encara no hi ha Prisma: l'API rep `DB_HOST`, `DB_USER`, `DB_NAME` i `DB_PASSWORD_FILE`, però encara no els fa servir (Fase 1, punt 4).

#### Secrets

- Les contrasenyes **no** van al `.env` ni a cap variable d'entorn. Són fitxers a `secrets/` (al `.gitignore`), muntats com a [Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/) a `/run/secrets/*`. Postgres els llegeix amb `POSTGRES_PASSWORD_FILE`, i l'API amb `DB_PASSWORD_FILE`.
- Per això no apareixen a `docker inspect`, a `docker compose config` ni als logs.
- Si falta el fitxer, `docker compose up` falla i no arrenca res sense contrasenya.
- `secrets/` és `700`; el fitxer pot ser `644` perquè els usuaris dels contenidors (Postgres uid 70, API `node` uid 1000) el puguin llegir.

#### Darrere d'un proxy TLS corporatiu

Si `npm ci` falla durant el build per un certificat, passa el CA del proxy com a secret de BuildKit. Només es munta durant `npm ci` i no queda a cap capa de la imatge:

```bash
docker build --secret id=npm_ca,src=/ruta/al/ca.pem -t ledge-api:local -f apps/api/Dockerfile .
```

```bash
docker compose up --no-build
```

Aturar i esborrar les dades locals:

```bash
docker compose down -v
```

## Qualitat

```bash
npx nx run-many -t lint test build
```

```bash
npx prettier --check .
```

Per projecte: `npx nx test web`, `npx nx lint api`, `npx nx build web`…

## Convencions

- **Tailwind v3 amb prefix `t-`**: `t-bg-surface`, `md:t-px-10`, `hover:t-text-content`. Els colors són tokens CSS a `apps/web/src/styles.css`:
  - `canvas` (fons charcoal), `surface` / `surface-raised` (panells), `line` (vores)
  - `content` / `content-muted` / `content-subtle` (text)
  - `positive` (maragda, només guanys) · `negative` (vermell, només pèrdues o alertes)
- Components: standalone + `ChangeDetectionStrategy.OnPush` (és el default del generador a `nx.json`).
- Rutes de negoci de l'API sota `/api/*`; `/health` queda a l'arrel.
- Cap secret al repo: `.env`, `*.pem` i `*.key` són al `.gitignore`.

## Estat

Fase 1, punts 1–3 (monorepo, Tailwind, Docker Compose) a `main`. Següent: punts 4–7 + gitleaks (prompt a `NEXT_STEPS.md` §3b). La UI només té la navegació i un estat buit: **cap xifra**, perquè encara no hi ha cap font de dades connectada.
