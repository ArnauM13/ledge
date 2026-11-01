# Documentació de ledge

Índex únic. Cada tema té **un** document que mana; els altres hi enllacen en lloc de repetir-lo.

## Per on començar

| Vull…                                    | Llegeix                                                       |
| ---------------------------------------- | ------------------------------------------------------------- |
| Veure la web funcionant (passos manuals) | [`MANUAL_SETUP.md`](MANUAL_SETUP.md)                          |
| Saber com està el projecte avui          | [`ANALYSIS.md`](ANALYSIS.md) (foto de l'01/11/2026)           |
| Saber què toca fer ara                   | [`../NEXT_STEPS.md`](../NEXT_STEPS.md)                        |
| Obrir una sessió nova de Claude          | [`../CLAUDE.md`](../CLAUDE.md) + el prompt de `NEXT_STEPS.md` |

## Font de veritat per tema

| Tema                                   | Document                                                           | Contingut                                             |
| -------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| Regles per a Claude                    | [`../CLAUDE.md`](../CLAUDE.md)                                     | Documentació, secrets, codi                           |
| Estat, checklist i prompts pendents    | [`../NEXT_STEPS.md`](../NEXT_STEPS.md)                             | Què queda, en ordre                                   |
| Fases, gates i decisions (D1–D6)       | [`../IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md)           | Pla i decisions preses                                |
| Viabilitat de les integracions         | [`../INTEGRATION_FEASIBILITY.md`](../INTEGRATION_FEASIBILITY.md)   | GO / NO-GO, només amb evidències                      |
| Arrencar, provar i configurar (tècnic) | [`../README.md`](../README.md)                                     | Comandes, auth, CSRF, xifratge, gitleaks, convencions |
| Passos manuals de l'usuari             | [`MANUAL_SETUP.md`](MANUAL_SETUP.md)                               | Local, galeria, publicació                            |
| Secrets (com es generen i es roten)    | [`../secrets/README.md`](../secrets/README.md)                     | Fitxers de `secrets/`                                 |
| Spikes de la Fase 0                    | [`../spikes/README.md`](../spikes/README.md)                       | Com executar-los i què compartir                      |
| Gràfiques                              | [`CHARTS.md`](CHARTS.md)                                           | Catàleg, contracte de dades, paleta                   |
| Disseny de la UI                       | [`DESIGN_CHANGES.md`](DESIGN_CHANGES.md) + [`design/`](design/)    | Canvis DC-1…DC-13 i referències HTML                  |
| Estat i auditoria puntual              | [`ANALYSIS.md`](ANALYSIS.md)                                       | Troballes T1–T7 i D-1…D-12                            |
| Tipus compartits                       | [`../libs/shared/types/README.md`](../libs/shared/types/README.md) | `@ledge/shared-types`                                 |
| Prompts de sessions acabades           | [`archive/SESSION_PROMPTS.md`](archive/SESSION_PROMPTS.md)         | Històric, no reutilitzar                              |

## Referències de disseny

Fitxers HTML estàtics: s'obren directament al navegador, sense servidor.

- [`design/login.html`](design/login.html): login, codi de verificació, codis de recuperació.
- [`design/overview.html`](design/overview.html): shell, Resum sense dades i Resum de la Fase 2.
- [`design/reference.css`](design/reference.css): tokens proposats.
- [`design/captures/`](design/captures/): captures de la web actual (01/11/2026).

## Convencions

- Català a la documentació. Dates `dd/mm/aaaa`. Imports `130.000,00 €`.
- Cap secret, cap dada real sense anonimitzar.
- Un document nou s'afegeix a aquesta taula al mateix PR.
