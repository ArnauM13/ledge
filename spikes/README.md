# spikes/ — Fase 0 (gates G1–G4)

Scripts de prova **read-only** per verificar les integracions abans d'escriure-les de debò.
Els executes **tu, a la teva màquina, amb els teus secrets**. Ningú més els ha executat:
fins que no hi hagi un informe generat per tu, **cap integració està verificada**.

| Gate | Script | Què demostra |
|---|---|---|
| G1 | `eb:aspsps`, `eb:connect`, `eb:fetch` | BBVA via Enable Banking: consentiment, saldos, historial |
| G2 | `eb:connect` + `eb:fetch` amb `--member B` | El segon titular obté els seus comptes (o una llista buida) |
| G3 | `binance` | Quins endpoints/productes de Binance retornen dades amb una clau read-only |
| G4 | `wallets` | Consultes d'adreces BTC (mempool.space) i EVM (Etherscan V2) |

## Prerequisits

- Node **≥ 20.12** (fa servir `fetch`, `node:crypto`, `node:test` i `process.loadEnvFile` natius).
- `cd spikes && npm ci`
- `cp .env.example .env` i omple'l (vegeu a sota). `.env` i `output/` són al `.gitignore`.

### Dependències (totes de desenvolupament; zero dependències en temps d'execució)

| Paquet | Per què |
|---|---|
| `tsx` | Executar TypeScript directament, sense pas de build. |
| `typescript` | `npm run typecheck` (`tsc --noEmit`, mode `strict`). |
| `@types/node` | Tipus de les APIs natives de Node. |

JWT RS256, HMAC-SHA256, Base58Check, bech32/bech32m i Keccak-256 (EIP-55) s'implementen amb `node:crypto`
i codi propi testejat, per no afegir llibreries que manegin secrets.

## Credencials

### Enable Banking (G1, G2)

Documentació: <https://enablebanking.com/docs/api/quick-start>, <https://enablebanking.com/docs/api/linked-accounts>

1. Crea un compte al Control Panel d'Enable Banking i registra una aplicació d'entorn **PRODUCTION**.
2. Genera la clau **fora del repo** i un certificat autosignat per pujar-lo:
   ```bash
   mkdir -p ~/.secrets/ledge && chmod 700 ~/.secrets/ledge
   ```
   ```bash
   openssl genrsa -out ~/.secrets/ledge/enablebanking-private.pem 4096
   ```
   ```bash
   openssl req -new -x509 -days 365 -key ~/.secrets/ledge/enablebanking-private.pem -out ~/.secrets/ledge/enablebanking-cert.pem -subj "/CN=ledge-household"
   ```
   Puja el **certificat** (`.pem` públic) a l'app. L'Application ID que et retorna va a `EB_APP_ID`.
   (Si el Control Panel ofereix generar la clau al navegador, també serveix: desa la privada fora del repo.)
3. Registra una **URL de redirecció HTTPS** i posa-la a `EB_REDIRECT_URL`. No cal que hi hagi res servint-la:
   després de la SCA només has de copiar l'URL de la barra d'adreces.
4. L'app queda *Inactive*. Fes servir **"Activate by linking accounts"** per vincular els teus comptes:
   passa a mode **restringit**, on només es retornen dades de comptes vinculats.

### Binance (G3)

1. *Account → API Management → Create API* (clau HMAC generada pel sistema).
2. Permisos: **només "Enable Reading"**. Res de Spot/Margin trading, Withdrawals, Internal/Universal Transfer, Futures, Options…
3. **Restringeix l'accés a IPs de confiança** i posa-hi la teva IP pública actual (la del VPS més endavant).
4. `BINANCE_API_KEY` i `BINANCE_API_SECRET` al `.env`. El script **s'atura** si la clau té qualsevol permís que no sigui de lectura, i avisa si no té restricció d'IP.

### Etherscan (G4)

