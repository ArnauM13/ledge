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
  api/            NestJS 11 + Prisma 7 (PostgreSQL)
    prisma/       schema.prisma i migracions SQL
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

Secrets (com es genera cadascun: [`secrets/README.md`](secrets/README.md)):

```bash
mkdir -p secrets && chmod 700 secrets
openssl rand -base64 32 > secrets/postgres_password
openssl rand -base64 32 > secrets/ledge_master_key
chmod 644 secrets/postgres_password secrets/ledge_master_key
```

```bash
docker compose up --build
```

- L'API es publica només a `127.0.0.1:3000`.
- Postgres **no** publica cap port: és a la xarxa `backend` (interna, sense sortida) i només l'API hi arriba (`db:5432`).
- Ordre d'arrencada: `db` (healthy) → `migrate` (`prisma migrate deploy`, acaba amb codi 0) → `api`.
- L'API munta la URL de connexió en arrencar a partir de `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME` i el fitxer `DB_PASSWORD_FILE` (usuari i contrasenya codificats per a URL). La URL no s'escriu mai als logs, als errors ni a cap variable d'entorn. Si la BD no respon, l'API no arrenca.

- L'API llegeix la clau mestra de `LEDGE_MASTER_KEY_FILE` (`/run/secrets/ledge_master_key`) i **no arrenca** si falta o no és vàlida.

Migracions a mà:

```bash
docker compose run --rm migrate
```

### Base de dades (Prisma)

