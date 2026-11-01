# CLAUDE.md

Regles per a qualsevol sessió de Claude Code en aquest repo.

## Documentació (sempre)

Índex i font de veritat de cada tema: `docs/README.md`. Llegeix-lo abans de començar.

Cada canvi actualitza la documentació que afecta, **al mateix PR**:

- `NEXT_STEPS.md`: taula d'estat, checklist i prompts de les sessions següents.
- `IMPLEMENTATION_PLAN.md`: punts fets (✅) i decisions que canvien.
- `README.md`: com arrencar, provar i configurar el que s'hagi afegit.
- `INTEGRATION_FEASIBILITY.md`: només amb evidències reals (informes anonimitzats).
- `docs/MANUAL_SETUP.md`: si canvia algun pas que l'usuari ha de fer a mà.
- `docs/DESIGN_CHANGES.md` i `docs/design/*`: marcar els DC fets (✅) o els que canvien.
- `docs/ANALYSIS.md` és una foto datada: no s'actualitza, se'n fa una de nova.
- Prompts de sessions acabades → `docs/archive/SESSION_PROMPTS.md`.

Un PR que canvia codi o decisions sense tocar la documentació està incomplet.

## Secrets

- Cap secret al repo, al xat, als logs ni en variables d'entorn: van en fitxers (`secrets/`, Compose secrets a `/run/secrets/*`).
- `.env` només per a configuració no secreta.

## Disseny

- Qualsevol canvi a la UI segueix `docs/DESIGN_CHANGES.md` (estil `true-black-flat`, tokens a `docs/design/reference.css`).
- Fes servir les skills `design-taste-frontend` (regles d'app: `lint.mjs --app` i `inspect.mjs --app`, 0 FAIL a 1440/768/390), `web-design-guidelines` i `playwright-cli` per veure-ho amb el navegador. Si no hi són, `docs/MANUAL_SETUP.md` §5.

## Codi

- `spikes/` és un paquet independent (fora de Nx). No el modifiquis des d'una tasca de l'app.
- Abans d'acabar: `npx nx run-many -t lint test build` i `npx prettier --check .`.
- Branca nova des de `main`, un PR per tasca.
