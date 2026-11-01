# Què has de fer tu per veure la web

> 01/11/2026. Passos manuals, en ordre. Tot el que és codi ho fa Claude; això són coses que necessiten la teva màquina, els teus comptes o una decisió teva.
> El flux local (§2) s'ha provat el 01/11/2026 de punta a punta: login, alta del TOTP, codis de recuperació i Overview.

| #   | Què                                   | Temps  | Resultat                                |
| --- | ------------------------------------- | ------ | --------------------------------------- |
| 1   | Fusionar la lib de gràfiques a `main` | 5 min  | `main` té tot el codi fet               |
| 2   | Arrencar-la en local                  | 20 min | Web a `http://localhost:4200` amb login |
| 3   | Veure la galeria de gràfiques         | 2 min  | G-1 amb dades de prova a `/dev/charts`  |
| 4   | Decisions i comptes per publicar-la   | 1–2 h  | Claude pot fer el CI, Vercel i el VPS   |

---

## 1. Fusionar la lib de gràfiques a `main`

El PR #10 (lib de gràfiques + G-1) es va fusionar a la branca `docs/charts-design` en lloc de `main` ([`ANALYSIS.md`](ANALYSIS.md) T1). Per recuperar-lo:

1. Obre https://github.com/ArnauM13/ledge/compare/main...docs/charts-design
2. **Create pull request**. Títol: `feat(charts): lib web-charts + G-1 (recupera el PR #10)`.
3. Espera que passi `secrets` (gitleaks) i fusiona.
4. Esborra la branca `docs/charts-design`.

Si prefereixes que ho faci Claude, demana-ho en una sessió: «obre el PR de `docs/charts-design` cap a `main`».

## 2. Arrencar-la en local

### 2.1 Què cal tenir instal·lat (un sol cop)

| Eina                                   | Per què                                                         | Comprovació              |
| -------------------------------------- | --------------------------------------------------------------- | ------------------------ |
| Node.js 22 (≥ 20.19) i npm 10          | Construir i servir web i API                                    | `node -v`                |
| Docker Desktop (o Docker + Compose v2) | Postgres                                                        | `docker compose version` |
| `openssl`                              | Generar els secrets                                             | `openssl version`        |
| gitleaks 8.30.1                        | Només per fer commits (hook)                                    | `gitleaks version`       |
| App d'autenticació al mòbil            | TOTP (Google Authenticator, 1Password, Aegis…)                  | —                        |
| Chrome o Firefox                       | La cookie és `Secure`: Safari no l'accepta a `http://localhost` | —                        |

