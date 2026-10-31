# spikes/ — Proves reals de la Fase 0

Scripts que **executes tu, a la teva màquina, amb els teus secrets**, per tancar els gates de `IMPLEMENTATION_PLAN.md`.
Tots són **read-only**: no fan pagaments, transferències, ordres ni cap operació d'escriptura.

| Spike | Gate | Estat |
|---|---|---|
| `enable-banking/` | G1 (membre A), G2 (membre B) | ✅ Escrit, **no s'ha executat mai contra l'API real amb credencials** |
| `binance/` | G3 | ✅ Escrit, **no s'ha executat mai contra l'API real amb credencials** → §8 |
| `wallets/` | G4 | ✅ Escrit, **no s'ha executat mai contra l'API real** → §9 |

Codi comú a `lib/`: anonimització (`anonymize.ts`), informes (`report.ts`), `.env` (`env.ts`) i CLI (`cli.ts`).

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

La resta és Node natiu: `fetch`, `node:crypto` (JWT RS256, HMAC-SHA256, SHA-256), `node:readline` i `node:test`.
Cap dependència nova per a Binance ni wallets. El checksum EIP-55 necessita Keccak-256, que `node:crypto` no té (el seu `sha3-256` és una altra funció), per això hi ha una implementació mínima a `wallets/lib/keccak.ts`, comprovada als tests contra el `sha3-256` de Node i els vectors de l'EIP-55.

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

Per spike:

| Spike | Compartir | No compartir |
|---|---|---|
| Enable Banking | `eb-aspsps-ES.report.md`, `eb-connect-*.report.md`, `eb-fetch-*.report.md` | `eb-*.raw.json`, `eb-session-*.json` |
| Binance | `bn-check.report.md`, `bn-fetch.report.md` | `bn-*.raw.json` (saldos i historial complets) |
| Wallets | `wallets-fetch.report.md` | `wallets-fetch.raw.json` (adreces i saldos complets) |

## 7. Desenvolupament

```bash
npm test
```

```bash
npm run typecheck
```