1. Crea un compte a <https://etherscan.io> → *API Dashboard* → *Add* una clau (pla gratuït).
2. Posa-la a `ETHERSCAN_API_KEY`. Una sola clau serveix per a totes les cadenes de l'API V2 (`chainid`),
   però el pla gratuït cobreix només "selected chains": l'informe dirà quines fallen.

## Execució

```bash
npm test
```

### G1 — Enable Banking (membre A)

```bash
npm run eb:aspsps
```
Informe: si hi són BBVA, MyInvestor i Trade Republic, tipus de PSU, `maximum_consent_validity` (segons → dies), mètodes d'autenticació, `required_psu_headers`, beta, BIC. Opcional: `-- --country ES,DE` (Trade Republic pot aparèixer sota DE).

```bash
npm run eb:connect -- --aspsp BBVA --member A
```
Demana confirmació, imprimeix l'URL de consentiment, fas la SCA al navegador i enganxes l'URL de redirecció **completa**.
Crea la sessió i la desa a `output/eb-session-A.json` (git-ignored). Opcional: `--days N` (mai supera el màxim del banc).

```bash
npm run eb:fetch -- --member A
```
**Executa'l just després de connectar**: molts bancs només donen l'historial complet durant ~1 h després de la SCA.
Per defecte demana `strategy=longest` (l'historial més llarg que permeti el banc); alternativa: `-- --date-from 2024-01-01`.

### G2 — membre B

El membre B, amb **el seu** usuari del banc:
```bash
npm run eb:connect -- --aspsp BBVA --member B
```
```bash
npm run eb:fetch -- --member B
```
L'informe diu explícitament si l'API retorna comptes o **una llista buida** (comptes no vinculats a l'app restringida).
Si cal, el membre B ha de vincular els seus comptes amb "Activate by linking accounts" a la mateixa app.

### Tancar una sessió (opcional)
```bash
npm run eb:close -- --member A
```
Fa `DELETE /sessions/{id}` i esborra `output/eb-session-A.json`. Útil abans de reconnectar (Redsys = 1 sessió activa).

### G3 — Binance

```bash
npm run binance
```
Ordre: `GET /api/v3/time` → **`GET /sapi/v1/account/apiRestrictions` (obligatori)** → compte spot, `getUserAsset`,
funding, saldo per wallet, Simple Earn flexible i locked, dipòsits i retirades (darrers 90 dies). Pes documentat total ≈ IP 389 + UID 18000, molt per sota dels límits.

### G4 — Wallets

```bash
npm run wallets
```
Valida totes les adreces **abans** de cap crida (checksum Base58/bech32/bech32m i EIP-55). Rebutja seed phrases,
claus privades (hex, WIF, xprv, PEM) i xpub sense repetir-les mai per pantalla.

## Què compartir

Cada execució desa a `spikes/output/` (git-ignored, permisos `600`):

- `*.raw.json` — dades completes. **No el comparteixis.**
- `*.report.md` — anonimitzat: IBAN `ES12 **** **** 1234`, adreces `bc1qar…5mdq`, identificadors truncats,
  **sense imports, noms ni adreces completes**. **Aquest és el que s'ha de compartir.**

Abans de desar-lo, l'informe passa un control automàtic que n'atura l'escriptura si hi detecta un secret conegut,
un IBAN sencer, un valor hex de 64 caràcters, un JWT o una clau PEM. Igualment, **llegeix-lo abans d'enviar-lo**.

Fitxers a compartir: `eb-aspsps-*.report.md`, `eb-connect-{A,B}-*.report.md`, `eb-fetch-{A,B}-*.report.md`,
`binance-*.report.md`, `wallets-*.report.md`.

## Límits i seguretat

- **Tot és read-only.** No s'usa cap endpoint de pagaments, ordres, transferències, retirades ni subscripcions.
- **Enable Banking / Redsys:** una sola sessió d'autenticació activa per usuari i TPP; una nova SCA invalida l'anterior.
  No repeteixis `eb:connect` sense necessitat.
- **4 consultes/dia sense PSU:** `eb:fetch` porta un registre local i es nega a una 5a execució en 24 h per membre
  (excepte `--force`). Mai reintenta crides a l'ASPSP.
- `429` / `ASPSP_RATE_LIMIT_EXCEEDED` → s'atura tot i recomana esperar ≥ 6 h.
  `EXPIRED_SESSION`, `CLOSED_SESSION`, `REVOKED_SESSION`, `SESSION_DOES_NOT_EXIST` → s'atura i demana reconnectar.
- **Binance:** `429`/`418` → s'atura i informa del `Retry-After`, sense reintents.
- Cap script imprimeix claus, secrets, JWT, signatures ni URLs amb `apikey`.

## Verificació documental (31/10/2026)

Cada endpoint té l'URL de la seva documentació en un comentari al codi. Resultat i diferències trobades:

| Àmbit | Font | Estat |
|---|---|---|
| EB JWT (`typ/alg/kid`, `iss=enablebanking.com`, `aud=api.enablebanking.com`, TTL ≤ 86400 s) | [API reference](https://enablebanking.com/docs/api/reference) | Verificat |
| EB `GET /aspsps`, `POST /auth`, `POST /sessions`, `GET /sessions/{id}`, `GET /accounts/{id}/balances`, `GET /accounts/{id}/transactions` | [API reference](https://enablebanking.com/docs/api/reference) | Verificat |
| EB codis d'error (`ASPSP_RATE_LIMIT_EXCEEDED`, `EXPIRED_SESSION`, …) | [API reference](https://enablebanking.com/docs/api/reference) | Verificat (camp `error`) |
| Binance signatura, `/api/v3/account`, `/api/v3/time`, capçaleres de pes | [Spot REST API](https://developers.binance.com/docs/binance-spot-api-docs/rest-api), [Wallet general info](https://developers.binance.com/en/docs/products/wallet/general-info.md) | Verificat |
| Binance Wallet i Simple Earn (`apiRestrictions`, `getUserAsset`, funding, wallet balance, earn, historials) | [OpenAPI oficial `binance/binance-api-swagger`](https://github.com/binance/binance-api-swagger/blob/master/spot_api.yaml) | Verificat a l'spec (les pàgines web són JS i no s'han pogut llegir) |
| mempool.space `GET /api/address/:address` | [REST docs](https://mempool.space/docs/api/rest) | Verificat |
| Etherscan V2 `balancemulti`, `chainlist`, límits, errors | [docs.etherscan.io](https://docs.etherscan.io/) | Verificat |

Diferències o punts oberts respecte a `INTEGRATION_FEASIBILITY.md`:

- **EB:** `maximum_consent_validity` ve en **segons** (l'informe ho converteix a dies).
  `POST /sessions` retorna objectes de compte complets; `GET /sessions/{id}` només `uid`s. Les consultes fan servir el `uid`, no l'IBAN.
- **EB:** la doc **no** associa cada codi d'error a un HTTP concret; el script es basa en el camp `error` (i tracta qualsevol `429` com a límit).
- **EB:** el significat exacte de `strategy=longest` s'ha llegit d'un resum de la pàgina; cal confirmar-ho amb l'execució real (o usar `--date-from`).
- **EB:** la pàgina del mercat ES no esmenta ni el límit de 4 consultes/dia ni la profunditat d'historial: aquests valors venen de l'estudi previ.
- **Binance:** `GET /sapi/v1/asset/wallet/balance` pesa **60** (IP); Simple Earn flexible/locked **150** cadascun; `withdraw/history` **UID 18000** i màxim 10 req/s.
  Historials: finestra màxima de **90 dies** per consulta. El change log esmenta camps de permís FIX API sense nom confirmat: el control de permisos és *default deny*.
- **Etherscan:** el pla gratuït cobreix "selected chains only" i no s'ha pogut llegir la taula de quines; avui (31/10/2026) es deixen de suportar ApeChain i Blast.
  A partir del 3/11/2026 canvia la gestió del límit diari.
- **mempool.space:** aplica rate limit (HTTP 429) però no en publica xifres ni capçaleres.
