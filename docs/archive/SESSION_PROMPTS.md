# Prompts de sessions ja fetes (arxiu)

> Mogut des de `NEXT_STEPS.md` l'01/11/2026 per deixar-hi només el que queda per fer.
> **No els tornis a fer servir.** Es conserven com a referència del que es va demanar a cada sessió.

| Prompt                                                       | Resultat                                                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Spikes de la Fase 0                                          | PR #2 i #4 (a `main`)                                                                     |
| Fase 1, punts 1–3                                            | PR #6                                                                                     |
| Fase 1, punts 0 i 4–7                                        | PR #8                                                                                     |
| Lib de gràfiques + G-1                                       | PR #10 i #11 (el #10 es va fusionar a `docs/charts-design`; el #11 el va portar a `main`) |
| Revisió de l'estat i del disseny, documentació centralitzada | PR #12 (sense prompt: petició directa)                                                    |

---

## 2. Prompt: sessió de spikes

> **Actualització 31/10/2026:** els tres spikes ja són a `main` (`spikes/enable-banking`, `spikes/binance`, `spikes/wallets`, amb codi comú a `spikes/shared/`). Aquest prompt es conserva només com a referència: **no el tornis a fer servir**.

Obrir una sessió nova amb el repo `ArnauM13/ledge` seleccionat i enganxar:

```text
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
```

---

## 3. Prompt: sessió de la Fase 1, punts 1–3 (✅ fet, PR #6)

Obrir una sessió nova amb el repo `ArnauM13/ledge` seleccionat i enganxar:

```text
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
```

---

## 3b. Prompt: sessió de la Fase 1, punts 4–7 + gitleaks (✅ fet)

> Fet el 01/11/2026 a la branca `feat/phase1-auth-security`. Es conserva com a referència: **no el tornis a fer servir**.

Obrir una sessió nova amb el repo `ArnauM13/ledge` seleccionat i enganxar:

```text
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
```

Per què gitleaks va primer: protegeix els commits de Prisma i auth, que és on és més fàcil que s'escoli un secret. El workflow només fa gitleaks; el CI complet continua sent el punt 8.

---

## 3d. Prompt: lib de gràfiques + G-1

Obrir una sessió nova amb el repo `ArnauM13/ledge` seleccionat i enganxar:

```text
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
```
