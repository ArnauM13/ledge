# spikes/ — Proves reals de la Fase 0

Scripts que **executes tu, a la teva màquina, amb els teus secrets**, per tancar els gates de `IMPLEMENTATION_PLAN.md`.
Tots són **read-only**: no fan pagaments, transferències ni cap operació d'escriptura al banc.

| Spike | Gate | Estat |
|---|---|---|
| `enable-banking/` | G1 (membre A), G2 (membre B) | ✅ Escrit, **no s'ha executat mai contra l'API real amb credencials** |
| `binance/` | G3 | ✅ Escrit, **no s'ha executat mai contra l'API real amb credencials** |
| `wallets/` | G4 | ✅ Escrit, **no s'ha executat mai contra l'API real amb credencials** |

---

## 1. Prerequisits

- Node **20.12 o més nou**. Comprova-ho amb `node -v`.
- Una app d'Enable Banking registrada (guia a `NEXT_STEPS.md` §1). Necessites:
  - El fitxer `<APP_ID>.pem` (la clau privada).
  - La Redirect URL que vas registrar (per defecte, `https://localhost:3000/callback`).

Dependències (només de desenvolupament):

| Paquet | Per què |
|---|---|
| `tsx` | Executa TypeScript directament, sense compilar |
| `typescript` | Comprovació de tipus (`npm run typecheck`) |
| `@types/node` | Tipus de Node |

La resta és Node natiu: `fetch`, `node:crypto` (JWT RS256), `node:readline` i `node:test`.

## 2. Configuració (un sol cop)

```bash
cd spikes
npm install
cp .env.example .env
```

Edita `.env`:

```dotenv
EB_APP_ID=a1b2c3d4-...                         # el nom del .pem, sense ".pem"
EB_PRIVATE_KEY_PATH=~/.secrets/ledge/a1b2c3d4-....pem
EB_REDIRECT_URL=https://localhost:3000/callback  # igual que a l'app
```

Si la clau és dins del repo, el script s'atura: mou-la a una carpeta de fora.
`.env`, `output/` i `*.pem` són al `.gitignore`.

**Sandbox o producció?** Depèn de l'app (`EB_APP_ID`), no del script.
- Amb l'app de **sandbox** veus bancs de prova. Serveix per assajar el flux.
- Amb l'app de **producció** llegeixes el BBVA real. És la que tanca els gates.

## 3. Execució pas a pas

### Pas 1 — Quins bancs hi ha?
```bash
npm run eb:aspsps
```
Mira si a Espanya hi ha BBVA, MyInvestor i Trade Republic, i amb quina validesa màxima de consentiment.
→ Fitxer per compartir: `output/eb-aspsps-ES.report.md`

### Pas 2 — Connectar el membre A (gate G1)
```bash
npm run eb:connect -- --aspsp BBVA --member A
```
1. El script imprimeix una URL. Obre-la al navegador.
2. Entra al BBVA i confirma al mòbil.
3. El navegador va a `https://localhost:3000/callback?...` i mostra un error de connexió. **És normal.**
4. Copia l'URL **completa** de la barra d'adreces, enganxa-la a la terminal i prem Enter. Fes-ho de seguida, perquè el codi caduca en pocs minuts.

Si `BBVA` no és el nom exacte, el script t'ensenya els noms semblants. Fes servir el que surti, entre cometes: `--aspsp "Nom exacte"`.

→ La sessió es desa a `output/eb-session-A.json`. **No la comparteixis.**
→ Fitxer per compartir: `output/eb-connect-A.report.md`

### Pas 3 — Llegir saldos i moviments del membre A
```bash
npm run eb:fetch -- --member A
```
Fes-ho just després del pas 2, **i només un cop**. Molts bancs permeten només 4 consultes al dia sense l'usuari present, i `strategy=longest` pot gastar-ne alguna de més.
→ Fitxer per compartir: `output/eb-fetch-A.report.md`

### Pas 4 — Membre B (gate G2)
Els passos 2 i 3, però amb `--member B`. **Ha de ser el membre B qui faci la SCA amb el seu usuari del BBVA.**

