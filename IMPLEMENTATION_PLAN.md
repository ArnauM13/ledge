# IMPLEMENTATION_PLAN.md

> Basat en `INTEGRATION_FEASIBILITY.md` (31/10/2026).
> Principi: **el que no depèn de les integracions es comença ja**. El que en depèn espera que la seva prova (gate) sigui GO.

## Visió general

```text
          Setmana 1      Setmana 2      Setmana 3      Setmana 4      Setmana 5+
Pas previ  ███
Fase 0     ███████████████  (spikes reals, en paral·lel)
Fase 1     ███████████
Fase 2               ████████████████
Fase 3                       [GATE] ████████████████
Fase 4/5                                    ████████████████████
Fase 6                                                     ██████
```

---

## Pas previ A — Decisions (bloquejants)

| # | Decisió | Opcions | Recomanació |
|---|---|---|---|
| D1 | Abast de les posicions de MyInvestor / Trade Republic | Manual · aturar el projecte | **Manual**, etiquetat a la UI |
| D2 | Font del NAV dels fons | Manual · font externa (cal aprovar-la) | **Manual** a l'MVP |
| D3 | Nom i visibilitat del repo | — | `household-wealth`, **privat** |
| D4 | Domini | Subdomini propi · `*.vercel.app` | Domini propi (necessari per a la redirecció HTTPS d'Enable Banking i l'API) |
| D5 | Proveïdor del VPS | Hetzner · OVH · Scaleway | Hetzner (UE, ~4–7 €/mes) |

## Pas previ B — Comptes i accessos (ho feu vosaltres)

