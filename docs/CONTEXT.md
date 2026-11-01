# Què sabem del projecte

> Actualitzat l'01/11/2026. **És el primer document que ha de llegir una sessió nova** (després de `CLAUDE.md`).
> Recull el coneixement acumulat: què és ledge, què s'ha decidit, què funciona de veritat, com és l'entorn i què s'ha après pel camí.
> El que **falta** és a [`../NEXT_STEPS.md`](../NEXT_STEPS.md). Les skills, a [`SKILLS.md`](SKILLS.md).

## 1. El producte

Dashboard patrimonial **privat** per a una household de dues persones (membre A i membre B). Mostra el patrimoni net conjunt i per membre: comptes, inversions, cripto, immobles i la hipoteca.

- **Sense registre públic**: els dos usuaris es creen amb un CLI.
- **Dades reals o res**: cap xifra inventada fora de la galeria `/dev` (dades de prova amb el segell «Dades de prova»).
- **Abast reduït acceptat de facto** (pendent de confirmar a D1/D2): només s'automatitza el que té API oficial. Fons, valors de MyInvestor i Trade Republic, el capital pendent de la hipoteca i els immobles són **manuals o estimats**, i la UI ho ha de dir (xip «Manual»/«Estimat», `DESIGN_CHANGES.md` DC-11).

## 2. Estat en una taula

