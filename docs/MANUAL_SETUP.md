# Passos manuals

> Actualitzat l'01/11/2026. Guies de tot el que has de fer tu: necessiten la teva màquina, els teus comptes o una decisió teva. L'ordre en què fer-ho és a [`../NEXT_STEPS.md`](../NEXT_STEPS.md) §1.
> El flux local (§1) s'ha provat el 01/11/2026 de punta a punta: login, alta del TOTP, codis de recuperació i Overview.

| #   | Què                                 | Temps  | Resultat                                 |
| --- | ----------------------------------- | ------ | ---------------------------------------- |
| 1   | Arrencar-la en local                | 20 min | Web a `http://localhost:4200` amb login  |
| 2   | Veure la galeria de gràfiques       | 2 min  | G-1 amb dades de prova a `/dev/charts`   |
| 3   | Decisions i comptes per publicar-la | 1–2 h  | Claude pot fer el CI, Vercel i el VPS    |
| 5   | Registrar l'app a Enable Banking    | 30 min | App de producció activa per a l'spike G1 |

---

## 1. Arrencar-la en local

### 1.1 Què cal tenir instal·lat (un sol cop)

| Eina                                   | Per què                                                         | Comprovació              |
| -------------------------------------- | --------------------------------------------------------------- | ------------------------ |
| Node.js 22 (≥ 20.19) i npm 10          | Construir i servir web i API                                    | `node -v`                |
| Docker Desktop (o Docker + Compose v2) | Postgres                                                        | `docker compose version` |
| `openssl`                              | Generar els secrets                                             | `openssl version`        |
| gitleaks 8.30.1                        | Només per fer commits (hook)                                    | `gitleaks version`       |
| App d'autenticació al mòbil            | TOTP (Google Authenticator, 1Password, Aegis…)                  | —                        |
| Chrome o Firefox                       | La cookie és `Secure`: Safari no l'accepta a `http://localhost` | —                        |

