# Passos manuals

> Actualitzat l'01/11/2026. Guies de tot el que has de fer tu: necessiten la teva màquina, els teus comptes o una decisió teva. L'ordre en què fer-ho és a [`../NEXT_STEPS.md`](../NEXT_STEPS.md) §1.
> El flux local (§1) s'ha provat el 01/11/2026 de punta a punta: login, alta del TOTP, codis de recuperació i Overview.

| #   | Què                              | Temps  | Resultat                                 |
| --- | -------------------------------- | ------ | ---------------------------------------- |
| 1   | Arrencar-la en local             | 20 min | Web a `http://localhost:4200` amb login  |
| 2   | Veure la galeria de gràfiques    | 2 min  | G-1 amb dades de prova a `/dev/charts`   |
| 3   | Publicar-la (Vercel + VPS)       | 45 min | Login amb 2FA a `ledge-am.vercel.app`    |
| 5   | Registrar l'app a Enable Banking | 30 min | App de producció activa per a l'spike G1 |

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

**Abans de res (5 min): fer obligatori el CI.** El workflow `ci.yml` ja s'executa a cada PR, però GitHub no impedeix fusionar si falla fins que no ho dius. A GitHub → _Settings_ → _Rules_ → _Rulesets_ → _New branch ruleset_: objectiu `main`, activa _Require a pull request before merging_ i _Require status checks to pass_, i afegeix `format, lint, test, build`, `API integration tests (PostgreSQL 17)` i `gitleaks (full history)` (apareixen després de la primera execució).

Vercel només serveix la web (fitxers estàtics). El login el comprova l'**API**, que guarda usuaris i sessions a **Postgres**: tots dos viuen en un **VPS** (D5). Vercel fa de proxy de `/api/*` cap al VPS (_rewrite_), així que el navegador només veu `ledge-am.vercel.app` i la cookie `SameSite=Strict` funciona sense domini propi (decidit el 02/11/2026; D4 pot esperar a la Fase 3).

```text
Navegador ──► ledge-am.vercel.app ──┬─ /, /login…  → web (Vercel, vercel.json)
                                    └─ /api/*  ──► VPS: Caddy (HTTPS, <ip>.sslip.io) → API → Postgres
```

