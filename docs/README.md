# Documentació de ledge

Índex únic. Cada tema té **un** document que mana; els altres hi enllacen en lloc de repetir-lo.

## Per on començar

| Vull…                                 | Llegeix                                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entendre el projecte i com està       | [`CONTEXT.md`](CONTEXT.md): què sabem, decisions, fets verificats, entorn, lliçons                                                                 |
| Saber què falta i en quin ordre       | [`../NEXT_STEPS.md`](../NEXT_STEPS.md): el que has de fer tu (§1) i les sessions de Claude (§2)                                                    |
| Fer un pas manual (local, Vercel, EB) | [`MANUAL_SETUP.md`](MANUAL_SETUP.md)                                                                                                               |
| Obrir una sessió nova de Claude       | [`../CLAUDE.md`](../CLAUDE.md) → [`CONTEXT.md`](CONTEXT.md) → el prompt de `NEXT_STEPS.md` §2. Les skills arriben soles ([`SKILLS.md`](SKILLS.md)) |

## Font de veritat per tema

| Tema                                   | Document                                                           | Contingut                                                    |
| -------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| Regles per a Claude                    | [`../CLAUDE.md`](../CLAUDE.md)                                     | Documentació, secrets, disseny, codi                         |
| Coneixement acumulat                   | [`CONTEXT.md`](CONTEXT.md)                                         | Producte, estat, decisions, fets verificats, entorn, lliçons |
| Què falta                              | [`../NEXT_STEPS.md`](../NEXT_STEPS.md)                             | Tasques de l'usuari, sessions, prompts, deute tècnic         |
| Fases, gates i decisions (D1–D6)       | [`../IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md)           | Pla per fases i decisions                                    |
| Viabilitat de les integracions         | [`../INTEGRATION_FEASIBILITY.md`](../INTEGRATION_FEASIBILITY.md)   | GO / NO-GO, només amb evidències                             |
| Arrencar, provar i configurar (tècnic) | [`../README.md`](../README.md)                                     | Comandes, auth, CSRF, xifratge, gitleaks, convencions        |
| Passos manuals de l'usuari             | [`MANUAL_SETUP.md`](MANUAL_SETUP.md)                               | Local, galeria, publicació, Enable Banking                   |
| Skills de Claude Code                  | [`SKILLS.md`](SKILLS.md) + `.claude/hooks/session-start.sh`        | Quines, com arriben a cada sessió (hook), com s'usen aquí    |
| Secrets (com es generen i es roten)    | [`../secrets/README.md`](../secrets/README.md)                     | Fitxers de `secrets/`                                        |
| Spikes de la Fase 0                    | [`../spikes/README.md`](../spikes/README.md)                       | Com executar-los i què compartir                             |
| Gràfiques                              | [`CHARTS.md`](CHARTS.md)                                           | Catàleg, contracte de dades, paleta                          |
| Disseny de la UI                       | [`DESIGN_CHANGES.md`](DESIGN_CHANGES.md) + [`design/`](design/)    | Estil, canvis DC-1…DC-13 i referències HTML                  |
| Auditoria de l'01/11/2026              | [`ANALYSIS.md`](ANALYSIS.md)                                       | Foto datada: troballes T1–T7 i D-1…D-14. No s'actualitza     |
| Tipus compartits                       | [`../libs/shared/types/README.md`](../libs/shared/types/README.md) | `@ledge/shared-types`                                        |
| Prompts de sessions acabades           | [`archive/SESSION_PROMPTS.md`](archive/SESSION_PROMPTS.md)         | Històric, no reutilitzar                                     |

## Referències de disseny

Fitxers HTML estàtics: s'obren directament al navegador, sense servidor.

- [`design/overview.html`](design/overview.html): shell i Resum de la Fase 2 (dades de prova).
- [`design/overview-empty.html`](design/overview-empty.html): Resum ara, sense dades.
- [`design/login.html`](design/login.html): inici de sessió, codi de verificació, codis de recuperació.
- [`design/reference.css`](design/reference.css): tokens proposats.
- [`design/captures/`](design/captures/): captures de la web actual (01/11/2026).

## Convencions

- Català a la documentació. Dates `dd/mm/aaaa`. Imports `130.000,00 €`.
- Cap secret, cap dada real sense anonimitzar.
- Un document nou s'afegeix a aquesta taula al mateix PR.
- `CONTEXT.md` es manté al dia; `ANALYSIS.md` és una foto: per a una auditoria nova se'n fa una altra amb data.