Instal·lació de gitleaks: [`../README.md`](../README.md#instal·lació).

### 1.2 Preparar el repo

```bash
git clone https://github.com/ArnauM13/ledge.git && cd ledge
```

```bash
npm ci
```

```bash
cp .env.example .env
```

```bash
mkdir -p secrets && chmod 700 secrets
openssl rand -base64 32 > secrets/postgres_password
openssl rand -base64 32 > secrets/ledge_master_key
chmod 644 secrets/postgres_password secrets/ledge_master_key
```

Desa una còpia de `secrets/ledge_master_key` al gestor de contrasenyes: sense ella no es poden llegir els secrets TOTP xifrats.

### 1.3 Arrencar Postgres + API (Docker, dades persistents)

```bash
docker compose up --build -d
```

Comprova-ho:

```bash
curl http://127.0.0.1:3000/health
```

Ha de respondre `{"status":"ok",...}`. Si no, mira `docker compose logs api`.

### 1.4 Crear els dos usuaris

La contrasenya es demana per teclat (oculta, dues vegades). Mínim 12 caràcters.

```bash
docker compose run --rm -it api node create-user.js --email <el teu correu> --name "<el teu nom>" --household-name "Casa"
```

Apunta l'UUID de la household que imprimeix i crea el segon membre:

```bash
docker compose run --rm -it api node create-user.js --email <correu de B> --name "<nom de B>" --household-id <uuid>
```

### 1.5 Servir la web

```bash
npx nx serve web
```

Obre http://localhost:4200 a Chrome o Firefox. El dev-server envia `/api` a l'API de Docker.

### 1.6 Primer login (cada membre)

1. Correu i contrasenya.
2. Escaneja el QR amb l'app d'autenticació i escriu el codi de 6 xifres.
3. **Desa els 10 codis de recuperació** al gestor de contrasenyes. No es tornen a mostrar.
4. Arribes a l'Overview buit. És correcte: encara no hi ha cap font de dades.

### 1.7 Aturar i esborrar

```bash
docker compose down        # atura, conserva les dades
```

```bash
docker compose down -v     # atura i esborra la BD (usuaris inclosos)
```

### 1.8 Problemes habituals

| Símptoma                                         | Causa i solució                                                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `docker compose up` falla amb «secret not found» | Falta un fitxer a `secrets/` (§1.2)                                                                                            |
| Error de certificat a `npm ci` dins Docker       | Proxy TLS corporatiu: [`../README.md`](../README.md#darrere-dun-proxy-tls-corporatiu)                                          |
| El login no avança i no hi ha error              | Safari, o `http://127.0.0.1` en lloc de `localhost`. Fes servir `http://localhost:4200` a Chrome/Firefox                       |
| «The server is not responding»                   | L'API no està engegada: `docker compose ps`                                                                                    |
| «Too many attempts»                              | Límit de 20 intents / 15 min per IP, o bloqueig de 15 min del compte després de 5 errors. Espera                               |
| Codi TOTP sempre incorrecte                      | Rellotge del mòbil desajustat: activa l'hora automàtica                                                                        |
| Has perdut el mòbil i els codis                  | Encara no hi ha procediment ([`../NEXT_STEPS.md`](../NEXT_STEPS.md) §3). En local: `docker compose down -v` i torna a començar |

Alternativa sense dades persistents (BD a la RAM, la que fan servir els tests): [`../README.md`](../README.md#arrencar-en-local).

## 2. Veure la galeria de gràfiques

N'hi ha prou amb la web (no cal l'API ni Docker):

```bash
npm ci && npx nx serve web
```

Obre http://localhost:4200/dev/charts. Mostra G-1 amb **dades de prova**, sense login: només existeix al build de desenvolupament.

Per veure com hauria de quedar el disseny proposat, obre directament al navegador:

- `docs/design/login.html`
- `docs/design/overview.html`

## 3. Publicar-la a Internet

Vercel sol no n'hi ha prou: la web necessita l'API, i la cookie de sessió (`SameSite=Strict`) obliga que web i API siguin al mateix domini. Per això cal:

| #   | Què has de fer                                                                                                                                              | Decisió |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 3.1 | Triar i comprar un **domini** (o fer servir un subdomini d'un que ja tinguis), p. ex. `ledge.<el-teu-domini>`                                               | D4      |
| 3.2 | Crear un **VPS** a la UE (recomanat Hetzner CX22, ~4–7 €/mes) amb Ubuntu 24.04 i accés per clau SSH                                                         | D5      |
| 3.3 | Crear el compte de **Vercel** i connectar-lo a GitHub (repo `ArnauM13/ledge`)                                                                               | —       |
| 3.4 | Apuntar el DNS: `ledge.<domini>` → Vercel, `api.ledge.<domini>` (o una ruta `/api` via rewrite) → IP del VPS                                                | —       |
| 3.5 | Obrir la sessió de la Fase 1, punts 8–9 (prompt a [`../NEXT_STEPS.md`](../NEXT_STEPS.md) §2.1) i passar-li: domini, IP del VPS i nom del projecte de Vercel | —       |
| 3.6 | Al VPS, copiar **tu** els fitxers de `secrets/` (per `scp`, mai pel xat ni pel repo)                                                                        | —       |
| 3.7 | Crear els dos usuaris al VPS amb `create-user` (§1.4) i fer el primer login                                                                                 | —       |

Quan acabi, la Definition of Done de la Fase 1 es compleix: els dos feu login amb 2FA i veieu l'Overview buit a la URL pública.

## 4. Després: perquè hi hagi xifres

La web estarà buida fins que:

- **Fase 2** (no depèn de res teu, tret de D1 i D2): podreu entrar a mà comptes, posicions, immobles i la hipoteca.
- **Fase 3**: cal que executis els spikes ([`../spikes/README.md`](../spikes/README.md)) i que els gates siguin GO.

## 5. Registrar l'app a Enable Banking

### 5.1 Crear el compte

1. Anar a https://enablebanking.com/sign-in/
2. Posar l'email. El compte es crea automàticament el primer cop que s'hi entra.
3. Obrir l'enllaç d'accés que arriba per correu.

### 5.2 App de sandbox (per provar el flux sense risc)

1. Menú superior → **API applications** (https://enablebanking.com/cp/applications).
2. Formulari _Add a new application_:
   - **Environment:** Sandbox
   - **Private key:** opció per defecte (es genera al navegador)
   - **Name:** `ledge`
   - **Redirect URL:** `https://localhost:3000/callback`
3. **Register** → es descarrega `<application-id>.pem`.
   - Nom del fitxer = **ID de l'app** → variable `EB_APP_ID`
   - Fitxer = **clau privada** → variable `EB_PRIVATE_KEY_PATH`

### 5.3 App de producció (llegeix el BBVA real)

1. El mateix formulari, amb **Environment: Production**.
2. L'app apareix en estat **Inactive**.
3. **Activate by linking accounts** → pàgina d'Enable Banking → BBVA (usuari, contrasenya i confirmació al mòbil).
   - Primer el **membre A**.
   - Vincular **tots** els comptes que es vulguin fer servir. Els que no es vinculin tornaran com a llista buida.
4. L'app passa a **Active (restricted)**.

La prova del membre B (G2) es fa amb l'spike, no aquí.

### 5.4 Seguretat de la clau `.pem`

- Moure-la de _Descàrregues_ a una carpeta fora del repo, p. ex. `~/.secrets/ledge/`.
- Còpia al gestor de contrasenyes.
- Mai a GitHub ni al xat. Qui té el fitxer pot actuar com la vostra app.

### 5.5 Per què `localhost` com a redirecció

El banc redirigeix a aquesta URL amb un `code` a l'adreça. Amb `localhost` la pàgina no carrega (és normal): l'spike demana que copieu la URL i n'extreu el codi. Així el codi no surt del vostre ordinador. Amb un domini d'un tercer (p. ex. `example.com`), el codi acabaria als seus servidors.

### 5.6 Què no aclareix la documentació

- Si el formulari accepta `localhost`. Si el rebutja: posar una URL del vostre **propi** domini i adaptar l'spike.
- On es mostra l'ID de l'app al panell (en tot cas, és el nom del `.pem`).
- Si la clau es pot tornar a descarregar o regenerar.

Fonts: [Quick start](https://enablebanking.com/docs/api/quick-start) · [Linked accounts](https://enablebanking.com/docs/api/linked-accounts/) · [FAQ](https://enablebanking.com/docs/faq/)

## 6. Skills de Claude Code

No cal fer res: el hook `SessionStart` del repo les instal·la a cada sessió al núvol, i al teu ordinador ja les tens. Detall i com afegir-ne: [`SKILLS.md`](SKILLS.md).
