# CLAUDE.md

Regles per a qualsevol sessió de Claude Code en aquest repo.

## Documentació (sempre)

Cada canvi actualitza la documentació que afecta, **al mateix PR**:

- `NEXT_STEPS.md`: taula d'estat, checklist i prompts de les sessions següents.
- `IMPLEMENTATION_PLAN.md`: punts fets (✅) i decisions que canvien.
- `README.md`: com arrencar, provar i configurar el que s'hagi afegit.
- `INTEGRATION_FEASIBILITY.md`: només amb evidències reals (informes anonimitzats).

Un PR que canvia codi o decisions sense tocar la documentació està incomplet.

## Secrets

- Cap secret al repo, al xat, als logs ni en variables d'entorn: van en fitxers (`secrets/`, Compose secrets a `/run/secrets/*`).
- `.env` només per a configuració no secreta.

## Codi

- `spikes/` és un paquet independent (fora de Nx). No el modifiquis des d'una tasca de l'app.
- Abans d'acabar: `npx nx run-many -t lint test build` i `npx prettier --check .`.
- Branca nova des de `main`, un PR per tasca.
