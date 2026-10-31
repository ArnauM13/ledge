# secrets/

Fitxers de secrets locals per a `docker compose` (muntats a `/run/secrets/*`).
Tot el que hi ha en aquesta carpeta és al `.gitignore`, excepte aquest README.

```bash
openssl rand -base64 32 > secrets/postgres_password
chmod 600 secrets/postgres_password
```
