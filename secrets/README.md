# secrets/

Fitxers de secrets locals per a `docker compose` (muntats a `/run/secrets/*`).
Tot el que hi ha en aquesta carpeta és al `.gitignore`, excepte aquest README.

Cap d'aquests valors va mai al `.env`, a una variable d'entorn, al repo, als logs ni al xat.

```bash
mkdir -p secrets && chmod 700 secrets
```

## Fitxers

| Fitxer                   | Qui el fa servir                                       | Com es genera                                         |
| ------------------------ | ------------------------------------------------------ | ----------------------------------------------------- |
| `postgres_password`      | Postgres (`POSTGRES_PASSWORD_FILE`) i l'API/migrate    | `openssl rand -base64 32 > secrets/postgres_password` |
| `ledge_master_key`       | API: clau mestra AES-256-GCM (`LEDGE_MASTER_KEY_FILE`) | `openssl rand -base64 32 > secrets/ledge_master_key`  |
| `postgres_test_password` | Només `docker-compose.test.yml` (tests d'integració)   | El crea sol `npx nx run api:test-integration`         |

```bash
openssl rand -base64 32 > secrets/postgres_password
openssl rand -base64 32 > secrets/ledge_master_key
chmod 644 secrets/postgres_password secrets/ledge_master_key
```

`644` perquè els usuaris dels contenidors (Postgres uid 70, API `node` uid 1000) els puguin llegir; la carpeta és `700`, així que cap altre usuari de la màquina hi arriba.

## Clau mestra (`ledge_master_key`)

- Exactament **32 bytes aleatoris en base64** (el que dona `openssl rand -base64 32`). L'API **no arrenca** si el fitxer falta, no és base64 canònic, no fa 32 bytes o és trivial (tots els bytes iguals).
- Xifra els camps sensibles de la BD (p. ex. el secret TOTP). Mai es guarda a la BD.
- **Si es perd, les dades xifrades són irrecuperables.** Desa'n una còpia al gestor de contrasenyes compartit.
- Si es filtra, tracta-la com a compromesa: rota-la (a sota) i canvia també els secrets que protegia (p. ex. torna a donar d'alta el TOTP).

### Rotació

Cada valor xifrat porta la versió de la clau (`enc:v1:<versió>:...`), així que una clau nova pot conviure amb l'antiga:

1. Mou la clau actual: `mv secrets/ledge_master_key secrets/ledge_master_key_v1`.
2. Genera'n una de nova: `openssl rand -base64 32 > secrets/ledge_master_key`.
3. Posa `LEDGE_MASTER_KEY_VERSION=2` al `.env`.
4. Munta l'antiga a l'API com a secret `ledge_master_key_v1` i afegeix `LEDGE_MASTER_KEY_PREVIOUS_FILES: 1=/run/secrets/ledge_master_key_v1` a l'entorn de l'API (`docker-compose.yml`). Les claus antigues només desxifren.
5. Pendent: un job que torni a xifrar els valors antics (`EncryptionService.needsReEncryption`). Fins aleshores, no retiris la clau antiga.

## Base de dades de test (`postgres_test_password`)

Només per a `docker-compose.test.yml`, una BD d'un sol ús en tmpfs a `127.0.0.1:55432`. No la facis servir per a res més.
