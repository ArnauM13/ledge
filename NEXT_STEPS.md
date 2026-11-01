# NEXT_STEPS.md — Full de ruta per reprendre el projecte

> Creat el 31/10/2026. Recull tot el que cal fer a partir d'ara, en ordre.
> Documents relacionats: `INTEGRATION_FEASIBILITY.md` (viabilitat) · `IMPLEMENTATION_PLAN.md` (fases).

## Estat actual

| Element | Estat |
|---|---|
| Repo `ArnauM13/ledge` | Creat, amb els documents de la Fase 0 |
| Estudi de viabilitat | Fet (recerca documental, **sense proves reals**) |
| Pla d'implementació | Fet |
| Compte d'Enable Banking | Registrat (31/10/2026) |
| Spike d'Enable Banking (`spikes/enable-banking`) | **Escrit i testejat en local; no s'ha executat mai amb credencials reals** |
| Spike de Binance (`spikes/binance`) | **Escrit i testejat en local; no s'ha executat mai amb credencials reals** |
| Spike de wallets (`spikes/wallets`) | **Escrit i testejat en local; no s'ha executat mai contra l'API real** |
| Codi de l'app (monorepo) | Fase 1 punts 1–3 a `main` (PR #6): Nx + Angular 21 + NestJS + Tailwind `t-` + Docker Compose amb secrets en fitxers (veure `README.md`) |
| Fase 1 punts 4–7 + gitleaks | **Fet** a la branca `feat/phase1-auth-security` (PR pendent de revisar): gitleaks, Prisma, auth amb TOTP, aïllament de household i xifratge (veure `README.md`) |
| Fase 1 punts 8–9 (CI + Vercel) | Pendent. Prompt a la §3c. El punt 9 depèn de D4, D5 i del compte de Vercel |
| Gràfiques | Disseny fet a `docs/CHARTS.md` (catàleg G-1…G-9, contracte de dades, paleta validada). Següent: lib `libs/web/charts` + G-1 (§3d) |
| Gates G1–G4 (proves reals) | Pendents |

---

## 0. Què has de fer ara (resum ràpid)

**Avui (Enable Banking, ~30 min):**
1. Comprova que tens l'app de **producció** en estat *Active (restricted)*, amb els comptes del membre A vinculats (§1.3).
2. Mou el `.pem` fora del repo, a `~/.secrets/ledge/`, i desa'n una còpia al gestor de contrasenyes (§1.4).
3. Envia la consulta de l'Annex A de `INTEGRATION_FEASIBILITY.md` a `support.api@enablebanking.com`.
4. Executa l'spike seguint `spikes/README.md`:
   ```bash
   cd spikes && npm install && cp .env.example .env   # i omple el .env
   npm run eb:aspsps
   npm run eb:connect -- --aspsp BBVA --member A
   npm run eb:fetch -- --member A
   ```
5. Quan el membre B estigui disponible, fes el mateix amb `--member B`.
6. Obre una sessió nova i passa-hi els `spikes/output/*.report.md`, **revisats abans** (mai els `.raw.json` ni `eb-session-*.json`), amb el prompt de la §5.