Els tests no fan cap crida de xarxa (on cal, `fetch` se substitueix per una funció falsa). Cobreixen:
- **Enable Banking:** el JWT (header, claims, signatura i TTL màxim de 24 h), el parseig de la redirect URL i el càlcul de `valid_until`.
- **Binance:** la signatura HMAC-SHA256 amb els vectors de la documentació oficial, la detecció de permisos perillosos (fail-closed), la llista blanca d'endpoints, l'aturada amb 429/418/-2015 i la divisió de l'historial en finestres de < 90 dies.
- **Wallets:** Keccak-256, EIP-55, adreces BTC (base58check, bech32, bech32m, testnet, xpub), detecció de seeds i claus privades (i que el missatge d'error no les reprodueix mai).
- **Comú:** l'anonimització (IBAN, UUID, imports, adreces cripto).

Referències (verificades el 31/10/2026):
- Enable Banking: https://enablebanking.com/docs/api/reference
- Binance: https://developers.binance.com/docs/wallet (cada endpoint té la URL exacta a `binance/lib/endpoints.ts`)
- mempool.space: https://mempool.space/docs/api/rest
- Etherscan V2: https://docs.etherscan.io/

---

## 8. Binance (gate G3)

### 8.1 Crear la clau (només lectura)
1. Binance → **Account → API Management → Create API** → *System generated* (HMAC). Posa-li un nom, p. ex. `ledge-spike-readonly`.
2. Fes la verificació de seguretat (2FA).
3. A **Edit restrictions**:
   - ✅ **Enable Reading** (ve marcat per defecte).
   - ❌ Qualsevol altra opció desmarcada: trading spot i margin, retirades, transferències (internes i universals), margin, futures, opcions, portfolio margin, FIX trading… (els noms exactes de la pantalla poden variar; si en dubtes, desmarca-la: `bn:check` et dirà quins permisos queden actius).
   - **IP access restrictions → Restrict access to trusted IPs only**, i hi poses la IP pública de la màquina on executaràs el spike (la pots mirar a https://api.ipify.org). Quan hi hagi VPS, la clau definitiva anirà restringida a la IP del VPS.
4. Copia l'**API Key** i el **Secret Key** directament al `.env` (el secret només es mostra un cop) i desa'ls també al gestor de contrasenyes:
   ```dotenv
   BINANCE_API_KEY=...
   BINANCE_API_SECRET=...
   ```

Si la clau té **qualsevol** permís que no sigui de lectura, el spike s'atura a la primera crida i no en fa cap altra.

### 8.2 Executar
```bash
npm run bn:check
```
Només crida `GET /sapi/v1/account/apiRestrictions` (pes 1) i diu si la clau és segura i si té restricció d'IP.
→ Fitxer per compartir: `output/bn-check.report.md`

```bash
npm run bn:fetch
```
Torna a comprovar els permisos i, si són de només lectura, llegeix en sèrie: compte spot, `getUserAsset`, funding wallet, saldo per wallet, Simple Earn (flexible i locked) i historial de dipòsits i retirades dels últims 89 dies (una sola crida a cada historial).
→ Fitxer per compartir: `output/bn-fetch.report.md`

Opció: `--history-days N` (1–365, per defecte 89). Binance exigeix intervals de menys de 90 dies, així que cada 89 dies són una crida més a cada historial. Atenció: `withdraw/history` té un pes documentat de **18.000 (UID)** per crida, sobre un límit de 180.000 per minut.

### 8.3 Límits i aturades
- Pes documentat d'una execució de `bn:fetch` per defecte: **388 d'IP** (repartit entre endpoints, cadascun amb un límit propi de 12.000/min a `/sapi`, i 6.000/min compartit a `/api`) + **18.000 d'UID** (`withdraw/history`). Una pàgina més de Simple Earn suma 150.
- El script llegeix `X-SAPI-USED-IP-WEIGHT-1M`, `X-SAPI-USED-UID-WEIGHT-1M` i `X-MBX-USED-WEIGHT-1M` i s'atura si alguna passa del 50 % del límit.
- S'atura immediatament amb **429**, **418** (IP bandejada) o errors de clau/rellotge (`-1002`, `-1021`, `-1022`, `-2014`, `-2015`). No reintenta mai.

| Error | Què fer |
|---|---|
| `code -2015` | Clau, IP o permisos invàlids. Normalment, la IP actual no és a la llista de la clau |
| `code -1021` | El rellotge del sistema va desfasat. Sincronitza'l, o puja `BINANCE_RECV_WINDOW` (màx. 60000) |
| `code -1022` | `BINANCE_API_SECRET` incorrecte |
| `HTTP 429` | Límit de pes. Espera el `Retry-After` que indica l'informe |
| `HTTP 418` | IP bandejada temporalment. **No tornis a provar** fins passat el `Retry-After` |
| `⛔ CLAU NO SEGURA` | Treu els permisos que diu l'informe, o crea una clau nova només amb lectura |

---

## 9. Wallets (gate G4)

### 9.1 Clau d'Etherscan (gratuïta)
1. Crea un compte a https://etherscan.io/register i confirma el correu.
2. **API Dashboard → Add** (https://etherscan.io/apidashboard). Posa-li un nom (`ledge-spike`).
3. Copia la clau al `.env` com a `ETHERSCAN_API_KEY`. Amb l'API V2, la mateixa clau serveix per a totes les cadenes (`chainid`).

El pla gratuït és de 3 crides/s i 100.000 al dia, i **només inclou algunes cadenes** (llista a https://docs.etherscan.io/supported-chains). Si una cadena no hi és, l'informe mostrarà l'error `Free API access is not supported for this chain`. Això també és un resultat útil per al gate.

### 9.2 Configurar les adreces
```dotenv
BTC_ADDRESSES=bc1q...,3...        # adreces públiques individuals de mainnet
EVM_ADDRESSES=0x...,0x...         # 0x + 40 hex
EVM_CHAINS=1,8453,42161           # Ethereum, Base, Arbitrum (per defecte: 1)
ETHERSCAN_API_KEY=...
```

- **Només adreces públiques.** Si un valor sembla una seed phrase (12–24 paraules) o una clau privada (64 hex, WIF o xprv), el spike s'atura **sense mostrar-la ni desar-la**. Esborra-la del `.env`.
- En aquest spike **no s'accepten xpub/zpub**: posa'n adreces individuals (les trobaràs a la teva wallet, a *Receive*).
- Es valida el format i el checksum de cada adreça (base58check, bech32/bech32m i EIP-55 si té majúscules i minúscules) abans de fer cap crida.
- Màxim 20 adreces de cada tipus i 10 cadenes.

### 9.3 Executar
```bash
npm run wallets:fetch
```
- BTC: una crida a `mempool.space/api/address/{addr}` per adreça, a 1 crida/s.
- EVM: una crida a `balancemulti` d'Etherscan V2 per cadena (fins a 20 adreces per crida), a ≤ 3 crides/s.
- S'atura amb un 429 o un error de límit d'Etherscan.

→ Fitxer per compartir: `output/wallets-fetch.report.md` (adreces emmascarades, p. ex. `bc1q…a1b2`; latència, HTTP i capçaleres de rate limit; **sense saldos**).