- Esquema: `apps/api/prisma/schema.prisma`. Migracions: `apps/api/prisma/migrations/`.
- Taules: `users`, `households`, `memberships`, `audit_logs`. IDs UUID (`gen_random_uuid()`), `created_at`/`updated_at` en `timestamptz` (instants UTC; la sessió de BD de l'API va en `TimeZone=UTC`) i índex per `household_id`.
- `audit_logs` és **append-only**: l'API no pot fer `update`/`delete`/`upsert` (extensió de Prisma que llança error) i un trigger de Postgres rebutja `UPDATE`, `DELETE` i `TRUNCATE`. Un superusuari de la BD encara podria desactivar el trigger.
- El client de Prisma es genera a `apps/api/src/generated/prisma` (al `.gitignore`); `nx build|test|lint api` el generen abans (`nx run api:prisma-generate`).

Nova migració en local (contra la BD de test, vegeu més avall):

```bash
cd apps/api
export DB_HOST=127.0.0.1 DB_PORT=55432 DB_USER=ledge_test DB_NAME=ledge_test DB_PASSWORD_FILE=$PWD/../../secrets/postgres_test_password
npx prisma migrate dev --name <nom>
```

### Xifratge de camps

`EncryptionService` (`apps/api/src/app/crypto`) xifra els camps sensibles amb **AES-256-GCM**:

- IV aleatori de 96 bits per a cada valor i tag de 128 bits.
- Format: `enc:v1:<versió de clau>:<iv>:<ciphertext>:<tag>` (base64url). La versió permet rotar la clau ([`secrets/README.md`](secrets/README.md#rotació)).
- AAD = format + versió + `taula`, `columna` i `id` del registre: un valor copiat a una altra fila o columna no es desxifra.
- Qualsevol error de desxifrat (clau incorrecta, text manipulat, context diferent) dona el mateix `Decryption failed`, sense detalls.
- La clau mestra (32 bytes) és un fitxer de secrets. Mai a la BD, al repo, a l'entorn ni als logs (el `Keyring` no es pot serialitzar ni imprimir).

#### Secrets

- Les contrasenyes **no** van al `.env` ni a cap variable d'entorn. Són fitxers a `secrets/` (al `.gitignore`), muntats com a [Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/) a `/run/secrets/*`. Postgres els llegeix amb `POSTGRES_PASSWORD_FILE`, i l'API amb `DB_PASSWORD_FILE`.
- Per això no apareixen a `docker inspect`, a `docker compose config` ni als logs.
- Si falta el fitxer, `docker compose up` falla i no arrenca res sense contrasenya.
- `secrets/` és `700`; el fitxer pot ser `644` perquè els usuaris dels contenidors (Postgres uid 70, API `node` uid 1000) el puguin llegir.

#### Darrere d'un proxy TLS corporatiu

Si `npm ci` o `prisma generate` (que descarrega el _schema engine_) fallen durant el build per un certificat, passa el CA del proxy com a secret de BuildKit. Només es munta en aquests dos passos i no queda a cap capa de la imatge:

```bash
docker build --secret id=npm_ca,src=/ruta/al/ca.pem --target migrate -t ledge-api-migrate:local -f apps/api/Dockerfile .
docker build --secret id=npm_ca,src=/ruta/al/ca.pem --target runtime -t ledge-api:local -f apps/api/Dockerfile .
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

Tests d'integració de l'API (`*.int-spec.ts`, amb Postgres real). Arrenquen `docker-compose.test.yml` (Postgres en tmpfs a `127.0.0.1:55432`), apliquen les migracions, executen els tests i aturen la BD:

```bash
npx nx run api:test-integration            # -- --keep-db per deixar la BD engegada
```

- La contrasenya de la BD de test es crea sola a `secrets/postgres_test_password`, i la clau mestra és un fitxer temporal per execució.
- Si ja hi ha `DB_HOST` definit (p. ex. un servei de CI), fa servir aquella BD. En tots dos casos, **es nega a executar-se si `DB_NAME` no acaba en `_test`**.

Per projecte: `npx nx test web`, `npx nx lint api`, `npx nx build web`…

## Secrets al repo (gitleaks)

[gitleaks](https://github.com/gitleaks/gitleaks) **8.30.1** busca secrets en dos llocs:

- **Hook de pre-commit** (`.githooks/pre-commit`): escaneja el que hi ha a l'staging (`gitleaks git --pre-commit --staged`). `npm install` l'activa (`core.hooksPath=.githooks`). Si gitleaks no hi és, el commit **falla** amb instruccions; mai se salta.
- **CI** (`.github/workflows/secrets.yml`): a cada PR i a cada push a `main`, escaneja **tot l'historial**. La versió i el SHA-256 del binari estan fixats al workflow.

### Instal·lació

macOS:

```bash
brew install gitleaks
```

Linux (x64), amb verificació del checksum:

```bash
V=8.30.1
curl -sSfLO https://github.com/gitleaks/gitleaks/releases/download/v$V/gitleaks_${V}_linux_x64.tar.gz
curl -sSfLO https://github.com/gitleaks/gitleaks/releases/download/v$V/gitleaks_${V}_checksums.txt
sha256sum --ignore-missing -c gitleaks_${V}_checksums.txt   # ha de dir OK
tar -xzf gitleaks_${V}_linux_x64.tar.gz gitleaks && sudo install -m 0755 gitleaks /usr/local/bin/
```

Si ja tenies el repo clonat abans d'aquest canvi, activa el hook amb `npm install` (o `git config core.hooksPath .githooks`).

Escaneig manual de tot l'historial (el mateix que fa el CI):

```bash
npm run secrets:scan
```

### Si salta

1. **Secret real**: treu-lo de l'staging (`git restore --staged <fitxer>`), mou-lo a `secrets/` o fora del repo i **rota'l** (si ha arribat a un commit, considera'l compromès encara que no s'hagi fet push).
2. **Fals positiu** (només si l'has verificat a mà): afegeix una entrada a `[[allowlists]]` de `.gitleaks.toml`, tan estreta com puguis:
   ```toml
   [[allowlists]]
   description = "Clau de prova generada per al test X; no dona accés a res (verificat per <qui>, <data>)"
   targetRules = ["private-key"]
   paths = ['''^apps/api/src/app/crypto/fixtures/test-key\.pem$''']
   ```
   Res de carpetes senceres, regex amples ni `stopwords`. Els comentaris `gitleaks:allow` s'ignoren expressament (`--ignore-gitleaks-allow`): tota excepció ha de ser a `.gitleaks.toml`, on es revisa al PR.

`git commit --no-verify` salta el hook, però el CI tornarà a escanejar tot l'historial.

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
