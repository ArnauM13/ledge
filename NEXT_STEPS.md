# NEXT_STEPS.md — Full de ruta

> Actualitzat l'01/11/2026. Només el que **queda per fer**, en ordre.
> Índex de tota la documentació: [`docs/README.md`](docs/README.md). Anàlisi de l'estat: [`docs/ANALYSIS.md`](docs/ANALYSIS.md).
> Prompts de sessions ja fetes: [`docs/archive/SESSION_PROMPTS.md`](docs/archive/SESSION_PROMPTS.md).

## Estat actual

| Element | Estat |
|---|---|
| Repo `ArnauM13/ledge` | Privat. `main` = Fase 1 punts 0–7 + gràfiques (disseny, lib i G-1) |
| Estudi de viabilitat | Fet (recerca documental, **sense proves reals**) |
| Spikes (`spikes/enable-banking`, `binance`, `wallets`) | **Escrits i testejats en local; cap executat amb credencials reals** |
| Fase 1, punts 0–7 | ✅ A `main` (PR #6 i #8): gitleaks, Nx, Tailwind, Docker Compose, Prisma, auth amb TOTP, aïllament de household, xifratge. Flux de login provat al navegador l'01/11 |
| Fase 1, punts 8–9 (CI + Vercel) | Pendent (§3c). El punt 9 depèn de D4, D5 i del compte de Vercel |
| Gràfiques | Disseny ✅ (`docs/CHARTS.md`). Lib `libs/web/charts` + G-1 ✅ a `main` (PR #10 i #11), només a `/dev/charts` amb dades de prova. Següent: G-2 + G-3 (§3e) i G-4 + G-5 (§3f) |
| Disseny de la UI | Revisat l'01/11 (`docs/ANALYSIS.md` §4). Canvis proposats amb referències HTML a `docs/DESIGN_CHANGES.md` (§3g). Pendent D6 (idioma) |
| Fase 2 (domini financer) | No començada. No depèn de cap gate (§3h) |
| Gates G1–G4 | Pendents |

---

## 0. Què has de fer ara (resum ràpid)

Guia pas a pas de tot el que és manual: [`docs/MANUAL_SETUP.md`](docs/MANUAL_SETUP.md).

1. **Veure la web en local** (`docs/MANUAL_SETUP.md` §1): crear els dos usuaris, donar d'alta el TOTP i **desar els codis de recuperació**.
2. **Decidir D6** (idioma de la UI, `docs/DESIGN_CHANGES.md` §0), **D1**, **D2**, **D4** i **D5**.
3. **Enable Banking** (~30 min):
   1. App de **producció** en estat *Active (restricted)* amb els comptes del membre A (§1.3).
   2. El `.pem` fora del repo, a `~/.secrets/ledge/`, i còpia al gestor de contrasenyes (§1.4).
   3. Enviar l'Annex A de `INTEGRATION_FEASIBILITY.md` a `support.api@enablebanking.com`.
   4. Executar l'spike (`spikes/README.md`):
      ```bash
      cd spikes && npm install && cp .env.example .env   # i omple el .env
      npm run eb:aspsps
      npm run eb:connect -- --aspsp BBVA --member A
      npm run eb:fetch -- --member A
      ```
   5. El mateix amb `--member B` quan pugui.
4. **Binance i wallets**: claus (`spikes/README.md` §3b i §3c) i `npm run binance` / `npm run wallets`.
5. Passar els `spikes/output/*.report.md`, **revisats**, a una sessió nova amb el prompt de la §5 (mai els `.raw.json` ni `eb-session-*.json`).

**Sessions de Claude** (en paral·lel): §3c (CI, després Vercel) → §3g (disseny) → §3e/§3f (gràfiques) → §3h (Fase 2).

---

## Checklist (en aquest ordre)

### A. Decisions (vosaltres)
- [ ] **D1** — Posicions de MyInvestor / Trade Republic manuals? *(recomanat: sí)*
- [ ] **D2** — NAV dels fons manual? *(recomanat: sí, a l'MVP)*
- [x] **D3** — Repo: `ArnauM13/ledge`, privat
- [ ] **D4** — Domini (necessari per a l'API i la redirecció d'Enable Banking a producció)
- [ ] **D5** — Proveïdor de VPS *(recomanat: Hetzner, ~4–7 €/mes)*
- [ ] **D6** — Idioma de la UI *(recomanat: català, `docs/DESIGN_CHANGES.md` §0)*

### B. Comptes i credencials (vosaltres)
- [x] Enable Banking: compte creat
- [ ] Enable Banking: app de sandbox + app de producció activada amb el membre A → guia a la §1
- [ ] Enviar la consulta de l'Annex A de `INTEGRATION_FEASIBILITY.md` a `support.api@enablebanking.com`
- [ ] Binance: API key amb **només "Enable Reading"** i restricció d'IP
- [ ] Etherscan: API key gratuïta
- [ ] Gestor de contrasenyes compartit (per als `.pem`, les claus i els codis de recuperació)
- [ ] gitleaks 8.30.1 instal·lat (`README.md` → "Secrets al repo")
- [ ] Vercel: compte connectat a GitHub (Fase 1, punt 9)

### C. Sessions de Claude Code
1. [x] Spikes (EB, Binance, wallets) → `docs/archive/SESSION_PROMPTS.md`
2. [x] Fase 1, punts 1–3 (PR #6)
3. [x] Fase 1, punts 0 i 4–7 (PR #8)
4. [x] Disseny de gràfiques (`docs/CHARTS.md`, PR #9)
5. [x] Lib de gràfiques + G-1 (PR #10 i #11)
6. [x] Revisió de l'estat i del disseny + centralització de la documentació (`docs/ANALYSIS.md`, `docs/DESIGN_CHANGES.md`, `docs/MANUAL_SETUP.md`)
7. [ ] **Fase 1, punts 8–9** → §3c (CI ara; Vercel quan hi hagi D4, D5 i Vercel)
8. [ ] **Disseny, PR 1–3** de `docs/DESIGN_CHANGES.md` §5 → §3g (el PR 2 necessita D6)
9. [ ] **G-2 + G-3** (distribució + KPIs) → §3e. No depèn dels gates
10. [ ] **G-4 + G-5** (hipoteca) → §3f. Es pot fer amb fixtures abans de la Fase 2.4
11. [ ] **Fase 2** → §3h
12. [ ] **Connectar G-1…G-5 a l'API** quan la Fase 2 tingui els endpoints (`docs/CHARTS.md` §8, punt 5)
13. [ ] **G-6 a G-9** quan les Fases 3 i 4 donin dades

### D. Executar els spikes (vosaltres) → `spikes/README.md`
- [ ] `npm run eb:aspsps` → hi ha MyInvestor i Trade Republic?
- [ ] `npm run eb:connect -- --aspsp BBVA --member A` + `npm run eb:fetch -- --member A` → **G1**
- [ ] `npm run eb:connect -- --aspsp BBVA --member B` + `npm run eb:fetch -- --member B` → **G2**
- [ ] `npm run binance` → **G3**
- [ ] `npm run wallets` amb una adreça BTC i una ETH reals → **G4**
- [ ] Passar els `*.report.md` (anonimitzats) a una sessió (§5)

### E. Després dels gates
- Fase 3 (integracions): cada adapter només quan el seu gate sigui GO.

---

## 1. Guia: registrar l'app a Enable Banking

### 1.1 Crear el compte
1. Anar a https://enablebanking.com/sign-in/
2. Posar l'email. El compte es crea automàticament el primer cop que s'hi entra.
3. Obrir l'enllaç d'accés que arriba per correu.

### 1.2 App de sandbox (per provar el flux sense risc)
1. Menú superior → **API applications** (https://enablebanking.com/cp/applications).
2. Formulari *Add a new application*:
   - **Environment:** Sandbox
   - **Private key:** opció per defecte (es genera al navegador)
   - **Name:** `ledge`
   - **Redirect URL:** `https://localhost:3000/callback`
3. **Register** → es descarrega `<application-id>.pem`.
   - Nom del fitxer = **ID de l'app** → variable `EB_APP_ID`
   - Fitxer = **clau privada** → variable `EB_PRIVATE_KEY_PATH`

### 1.3 App de producció (llegeix el BBVA real)
1. El mateix formulari, amb **Environment: Production**.
2. L'app apareix en estat **Inactive**.
3. **Activate by linking accounts** → pàgina d'Enable Banking → BBVA (usuari, contrasenya i confirmació al mòbil).
   - Primer el **membre A**.
   - Vincular **tots** els comptes que es vulguin fer servir. Els que no es vinculin tornaran com a llista buida.
4. L'app passa a **Active (restricted)**.

La prova del membre B (G2) es fa amb l'spike, no aquí.

### 1.4 Seguretat de la clau `.pem`
- Moure-la de *Descàrregues* a una carpeta fora del repo, p. ex. `~/.secrets/ledge/`.
- Còpia al gestor de contrasenyes.
- Mai a GitHub ni al xat. Qui té el fitxer pot actuar com la vostra app.

### 1.5 Per què `localhost` com a redirecció
El banc redirigeix a aquesta URL amb un `code` a l'adreça. Amb `localhost` la pàgina no carrega (és normal): l'spike demana que copieu la URL i n'extreu el codi. Així el codi no surt del vostre ordinador. Amb un domini d'un tercer (p. ex. `example.com`), el codi acabaria als seus servidors.

### 1.6 Què no aclareix la documentació
- Si el formulari accepta `localhost`. Si el rebutja: posar una URL del vostre **propi** domini i adaptar l'spike.
- On es mostra l'ID de l'app al panell (en tot cas, és el nom del `.pem`).
- Si la clau es pot tornar a descarregar o regenerar.

Fonts: [Quick start](https://enablebanking.com/docs/api/quick-start) · [Linked accounts](https://enablebanking.com/docs/api/linked-accounts/) · [FAQ](https://enablebanking.com/docs/faq/)

---

> Les seccions §2, §3, §3b i §3d (prompts de sessions fetes) són a `docs/archive/SESSION_PROMPTS.md`.

## 3c. Prompt: sessió de la Fase 1, punts 8–9 (CI + Vercel)

Per al punt 9 cal haver decidit **D4** (domini) i **D5** (VPS) i tenir el compte de Vercel connectat a GitHub. Si encara no, la sessió fa el punt 8 i deixa el 9 preparat però sense desplegar.

Obrir una sessió nova amb el repo `ArnauM13/ledge` seleccionat i enganxar:

~~~~text
Projecte: "ledge", un dashboard patrimonial privat per a una household de dues persones. Repo: ArnauM13/ledge.

## Context
Abans de fer res, llegeix del repo: CLAUDE.md, docs/README.md (índex), README.md, IMPLEMENTATION_PLAN.md (Fase 1 i les decisions dels punts 4–7), NEXT_STEPS.md i docs/MANUAL_SETUP.md §3.

Ja és a main (Fase 1, punts 0–7, i la lib de gràfiques `libs/web/charts` amb G-1 a `/dev/charts`):
- Monorepo Nx 24: apps/web (Angular 21, zoneless, signals), apps/api (NestJS 11 + Prisma 7 + PostgreSQL), libs/shared/types.
- gitleaks 8.30.1: hook de pre-commit i `.github/workflows/secrets.yml` (només gitleaks, sobre tot l'historial).
- Auth: argon2id + TOTP obligatori, sessions a Postgres en cookie `__Host-ledge_session` (HttpOnly, Secure, SameSite=Strict), CSRF amb token de sessió, bloqueig i rate limit. Usuaris amb el CLI `create-user` (contrasenya per stdin).
- Aïllament de household (404, no 403) i xifratge AES-256-GCM amb clau mestra en fitxer.
- Secrets sempre en fitxers (/run/secrets/*), mai en variables d'entorn ni al .env.
- Tests: `nx test` (unitaris) i `nx run api:test-integration` (Postgres real; es nega si DB_NAME no acaba en `_test`; si DB_HOST ja hi és, no arrenca Docker).
- spikes/ és un paquet independent, fora del graf de Nx. No el toquis.

## Tasca d'aquesta sessió: Fase 1, punts 8 i 9

8. CI (GitHub Actions), workflow nou `.github/workflows/ci.yml` (no toquis `secrets.yml`):
   - A cada PR i a cada push a main: `npm ci`, `npx prettier --check .`, `npx nx run-many -t lint test build`, i `npx nx run api:test-integration` amb un servei Postgres 17.
   - La contrasenya del Postgres de CI és d'un sol ús: genera-la al job, escriu-la en un fitxer (DB_PASSWORD_FILE) i no la posis mai com a text al workflow ni als logs. DB_NAME ha d'acabar en `_test`.
   - Actions fixades per SHA de commit (com a `secrets.yml`), `permissions: contents: read`, `persist-credentials: false`, timeout per job i cache de npm.
   - Comprova que el job falla de debò si un test falla (fes-ho en local o amb un commit temporal que no arribi a main).

9. Vercel (només si D4, D5 i el compte de Vercel estan decidits; si no, prepara la configuració i explica què falta):
   - Projecte connectat al repo que construeixi `apps/web` (`npx nx build web`, sortida `dist/apps/web/browser`), amb fallback SPA.
   - La cookie és SameSite=Strict: la web i l'API han de ser el mateix site. Proposa com fer-ho (p. ex. rewrite de `/api/*` de Vercel cap a l'API del VPS, o subdominis del domini de D4) i pregunta abans de decidir. Recorda `WEB_ORIGINS` i `API_TRUST_PROXY` (vegeu `.env.example`).
   - Capçaleres de seguretat a la web (CSP estricta, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, HSTS).
   - Definition of Done de la Fase 1: els dos usuaris fan login amb 2FA i veuen un Overview buit a Vercel. Si l'API encara no està desplegada (depèn de D5), digues-ho clarament: no ho donis per fet.

## Requisits
- Actualitza la documentació (regla de CLAUDE.md): README (CI i desplegament), NEXT_STEPS.md (estat, checklist i prompt de la sessió següent) i IMPLEMENTATION_PLAN.md (✅ i decisions).
- `nx lint`, `nx test`, `nx build`, `nx run api:test-integration`, `prettier --check .` i gitleaks sobre tot l'historial han de passar abans d'acabar.
- Justifica cada dependència o action nova i fixa'n la versió.

## Fora d'abast
Model de dades financer (Fase 2), integracions (Fase 3) i el desplegament del backend al VPS (Fase 3), tret que l'usuari ho demani.

## Forma de treballar
- Branca nova des de main i PR cap a main. Commits petits: un per punt.
- Si cal una decisió que no surt als documents, pregunta-ho abans de decidir.
- Al final, resumeix què has fet, què has verificat (amb la sortida) i què queda pendent.

Decisions encara pendents de l'usuari, que no has d'assumir: D4 (domini), D5 (VPS) i el compte de Vercel.
~~~~

### Pendents tècnics coneguts (de la sessió dels punts 4–7)

No són de la Fase 1 però convé no perdre'ls:

- **Rotació de la clau mestra**: el format ja porta la versió i l'API accepta claus antigues (`LEDGE_MASTER_KEY_PREVIOUS_FILES`), però falta el job que torna a xifrar els valors antics.
- **Rols de BD separats**: ara l'API i les migracions fan servir el mateix usuari de Postgres. Un rol per a l'API sense `TRUNCATE` ni permís per desactivar triggers reforçaria `audit_logs`.
- **TOTP perdut + codis de recuperació perduts**: no hi ha procediment. Caldria una ordre del CLI per reiniciar el 2FA d'un usuari (amb auditoria).
- **Neteja de sessions caducades**: les files de `sessions` revocades o caducades no s'esborren (no afecta la seguretat, només l'espai).
- **Capçaleres de seguretat de l'API** (helmet o equivalent): no afegides.
- **Build de Docker darrere d'un proxy TLS**: `docker compose build` no passa el secret `npm_ca`; cal `docker build` a mà (`README.md`).

---

## 3e. Prompt: G-2 (distribució per classe d'actiu) + G-3 (KPIs)

Obrir una sessió nova amb el repo `ArnauM13/ledge` seleccionat i enganxar:

~~~~text
Projecte: "ledge" (repo ArnauM13/ledge). Abans de fer res, llegeix CLAUDE.md, README.md i docs/CHARTS.md (sobretot §1, §2, §4–§8).
Mira també com està feta la G-1: libs/web/charts (line-chart.*, chart-frame.ts, format.ts),
apps/web/src/app/charts (net-worth.ts, net-worth-card.ts, decimal.ts) i apps/web/src/app/dev (galeria i fixtures).

Tasca: el PR 3 de docs/CHARTS.md §8.

G-2 — Distribució per classe d'actiu (Overview):
- Contracte a libs/shared/types, amb guard i tests (mateix patró que NetWorthSeries):
  - Imports com a string decimal.
  - Classes fixes en aquest ordre: cash, investments, crypto, real-estate, other. L'ordre fixa el color (slots 1–5).
  - Els deutes NO entren a la barra: es mostren a part, a G-3.
- Lib: `ledge-stacked-bar` (una barra horitzontal 100% apilada) + geometria pura testejada:
  - Barra de 24px, extrems de 4px arrodonits, separació de 2px entre segments.
  - Etiqueta dins el segment només si hi cap (mesura-ho); si no, va a la llegenda, al tooltip i a la taula.
  - Llegenda sempre, amb % i import. Tooltip per segment (hover i focus). Vista de taula.
  - Segments de valor 0: no es dibuixen, però surten a la taula.
- Els percentatges es calculen per dibuixar. Si el backend no els envia, mostra'ls arrodonits a 1 decimal i comprova amb un test que la llegenda no suma 99,9% per culpa de l'arrodoniment (fes servir el mètode del residu més gran).

G-3 — KPIs (Overview, stat tiles, no és una gràfica):
- Patrimoni net, variació 30 dies (positive/negative + signe, mai només color) i deute viu.
- Component `ledge-stat-tile` a la lib, amb estat buit (sense xifres).
- La variació es calcula amb subtractDecimal (no amb floats).

Comú:
- Tot es mostra a /dev/charts amb fixtures deterministes i el segell «Dades de prova», amb tots els estats (empty, loading, loading stale, error).
- L'Overview continua SENSE xifres (el test "shows no figures in any section" ha de seguir passant).
- Cap dependència nova si no és imprescindible. Si n'hi ha, justifica-la i fixa'n la versió.
- Abans d'acabar, fes captures (Playwright, ja instal·lat) a 1280px i 390px, revisa-les tu mateix (col·lisions d'etiquetes, desbordaments) i comprova que el build de producció no conté «Dades de prova».
- Documentació (regla de CLAUDE.md): docs/CHARTS.md (§3 contracte, §8 ✅), NEXT_STEPS.md, IMPLEMENTATION_PLAN.md i README.md.
- `npx nx run-many -t lint test build` i `npx prettier --check .` han de passar.
Branca nova des de main i PR cap a main.
~~~~

## 3f. Prompt: G-4 (saldo pendent de la hipoteca) + G-5 (capital vs interès)

Obrir una sessió nova amb el repo `ArnauM13/ledge` seleccionat i enganxar:

~~~~text
Projecte: "ledge" (repo ArnauM13/ledge). Abans de fer res, llegeix CLAUDE.md, README.md, docs/CHARTS.md i IMPLEMENTATION_PLAN.md (Fase 2, punt 4: hipoteca).
Reutilitza el que ja hi ha a libs/web/charts (line-chart, chart-frame, format) i a apps/web/src/app/charts.

Tasca: el PR 4 de docs/CHARTS.md §8, a la secció Liabilities. Si la Fase 2.4 encara no és a main, treballa amb fixtures i defineix el contracte perquè el backend el pugui complir després.

Contracte (libs/shared/types, guard i tests):
- Calendari d'amortització: una fila per mes amb data, quota, capital, interès i saldo pendent.
  - Imports com a string decimal.
  - `quality: 'MANUAL_REAL' | 'ESTIMATED'`, alineat amb la Fase 2.4.
- Fixture: sistema francès calculat amb aritmètica exacta (cèntims enters o BigInt). Cas conegut amb test: 180.000 €, 25 anys, 3% fix → la quota mensual ha de coincidir amb la fórmula fins al cèntim.

G-4 — Saldo pendent:
- `ledge-line-chart` existent, una sèrie.
- El tram passat `MANUAL_REAL` va continu i el futur `ESTIMATED` discontinu.
- Afegeix una línia vertical «avui» (hairline, color content-subtle, amb etiqueta). Si cal, amplia la lib amb una API genèrica de "marcadors" i testeja-la.

G-5 — Quota anual: capital vs interès:
- Gràfica SEPARADA de G-4 (un sol eix Y per gràfica; mai doble eix).
- Columnes apilades per any: capital (slot 1) i interès (slot 2).
  - Columnes de ≤ 24px, extrem superior arrodonit a 4px i quadrat a la base, separació de 2px.
  - Tooltip per columna, llegenda i vista de taula.
- Nou component `ledge-stacked-columns` a la lib, amb geometria pura testejada.
- Els anys parcials (el primer i l'últim) s'indiquen a l'eix o a la taula.

Comú: el mateix que la §3e.
- Galeria /dev/charts amb «Dades de prova» i tots els estats.
- La pàgina Liabilities continua sense xifres fins que hi hagi l'endpoint.
- Captures a 1280px i 390px revisades.
- Res de «Dades de prova» al build de producció.
- Documentació actualitzada.
- lint, test, build i prettier en verd.
Branca nova des de main i PR cap a main.
~~~~

---

## 3g. Prompt: canvis de disseny (PR 1–3)

~~~~text
Projecte: "ledge" (repo ArnauM13/ledge). Llegeix CLAUDE.md, docs/README.md, docs/ANALYSIS.md §4 i docs/DESIGN_CHANGES.md abans de fer res.
Obre al navegador (Playwright) docs/design/login.html i docs/design/overview.html: són les referències visuals.

Tasca: els PR 1, 2 i 3 de docs/DESIGN_CHANGES.md §5, un PR per punt, en aquest ordre.
- PR 1: tokens (DC-1), focus (DC-2), lletra i escala (DC-4). Valors exactes a docs/design/reference.css. Justifica i fixa la versió de qualsevol dependència (p. ex. @fontsource-variable/inter).
- PR 2: idioma (DC-3) i pantalles d'accés (DC-5). Idioma segons D6: [català | anglès].
- PR 3: shell (DC-6 a DC-9) i estat buit guiat (DC-10). Cap xifra inventada fora de /dev.
Per a cada PR: tests dels components afectats, captures abans/després (Playwright) a la descripció, documentació actualitzada (regla de CLAUDE.md),
`npx nx run-many -t lint test build` i `npx prettier --check .` en verd.
Branca nova des de main per a cada PR.
~~~~

---

## 3h. Prompt: Fase 2, domini financer

~~~~text
Projecte: "ledge" (repo ArnauM13/ledge). Llegeix CLAUDE.md, docs/README.md, IMPLEMENTATION_PLAN.md (Fase 2), INTEGRATION_FEASIBILITY.md §8–9, docs/CHARTS.md §3 i docs/DESIGN_CHANGES.md DC-11 abans de fer res.

Decisions de l'usuari: D1 = [manual | ...], D2 = [manual | ...].

Tasca: Fase 2 de IMPLEMENTATION_PLAN.md, un PR per punt (1–6).
- Imports en NUMERIC/Decimal i com a string decimal al JSON; moneda original; snapshots immutables.
- Taules noves a HOUSEHOLD_SCOPED_MODELS (el test ho comprova). Camps sensibles xifrats amb EncryptionService.
- Cada valor porta el seu origen (AUTOMATIC | MANUAL | ESTIMATED) per al xip DC-11.
- Hipoteca: calendari francès, estat ESTIMATED / MANUAL_REAL.
- Patrimoni net conjunt i per membre, amb el test de la Fase 2 (130.000 € · A 70.000 € · B 60.000 €).
- Endpoint GET /api/households/:id/net-worth?range=1A amb el contracte NetWorthSeries de docs/CHARTS.md.
- Actualitza la documentació (regla de CLAUDE.md). Lint, test, build, test-integration i prettier en verd.
Branca nova des de main per a cada PR. Pregunta abans de qualsevol decisió que no surti als documents.
~~~~

---

## 4. Com interpretar els resultats dels spikes

| Què diu l'informe | Gate | Conseqüència |
|---|---|---|
| `eb-connect-A`: ≥1 compte, i `eb-fetch-A`: saldos i moviments sense errors | **G1 = GO** | L'adapter de BBVA es pot fer a la Fase 3 |
| `eb-connect-B` / `eb-fetch-B`: retorna els comptes del membre B | **G2 = GO** | Els dos membres sincronitzen automàticament |
| Membre B: `Comptes a la sessió: 0` | **G2 = NO-GO** (de moment) | Comptes de B manuals fins que Enable Banking respongui l'Annex A |
| `ASPSP_RATE_LIMIT_EXCEEDED` | Ni GO ni NO-GO | Espera ≥ 6 h i torna a fer només `eb:fetch` |
| `eb-aspsps`: MyInvestor / Trade Republic = NO | — | El seu cash també serà manual (D1) |
| `Dies d'historial` i `Consentiment vàlid fins a` | — | Fixen quant historial s'importa i cada quan cal reconnectar (alerta 14 dies abans) |
| `binance`: **Aturat** per permisos | Ni GO ni NO-GO | La clau té algun permís que no és de lectura. Crea'n una de nova només amb "Enable Reading" i torna-ho a provar |
| `binance`: tots els endpoints amb HTTP 200 | **G3 = GO** | L'informe diu quins productes tenen saldo; l'adapter només n'inclourà aquests |
| `binance`: algun endpoint amb error (p. ex. `-2015`) | Pendent | Revisa la restricció d'IP i els permisos; l'error exacte surt a l'informe |
| `wallets`: BTC i EVM ✅ | **G4 = GO** | — |
| `wallets`: `Free API access is not supported for this chain` | G4 parcial | Aquella cadena no és al pla gratuït d'Etherscan: o es treu, o es busca una altra font |

---

## 5. Prompt: sessió per actualitzar la viabilitat amb els resultats

~~~~text
Projecte "ledge" (repo ArnauM13/ledge). He executat els spikes de la Fase 0 a la meva màquina.
Et passo els informes anonimitzats (spikes/output/*.report.md) a continuació.

Tasca:
1. Llegeix INTEGRATION_FEASIBILITY.md, IMPLEMENTATION_PLAN.md, NEXT_STEPS.md (§4) i spikes/README.md.
2. Amb els informes, decideix els gates G1–G4 (GO / NO-GO / pendent) i justifica-ho amb dades dels informes.
3. Actualitza INTEGRATION_FEASIBILITY.md: veredictes de BBVA, Enable Banking, Binance i wallets, `maximum_consent_validity` real,
   profunditat de l'historial, cobertura de MyInvestor i Trade Republic, productes de Binance amb dades,
   cadenes EVM disponibles, i elimina el que ja no sigui "no verificat".
4. Actualitza l'estat i la checklist de NEXT_STEPS.md.
5. No inventis res que no surti als informes. Si un informe té un error, digues què vol dir i què cal tornar a provar.
Treballa en una branca nova i obre un PR cap a main.

[enganxa aquí els informes]
~~~~

---

## 6. Fases següents: què et tocarà fer a tu

| Fase | Què fa Claude | Què fas tu |
|---|---|---|
| **0 — Spikes** | Escriure els scripts (EB ✅, Binance ✅, wallets ✅) | Executar-los, revisar i passar els `*.report.md` |
| **1 — Infraestructura** (§3c) | Monorepo, Docker, `/health` ✅ · gitleaks, Prisma, auth amb 2FA, aïllament de household, xifratge ✅ · CI i Vercel | Revisar i fusionar els PR. Instal·lar gitleaks. Al final de la fase: decidir D4 (domini) i D5 (VPS), i connectar Vercel a GitHub |
| **2 — Domini financer** | Model de dades financer, ownerships, entrades manuals, hipoteca, patrimoni net | Decidir D1 i D2. Preparar les dades manuals inicials (posicions de MyInvestor/TR, NAV, hipoteca, immobles) |
| **3 — Integracions** | Un adapter per a cada gate en GO | Desplegar el backend amb domini HTTPS i canviar la Redirect URL de l'app de producció a `https://<domini>/...`. Posar els secrets al servidor (mai al repo) |
| **4 — Sync i operació** | Sync nocturna, alertes de consentiment | Reconnectar BBVA quan caduqui el consentiment (cada ~90–180 dies, segons l'informe) |

---

## 7. Regles que no canvien

- Cap secret al xat, al repo ni als logs. Els secrets van en fitxers (`secrets/`, Compose secrets), no en variables d'entorn.
- Cada PR actualitza la documentació afectada. Quin document mana per a cada cosa: `docs/README.md`. Regla a `CLAUDE.md`.
- Cap integració es declara funcional sense una prova real.
- Res de scraping, APIs no oficials ni dades fictícies presentades com a reals.
- Cap servei de pagament sense aprovació explícita.
- Treballar en branques; un PR per tasca.
- Una sola sessió de Claude per carpeta alhora (p. ex. `spikes/`). Dues sessions sobre el mateix codi acaben en PR duplicades i force-pushes creuats.
- Esborrar la branca quan se'n fusiona o es tanca la PR.