Instal·lació de gitleaks: [`../README.md`](../README.md#instal·lació).

### 2.2 Preparar el repo

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

### 2.3 Arrencar Postgres + API (Docker, dades persistents)

```bash
docker compose up --build -d
```

Comprova-ho:

```bash
curl http://127.0.0.1:3000/health
```

Ha de respondre `{"status":"ok",...}`. Si no, mira `docker compose logs api`.

### 2.4 Crear els dos usuaris

La contrasenya es demana per teclat (oculta, dues vegades). Mínim 12 caràcters.

```bash
docker compose run --rm -it api node create-user.js --email <el teu correu> --name "<el teu nom>" --household-name "Casa"
```

Apunta l'UUID de la household que imprimeix i crea el segon membre:

```bash
docker compose run --rm -it api node create-user.js --email <correu de B> --name "<nom de B>" --household-id <uuid>
```

### 2.5 Servir la web

```bash
npx nx serve web
```

Obre http://localhost:4200 a Chrome o Firefox. El dev-server envia `/api` a l'API de Docker.

### 2.6 Primer login (cada membre)

1. Correu i contrasenya.
2. Escaneja el QR amb l'app d'autenticació i escriu el codi de 6 xifres.
3. **Desa els 10 codis de recuperació** al gestor de contrasenyes. No es tornen a mostrar.
4. Arribes a l'Overview buit. És correcte: encara no hi ha cap font de dades.

### 2.7 Aturar i esborrar

```bash
docker compose down        # atura, conserva les dades
```

```bash
docker compose down -v     # atura i esborra la BD (usuaris inclosos)
```

### 2.8 Problemes habituals

| Símptoma                                         | Causa i solució                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `docker compose up` falla amb «secret not found» | Falta un fitxer a `secrets/` (§2.2)                                                                                             |
| Error de certificat a `npm ci` dins Docker       | Proxy TLS corporatiu: [`../README.md`](../README.md#darrere-dun-proxy-tls-corporatiu)                                           |
| El login no avança i no hi ha error              | Safari, o `http://127.0.0.1` en lloc de `localhost`. Fes servir `http://localhost:4200` a Chrome/Firefox                        |
| «The server is not responding»                   | L'API no està engegada: `docker compose ps`                                                                                     |
| «Too many attempts»                              | Límit de 20 intents / 15 min per IP, o bloqueig de 15 min del compte després de 5 errors. Espera                                |
| Codi TOTP sempre incorrecte                      | Rellotge del mòbil desajustat: activa l'hora automàtica                                                                         |
| Has perdut el mòbil i els codis                  | Encara no hi ha procediment ([`../NEXT_STEPS.md`](../NEXT_STEPS.md) §3c). En local: `docker compose down -v` i torna a començar |

Alternativa sense dades persistents (BD a la RAM, la que fan servir els tests): [`../README.md`](../README.md#arrencar-en-local).

## 3. Veure la galeria de gràfiques

Després del pas 1 n'hi ha prou amb la web (no cal l'API ni Docker):

```bash
npm ci && npx nx serve web
```

Obre http://localhost:4200/dev/charts. Mostra G-1 amb **dades de prova**, sense login: només existeix al build de desenvolupament.

Per veure com hauria de quedar el disseny proposat, obre directament al navegador:

- `docs/design/login.html`
- `docs/design/overview.html`

## 4. Publicar-la a Internet

Vercel sol no n'hi ha prou: la web necessita l'API, i la cookie de sessió (`SameSite=Strict`) obliga que web i API siguin al mateix domini. Per això cal:

| #   | Què has de fer                                                                                                                                             | Decisió |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 4.1 | Triar i comprar un **domini** (o fer servir un subdomini d'un que ja tinguis), p. ex. `ledge.<el-teu-domini>`                                              | D4      |
| 4.2 | Crear un **VPS** a la UE (recomanat Hetzner CX22, ~4–7 €/mes) amb Ubuntu 24.04 i accés per clau SSH                                                        | D5      |
| 4.3 | Crear el compte de **Vercel** i connectar-lo a GitHub (repo `ArnauM13/ledge`)                                                                              | —       |
| 4.4 | Apuntar el DNS: `ledge.<domini>` → Vercel, `api.ledge.<domini>` (o una ruta `/api` via rewrite) → IP del VPS                                               | —       |
| 4.5 | Obrir la sessió de la Fase 1, punts 8–9 (prompt a [`../NEXT_STEPS.md`](../NEXT_STEPS.md) §3c) i passar-li: domini, IP del VPS i nom del projecte de Vercel | —       |
| 4.6 | Al VPS, copiar **tu** els fitxers de `secrets/` (per `scp`, mai pel xat ni pel repo)                                                                       | —       |
| 4.7 | Crear els dos usuaris al VPS amb `create-user` (§2.4) i fer el primer login                                                                                | —       |

Quan acabi, la Definition of Done de la Fase 1 es compleix: els dos feu login amb 2FA i veieu l'Overview buit a la URL pública.

## 5. Després: perquè hi hagi xifres

La web estarà buida fins que:

- **Fase 2** (no depèn de res teu, tret de D1 i D2): podreu entrar a mà comptes, posicions, immobles i la hipoteca.
- **Fase 3**: cal que executis els spikes ([`../spikes/README.md`](../spikes/README.md)) i que els gates siguin GO.
