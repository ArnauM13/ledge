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
| Codi de l'app (monorepo) | Encara no n'hi ha |
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
- Sessió de la Fase 1 (prompt de la §3). No depèn dels gates.
- Claus de Binance (només "Enable Reading" i restricció d'IP) i d'Etherscan → `spikes/README.md` §8.1 i §9.1.
- Executar els spikes de Binance i wallets:
  ```bash
  cd spikes
  npm run bn:check        # comprova que la clau sigui de només lectura
  npm run bn:fetch        # G3
  npm run wallets:fetch   # G4
  ```
  Comparteix només `output/bn-check.report.md`, `output/bn-fetch.report.md` i `output/wallets-fetch.report.md` (revisats).

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
1. [x] **Sessió de spikes** → prompt a la §2. Enable Banking ✅ (`spikes/enable-banking`), Binance ✅ (`spikes/binance`) i wallets ✅ (`spikes/wallets`). Escrits, no executats.
2. [ ] **Sessió de la Fase 1** → prompt a la §3. Es pot obrir en paral·lel; no es trepitgen.

### D. Executar els spikes (vosaltres, a la vostra màquina) → instruccions a `spikes/README.md`
- [ ] `npm run eb:aspsps` → hi ha MyInvestor i Trade Republic?
- [ ] `npm run eb:connect -- --aspsp BBVA --member A` + `npm run eb:fetch -- --member A` → **G1**
- [ ] `npm run eb:connect -- --aspsp BBVA --member B` + `npm run eb:fetch -- --member B` → **G2**
- [ ] `npm run bn:check` → la clau és de només lectura i té restricció d'IP?
- [ ] `npm run bn:fetch` → **G3**
- [ ] `npm run wallets:fetch` amb una adreça BTC i una ETH reals → **G4**
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

> **Actualització 31/10/2026:** els tres spikes ja estan escrits (`spikes/enable-banking`, `spikes/binance`, `spikes/wallets`), amb el codi comú a `spikes/lib/`. Aquest prompt es conserva com a referència; no cal tornar-lo a fer servir.

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

## 3. Prompt: sessió de la Fase 1

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

## 4. Com interpretar els resultats d'Enable Banking

| Què diu l'informe | Gate | Conseqüència |
|---|---|---|
| `eb-connect-A`: ≥1 compte, i `eb-fetch-A`: saldos i moviments sense errors | **G1 = GO** | L'adapter de BBVA es pot fer a la Fase 3 |
| `eb-connect-B` / `eb-fetch-B`: retorna els comptes del membre B | **G2 = GO** | Els dos membres sincronitzen automàticament |
| Membre B: `Comptes a la sessió: 0` | **G2 = NO-GO** (de moment) | Comptes de B manuals fins que Enable Banking respongui l'Annex A |
| `ASPSP_RATE_LIMIT_EXCEEDED` | Ni GO ni NO-GO | Espera ≥ 6 h i torna a fer només `eb:fetch` |
| `eb-aspsps`: MyInvestor / Trade Republic = NO | — | El seu cash també serà manual (D1) |
| `Dies d'historial` i `Consentiment vàlid fins a` | — | Fixen quant historial s'importa i cada quan cal reconnectar (alerta 14 dies abans) |

## 4b. Com interpretar els resultats de Binance i wallets

| Què diu l'informe | Gate | Conseqüència |
|---|---|---|
| `bn-check`: `només lectura ✅` i restricció d'IP `sí` | — | La clau es pot fer servir per a `bn:fetch` |
| `bn-check`: `NO segura ⛔` | — | Treu els permisos que surten a l'informe (o crea una clau nova) i torna a provar |
| `bn-fetch`: els endpoints dels productes que feu servir retornen `Dades: sí` | **G3 = GO** | L'adapter de Binance es pot fer a la Fase 3 |
| `bn-fetch`: un producte amb saldo que cap endpoint cobreix (p. ex. una wallet amb `Saldo > 0` a la taula de wallets sense endpoint propi) | G3 = GO parcial | Aquell producte serà manual, o caldrà un endpoint més a la Fase 3 |
| `code -2015` | Ni GO ni NO-GO | Revisa la restricció d'IP de la clau i torna a provar |
| `wallets-fetch`: BTC i la cadena 1 amb `OK = sí` | **G4 = GO** | Adapters de BTC i ETH a la Fase 3 |
| `wallets-fetch`: `Free API access is not supported for this chain` | — | Aquella cadena necessita un pla de pagament d'Etherscan o un altre proveïdor |

---

## 5. Prompt: sessió per actualitzar la viabilitat amb els resultats

~~~~text
Projecte "ledge" (repo ArnauM13/ledge). He executat els spikes (Enable Banking, Binance i/o wallets) a la meva màquina.
Et passo els informes anonimitzats (spikes/output/*.report.md) a continuació.

Tasca:
1. Llegeix INTEGRATION_FEASIBILITY.md, IMPLEMENTATION_PLAN.md, NEXT_STEPS.md (§4 i §4b) i spikes/README.md.
2. Amb els informes, decideix els gates G1–G4 que corresponguin (GO / NO-GO / pendent) i justifica-ho amb dades dels informes.
3. Actualitza INTEGRATION_FEASIBILITY.md: veredictes de BBVA i Enable Banking, `maximum_consent_validity` real,
   profunditat de l'historial, cobertura de MyInvestor i Trade Republic, endpoints i productes de Binance (§6),
   wallets (§7), i elimina el que ja no sigui "no verificat".
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
| **1 — Scaffold** (§3) | Monorepo Nx, Angular, NestJS, Docker, `/health` | Revisar i fusionar el PR. Al final de la fase: decidir D4 (domini) i D5 (VPS), i connectar Vercel a GitHub |
| **2 — Domini financer** | Model de dades, Prisma, auth, entrades manuals | Decidir D1 i D2. Preparar les dades manuals inicials (posicions de MyInvestor/TR, NAV, hipoteca, immobles) |
| **3 — Integracions** | Un adapter per a cada gate en GO | Desplegar el backend amb domini HTTPS i canviar la Redirect URL de l'app de producció a `https://<domini>/...`. Posar els secrets al servidor (mai al repo) |
| **4 — Sync i operació** | Sync nocturna, alertes de consentiment | Reconnectar BBVA quan caduqui el consentiment (cada ~90–180 dies, segons l'informe) |

---

## 7. Regles que no canvien

- Cap secret al xat, al repo ni als logs.
- Cap integració es declara funcional sense una prova real.
- Res de scraping, APIs no oficials ni dades fictícies presentades com a reals.
- Cap servei de pagament sense aprovació explícita.
- Treballar en branques; un PR per tasca.
