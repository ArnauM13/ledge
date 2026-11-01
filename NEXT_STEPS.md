# NEXT_STEPS.md — Què falta

> Actualitzat l'01/11/2026. Només el que **queda per fer**, en ordre.
> Què sabem (estat, decisions, entorn): [`docs/CONTEXT.md`](docs/CONTEXT.md). Índex: [`docs/README.md`](docs/README.md).
> Guies dels passos manuals: [`docs/MANUAL_SETUP.md`](docs/MANUAL_SETUP.md). Prompts de sessions fetes: [`docs/archive/SESSION_PROMPTS.md`](docs/archive/SESSION_PROMPTS.md).

## Estat

| Element | Estat |
|---|---|
| Fase 0 · spikes (`enable-banking`, `binance`, `wallets`) | **Escrits; cap executat amb credencials reals**. Gates G1–G4 pendents |
| Fase 1 · punts 0–7 | ✅ A `main` (PR #6 i #8). Login amb TOTP provat al navegador l'01/11 |
| Fase 1 · punt 8 (CI) | ✅ `.github/workflows/ci.yml` (prettier, lint, test, build, test-integration). Falta fer-lo obligatori a GitHub (§1) |
| Fase 1 · punt 9 (Vercel) | Pendent (§2.1). Depèn de D4, D5 i del compte de Vercel |
| Gràfiques | Disseny ✅, lib + G-1 ✅ (PR #10 i #11), només a `/dev/charts`. Següent: G-2/G-3 i G-4/G-5 |
| Disseny de la UI | Revisió amb skills ✅ (PR #12). Proposta a `docs/DESIGN_CHANGES.md`, **no implementada**. Pendent D6 |
| Fase 2 · domini financer | No començada. No depèn de cap gate |
| Documentació i skills | ✅ Centralitzada (PR #12). Hook `SessionStart` que instal·la les skills a cada sessió al núvol, a partir del PR que l’afegeix (`docs/SKILLS.md`) |

---

## 1. El que has de fer tu

En aquest ordre. Cada pas enllaça la seva guia.

1. **Esborrar les branques ja fusionades** (les sessions de Claude no poden: el proxy de git respon 403). Des de GitHub → *Branches*, o:
   ```bash
   git push origin --delete docs/charts-design docs/next-steps feat/charts-net-worth feat/phase1-auth-security petja/awesome-dijkstra-kcamhb petja/eager-bohr-i0juf8 petja/sharp-shannon-relsdl
   ```
2. **Fer obligatori el CI** a `main` (ruleset amb els 3 checks) → `docs/MANUAL_SETUP.md` §3, primer paràgraf.
3. **Veure la web en local**: crear els dos usuaris, donar d'alta el TOTP i **desar els codis de recuperació** → `docs/MANUAL_SETUP.md` §1.
4. **Decisions** → `docs/CONTEXT.md` §3:
   - [ ] **D1** Posicions de MyInvestor / Trade Republic manuals? *(recomanat: sí)*
   - [ ] **D2** NAV dels fons manual? *(recomanat: sí, a l'MVP)*
   - [ ] **D4** Domini *(necessari per a Vercel, l'API i la redirecció d'Enable Banking)*
   - [ ] **D5** VPS *(recomanat: Hetzner, ~4–7 €/mes)*
   - [ ] **D6** Idioma de la UI *(recomanat: català, `docs/DESIGN_CHANGES.md` §0)*
5. **Comptes i credencials**:
   - [x] Enable Banking: compte creat
   - [ ] Enable Banking: app de producció activada amb el membre A → `docs/MANUAL_SETUP.md` §5
   - [ ] Enviar l'Annex A de `INTEGRATION_FEASIBILITY.md` a `support.api@enablebanking.com`
   - [ ] Binance: API key amb **només "Enable Reading"** i restricció d'IP (`spikes/README.md` §3b)
   - [ ] Etherscan: API key gratuïta (`spikes/README.md` §3c)
   - [ ] Gestor de contrasenyes compartit (`.pem`, claus, codis de recuperació)
   - [ ] gitleaks 8.30.1 instal·lat (`README.md` → Secrets al repo)
   - [ ] Vercel: compte connectat a GitHub (Fase 1, punt 9)
6. **Executar els spikes** a la teva màquina → `spikes/README.md`:
   - [ ] `npm run eb:aspsps` → hi ha MyInvestor i Trade Republic?
   - [ ] `npm run eb:connect -- --aspsp BBVA --member A` + `npm run eb:fetch -- --member A` → **G1**
   - [ ] El mateix amb `--member B` → **G2**
   - [ ] `npm run binance` → **G3**
   - [ ] `npm run wallets` amb una adreça BTC i una ETH reals → **G4**
   - [ ] Passar els `spikes/output/*.report.md`, **revisats**, a una sessió nova amb el prompt de la §5 (mai els `.raw.json` ni `eb-session-*.json`)

## 2. Sessions de Claude Code

Cada sessió nova: el hook instal·la les skills sol, i el prompt diu què llegir primer (`CLAUDE.md` → `docs/CONTEXT.md`). Un PR per tasca, sempre amb base `main`.

| # | Sessió | Prompt | Depèn de |
|---|---|---|---|
| 1 | Disseny, PR 1–3 de `docs/DESIGN_CHANGES.md` §5 | §2.4 | D6 (només el PR 2) |
| 2 | G-2 + G-3 (distribució i KPI) | §2.2 | — |
| 3 | G-4 + G-5 (hipoteca) | §2.3 | — (amb fixtures) |
| 4 | Fase 2: domini financer | §2.5 | D1, D2 |
| 5 | Fase 1, punt 9: Vercel + API desplegada | §2.1 | D4, D5, Vercel |
| 6 | Connectar G-1…G-5 a l'API | — | Fase 2 |
| 7 | Viabilitat amb els informes dels spikes | §5 | Spikes executats |
| 8 | Fase 3: adapters dels gates en GO | — | 5, 7 |

### 2.1 Prompt: Fase 1, punt 9 (Vercel)

Cal haver decidit **D4** (domini) i **D5** (VPS) i tenir el compte de Vercel connectat a GitHub (`docs/MANUAL_SETUP.md` §3). El CI (punt 8) ja és a `ci.yml`.

Obrir una sessió nova amb el repo `ArnauM13/ledge` seleccionat i enganxar:

~~~~text
Projecte: "ledge", un dashboard patrimonial privat per a una household de dues persones. Repo: ArnauM13/ledge.

## Context
Abans de fer res, llegeix del repo: CLAUDE.md, docs/CONTEXT.md, docs/README.md (índex), README.md (sobretot Autenticació, CSRF i CI), IMPLEMENTATION_PLAN.md (Fase 1), NEXT_STEPS.md i docs/MANUAL_SETUP.md §3.

Fase 1, punts 0–8, ja és a main: monorepo Nx (Angular 21 + NestJS 11 + Prisma 7), auth amb TOTP i cookie `__Host-ledge_session` SameSite=Strict, CSRF, aïllament de household, xifratge, gitleaks (`secrets.yml`) i CI (`ci.yml`: prettier, lint, test, build i test-integration). spikes/ és un paquet independent: no el toquis.

## Tasca d'aquesta sessió: Fase 1, punt 9
Domini (D4): [omple]. VPS (D5): [omple]. Projecte de Vercel: [omple].

- Projecte de Vercel connectat al repo que construeixi `apps/web` (`npx nx build web`, sortida `dist/apps/web/browser`), amb fallback SPA.
- La cookie és SameSite=Strict: web i API han de ser el mateix site. Proposa com fer-ho (rewrite de `/api/*` de Vercel cap a l'API del VPS, o subdominis del domini de D4) i pregunta abans de decidir. Recorda `WEB_ORIGINS` i `API_TRUST_PROXY` (`.env.example`).
- Capçaleres de seguretat a la web (CSP estricta, `frame-ancestors`, `Referrer-Policy`, HSTS).
- Definition of Done de la Fase 1: els dos usuaris fan login amb 2FA i veuen un Overview buit a la URL pública. Si l'API encara no està desplegada, digues-ho clarament: no ho donis per fet.

## Requisits
- Actualitza la documentació (regla de CLAUDE.md).
- `npx nx run-many -t lint test build`, `npx prettier --check .` i el CI en verd abans d'acabar.
- Justifica cada dependència nova i fixa'n la versió.

## Forma de treballar
- Branca nova des de main i PR cap a main.
- Si cal una decisió que no surt als documents, pregunta-ho abans de decidir.
- Al final, resumeix què has fet, què has verificat (amb la sortida) i què queda pendent.
~~~~

### 2.2 Prompt: G-2 (distribució per classe d'actiu) + G-3 (KPIs)

Obrir una sessió nova amb el repo `ArnauM13/ledge` seleccionat i enganxar:

~~~~text
Projecte: "ledge" (repo ArnauM13/ledge). Abans de fer res, llegeix CLAUDE.md, docs/CONTEXT.md, docs/SKILLS.md, README.md i docs/CHARTS.md (amb els ajustos de docs/DESIGN_CHANGES.md DC-13) (sobretot §1, §2, §4–§8).
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

### 2.3 Prompt: G-4 (saldo pendent de la hipoteca) + G-5 (capital vs interès)

Obrir una sessió nova amb el repo `ArnauM13/ledge` seleccionat i enganxar:

~~~~text
Projecte: "ledge" (repo ArnauM13/ledge). Abans de fer res, llegeix CLAUDE.md, docs/CONTEXT.md, docs/SKILLS.md, README.md, docs/CHARTS.md i IMPLEMENTATION_PLAN.md (Fase 2, punt 4: hipoteca).
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

Comú: el mateix que la §2.2.
- Galeria /dev/charts amb «Dades de prova» i tots els estats.
- La pàgina Liabilities continua sense xifres fins que hi hagi l'endpoint.
- Captures a 1280px i 390px revisades.
- Res de «Dades de prova» al build de producció.
- Documentació actualitzada.
- lint, test, build i prettier en verd.
Branca nova des de main i PR cap a main.
~~~~

### 2.4 Prompt: canvis de disseny (PR 1–3)

~~~~text
Projecte: "ledge" (repo ArnauM13/ledge). Llegeix CLAUDE.md, docs/CONTEXT.md, docs/SKILLS.md, docs/ANALYSIS.md §4 i docs/DESIGN_CHANGES.md abans de fer res.
Obre al navegador (playwright-cli) docs/design/login.html, overview-empty.html i overview.html: són les referències visuals.
Fes servir les skills design-taste-frontend (references/app-screens.md; `lint.mjs --app` i `inspect.mjs --app`), web-design-guidelines i playwright-cli. Les instal·la el hook SessionStart del repo (docs/SKILLS.md §2); si no hi són, atura't i digues-ho.

Tasca: els PR 1, 2 i 3 de docs/DESIGN_CHANGES.md §5, un PR per punt, en aquest ordre.
- PR 1: tokens (DC-1), focus (DC-2), lletra i escala (DC-4). Valors exactes a docs/design/reference.css. Justifica i fixa la versió de qualsevol dependència (p. ex. @fontsource-variable/inter).
- PR 2: idioma (DC-3) i pantalles d'accés (DC-5). Idioma segons D6: [català | anglès].
- PR 3: shell (DC-6 a DC-9, amb la barra lateral plegada per sota de 1100 px) i primer ús (DC-10). Cap xifra inventada fora de /dev.
Per a cada PR: tests dels components afectats, `inspect.mjs --app` amb 0 FAIL a 1440/768/390, captures abans/després a la descripció, documentació actualitzada (regla de CLAUDE.md),
`npx nx run-many -t lint test build` i `npx prettier --check .` en verd.
Branca nova des de main per a cada PR.
~~~~

### 2.5 Prompt: Fase 2, domini financer

~~~~text
Projecte: "ledge" (repo ArnauM13/ledge). Llegeix CLAUDE.md, docs/CONTEXT.md, docs/README.md, IMPLEMENTATION_PLAN.md (Fase 2), INTEGRATION_FEASIBILITY.md §8–9, docs/CHARTS.md §3 i docs/DESIGN_CHANGES.md DC-11 abans de fer res.

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

## 3. Deute tècnic conegut

No són de la Fase 1 però convé no perdre'ls:

- **Rotació de la clau mestra**: el format ja porta la versió i l'API accepta claus antigues (`LEDGE_MASTER_KEY_PREVIOUS_FILES`), però falta el job que torna a xifrar els valors antics.
- **Rols de BD separats**: ara l'API i les migracions fan servir el mateix usuari de Postgres. Un rol per a l'API sense `TRUNCATE` ni permís per desactivar triggers reforçaria `audit_logs`.
- **TOTP perdut + codis de recuperació perduts**: no hi ha procediment. Caldria una ordre del CLI per reiniciar el 2FA d'un usuari (amb auditoria).
- **Neteja de sessions caducades**: les files de `sessions` revocades o caducades no s'esborren (no afecta la seguretat, només l'espai).
- **Capçaleres de seguretat de l'API** (helmet o equivalent): no afegides.
- **Build de Docker darrere d'un proxy TLS**: `docker compose build` no passa el secret `npm_ca`; cal `docker build` a mà (`README.md`).

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
1. Llegeix CLAUDE.md, docs/CONTEXT.md, INTEGRATION_FEASIBILITY.md, IMPLEMENTATION_PLAN.md, NEXT_STEPS.md (§4) i spikes/README.md.
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
| **1 — Infraestructura** (§2.1) | Monorepo, Docker, `/health` ✅ · gitleaks, Prisma, auth amb 2FA, aïllament de household, xifratge, CI ✅ · Vercel | Revisar i fusionar els PR. Instal·lar gitleaks. Al final de la fase: decidir D4 (domini) i D5 (VPS), i connectar Vercel a GitHub |
| **2 — Domini financer** | Model de dades financer, ownerships, entrades manuals, hipoteca, patrimoni net | Decidir D1 i D2. Preparar les dades manuals inicials (posicions de MyInvestor/TR, NAV, hipoteca, immobles) |
| **3 — Integracions** | Un adapter per a cada gate en GO | Desplegar el backend amb domini HTTPS i canviar la Redirect URL de l'app de producció a `https://<domini>/...`. Posar els secrets al servidor (mai al repo) |
| **4 — Sync i operació** | Sync nocturna, alertes de consentiment | Reconnectar BBVA quan caduqui el consentiment (cada ~90–180 dies, segons l'informe) |
