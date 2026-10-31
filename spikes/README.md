# spikes/ — Proves reals de la Fase 0

Scripts que **executes tu, a la teva màquina, amb els teus secrets**, per tancar els gates de `IMPLEMENTATION_PLAN.md`.
Tots són **read-only**: no fan pagaments, transferències ni cap operació d'escriptura al banc.

| Spike | Gate | Estat |
|---|---|---|
| `enable-banking/` | G1 (membre A), G2 (membre B) | ✅ Escrit, **no s'ha executat mai contra l'API real amb credencials** |
| `binance/` | G3 | ⏳ Pendent |
| `wallets/` | G4 | ⏳ Pendent |

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

## 7. Desenvolupament

```bash
npm test
```

```bash
npm run typecheck
```

Els tests cobreixen les parts sense xarxa: el JWT (header, claims, signatura i TTL màxim de 24 h), l'anonimització, el parseig de la redirect URL i el càlcul de `valid_until`.

Referència de l'API: https://enablebanking.com/docs/api/reference (endpoints verificats el 31/10/2026).