```bash
npm run eb:connect -- --aspsp BBVA --member B
```

```bash
npm run eb:fetch -- --member B
```

La pregunta clau és què retorna l'API per al membre B: els seus comptes o `Comptes a la sessió: 0`.

### Pas 5 (opcional) — Tancar sessions
```bash
npm run eb:close -- --member A
```
Tanca la sessió a Enable Banking (i el consentiment al banc, si es pot) i esborra el fitxer local.

## 3b. Binance (gate G3)

### Crear la clau
1. *Account → API Management → Create API* (clau HMAC generada pel sistema).
2. Permisos: **només "Enable Reading"**. Res de Spot/Margin trading, Withdrawals, Internal/Universal Transfer, Futures ni Options.
3. **Restringeix l'accés a IPs de confiança** i hi poses la teva IP pública actual (més endavant, la del VPS).
4. Posa `BINANCE_API_KEY` i `BINANCE_API_SECRET` al `.env`.

### Executar
```bash
npm run binance
```
L'ordre és `GET /api/v3/time` i després **`GET /sapi/v1/account/apiRestrictions`, que és obligatori**. Si la clau té qualsevol permís que no sigui de lectura, el script **s'atura** abans de fer cap altra crida. També s'atura davant d'un camp de permís desconegut que valgui `true` (*default deny*). Si la clau no té restricció d'IP, avisa.

Després consulta, en aquest ordre:
- el compte spot;
- `getUserAsset`;
- la funding wallet;
- el saldo per wallet;
- Simple Earn flexible i locked;
- els dipòsits i les retirades dels darrers 90 dies.

Pes documentat total: ≈ IP 389 + UID 18000, molt per sota dels límits. Amb `429` o `418`, s'atura i informa del `Retry-After`, sense reintentar.

→ Fitxer per compartir: `output/binance-<data>.report.md`. Indica quins endpoints retornen dades, quins productes tenen saldo (sense imports), el pes consumit i els errors.

## 3c. Wallets (gate G4)

### Clau d'Etherscan
Crea un compte a <https://etherscan.io>, ves a *API Dashboard* i afegeix una clau del pla gratuït. Posa-la a `ETHERSCAN_API_KEY`. Una sola clau serveix per a totes les cadenes de l'API V2 (`chainid`), però el pla gratuït només en cobreix algunes ("selected chains"). L'informe dirà quines fallen.

### Executar
Omple `BTC_ADDRESSES`, `EVM_ADDRESSES` i `EVM_CHAINS` al `.env` i executa:
```bash
npm run wallets
```
- Abans de fer cap crida, valida totes les adreces: checksum Base58Check, bech32/bech32m i EIP-55.
- Rebutja seed phrases, claus privades (hex, WIF, xprv, PEM) i xpub, i no les repeteix mai per pantalla.
- BTC: `GET https://mempool.space/api/address/{addr}`, amb 1 s entre crides.
- EVM: Etherscan V2 `balancemulti` (fins a 20 adreces per crida), amb 400 ms entre crides (el límit gratuït és de 3 per segon).

→ Fitxer per compartir: `output/wallets-<data>.report.md`. Inclou si cada consulta ha funcionat, la latència i les capçaleres de rate limit. **Sense saldos.**

Abans de desar-se, els informes de Binance i wallets passen un control automàtic. Si hi detecta un secret conegut, un IBAN sencer, un valor hex de 64 caràcters, un JWT o una clau PEM, no es desa.

## 4. Opcions

| Script | Opció | Per defecte | Què fa |
|---|---|---|---|
| `eb:aspsps` | `--country` | `ES` | País |
| `eb:connect` | `--aspsp` | — (obligatori) | Nom exacte del banc |
| | `--member` | `A` | Etiqueta de la sessió (A, B…) |
| | `--psu-type` | `personal` | `personal` o `business` |
| | `--days` | màxim del banc | Dies de consentiment |
| `eb:fetch` | `--member` | `A` | Quina sessió llegir |
| | `--date-from` | — | Data mínima `AAAA-MM-DD` |
| | `--max-pages` | `50` | Límit de pàgines per compte |
| | `--no-transactions` | — | Només saldos |