| Àrea                     | Estat                                                                                          | Detall                        |
| ------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------- |
| Fase 0 · viabilitat      | Recerca documental feta. **Cap prova real**: els 3 spikes estan escrits però no s'han executat | `INTEGRATION_FEASIBILITY.md`  |
| Fase 1 · infraestructura | Punts 0–7 ✅ a `main`. **Falten 8 (CI) i 9 (Vercel)**                                          | `IMPLEMENTATION_PLAN.md`      |
| Gràfiques                | Disseny ✅, lib `libs/web/charts` + G-1 ✅ (només a `/dev/charts`)                             | `CHARTS.md`                   |
| Disseny de la UI         | Revisat amb skills. Proposta i referències HTML **no implementades** a l'app                   | `DESIGN_CHANGES.md`           |
| Fase 2 · domini financer | No començada. No depèn de cap gate                                                             | `IMPLEMENTATION_PLAN.md`      |
| Fases 3–6                | Esperen els gates G1–G4, D4 i D5                                                               | `IMPLEMENTATION_PLAN.md`      |
| Documentació i skills    | Centralitzada (PR #12). Hook `SessionStart` que instal·la les skills a cada sessió al núvol    | `docs/README.md`, `SKILLS.md` |

## 3. Decisions

### Preses

| Tema                | Decisió                                                                                                              | On                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Repo (D3)           | `ArnauM13/ledge`, privat                                                                                             | `IMPLEMENTATION_PLAN.md`         |
| Stack               | Nx 24 · Angular 21 (standalone, OnPush, signals, zoneless) · NestJS 11 · Prisma 7 · PostgreSQL 17                    | `README.md`                      |
| Estils              | Tailwind v3 amb prefix `t-` i tokens CSS. Tema únic fosc                                                             | `README.md` → Convencions        |
| Secrets             | Sempre en fitxers (`secrets/`, `/run/secrets/*`). Mai en variables d'entorn, `.env`, xat ni logs                     | `CLAUDE.md`, `secrets/README.md` |
| Auth                | argon2id + TOTP obligatori + codis de recuperació. Sessions opaques a Postgres en cookie `__Host-` `SameSite=Strict` | `README.md` → Autenticació       |
| CSRF                | Token sincronitzador + `Sec-Fetch-Site`/`Origin` + només JSON                                                        | `README.md` → CSRF               |
| Aïllament           | Guard + client de Prisma confinat a la household; resposta **404, mai 403**                                          | `README.md`                      |
| Xifratge            | AES-256-GCM, AAD lligada a taula/columna/id, clau mestra en fitxer                                                   | `README.md`                      |
| Imports             | `NUMERIC` a Postgres i **string decimal** al JSON. El front no suma imports                                          | `CHARTS.md` §3                   |
| Gràfiques           | SVG propi amb `d3-scale` + `d3-shape`; d3 no toca el DOM                                                             | `CHARTS.md`                      |
| Estil visual        | `true-black-flat` (taste-skill): profunditat per lluminositat, un sol to de dada, primari blanc                      | `DESIGN_CHANGES.md` §0           |
| Detecció de secrets | gitleaks 8.30.1 (hook de pre-commit + CI) amb checksum                                                               | `README.md`                      |

### Pendents (de l'usuari)

| #   | Pregunta                                          | Recomanació              | Bloqueja                |
| --- | ------------------------------------------------- | ------------------------ | ----------------------- |
| D1  | Posicions de MyInvestor / Trade Republic manuals? | Sí                       | Fase 2                  |
| D2  | NAV dels fons manual?                             | Sí, a l'MVP              | Fase 2                  |
| D4  | Domini                                            | Subdomini propi          | Vercel (punt 9), Fase 3 |
| D5  | VPS                                               | Hetzner (UE, ~4–7 €/mes) | Desplegar l'API, Fase 3 |
| D6  | Idioma de la UI                                   | Català                   | PR 2 de disseny         |

## 4. Arquitectura en breu

```text
apps/web          Angular. Login → TOTP → shell amb 9 seccions buides. /dev/charts (només dev)
apps/api          NestJS. /health, /api/auth/*, /api/households/:id. Prisma a apps/api/prisma
libs/shared/types Contractes web ↔ api (auth, health, NetWorthSeries)
libs/web/charts   Gràfiques (geometria pura + components)
spikes/           Paquet independent de la Fase 0 (fora de Nx; no es toca des de l'app)
docs/             Documentació (índex a docs/README.md) i referències de disseny (docs/design)
scripts/          Hooks de git i install-skills.mjs
```

- La web parla amb l'API a `/api` (proxy del dev-server en local). **Web i API han de ser al mateix site** per la cookie `SameSite=Strict`: per això Vercel depèn de D4.
- Taules: `users`, `households`, `memberships`, `sessions`, `audit_logs` (append-only també a la BD) i les de recuperació/TOTP. Tota taula nova amb `household_id` va a `HOUSEHOLD_SCOPED_MODELS` (un test ho comprova).

## 5. Fets verificats

Només el que s'ha comprovat de debò, amb data.

| Data       | Fet                                                                                                                            | Com                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| 01/11/2026 | `npx nx run-many -t lint test build` en verd (12 tasques) i `prettier --check .` OK                                            | Sessió del PR #12                            |
| 01/11/2026 | Flux complet al navegador: error genèric, alta del TOTP amb QR i clau, 10 codis de recuperació, Overview amb el nom            | Playwright amb codi TOTP generat (`otpauth`) |
| 01/11/2026 | Les 2 migracions s'apliquen sobre Postgres 16; `create-user` funciona amb la contrasenya per stdin                             | Postgres local del contenidor                |
| 01/11/2026 | Les referències de disseny passen `inspect.mjs --app` (0 FAIL) a 1440/768/390                                                  | taste-skill                                  |
| 01/11/2026 | El hook de les skills: instal·la des de zero (57 s), se salta la instal·lació si ja hi són (0,006 s), no fa res fora del núvol | Execució directa del hook                    |
| —          | **Cap integració real** (BBVA, Binance, wallets) s'ha provat mai                                                               | Spikes pendents d'executar                   |
| —          | `api:test-integration` no s'ha pogut executar en una sessió al núvol (no hi ha dimoni de Docker)                               | Pendent que ho faci el CI (punt 8)           |

Viabilitat per integració (documental, no provada): BBVA i Enable Banking **GO condicional**; Binance i wallets **GO**; fons, valors, hipoteca i immobles **manuals**. Detall a `INTEGRATION_FEASIBILITY.md` §0.

## 6. L'entorn de Claude Code al núvol

El que s'ha trobat en sessions anteriors i com resoldre-ho:

| Situació                                                        | Què fer                                                                                                           |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **No hi ha dimoni de Docker** (`docker compose` falla)          | Fes servir el Postgres del contenidor (recepta a sota). `api:test-integration` no funciona aquí                   |
| **gitleaks no hi és** i el hook de pre-commit bloqueja          | Instal·la'l amb el checksum (`README.md` → Instal·lació). Mai `--no-verify`                                       |
| **Push**: només es pot fer a la branca de la sessió             | El proxy de git rebutja altres branques i **no deixa esborrar-ne** (403). L'usuari ho ha de fer des de GitHub     |
| **Skills**                                                      | Les instal·la el hook `SessionStart` (~1 min la primera sessió d'un contenidor nou). Si falten, `SKILLS.md` §2    |
| **L'inspector de la taste-skill** no passa el login amb TOTP    | Inspecciona les referències de `docs/design` o fes el login amb Playwright (recepta a sota) i revisa les captures |
| Postgres s'atura (contenidor reiniciat) i l'API cau en arrencar | `service postgresql start` i torna a engegar `nx serve api`                                                       |

**Arrencar l'app en una sessió al núvol** (sense Docker), des de l'arrel del repo:

```bash
service postgresql start
mkdir -p secrets && chmod 700 secrets
[ -f secrets/ledge_master_key ] || openssl rand -base64 32 > secrets/ledge_master_key
[ -f secrets/postgres_test_password ] || openssl rand -hex 24 > secrets/postgres_test_password
su postgres -c "psql -q -c \"CREATE ROLE ledge_test LOGIN SUPERUSER PASSWORD '$(cat secrets/postgres_test_password)'\"" || true
su postgres -c "createdb -O ledge_test ledge_test" || true
```

```bash
export DB_HOST=127.0.0.1 DB_PORT=5432 DB_USER=ledge_test DB_NAME=ledge_test \
  DB_PASSWORD_FILE=$PWD/secrets/postgres_test_password LEDGE_MASTER_KEY_FILE=$PWD/secrets/ledge_master_key
npx nx run api:migrate && npx nx build api
printf 'una contrasenya llarga de prova\n' | node dist/apps/api/create-user.js --email a@ledge.local --name "Membre A" --household-name "Casa"
```

Després, `npx nx serve api` i `npx nx serve web` en segon pla, i el navegador a `http://localhost:4200`.

**Fer login amb Playwright** (per revisar pantalles amb sessió): omple correu i contrasenya, obre «Can't scan it?», llegeix la clau del `<code>` i genera el codi amb `new (require('otpauth').TOTP)({ secret }).generate()`. Cada usuari només pot donar d'alta el TOTP un cop: per repetir-ho, crea'n un de nou.

## 7. Lliçons

- **Base del PR sempre `main`.** El PR #10 es va fusionar a `docs/charts-design` quatre segons després que aquella branca s'hagués fusionat a `main`; va caldre el PR #11 per recuperar-lo.
- **Una sessió per carpeta alhora.** Dues sessions sobre el mateix codi acaben en PR duplicats i force-pushes creuats.
- **Les skills de l'ordinador no arriben al núvol.** Per això hi ha el hook `SessionStart` del repo (`SKILLS.md`).
- **Les dades de prova han de quadrar.** La taste-skill ho exigeix i ho comprova: `console.assert` a les referències.
- **El focus del teclat cal provar-lo.** Al codi semblava correcte; amb el teclat, el botó blanc no mostrava focus.
- **La tauleta és la seva pròpia amplada.** A 768 px, la barra lateral ocupa el 31%: només ho va detectar la revisió a tres amplades.