- [ ] Crear el repo **buit** a GitHub i passar-me `owner/repo`.
- [ ] Compte de Vercel connectat a GitHub.
- [ ] Compte d'Enable Banking + app de producció + clau `.pem` (fora del repo).
- [ ] Enviar la consulta de l'Annex A a Enable Banking.
- [ ] API key de Binance read-only (quan tinguem la IP del VPS, o la vostra IP per a l'spike).
- [ ] API key d'Etherscan (gratuïta).
- [ ] Gestor de secrets compartit entre els dos (p. ex. 1Password / Bitwarden).

**Regla:** cap secret al xat, al repo ni als logs.

---

## Fase 0 — Tancar la viabilitat (en paral·lel a la Fase 1)

| Spike | Qui | Resultat | Gate | Estat (31/10/2026) |
|---|---|---|---|---|
| `spikes/enable-banking` | Jo l'escric; vosaltres l'executeu | ASPSPs a ES, consentiment, saldos i historial de BBVA | **G1**: BBVA GO | Escrit, no executat |
| Membre B vincula comptes | Vosaltres | Confirmació pràctica dels dos titulars | **G2**: 2 titulars GO | Pendent d'executar |
| `spikes/binance` | Jo l'escric; vosaltres l'executeu | Endpoints i productes amb dades | **G3**: Binance GO | Escrit, no executat |
| `spikes/wallets` | Jo l'escric; vosaltres l'executeu | Una adreça BTC i una ETH reals | **G4** | Escrit, no executat |

Els tres spikes són a `main`. Instruccions a `spikes/README.md` i passos a `NEXT_STEPS.md` §0.

Resultat: actualitzar `INTEGRATION_FEASIBILITY.md` amb les evidències (anonimitzades).

## Fase 1 — Infraestructura (no depèn de cap gate)

Ordre de treball, un PR per punt:

0. **Detecció de secrets**: gitleaks (hook de pre-commit + workflow que només fa gitleaks). S'afegeix abans del punt 4.
1. ✅ **Monorepo Nx**: `apps/web` (Angular 21, standalone, OnPush, signals), `apps/api` (NestJS), `libs/shared/types`. TS `strict`. ESLint + Prettier.
2. ✅ **Tailwind** amb prefix `t-` i tokens del tema fosc (charcoal, maragda, vermell d'alerta).
3. ✅ **Docker Compose local**: PostgreSQL + API. Sense Redis de moment. Secrets com a fitxers (Compose secrets).
4. **Prisma**: primera migració amb `users`, `households`, `memberships`, `audit_logs`.
5. **Auth**: login individual, contrasenya argon2, **TOTP 2FA**, sessió en cookie `HttpOnly` + `Secure` + `SameSite`.
6. **Aïllament de household**: guard NestJS + filtre obligatori per `household_id`, amb test.
7. **Xifratge**: servei AES-256-GCM, master key en un fitxer de secrets (`/run/secrets/*`), mai a la BD ni en variables d'entorn.
8. **CI** (GitHub Actions): lint, test, build (gitleaks ja hi és des del punt 0).
9. **Vercel**: projecte connectat al repo; deploy de `apps/web` (pantalla de login, sense dades).

**Definition of Done de la Fase 1:** els dos usuaris poden fer login amb 2FA i veuen un Overview buit a Vercel.

## Fase 2 — Domini financer (no depèn de cap gate)

Aquesta part és necessària sigui quin sigui el resultat de les integracions:

1. Model de dades complet (`NUMERIC`/`Decimal`, moneda original, snapshots immutables).
2. `ownerships` amb percentatges (validació: suma = 100%).
3. **Entrada manual**: comptes, posicions (ISIN, unitats, cost), immobles i valoracions.
4. **Hipoteca**: condicions, calendari d'amortització (sistema francès), estat `ESTIMATED` / `MANUAL_REAL`.
5. Càlcul del patrimoni net (conjunt i per membre), sense comptar res dues vegades.
6. Tests de càlcul amb casos coneguts.

Exemple de test:
```text
Habitatge 300.000 € (50/50) · Hipoteca 180.000 € (50/50) · Compte A 10.000 € (100% A)
→ Household: 130.000 €  ·  A: 70.000 €  ·  B: 60.000 €
```

## Fase 3 — Integracions (s'obre per gate)

| Integració | Requereix |
|---|---|
| Adapter Binance | G3 |
| Adapter wallets | G4 |
| Adapter Enable Banking (BBVA) | G1 (+ G2 per al membre B) |
| MyInvestor / Trade Republic cash | Spike GO |
| Sync coordinator + scheduler nocturn | 1 adapter llest |
| Actualització manual (1/24 h, controlada al backend) | Coordinator |
| Pantalla d'estat de les integracions | Coordinator |

Desplegament del backend al VPS en aquest punt (necessari per a la redirecció d'Enable Banking i la IP fixa de Binance).

## Fases 4–6

Les del handoff, sense canvis: analytics (TWR, XIRR, FX), dashboard complet i producció (backups, monitoring, revisió de seguretat).

**Gràfiques** (avançat respecte a la Fase 5, perquè no depèn de cap gate):
- Disseny ✅ a `docs/CHARTS.md`.
- Lib `libs/web/charts` + G-1 (evolució del patrimoni net) ✅, només a `/dev/charts` amb dades de prova.
- Següents: G-2/G-3 i G-4/G-5 (`NEXT_STEPS.md` §3d i §3e).

Decisions:
- SVG propi amb `d3-scale` + `d3-shape`, sense llibreria de gràfiques.
- Paleta categòrica validada sense verds ni vermells.
- Imports com a string decimal.
- Fixtures només a `/dev/charts`. Les rutes de dev s'eliminen del build de producció amb `fileReplacements`.
- L'única aritmètica d'imports al frontend és la resta exacta (`BigInt`) de la variació del rang.

Cada gràfica es connecta a l'API quan la seva fase en doni dades.

---

## Repartiment

| Vosaltres | Jo |
|---|---|
| Decisions D1–D5 | Scripts dels spikes |
| Comptes, claus i consentiments | Scaffold, codi, tests, migracions |
| Executar els spikes amb els vostres secrets | Actualitzar la documentació amb les evidències |
| Revisar i fer merge dels PRs | Un PR per tasca, amb descripció |

## Primera setmana (concret)

1. **Vosaltres:** D1–D5, crear el repo, compte a Enable Banking, enviar el correu.
2. **Jo:** pujar els docs al repo → scaffold Nx (Fase 1, punts 1–3) → scripts dels spikes.
3. **Vosaltres:** executar l'spike d'Enable Banking → em passeu el resultat anonimitzat.