Fitxers: [`../vercel.json`](../vercel.json) (build, fallback de l'SPA, capçaleres) i [`../deploy/`](../deploy) (Compose de producció, `Caddyfile`, `prod.env.example`).

| #   | Què has de fer                                                           | Qui    | Temps  |
| --- | ------------------------------------------------------------------------ | ------ | ------ |
| 3.1 | ✅ Projecte de **Vercel** `ledge-am` enllaçat a `ArnauM13/ledge`         | Tu     | —      |
| 3.2 | Crear el **VPS** (§3.2)                                                  | Tu     | 10 min |
| 3.3 | Passar la **IP** del VPS a Claude (només la IP, cap clau ni contrasenya) | Tu     | —      |
| 3.4 | Afegir el rewrite de `/api` a `vercel.json` i fusionar el PR             | Claude | —      |
| 3.5 | Preparar el VPS i desplegar l'API (§3.5)                                 | Tu     | 20 min |
| 3.6 | Crear els dos usuaris i fer el primer login (§3.6)                       | Tu     | 5 min  |

Si encara existeix, esborra el repo còpia `ArnauM13/ledge-am` de GitHub (el va crear Vercel; ja no el fa servir res).

### 3.2 Crear el VPS (Hetzner)

1. Si no en tens, genera una clau SSH **a la teva màquina** (la privada no surt mai d'allà):

   ```bash
   ssh-keygen -t ed25519 -C "ledge-vps"
   ```

2. A [Hetzner Cloud](https://console.hetzner.cloud) → _New project_ → _Add server_:
   - **Location**: Falkenstein, Nuremberg o Helsinki (UE).
   - **Image**: Ubuntu 24.04.
   - **Type**: CX22 (2 vCPU, 4 GB; ~4–7 €/mes).
   - **SSH keys**: enganxa el contingut de `~/.ssh/id_ed25519.pub`. Així no hi ha contrasenya de root.
   - **Firewalls** → _Create firewall_, regles d'entrada: TCP 22 (millor només des de la teva IP), TCP 80 i TCP 443.
   - **Backups**: recomanat (+20 %), són les vostres dades.
3. Apunta la **IP pública (IPv4)** i passa-la a Claude (pas 3.3).

### 3.5 Preparar el VPS i desplegar l'API

Totes les ordres, connectat al VPS. Substitueix `<IP>` per la IP.

**a) Usuari, actualitzacions i Docker** (com a `root`, un sol cop):

```bash
ssh root@<IP>
```

```bash
apt update && apt -y upgrade && apt -y install git unattended-upgrades
```

```bash
curl -fsSL https://get.docker.com | sh
```

```bash
adduser --disabled-password --gecos "" deploy && usermod -aG docker deploy && rsync -a --chown=deploy:deploy ~/.ssh /home/deploy/
```

```bash
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && systemctl reload ssh
```

A partir d'aquí, entra sempre com a `deploy`:

```bash
ssh deploy@<IP>
```

**b) Clonar el repo amb una _deploy key_** (només lectura, només aquest repo):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/ledge_deploy -N "" -C "ledge-vps-deploy" && cat ~/.ssh/ledge_deploy.pub
```

Copia la línia que surt a GitHub → `ArnauM13/ledge` → _Settings_ → _Deploy keys_ → _Add deploy key_ (**sense** _Allow write access_). Després:

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/ledge_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config
```

```bash
git clone git@github.com:ArnauM13/ledge.git && cd ledge
```

**c) Configuració i secrets** (els secrets es generen **al VPS**: no viatgen mai):

```bash
cp deploy/prod.env.example .env && nano .env
```

Omple `LEDGE_API_HOST` amb la IP amb guions + `.sslip.io` (IP `203.0.113.10` → `203-0-113-10.sslip.io`). La resta ja ve bé.

```bash
mkdir -p secrets && chmod 700 secrets
openssl rand -base64 32 > secrets/postgres_password
openssl rand -base64 32 > secrets/ledge_master_key
chmod 644 secrets/postgres_password secrets/ledge_master_key
```

Desa una còpia de **`secrets/ledge_master_key`** al gestor de contrasenyes (`cat secrets/ledge_master_key` i copiar-la allà, mai al xat): sense ella, els secrets TOTP xifrats són irrecuperables.

**d) Arrencar** (la primera vegada triga uns minuts: construeix la imatge de l'API):

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
```

Comprova-ho (des de la teva màquina; ha de tornar `200` amb `{"authenticated":false}`, no un error de connexió ni de certificat):

```bash
curl -i https://<IP-amb-guions>.sslip.io/api/auth/session
```

**Actualitzar** després d'un merge a `main`:

```bash
cd ~/ledge && git pull && docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
```

### 3.6 Crear els usuaris i el primer login

Al VPS, dins de `~/ledge` (la contrasenya es demana amagada; vegeu [`../README.md`](../README.md#usuaris)):

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml run --rm -it api node create-user.js --email <email-A> --name "<Nom A>" --household-name "Casa"
```

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml run --rm -it api node create-user.js --email <email-B> --name "<Nom B>" --household-id <uuid que ha imprès l'anterior>
```

Després, cadascú a `https://ledge-am.vercel.app`: login, alta del TOTP amb el mòbil i **desar els 10 codis de recuperació** al gestor de contrasenyes. Quan tots dos veieu l'Overview, la **Fase 1 està tancada**: digues-ho a Claude perquè ho marqui a la documentació.

> Vercel Authentication està activa al projecte (_Settings_ → _Deployment Protection_, «Standard Protection»): protegeix els previews. Si en obrir `ledge-am.vercel.app` us demana login de Vercel, cal posar-la a «Only Preview Deployments».

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