**Capçaleres PSU (experimental):** si poses la teva IP pública a `EB_PSU_IP_ADDRESS`, `eb:fetch` envia les capçaleres `Psu-Ip-Address` i `Psu-User-Agent`. La documentació d'Enable Banking les accepta, però **no diu** si eviten el límit de 4 consultes al dia. Fes-les servir només si el banc retorna `PSU_HEADER_NOT_PROVIDED`.

## 5. Errors habituals

| Missatge | Què fer |
|---|---|
| `Falta la variable d'entorn …` | Omple el `.env` |
| `HTTP 403 Application does not exist` / `HTTP 401` | `EB_APP_ID` incorrecte, o la clau no és d'aquesta app |
| `ASPSP_RATE_LIMIT_EXCEEDED` / `HTTP 429` | El script s'atura. **Espera com a mínim 6 h** abans de tornar-ho a provar |
| `EXPIRED_SESSION`, `CLOSED_SESSION`, `REVOKED_SESSION` | Torna a fer `eb:connect` |
| `EXPIRED_AUTHORIZATION_CODE` | Has trigat massa a enganxar l'URL. Torna a fer `eb:connect` |
| `state no coincideix` | Has enganxat una URL d'un intent anterior |
| La redirect URL no s'accepta a l'app | Registra una URL del teu domini i posa-la a `EB_REDIRECT_URL` |

El script no reintenta mai automàticament.

## 6. Què compartir (i què no)

| Fitxer | Compartir? |
|---|---|
| `output/*.report.md` | ✅ Sí, **després de revisar-lo**: IBAN emmascarats, sense imports, noms ni IDs de sessió |
| `output/*.raw.json` | ❌ No. Té dades completes |
| `output/eb-session-*.json` | ❌ No. Dona accés a les dades fins que caduca |
| `.env`, `*.pem` | ❌ Mai |

Els informes de Binance i wallets inclouen la data i hora al nom (`binance-AAAAMMDD-HHMMSS.report.md`).

## 7. Desenvolupament

```bash
npm test
```

```bash
npm run typecheck
```

Els tests cobreixen les parts sense xarxa:
- el JWT (header, claims, signatura i TTL màxim de 24 h);
- l'anonimització;
- el parseig de la redirect URL i el càlcul de `valid_until`;
- la signatura HMAC-SHA256 de Binance (vectors de l'RFC 4231) i la política de permisos;
- el control dels informes compartibles;
- la validació d'adreces BTC/EVM i la detecció de secrets.

Referències verificades el 31/10/2026 (cada endpoint porta l'URL de la seva documentació en un comentari):
- Enable Banking: https://enablebanking.com/docs/api/reference
- Binance:
  - signatura i `/api/v3/account`: https://developers.binance.com/docs/binance-spot-api-docs/rest-api
  - Wallet i Simple Earn: OpenAPI oficial https://github.com/binance/binance-api-swagger/blob/master/spot_api.yaml (les pàgines web es generen amb JS i no s'han pogut llegir)
- mempool.space: https://mempool.space/docs/api/rest
- Etherscan V2: https://docs.etherscan.io/

Diferències respecte a `INTEGRATION_FEASIBILITY.md`:
- `GET /sapi/v1/asset/wallet/balance` pesa **60** (IP). Simple Earn flexible i locked pesen **150** cadascun. `withdraw/history` pesa **UID 18000** i admet com a màxim 10 peticions per segon.
- Els historials de dipòsits i retirades tenen una finestra màxima de **90 dies** per consulta.
- El change log de Binance esmenta camps de permís de la FIX API sense nom confirmat. Per això el control de permisos és *default deny*.
- Etherscan: el pla gratuït només cobreix algunes cadenes ("selected chains only") i no s'ha pogut llegir la llista. Avui (31/10/2026) deixa de donar suport a ApeChain i Blast, i a partir del 3/11/2026 canvia la gestió del límit diari.
- mempool.space aplica rate limit (HTTP 429), però no en publica xifres ni capçaleres.
