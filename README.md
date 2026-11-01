# ledge

Dashboard patrimonial privat per a una household de dues persones.

**Tota la documentació: [`docs/README.md`](docs/README.md)** (índex: quin document mana per a cada cosa).

- Vols veure la web funcionant? [`docs/MANUAL_SETUP.md`](docs/MANUAL_SETUP.md)
- Què sabem (estat, decisions, entorn): [`docs/CONTEXT.md`](docs/CONTEXT.md) · Què falta: [`NEXT_STEPS.md`](NEXT_STEPS.md)
- Skills de Claude Code (s'instal·len soles a cada sessió al núvol): [`docs/SKILLS.md`](docs/SKILLS.md)

## Estructura

```text
apps/
  web/            Angular 21 (standalone, OnPush, signals, zoneless) + Tailwind (prefix t-)
  api/            NestJS 11 + Prisma 7 (PostgreSQL)
    prisma/       schema.prisma i migracions SQL
libs/
  shared/types/   Tipus compartits web ↔ api (@ledge/shared-types)
  web/charts/     Gràfiques SVG (Angular + d3-scale/d3-shape) (@ledge/web-charts)
docs/             Índex, context, skills, passos manuals, disseny (CHARTS, DESIGN_CHANGES, docs/design/)
.claude/          settings.json + hooks/session-start.sh (instal·la les skills a les sessions al núvol)
scripts/          Hooks de git i install-skills.mjs (skills de Claude Code, docs/SKILLS.md)
spikes/           Scripts de la Fase 0, amb el seu propi package.json (fora de Nx)
```

## Requisits

- Node.js ≥ 20.19 (provat amb 22) i npm 10
- Docker amb Compose v2 (només per a l'stack local amb Postgres)

## Arrencar en local

```bash
npm ci
```

L'API necessita Postgres i la clau mestra (no arrenca sense). Per desenvolupar, fes servir la BD d'un sol ús de `docker-compose.test.yml` (tmpfs: les dades es perden en aturar-la):

```bash
mkdir -p secrets && chmod 700 secrets
[ -f secrets/ledge_master_key ] || openssl rand -base64 32 > secrets/ledge_master_key
[ -f secrets/postgres_test_password ] || openssl rand -base64 32 > secrets/postgres_test_password
docker compose -f docker-compose.test.yml up -d --wait
```

```bash
export DB_HOST=127.0.0.1 DB_PORT=55432 DB_USER=ledge_test DB_NAME=ledge_test \
  DB_PASSWORD_FILE=$PWD/secrets/postgres_test_password \
  LEDGE_MASTER_KEY_FILE=$PWD/secrets/ledge_master_key
npx nx run api:migrate
```

Crea un usuari (la contrasenya es demana per stdin, oculta; vegeu [Usuaris](#usuaris)):

```bash
npx nx build api
node dist/apps/api/create-user.js --email a@example.com --name "Membre A" --household-name "Casa"
```

API a http://localhost:3000 i web a http://localhost:4200 (el dev-server fa de proxy de `/api` cap a l'API, així que tot és same-origin):

```bash
npx nx serve api
```

```bash
npx nx serve web
```

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"api","timestamp":"2026-10-31T18:32:07.610Z"}
```

La cookie de sessió és `Secure`: Chrome i Firefox l'accepten a `http://localhost`, Safari no.

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

Crear un usuari dins Docker:

```bash
docker compose run --rm -it api node create-user.js --email a@example.com --name "Membre A" --household-name "Casa"
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

## Autenticació

Sense registre públic. Flux: **contrasenya → TOTP** (o alta del TOTP, obligatòria al primer login) → sessió completa. Fins aleshores no s'accedeix a res més.

### Usuaris

Es creen amb el CLI `create-user` (`apps/api/src/cli`). La contrasenya **només** es llegeix per stdin: oculta i demanada dues vegades en un terminal, o la primera línia d'un pipe (p. ex. des del gestor de contrasenyes). Mai per argument ni per variable d'entorn: el CLI rebutja `--password`.

```bash
# primer membre: crea la household (rol OWNER)
node dist/apps/api/create-user.js --email a@example.com --name "Membre A" --household-name "Casa"
# segon membre: s'uneix a la mateixa household (rol MEMBER)
node dist/apps/api/create-user.js --email b@example.com --name "Membre B" --household-id <uuid que ha imprès l'anterior>
```

Contrasenya: 12–256 caràcters i diferent de l'email.

### Paràmetres

| Què                            | Valor                                                                     | Per què                                                                                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hash de contrasenya            | argon2id, m = 19 MiB, t = 2, p = 1                                        | Configuració mínima de l'[OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id). Els hashes amb paràmetres antics es refan al següent login correcte.                |
| Usuari inexistent              | Es verifica igualment contra un hash fictici                              | El temps de resposta no revela si l'usuari existeix.                                                                                                                                                                                          |
| TOTP                           | RFC 6238, SHA-1, 6 dígits, 30 s, finestra ±1 pas, secret de 160 bits      | Compatible amb totes les apps d'autenticació. El secret es guarda **xifrat** (AES-256-GCM) i cada codi només es pot fer servir un cop (anti-replay). El QR es genera al servidor (cap servei extern veu el secret).                           |
| Codis de recuperació           | 10 codis de 80 bits, d'un sol ús                                          | Es mostren **un sol cop**; a la BD només n'hi ha el SHA-256 (amb 80 bits aleatoris no cal un hash lent).                                                                                                                                      |
| Cookie de sessió               | `__Host-ledge_session`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/` | Token aleatori de 256 bits; a la BD només el SHA-256.                                                                                                                                                                                         |
| Caducitat                      | 15 min d'inactivitat · 8 h absoluta · 5 min per a la sessió a mig login   | [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#session-expiration). Logout revoca la sessió al servidor. En completar el 2FA es canvia el token (contra la fixació de sessió). |
| Bloqueig per compte (Postgres) | 5 errors seguits (contrasenya, TOTP o codi de recuperació) → 15 min       | Sobreviu a reinicis. Durant el bloqueig, fins i tot la contrasenya bona falla amb el mateix missatge.                                                                                                                                         |
| Límit per IP (memòria)         | 20 intents / 15 min als endpoints de login i 2FA → `429`                  | Complementa el bloqueig per compte. Darrere d'un proxy cal `API_TRUST_PROXY`.                                                                                                                                                                 |
| Missatges d'error              | Sempre el mateix 401 genèric                                              | No revela si l'usuari existeix, si la contrasenya és bona o si el compte està bloquejat.                                                                                                                                                      |

### CSRF

Totes les peticions que modifiquen dades (`POST`, `PATCH`, `PUT`, `DELETE`):

1. Es rebutgen si `Sec-Fetch-Site: cross-site` o si `Origin` no és el mateix origen ni és a `WEB_ORIGINS`.
2. Han de ser `Content-Type: application/json` (un formulari HTML no ho pot enviar, i un `fetch` d'un altre origen necessitaria un preflight CORS que l'API no concedeix).
3. Amb sessió, han de dur `X-CSRF-Token` amb el token sincronitzador de la sessió (HMAC del token de sessió; l'API el retorna a `GET /api/auth/session` i en fer login). L'únic `POST` sense sessió és el login, cobert per 1 i 2.

A més, `SameSite=Strict` impedeix que el navegador enviï la cookie des d'un altre lloc.

### Auditoria

Cada intent de login (contrasenya, TOTP, codi de recuperació, alta del TOTP) i cada logout va a `audit_logs`, correcte o fallit, amb `action`, `outcome`, `reason` (p. ex. `invalid_password`, `replayed_code`, `locked`), usuari, household, IP i user agent. **Mai** contrasenyes, codis, tokens, secrets ni l'email escrit quan no correspon a cap usuari (podria ser una contrasenya escrita al camp equivocat). Si l'event no es pot escriure, el login falla.

### Endpoints

| Mètode i ruta                       | Sessió    | Què fa                                                                     |
| ----------------------------------- | --------- | -------------------------------------------------------------------------- |
| `GET /api/auth/session`             | cap       | Estat de la sessió, usuari, households i token CSRF                        |
| `POST /api/auth/login`              | cap       | Contrasenya → sessió parcial (`next: totp` o `totp-setup`)                 |
| `POST /api/auth/totp/setup`         | parcial   | Nou secret TOTP (xifrat) + QR. Només si el 2FA encara no està actiu        |
| `POST /api/auth/totp/setup/confirm` | parcial   | Confirma amb un codi → sessió completa + codis de recuperació (un sol cop) |
| `POST /api/auth/totp/verify`        | parcial   | Codi TOTP → sessió completa                                                |
| `POST /api/auth/recovery`           | parcial   | Codi de recuperació → sessió completa                                      |
| `POST /api/auth/logout`             | qualsevol | Revoca la sessió                                                           |

## Aïllament de household

Totes les dades de negoci pertanyen a una household, i un usuari només veu les de les households on és membre.

- **Rutes**: `/api/households/:householdId/...` amb `HouseholdGuard`. Comprova que l'usuari de la sessió en sigui membre; si no ho és, o la household no existeix, respon **404** (mai 403), així no es confirma ni que existeixi.
- **Consultes**: el guard dona un client de Prisma confinat a la household (`@CurrentHousehold() household` → `household.db`). Afegeix `AND household_id = <id>` a totes les lectures, actualitzacions i esborrats, i escriu el `household_id` a les insercions (rebutja'n un altre o moure files entre households). Una fila d'una altra household és simplement "no trobada".
- **Obligatori**: el client que s'injecta a la resta de l'API (`PRISMA`) **llança `UnscopedQueryError`** si una consulta a un model de negoci no porta el filtre de household (p. ex. `household.findMany()`). El client sense restriccions no s'exporta del `PrismaModule`.
- **Taules noves**: s'han d'afegir a `HOUSEHOLD_SCOPED_MODELS` (`apps/api/src/app/household/household-scope.ts`). Un test llegeix `schema.prisma` i falla si una taula amb `household_id` no hi és (o a la llista d'excepcions justificades: `memberships`, que és la mateixa autorització, i `audit_logs`).
- Tests: `household-isolation.int-spec.ts` (un usuari d'una household no pot llegir ni modificar l'altra: 404, i les dades no canvien) i `household-scope.spec.ts`.

| Mètode i ruta                        | Què fa                                                    |
| ------------------------------------ | --------------------------------------------------------- |
| `GET /api/households/:householdId`   | Nom i rol de l'usuari a la household                      |
| `PATCH /api/households/:householdId` | Canvia el nom (`{ "name": "..." }`), queda a `audit_logs` |

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

Per projecte: `npx nx test web`, `npx nx lint api`, `npx nx build web`, `npx nx test web-charts`…

### Galeria de gràfiques (només en desenvolupament)

Amb `npx nx serve web`, obre http://localhost:4200/dev/charts. Hi ha totes les gràfiques i els seus estats (buit, carregant, error) amb **dades de prova**.

La galeria no demana login, no surt al menú i no existeix al build de producció: `fileReplacements` substitueix `apps/web/src/app/dev/dev-routes.ts` per una versió buida. Disseny i regles: [`docs/CHARTS.md`](docs/CHARTS.md).

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
- Gràfiques:
  - Colors de sèrie `series-1`…`series-5` (tokens a `styles.css`, paleta validada; veure `docs/CHARTS.md` §4).
  - Imports com a string decimal.
  - Res de xifres a les seccions fins que hi hagi dades reals.
- Rutes de negoci de l'API sota `/api/*`; `/health` queda a l'arrel.
- Cap secret al repo: `.env`, `*.pem` i `*.key` són al `.gitignore`.

## Estat

Resum a [`docs/CONTEXT.md`](docs/CONTEXT.md) §2. Què falta i en quin ordre: [`NEXT_STEPS.md`](NEXT_STEPS.md). Deute tècnic conegut: `NEXT_STEPS.md` §3.
