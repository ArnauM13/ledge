# INTEGRATION_FEASIBILITY.md — Fase 0

> Data de la recerca: 31/10/2026
> Estat: **esborrany de recerca documental**. Encara no s'ha fet cap prova amb credencials reals.
> Spikes de la Fase 0 (`spikes/`): escrits i a `main` (31/10/2026), **pendents d'executar** amb credencials reals. Les correccions documentals que han aparegut en escriure'ls són a la §15.
> Cap integració es considera "funcional" fins que no estigui verificada amb una connexió de producció.

## 0. Resum executiu

| # | Integració | Què es pot obtenir oficialment | Veredicte |
|---|---|---|---|
| 1 | BBVA (PSD2 via Enable Banking) | Comptes de pagament, saldos, moviments, titulars | **GO condicional** |
| 2 | Enable Banking (restricted mode) | Accés de producció gratuït **només a comptes vinculats** | **GO condicional** (cal confirmar el cas de 2 titulars) |
| 3 | MyInvestor — cash | Comptes de pagament via PSD2 (Redsys) | **Condicional** (cal verificar cobertura a Enable Banking) |
| 3b | MyInvestor — fons | Cap API oficial trobada | **NO-GO automàtic** → entrada manual |
| 4 | Trade Republic — cash | AIS PSD2 del compte corrent (segons el handoff) | **Condicional** (no verificat) |
| 4b | Trade Republic — accions/ETFs | Cap API oficial; només SDKs no oficials (reverse engineering, prohibits) | **NO-GO automàtic** → entrada manual |
| 5 | Binance | API oficial, clau read-only | **GO** |
| 6 | Wallets BTC / ETH / EVM | Adreces públiques via APIs públiques | **GO** |
| 7 | Hipoteca — capital pendent | PSD2 AIS no cobreix préstecs | **NO-GO automàtic** → estimació + saldo real manual |
| 7b | Hipoteca — quotes cobrades | Moviments del compte de càrrec (BBVA) | **GO condicional** (depèn de l'1) |
| 8 | Valoració d'immobles | Cap API gratuïta i fiable | **NO-GO automàtic** → manual |
| 9 | Preus cripto | Binance public ticker / CoinGecko Demo | **GO** |
| 9b | Preus fons (NAV) / ETFs | Cap font oficial gratuïta verificada | **Pendent** → manual per defecte |
| 9c | Tipus de canvi | BCE (tipus de referència, gratuït) | **GO** |

**Conclusió:** el projecte **no és completament viable** tal com està formulat si el requisit és que *totes* les posicions d'inversió s'actualitzin automàticament. Amb vies oficials i gratuïtes només s'automatitza: cash bancari (BBVA, i potser MyInvestor/Trade Republic), Binance, wallets, preus cripto i FX. Les posicions de fons i valors, el capital pendent de la hipoteca i el valor dels immobles hauran de ser **manuals o estimats**, i la UI ho ha d'etiquetar.

**Decisió que necessito de vosaltres:** acceptar aquest abast reduït (recomanat) o aturar el projecte fins que existeixi una via oficial per a les posicions.

---

## 1. BBVA — connexió dels dos titulars

**Font oficial (BBVA API Market, AIS PSD2):**
- Dades: "listado de cuentas, saldos, movimientos y titulares".
- Abast: només **comptes de pagament** de particulars i empreses. No esmenta targetes, préstecs ni valors.
- Accés a través del HUB PSD2 de Redsys, amb SCA del titular.
- Consentiment: la pàgina parla de **90 dies** i de moviments amb 6 mesos de profunditat a la primera connexió. *Nota:* la normativa europea va ampliar la reautenticació a 180 dies i Enable Banking indica 180 dies "per a la majoria d'ASPSP"; cal verificar el valor real que retorna `maximum_consent_validity` per a BBVA.

**Particularitats de Redsys (Enable Banking, mercat ES):**
- **Una sola sessió d'autenticació activa per usuari i TPP.** Una nova autenticació invalida l'anterior. Cada membre ha d'autoritzar només els seus comptes, una vegada, i no repetir-ho sense necessitat.
- BBVA: login amb usuari + contrasenya al web del banc i SCA per push. (Mai passen per la nostra app.)

**Dos titulars:**
- Tècnicament, cada membre fa el seu propi flux de consentiment. → Viable.
- **Comptes conjunts:** si tots dos són titulars del mateix compte, el compte arribarà per les dues autoritzacions → cal **deduplicar per IBAN** (clau única `household_id + iban`).
- El bloqueig és contractual, no tècnic: vegeu §2.

**Veredicte: GO condicional.** Cal (a) confirmació d'Enable Banking per al cas de 2 persones, (b) una prova real amb un compte.

## 2. Enable Banking — restricted production mode

**Què diu la documentació oficial:**
- Una aplicació de producció registrada queda "Inactive". Si hi **vincules els teus propis comptes**, passa a "Active" en mode restringit, que permet "evaluation in real-life scenarios [...] as well as **individual non-commercial use**".
- "Using restricted applications you can only fetch data from accounts linked to the application." Els comptes no vinculats s'eliminen de la resposta (llista buida).
- Una aplicació restringida permet que "you (and any user of your application)" passin per l'autorització, però només retorna els comptes vinculats.
- Els termes legals i el correu de protecció de dades **no es comproven** en aquest mode.
- La documentació **no** diu explícitament "gratuït", però el mode restringit no requereix contracte. Producció completa = contracte + KYB d'una empresa + facturació mínima mensual (preu no publicat; cal demanar pressupost a `info@enablebanking.com`).

**Pregunta oberta (bloquejant):** pot el segon membre vincular els seus propis comptes a la mateixa aplicació restringida, i això encaixa amb "individual non-commercial use"?
→ Acció: enviar consulta escrita a `support.api@enablebanking.com` (esborrany a l'Annex A). Alternativa si diuen que no: **dues aplicacions restringides**, una per membre, cadascuna amb els seus comptes (cal confirmar-ho també).

**Límits:**
- Molts ASPSP limiten a **4 consultes/dia sense el PSU present**. Amb capçaleres PSU (usuari present a la UI) aquest límit no s'aplica.
- Si arriba `429 ASPSP_RATE_LIMIT_EXCEEDED`: esperar ≥ 6 h.
- Token d'autorització: TTL màxim 24 h per a la sessió d'API.
- Historial complet només durant ~1 h després d'autoritzar; després sovint 90 dies → **fer la càrrega històrica just després de connectar**.

**Requisits tècnics:** registrar l'app, generar una clau RSA privada (es queda al backend, xifrada), URL de redirecció HTTPS.

**Veredicte: GO condicional.**

## 3. Cost real i límits de consultes

| Servei | Cost | Límit rellevant |
|---|---|---|
| Enable Banking restricted | 0 € (sense contracte) | 4 fetch/dia sense PSU (per ASPSP) |
| Enable Banking producció | No publicat, facturació mínima | Requereix empresa + KYB → **fora d'abast** |
| Binance API | 0 € | Límits per pes d'IP (p. ex. `getUserAsset` pes 5) |
| Etherscan API V2 (free) | 0 € | 100.000 crides/dia, 3 crides/s, atribució obligatòria, ~90% de cadenes |
| mempool.space / Blockstream Esplora | 0 € | Públic, sense SLA, límits no garantits |
| CoinGecko Demo | 0 € | ~10.000 crèdits/mes, ~30–100 crides/min (fonts discrepants), atribució |
| BCE tipus de canvi | 0 € | Publicació diària laborable (~16:00 CET) |

Amb 1 sincronització nocturna + com a màxim 1 manual per dia, el consum és de l'ordre de desenes de crides diàries: molt per sota de tots els límits gratuïts.

## 4. MyInvestor

- PSD2 (Redsys) per a comptes de pagament: AIS, PIS, confirmació de fons (fonts secundàries; el node de Redsys ha retornat 503 durant la recerca → **cal reverificar**).
- **No s'ha trobat cap API oficial de posicions de fons ni de cartera.** La integració recent de MyInvestor amb assistents d'IA és un catàleg de fons, no accés a les posicions del client.
- Cobertura a Enable Banking: **no verificada** (la pàgina de mercat ES no l'esmenta; el llistat de bancs es carrega per JS i no s'ha pogut llegir).

**Veredicte:** cash **condicional**; fons **NO-GO automàtic**. Proposta: posicions introduïdes manualment (ISIN, participacions, cost) i valorades amb NAV manual o d'una font que aproveu.

## 5. Trade Republic

- Segons el handoff, la documentació de Trade Republic descriu AIS PSD2 del compte de cash (saldo, moviments, interessos, comissions). La pàgina de suport s'ha pogut descarregar però el contingut es renderitza per JS → **no reverificat** en aquesta recerca.
- **No existeix API oficial de cartera.** Els projectes que obtenen posicions (`trade-republic` a PyPI, `trade-republic-api` a GitHub) fan reverse engineering del WebSocket de l'app → **prohibit** per aquest projecte.
- Cobertura a Enable Banking: **no verificada**.

**Veredicte:** cash **condicional**; accions/ETFs **NO-GO automàtic** → manual.
**Risc de duplicació:** el cash de Trade Republic és alhora "compte bancari" i "cash de broker". S'ha de modelar un sol cop (compte `CASH` amb `provider=TRADE_REPUBLIC`), mai dins de la cartera.

## 6. Binance

API oficial: https://developers.binance.com

| Necessitat | Endpoint (a verificar amb clau real) |
|---|---|
| Saldo spot | `GET /api/v3/account` |
| Actius de l'usuari | `POST /sapi/v3/asset/getUserAsset` (pes IP 5; només saldos positius) |
| Funding wallet | `POST /sapi/v1/asset/get-funding-asset` |
| Saldo per wallet | `GET /sapi/v1/asset/wallet/balance` (pes IP 60) |
| Simple Earn | `GET /sapi/v1/simple-earn/flexible/position`, `/locked/position` (pes IP 150 cadascun) |
| Dipòsits / retirades | `GET /sapi/v1/capital/deposit/hisrec` (IP 1), `/capital/withdraw/history` (UID 18000; màx. 10 req/s). Finestra màxima de 90 dies per consulta |
| Preus | `GET /api/v3/ticker/price` (públic, sense clau) |

**Permisos de la clau:** només "Enable Reading". Sense trading, withdrawals ni transferències universals. **Restricció d'IP** a la IP fixa del VPS. Secret xifrat amb AES-256-GCM al backend.
Productes que caldrà verificar si es fan servir: Futures, Margin, Staking/ETH, Launchpool (endpoints separats).

**Veredicte: GO.**

## 7. Wallets

- **Bitcoin:** mempool.space o Blockstream Esplora (`/address/{addr}`). Per a xpub/zpub: derivar adreces localment al backend (sense claus privades) i consultar-les; o demanar adreces individuals.
- **Ethereum + EVM:** Etherscan API V2 (una clau, `chainid` per cadena). Saldo natiu + tokens ERC-20 coneguts. Free: 100k crides/dia, 3/s.
- Mai seed phrases ni claus privades: el model de dades només accepta adreces públiques, validades per format.

**Veredicte: GO** (0 €).

## 8. Hipoteca

- PSD2 AIS de BBVA cobreix **comptes de pagament**, no préstecs. **No hi ha via oficial verificada per obtenir el capital pendent.**
- Sí que es pot (si l'1 és GO): detectar els càrrecs mensuals de la quota als moviments del compte associat.
- Proposta:
  1. Entrar condicions (capital inicial, tipus, termini, data, quota, dia de càrrec).
  2. Generar calendari d'amortització (sistema francès; per a variable, revisió amb nou tipus manual).
  3. El capital pendent es mostra com a **"Estimació"**.
  4. Quan l'usuari introdueix el saldo real del banc → passa a **"Real (manual)"** i es recalcula des d'aquí.
  5. El càrrec detectat **no** actualitza el capital: només marca la quota com a pagada.

**Veredicte:** capital pendent **NO-GO automàtic**; seguiment **GO** amb estimació etiquetada.

## 9. Valoració d'immobles

- No hi ha cap API oficial gratuïta que doni valor de mercat per habitatge. Els portals (p. ex. Idealista) tenen APIs comercials/restringides; el valor de referència del Cadastre és oficial però anual, fiscal (no de mercat) i no és una API oberta.
- **Veredicte: NO-GO automàtic** → valoració manual amb historial (`asset_valuations`, font = `MANUAL` / `TAXACIO` / `CADASTRE`).

## 10. Sincronització nocturna i manual

- **Nocturna:** 03:00 UTC (configurable). 1 crida de fetch per compte PSD2 → dins del límit de 4/dia.
- **Manual:** 1 per household / 24 h, controlat al backend (taula `sync_runs`, lock + `UNIQUE` parcial sobre runs `RUNNING`). Si l'usuari és a la UI, s'envien capçaleres PSU (IP/User-Agent) → no consumeix el límit "sense PSU".
- Pressupost per compte PSD2: nocturna (1) + manual (1) + reintents (≤ 2) = 4. Els reintents de PSD2 han de ser conservadors.
- **Preus BCE:** es publiquen ~16:00 CET → a les 03:00 UTC s'usa el tipus del dia laborable anterior; cal guardar-ne la data.
- **Consentiments:** alertar 14 dies abans de `valid_until`; quan caduca, l'estat és `CONSENT_EXPIRED` i es mantenen les dades antigues.

## 11. Cost mensual estimat

| Concepte | €/mes |
|---|---|
| VPS europeu (2 vCPU, 4 GB, p. ex. Hetzner) | ~4–7 |
| Backups xifrats (object storage, < 10 GB) | ~1–3 |
| Vercel Hobby (frontend; ús personal no comercial) | 0 |
| Domini (opcional) | ~1 |
| APIs (Enable Banking restricted, Binance, Etherscan, mempool, CoinGecko, BCE) | 0 |
| **Total** | **~6–11 €/mes** |

Dins l'objectiu de 5–15 €/mes. Cap servei de pagament contractat.

## 12. GO / NO-GO

| Integració | Veredicte | Condició per passar a GO |
|---|---|---|
| BBVA | GO condicional | Resposta d'Enable Banking + prova real |
| Enable Banking | GO condicional | Confirmació escrita del cas de 2 membres |
| MyInvestor cash | Condicional | Cobertura a Enable Banking + prova |
| MyInvestor fons | NO-GO auto | Cap (manual) |
| Trade Republic cash | Condicional | Cobertura a Enable Banking + prova |
| Trade Republic valors | NO-GO auto | Cap (manual) |
| Binance | GO | Prova amb clau read-only |
| Wallets | GO | — |
| Hipoteca | NO-GO auto / GO estimació | — |
| Immobles | NO-GO auto / GO manual | — |
| Preus cripto + FX | GO | — |
| NAV fons / ETFs | Pendent | Aprovar una font |

## 13. Registres, credencials i autoritzacions necessàries

1. Compte a Enable Banking + aplicació de producció + clau RSA + URL de redirecció HTTPS (necessita el backend desplegat amb domini).
2. Consentiment SCA de cada membre a BBVA (i, si escau, MyInvestor / Trade Republic).
3. API key de Binance read-only amb restricció d'IP (cada membre que tingui compte).
4. API key d'Etherscan (gratuïta) i, opcionalment, CoinGecko Demo.
5. VPS amb IP fixa, domini i certificat TLS.
6. RGPD: sou responsables de dades d'ús domèstic, però tractem dades de dues persones; cal consentiment explícit de tots dos, exportació i eliminació. Enable Banking és el TPP regulat; nosaltres no actuem com a AISP.

## 14. Proves pendents (per tancar la Fase 0)

- [ ] Enviar la consulta de l'Annex A i guardar la resposta.
- [ ] Registrar l'app d'Enable Banking i vincular un compte BBVA real.
- [ ] Llegir `maximum_consent_validity` real de BBVA (`npm run eb:aspsps`).
- [ ] Comprovar a la llista d'ASPSP d'Enable Banking (`GET /aspsps?country=ES`) si hi són MyInvestor i Trade Republic (`npm run eb:aspsps`).
- [ ] Clau Binance read-only: cridar els endpoints de §6 i documentar quins productes retornen dades (`npm run binance`).
- [ ] Consultar una adreça BTC i una ETH reals (`npm run wallets`).
- [ ] Decidir la font de NAV per als fons.

## 15. Correccions documentals (en escriure els spikes, 31/10/2026)

Les dades següents surten de la documentació oficial, **no** de cap prova real. Cada endpoint dels spikes porta l'URL de la seva font en un comentari.

**Enable Banking** ([API reference](https://enablebanking.com/docs/api/reference)):
- JWT: `iss = enablebanking.com`, `aud = api.enablebanking.com`, `kid` = ID de l'app, RS256, TTL màxim de 86.400 s.
- `maximum_consent_validity` ve en **segons** (180 dies = 15.552.000).
- `POST /sessions` retorna els comptes complets. `GET /sessions/{id}` només en retorna els `uid`. Saldos i moviments es consulten per `uid`, no per IBAN → la deduplicació per IBAN (§1) s'ha de fer amb les dades de la sessió.
- La doc no associa cada codi d'error (`ASPSP_RATE_LIMIT_EXCEEDED`, `EXPIRED_SESSION`…) a un HTTP concret: cal mirar el camp `error`.
- La pàgina del mercat ES confirma la regla de Redsys d'una sessió activa per usuari. No esmenta ni el límit de 4 consultes al dia ni la profunditat de l'historial (§2 continua sense verificar).

**Binance** ([OpenAPI oficial](https://github.com/binance/binance-api-swagger/blob/master/spot_api.yaml); les pàgines web de Wallet i Simple Earn no s'han pogut llegir perquè es generen amb JS):
- Pesos: vegeu la taula de la §6. Els historials tenen una finestra màxima de 90 dies.
- `GET /sapi/v1/account/apiRestrictions` (pes 1) retorna els permisos de la clau. El change log esmenta camps de la FIX API sense nom confirmat: el spike aplica *default deny*.
- Límits de `/sapi`: IP 12.000/min i UID 180.000/min, independents per endpoint. `/sapi` retorna sempre 429, mai 418.

**Etherscan V2** ([docs](https://docs.etherscan.io/)):
- `balancemulti`: fins a 20 adreces per crida. Pla gratuït: 3 crides/s i 100.000/dia, **només per a algunes cadenes** ("selected chains only"). No s'ha pogut llegir quines.
- Des del 31/10/2026 ja no s'hi poden consultar ApeChain ni Blast. A partir del 3/11/2026 canvia la gestió del límit diari.

**mempool.space** ([REST](https://mempool.space/docs/api/rest)): aplica rate limit (HTTP 429), però no en publica xifres ni capçaleres.

## Annex A — Consulta a Enable Banking (esborrany)

> Hello, we registered a production application and plan to activate it in restricted mode for individual, non-commercial use: a private dashboard for one household (two adults). Each of us would authorise and link only our own accounts (BBVA, Spain), and possibly accounts we hold jointly. Questions: (1) Can both people link their own accounts to the same restricted application, or must each of us register a separate application? (2) Is there any cost or account limit in restricted mode? (3) Are MyInvestor and Trade Republic (Spain) available as ASPSPs for AIS? Thank you.

## Fonts

- Enable Banking — Linked accounts: https://enablebanking.com/docs/api/linked-accounts
- Enable Banking — FAQ: https://enablebanking.com/docs/faq/
- Enable Banking — Spain: https://enablebanking.com/docs/markets/es
- BBVA API Market — Accounts PSD2: https://www.bbvaapimarket.com/es/banking-apis/es-informacion-cuentas-accounts-psd2/
- Binance — Wallet API: https://developers.binance.com/docs/wallet
- Binance — User Asset: https://developers.binance.com/legacy-docs/wallet/asset/user-assets
- Etherscan APIs: https://etherscan.io/apis
- Trade Republic, SDKs no oficials (només per constatar que no hi ha API oficial): https://pypi.org/project/trade-republic/ , https://github.com/NightOwl07/trade-republic-api
- MyInvestor (fonts secundàries): https://openbankingtracker.com/provider/myinvestor/apis
- CoinGecko free plan (font secundària): https://costbench.com/software/blockchain-data-api/coingecko-api/free-plan/
- No accessibles durant la recerca (503 / JS): nodes Redsys de BBVA i MyInvestor, llistat d'ASPSP d'Enable Banking, article de suport de Trade Republic.