**En paral·lel:**
- Revisar i fusionar el PR de la Fase 1, punts 4–7 (branca `feat/phase1-auth-security`).
- Instal·lar `gitleaks` 8.30.1 a la vostra màquina (`README.md` → "Secrets al repo"). Sense ell, el hook de pre-commit bloqueja els commits. Després, `npm install` al repo per activar el hook.
- Provar el login en local (`README.md` → "Arrencar en local"): crear els dos usuaris amb `create-user`, donar d'alta el TOTP i **desar els codis de recuperació** al gestor de contrasenyes.
- Decidir **D4** (domini) i **D5** (VPS) i crear el compte de Vercel: el punt 9 (§3c) no es pot acabar sense.
- Sessió de la Fase 1, punts 8–9 (prompt de la §3c). El CI (punt 8) no depèn de res.
- Claus de Binance (només "Enable Reading" i restricció d'IP) i d'Etherscan → `spikes/README.md` §3b i §3c.
- Executa els spikes de Binance i wallets (omple abans `BINANCE_*`, `BTC_ADDRESSES`, `EVM_ADDRESSES`, `EVM_CHAINS` i `ETHERSCAN_API_KEY` al `.env`):
  ```bash
  cd spikes
  npm run binance   # G3: primer comprova que la clau sigui de només lectura; si no, s'atura
  npm run wallets   # G4
  ```
  Comparteix només els `output/binance-*.report.md` i `output/wallets-*.report.md`, revisats.

---

## Checklist (en aquest ordre)

### A. Decisions (vosaltres)
- [ ] **D1** — Posicions de MyInvestor / Trade Republic manuals? *(recomanat: sí)*
- [ ] **D2** — NAV dels fons manual? *(recomanat: sí, a l'MVP)*
- [ ] **D4** — Domini (necessari per a l'API i la redirecció d'Enable Banking a producció)
- [ ] **D5** — Proveïdor de VPS *(recomanat: Hetzner, ~4–7 €/mes)*

### B. Comptes i credencials (vosaltres)
- [x] Enable Banking: compte creat
- [ ] Enable Banking: app de sandbox + app de producció activada amb el membre A → guia a la §1
- [ ] Enviar la consulta de l'Annex A de `INTEGRATION_FEASIBILITY.md` a `support.api@enablebanking.com`
- [ ] Binance: API key amb **només "Enable Reading"** i restricció d'IP
- [ ] Etherscan: API key gratuïta
- [ ] Gestor de contrasenyes compartit (per als `.pem` i les claus)
- [ ] Vercel: compte connectat a GitHub (no cal fins a la Fase 1, punt 9)

### C. Sessions de Claude Code (en aquest ordre)
1. [x] **Sessió de spikes** → fet. Enable Banking (`spikes/enable-banking`), Binance (`spikes/binance`) i wallets (`spikes/wallets`) són a `main`. Estan escrits però no executats.
2. [x] **Sessió de la Fase 1, punts 1–3** → prompt a la §3. Fusionat (PR #6).
3. [x] **Fase 1, punts 4–7 + gitleaks** → prompt a la §3b. Fet (branca `feat/phase1-auth-security`, PR pendent de fusionar).
4. [ ] **Fase 1, punts 8–9** → prompt a la §3c: CI (GitHub Actions) i Vercel (requereix D4, D5 i el compte de Vercel).
5. [x] **Disseny de gràfiques** → `docs/CHARTS.md`.
6. [ ] **Lib de gràfiques + G-1 (evolució del patrimoni net)** → prompt a la §3d. No depèn dels gates.

### D. Executar els spikes (vosaltres, a la vostra màquina) → instruccions a `spikes/README.md`
- [ ] `npm run eb:aspsps` → hi ha MyInvestor i Trade Republic?
- [ ] `npm run eb:connect -- --aspsp BBVA --member A` + `npm run eb:fetch -- --member A` → **G1**
- [ ] `npm run eb:connect -- --aspsp BBVA --member B` + `npm run eb:fetch -- --member B` → **G2**
- [ ] `npm run binance` → **G3** (la clau ha de ser de només lectura i tenir restricció d'IP)
- [ ] `npm run wallets` amb una adreça BTC i una ETH reals → **G4**
- [ ] Passar els fitxers `*.report.md` (anonimitzats) a una sessió per actualitzar `INTEGRATION_FEASIBILITY.md`

### E. Després dels gates
- Fase 2 (domini financer): es pot fer sense esperar els gates.
- Fase 3 (integracions): cada adapter només quan el seu gate sigui GO.

**Per què aquest ordre:** els spikes són el que pot canviar l'abast del projecte, i tenen esperes externes (resposta d'Enable Banking, SCA de tots dos). El monorepo serà igual passi el que passi.

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

## 2. Prompt: sessió de spikes

> **Actualització 31/10/2026:** els tres spikes ja són a `main` (`spikes/enable-banking`, `spikes/binance`, `spikes/wallets`, amb codi comú a `spikes/shared/`). Aquest prompt es conserva només com a referència: **no el tornis a fer servir**.

Obrir una sessió nova amb el repo `ArnauM13/ledge` seleccionat i enganxar:

~~~~text
Projecte: "ledge", un dashboard patrimonial privat per a una household de dues persones. Repo: ArnauM13/ledge.

## Context
Abans de fer res, llegeix INTEGRATION_FEASIBILITY.md i IMPLEMENTATION_PLAN.md del repo, sobretot les seccions 1, 2, 6, 7 i 14 del primer i la Fase 0 del segon.

Objectiu: escriure scripts de prova (spikes) que l'usuari executarà a la SEVA màquina, amb els SEUS secrets, per tancar els gates G1–G4. Tu no tindràs credencials. No simulis respostes, no inventis dades i no declaris cap integració verificada.

## Restriccions
- Tot dins de `spikes/`, amb el seu propi package.json. No toquis la configuració arrel del repo: hi ha una altra sessió muntant el monorepo Nx.
- Node 20+ i TypeScript amb `tsx`. Fetch natiu i `node:crypto`. Mínim de dependències, i justifica cadascuna.
- Secrets només per variables d'entorn o fitxers fora del repo. Hi ha un `.env.example` i el `.env` va al `.gitignore`. No imprimeixis mai claus, tokens ni signatures.
- Tot és read-only: cap crida d'escriptura, pagament, trading ni transferència.
- Cada script desa un informe a `spikes/output/` (també al .gitignore), en dues versions:
  - `*.raw.json`: dades completes, només locals.
  - `*.report.md`: anonimitzat, amb IBAN emmascarat (`ES12 **** **** 1234`), sense imports, noms ni adreces completes. Aquest és el que l'usuari compartirà.
- Abans d'implementar cada endpoint, verifica'l a la documentació oficial i posa'n l'URL en un comentari. Si un endpoint no existeix o ha canviat, digues-ho.

## Spike 1: spikes/enable-banking (gates G1 i G2)
Documentació: https://enablebanking.com/docs/api/reference i https://enablebanking.com/docs/markets/es
- Autenticació: JWT RS256 signat amb la clau privada de l'app (`EB_PRIVATE_KEY_PATH`, `EB_APP_ID` com a `kid`). Verifica a la doc el format exacte de `iss`, `aud` i `exp`.
- `npm run eb:aspsps`: `GET /aspsps?country=ES`. Informe: BBVA, MyInvestor i Trade Republic (presents o no), tipus de PSU, `maximum_consent_validity` en dies i altres camps rellevants.
- `npm run eb:connect -- --aspsp BBVA`: `POST /auth`, imprimeix l'URL de consentiment. L'usuari fa la SCA al navegador i enganxa a la terminal l'URL de redirecció completa. El script n'extreu el `code` i fa `POST /sessions`. Desa el `session_id` a `spikes/output/` (fora del repo).
- `npm run eb:fetch`: per cada compte de la sessió, consulta saldos i moviments amb `date_from` tan antic com permeti el banc. Informe: nombre de comptes, tipus de compte, rang de dates de l'historial, tipus de saldo retornat, data `valid_until` del consentiment i errors amb el codi exacte.
- Gestiona `429 ASPSP_RATE_LIMIT_EXCEEDED` i `EXPIRED_SESSION` sense reintents agressius. Recorda: màxim 4 consultes al dia sense l'usuari present, i Redsys només permet una sessió activa per usuari.
- Prova del gate G2: el membre B executa `eb:connect` i `eb:fetch` amb els seus comptes. L'informe ha d'indicar si l'API retorna els seus comptes o una llista buida.

## Spike 2: spikes/binance (gate G3)
Documentació: https://developers.binance.com/docs/wallet
- Signatura HMAC-SHA256, `BINANCE_API_KEY` i `BINANCE_API_SECRET`.
- Primer pas obligatori: `GET /sapi/v1/account/apiRestrictions`. Si la clau té qualsevol permís que no sigui de lectura (trading, withdrawals, transferències...), el script s'ATURA amb un error clar.
- Després consulta: compte spot, `getUserAsset`, funding wallet, saldo per wallet, posicions de Simple Earn (flexible i locked), i historial de dipòsits i retirades. Respecta els pesos i els límits documentats.
- Informe: quins endpoints retornen dades, quins productes tenen saldo (sense imports), el pes total consumit i els errors.

## Spike 3: spikes/wallets (gate G4)
- BTC: mempool.space (`/api/address/{addr}`). Accepta adreces separades per comes a `BTC_ADDRESSES`. NO accepta xpub en aquest spike.
- ETH i EVM: Etherscan API V2 (`ETHERSCAN_API_KEY`, `chainid`), saldo natiu de les adreces de `EVM_ADDRESSES` a les cadenes de `EVM_CHAINS`.
- Valida el format de cada adreça. Rebutja amb un error qualsevol cosa que sembli una seed phrase o una clau privada.
- Informe: si cada consulta ha funcionat, latència i capçaleres de rate limit (sense saldos a la versió anonimitzada).

## Lliurables
- `spikes/README.md`: prerequisits, com crear cada credencial (app d'Enable Banking, clau Binance amb només "Enable Reading" i restricció d'IP, clau d'Etherscan), com executar cada script i quin fitxer cal compartir.
- Tests unitaris de les parts sense xarxa: generació del JWT, signatura de Binance, anonimització i validació d'adreces.
- Branca `feat/phase0-spikes` i PR cap a `main`.
- Al final, resumeix què has fet, què has verificat i què queda pendent. Deixa clar que els spikes NO s'han executat contra cap API real.
~~~~

---

## 3. Prompt: sessió de la Fase 1, punts 1–3 (✅ fet, PR #6)

Obrir una sessió nova amb el repo `ArnauM13/ledge` seleccionat i enganxar:

~~~~text
Projecte: "ledge", un dashboard patrimonial privat per a una household de dues persones. Repo: ArnauM13/ledge.

## Context
Abans de fer res, llegeix aquests dos documents del repo:
- INTEGRATION_FEASIBILITY.md: viabilitat de les integracions (Fase 0) i veredictes GO/NO-GO.
- IMPLEMENTATION_PLAN.md: fases, gates, repartiment de feina i ordre de treball.

Resum del que ja està decidit:
- Automàtic via APIs oficials: BBVA via Enable Banking (condicional), Binance read-only, wallets BTC/ETH/EVM, preus cripto, tipus de canvi del BCE.
- Manual o estimat: posicions de MyInvestor i Trade Republic, NAV dels fons, capital pendent de la hipoteca (estimació + saldo real manual), valor dels immobles.
- Prohibit: scraping, APIs no oficials o fetes per enginyeria inversa, dades fictícies presentades com a reals, demanar contrasenyes bancàries, secrets al frontend o als logs, contractar serveis de pagament.

## Tasca d'aquesta sessió: Fase 1, punts 1–3 de IMPLEMENTATION_PLAN.md
1. Monorepo Nx:
   - apps/web: Angular 21, standalone components, ChangeDetection OnPush, signals.
   - apps/api: NestJS.
   - libs/shared/types.
   - TypeScript strict, ESLint, Prettier.
2. Tailwind CSS amb prefix `t-` i tokens de tema fosc: fons charcoal, superfícies una mica més clares, text blanc i grisos, maragda discret per a valors positius, vermell només per a pèrdues o alertes.
3. Docker Compose local amb PostgreSQL i l'API. Sense Redis de moment. Postgres no s'exposa fora de la xarxa interna de Docker. Afegeix un `.env.example` sense cap secret real.

Requisits:
- apps/web: només un layout buit amb la navegació (Overview, Accounts, Investments, Crypto, Real Estate, Liabilities, Transactions, Analytics, Settings) i un estat buit. Cap xifra inventada.
- apps/api: un endpoint `GET /health`.
- Tests mínims que passin a les dues apps.
- Actualitza el README amb les instruccions per arrencar el projecte en local.
- `nx lint`, `nx test` i `nx build` han de passar abans d'acabar.

## Fora d'abast (no ho facis encara)
Auth, Prisma i model de dades, integracions, CI i deploy a Vercel. Van en tasques posteriors.

## Forma de treballar
- No treballis a `main`. Crea una branca `feat/phase1-scaffold` i obre un PR cap a `main`.
- Commits petits i descriptius.
- Si cal una decisió que no surt als documents, pregunta-ho abans de decidir-ho tu.
- Al final, resumeix què has fet, què has verificat (amb la sortida de lint, test i build) i què queda pendent.

Decisions encara pendents de l'usuari, que no has d'assumir: D4 (domini), D5 (proveïdor de VPS) i el compte de Vercel.
~~~~

---

## 3b. Prompt: sessió de la Fase 1, punts 4–7 + gitleaks (✅ fet)

> Fet el 01/11/2026 a la branca `feat/phase1-auth-security`. Es conserva com a referència: **no el tornis a fer servir**.

Obrir una sessió nova amb el repo `ArnauM13/ledge` seleccionat i enganxar:

~~~~text
Projecte: "ledge", un dashboard patrimonial privat per a una household de dues persones. Repo: ArnauM13/ledge.

## Context
Abans de fer res, llegeix del repo: CLAUDE.md, README.md, IMPLEMENTATION_PLAN.md (Fase 1), INTEGRATION_FEASIBILITY.md (seccions de seguretat) i NEXT_STEPS.md.

Ja és a main (Fase 1, punts 1–3):
- Monorepo Nx 24: apps/web (Angular 21, standalone, OnPush, signals, zoneless), apps/api (NestJS 11, GET /health), libs/shared/types.
- Tailwind v3 amb prefix `t-`.
- Docker Compose amb Postgres (xarxa interna, sense ports publicats) i l'API (només a 127.0.0.1).
- Secrets com a fitxers (Compose secrets a /run/secrets/*). L'API rep DB_HOST, DB_PORT, DB_USER, DB_NAME i DB_PASSWORD_FILE. Mai contrasenyes en variables d'entorn ni al .env.
- spikes/ és un paquet independent, fora del graf de Nx. No el toquis.

## Tasca d'aquesta sessió: Fase 1, punts 4–7, més detecció de secrets

0. Detecció de secrets amb gitleaks (fes-ho PRIMER, en un commit propi):
   - `.gitleaks.toml` que estengui les regles per defecte.
   - Allowlist molt acotada, només per a falsos positius verificats (p. ex. les dades de prova de spikes/test/*.test.ts que contenen '-----BEGIN PRIVATE KEY-----'). Res de patrons amplis ni carpetes senceres sense justificar-ho.
   - Hook de pre-commit que executi `gitleaks git --staged` (o l'ordre equivalent de la versió actual; verifica-la a la documentació oficial). Si gitleaks no està instal·lat, el hook ha de fallar amb un missatge que expliqui com instal·lar-lo. Mai l'ha de saltar en silenci.
   - Workflow `.github/workflows/secrets.yml` que només executi gitleaks sobre tot l'historial a cada PR i a cada push a main. Fixa la versió i verifica el checksum del binari. El CI complet (lint, test, build) és el punt 8, no el facis.
   - Escaneja tot l'historial del repo i ensenya'n el resultat. Si troba alguna cosa, atura't i explica-ho abans de continuar.
   - Documenta-ho al README (instal·lació i què fer davant un fals positiu).

4. Prisma i PostgreSQL:
   - Primera migració amb `users`, `households`, `memberships` i `audit_logs`.
   - IDs UUID, `created_at`/`updated_at` en UTC i índexs per `household_id`.
   - La URL de connexió es munta en arrencar, a partir de DB_* i del fitxer DB_PASSWORD_FILE (amb la contrasenya codificada per a URL). Mai s'escriu als logs ni als errors.
   - `audit_logs` és append-only: cap update ni delete des de l'API.

5. Auth:
   - Login individual amb contrasenya argon2id (paràmetres d'OWASP, documentats).
   - TOTP 2FA obligatori: alta amb QR i codis de recuperació (es mostren una sola vegada i es guarden amb hash).
   - Sessió en cookie HttpOnly + Secure + SameSite=Strict, amb caducitat per inactivitat i absoluta, i invalidació al logout.
   - Rate limiting i bloqueig temporal al login i al TOTP.
   - Missatges d'error genèrics (no han de revelar si l'usuari existeix).
   - Protecció CSRF per a les peticions que modifiquen dades.
   - Tot inici de sessió, fallit o correcte, va a `audit_logs` sense dades sensibles.
   - Sense registre públic: els dos usuaris es creen amb un script de seed/CLI que demana la contrasenya per stdin. Mai per argument ni per variable d'entorn.

6. Aïllament de household:
   - Guard de NestJS i un mecanisme que obligui a filtrar per `household_id` a totes les consultes de dades de negoci.
   - Test que demostri que un usuari d'una household no pot llegir ni modificar dades d'una altra (ha de retornar 404, no 403).

7. Xifratge:
   - Servei AES-256-GCM amb IV aleatori per valor, versió de clau al text xifrat (per poder rotar-la) i AAD lligada al registre.
   - Clau mestra de 32 bytes llegida d'un fitxer de secrets (p. ex. LEDGE_MASTER_KEY_FILE a /run/secrets/). Mai a la BD, al repo ni als logs.
   - L'API no arrenca si la clau falta o és invàlida.
   - Tests de xifrar i desxifrar, de text manipulat (ha de fallar) i de clau incorrecta.

Web (apps/web): pantalles de login, TOTP i alta del 2FA, i un Overview buit protegit per auth. Cap xifra inventada.

## Requisits
- Docker Compose: afegeix el secret de la clau mestra i les migracions (que es puguin executar en local).
- Actualitza .env.example (sense cap secret), secrets/README.md (com generar cada secret) i el README.
- Actualitza la documentació (regla de CLAUDE.md): estat i checklist de NEXT_STEPS.md, i IMPLEMENTATION_PLAN.md si canvia alguna decisió.
- `nx lint`, `nx test`, `nx build`, `prettier --check .` i gitleaks sobre tot l'historial han de passar abans d'acabar.
- Justifica cada dependència nova i fixa'n la versió.

## Fora d'abast
CI complet (punt 8), Vercel (punt 9), model de dades financer (Fase 2) i integracions (Fase 3).

## Forma de treballar
- Branca nova des de main i PR cap a main. Commits petits: un per punt.
- Si cal una decisió que no surt als documents (p. ex. sessions a Postgres o tokens signats, o la llibreria de TOTP), pregunta-ho abans de decidir.
- Al final, resumeix què has fet, què has verificat (amb la sortida de lint, test, build i gitleaks) i què queda pendent.

Decisions encara pendents de l'usuari, que no has d'assumir: D4 (domini), D5 (VPS) i el compte de Vercel.
~~~~

Per què gitleaks va primer: protegeix els commits de Prisma i auth, que és on és més fàcil que s'escoli un secret. El workflow només fa gitleaks; el CI complet continua sent el punt 8.

---

## 3c. Prompt: sessió de la Fase 1, punts 8–9 (CI + Vercel)

Abans d'obrir-la: fusiona el PR dels punts 4–7. Per al punt 9 cal haver decidit **D4** (domini) i **D5** (VPS) i tenir el compte de Vercel connectat a GitHub. Si encara no, la sessió fa el punt 8 i deixa el 9 preparat però sense desplegar.

Obrir una sessió nova amb el repo `ArnauM13/ledge` seleccionat i enganxar:

~~~~text
Projecte: "ledge", un dashboard patrimonial privat per a una household de dues persones. Repo: ArnauM13/ledge.

## Context
Abans de fer res, llegeix del repo: CLAUDE.md, README.md, IMPLEMENTATION_PLAN.md (Fase 1 i les decisions dels punts 4–7) i NEXT_STEPS.md.

Ja és a main (Fase 1, punts 0–7):
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

## 3d. Prompt: lib de gràfiques + G-1

Obrir una sessió nova amb el repo `ArnauM13/ledge` seleccionat i enganxar:

~~~~text
Projecte: "ledge" (repo ArnauM13/ledge). Llegeix CLAUDE.md, README.md i docs/CHARTS.md abans de fer res.

Tasca: el PR 2 de docs/CHARTS.md §8.
- Lib Angular `libs/web/charts` (`@ledge/web-charts`) amb d3-scale + d3-shape (versions fixades). d3 no toca el DOM.
- Tokens de sèrie a apps/web/src/styles.css i tailwind.config.js (§4).
- `NetWorthSeries` / `NetWorthPoint` a libs/shared/types, amb guard i tests.
- Geometria pura (escales, camins, ticks, format ca-ES) amb tests de casos coneguts.
- `ledge-line-chart` + `ledge-chart-frame`: estats empty/loading/error/ready, tooltip, teclat (← →), vista de taula, ESTIMATED discontinu.
- Galeria `/dev/charts` només amb isDevMode() i el segell «Dades de prova». L'Overview continua sense xifres.
- Actualitza la documentació (regla de CLAUDE.md).
- `npx nx run-many -t lint test build` i `npx prettier --check .` han de passar.
Branca nova des de main i PR cap a main.
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
| **1 — Infraestructura** (§3 ✅, §3b ✅, §3c) | Monorepo, Docker, `/health` ✅ · gitleaks, Prisma, auth amb 2FA, aïllament de household, xifratge ✅ · CI i Vercel | Revisar i fusionar els PR. Instal·lar gitleaks. Al final de la fase: decidir D4 (domini) i D5 (VPS), i connectar Vercel a GitHub |
| **2 — Domini financer** | Model de dades financer, ownerships, entrades manuals, hipoteca, patrimoni net | Decidir D1 i D2. Preparar les dades manuals inicials (posicions de MyInvestor/TR, NAV, hipoteca, immobles) |
| **3 — Integracions** | Un adapter per a cada gate en GO | Desplegar el backend amb domini HTTPS i canviar la Redirect URL de l'app de producció a `https://<domini>/...`. Posar els secrets al servidor (mai al repo) |
| **4 — Sync i operació** | Sync nocturna, alertes de consentiment | Reconnectar BBVA quan caduqui el consentiment (cada ~90–180 dies, segons l'informe) |

---

## 7. Regles que no canvien

- Cap secret al xat, al repo ni als logs. Els secrets van en fitxers (`secrets/`, Compose secrets), no en variables d'entorn.
- Cada PR actualitza la documentació afectada (`README.md`, `NEXT_STEPS.md`, `IMPLEMENTATION_PLAN.md`). Regla a `CLAUDE.md`.
- Cap integració es declara funcional sense una prova real.
- Res de scraping, APIs no oficials ni dades fictícies presentades com a reals.
- Cap servei de pagament sense aprovació explícita.
- Treballar en branques; un PR per tasca.
- Una sola sessió de Claude per carpeta alhora (p. ex. `spikes/`). Dues sessions sobre el mateix codi acaben en PR duplicades i force-pushes creuats.
- Esborrar la branca quan se'n fusiona o es tanca la PR.
