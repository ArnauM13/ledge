# Canvis de disseny proposats

> 01/11/2026. Solucions als problemes D-1…D-12 de [`ANALYSIS.md`](ANALYSIS.md) §4.
> **Referències HTML** (obre-les al navegador, no necessiten servidor):
>
> - [`design/login.html`](design/login.html): login, codi de verificació i codis de recuperació.
> - [`design/overview.html`](design/overview.html): shell nou, Resum sense dades (ara) i Resum de la Fase 2 (amb dades de prova).
> - [`design/reference.css`](design/reference.css): tokens proposats. És la font de veritat dels valors d'aquest document.
>
> Les referències són HTML i CSS sense Angular ni Tailwind. Mostren **què** ha de veure's; la implementació va a `apps/web` amb Tailwind `t-` i tokens.

## 0. Decisió prèvia: D6, idioma de la UI

| Opció                  | Pros                                                                                                  | Contres                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Català** (recomanat) | És la llengua dels dos usuaris. Les gràfiques ja formaten en `ca-ES` i diuen «Encara no hi ha dades». | Cal traduir les 4 pantalles actuals i els tests.  |
| Anglès                 | Ja ho és. Termes financers coneguts (Overview, Liabilities).                                          | Barreja amb els formats `ca-ES` de les gràfiques. |

Sense i18n (`@angular/localize`): una sola llengua, textos directes a les plantilles. Les referències són en català.

## 1. Tokens i base (DC-1 a DC-4)

Tots a `apps/web/src/styles.css` i `tailwind.config.js`. Contrastos calculats amb WCAG 2.x.

### DC-1 · Contrast dels tokens (D-1, D-2)

| Token                       | Ara       | Proposta  | Contrast nou                                   |
| --------------------------- | --------- | --------- | ---------------------------------------------- |
| `--ledge-content-subtle`    | `#71757e` | `#8b8f98` | 4,98:1 sobre `surface` (abans 3,49:1)          |
| `--ledge-negative`          | `#e5484d` | `#f06a6e` | 4,78:1 sobre `surface-raised` (abans 3,67:1)   |
| `--ledge-line-strong` (nou) | —         | `#6b6f78` | 3,2:1 sobre `surface`: vores de camps i botons |
| `--ledge-line`              | `#34373d` | igual     | Només separadors decoratius                    |

`positive` (`#34a878`) ja passa: 5,39:1 sobre `surface`.

Exemple a Tailwind: `INPUT_CLASS` passa de `t-border-line` a `t-border-line-strong`.

### DC-2 · Focus visible (D-3)

- Token nou `--ledge-focus: #8ab4f8` (blau clar, 7,65:1 sobre `surface`). No és cap color de sèrie ni semàntic.
- Regla global a `styles.css`:

```css
:focus-visible {
  outline: 2px solid rgb(var(--ledge-focus));
  outline-offset: 2px;
}
```

- Treure `focus:t-outline-none` de `INPUT_CLASS`.

### DC-3 · Idioma (D-4)

Si D6 = català: `index.html` amb `lang="ca"`, textos de les pantalles i dels `title` de les rutes en català, i `authErrorMessage` traduït. Glossari per mantenir la coherència:

| Ara                       | Proposta                  |
| ------------------------- | ------------------------- |
| Overview                  | Resum                     |
| Accounts                  | Comptes                   |
| Investments               | Inversions                |
| Crypto                    | Cripto                    |
| Real Estate               | Immobles                  |
| Liabilities               | Deutes                    |
| Transactions              | Moviments                 |
| Analytics                 | Anàlisi                   |
| Settings                  | Configuració              |
| Sign in                   | Inicia la sessió          |
| Sign out                  | Tanca la sessió           |
| Two-factor authentication | Verificació en dos passos |
| Recovery code             | Codi de recuperació       |

Les rutes (`/overview`, `/accounts`…) **no** canvien: són identificadors.

### DC-4 · Lletra i escala (D-5, D-12)

- **Inter autoallotjada** amb `@fontsource-variable/inter` (versió fixada; cap petició a Google: la CSP pot quedar `font-src 'self'`). Alternativa sense dependència: treure Inter i fer servir només la pila del sistema.
- `font-variant-numeric: tabular-nums` a tots els imports (classe `t-tabular-nums`).
- Escala fixa: 12 (etiquetes), 14 (cos), 16, 18 (títol de targeta), 24 (títol de pàgina), 36 (xifra principal). Res fora d'aquesta escala.

## 2. Pantalles d'accés (DC-5) → [`design/login.html`](design/login.html)

| Canvi                                                                                                                        | Per què                                                        |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Marca: «L» dins d'un quadrat arrodonit (SVG inline) + favicon a joc                                                          | D-12. Substitueix la icona del generador                       |
| Subtítol «Accés privat de la household» i peu «Sense registre públic · Verificació en dos passos obligatòria»                | Explica per què no hi ha «Crea un compte»                      |
| Error en caixa amb icona i vora vermella al 45%                                                                              | Es veu més que una línia de text vermell                       |
| Botó en estat ocupat: text «Verificant…» + `aria-busy`                                                                       | Ara només es desactiva, sense feedback                         |
| Codi TOTP: **un sol camp** gran, monoespaiat i espaiat, que s'envia sol a la 6a xifra                                        | No fem 6 caselles: trencarien l'autoemplenat (`one-time-code`) |
| Codis de recuperació en una columna monoespaiada + botó «Copia els codis» + casella «Els he desat» obligatòria per continuar | D-11                                                           |

## 3. Shell (DC-6 a DC-9) → [`design/overview.html`](design/overview.html)

### DC-6 · Navegació agrupada (D-6)

```text
PATRIMONI   Resum · Comptes · Inversions · Cripto · Immobles · Deutes
ACTIVITAT   Moviments (Fase 3) · Anàlisi (Fase 4)
(a baix)    Configuració
```

- Icones de traç de 16px (SVG inline, sense llibreria d'icones).
- Les seccions sense dades fins a una fase posterior porten l'etiqueta discreta de la fase.
- Element actiu: fons `surface-raised` + línia interior de 2px a l'esquerra en `content`. No depèn només del color.
- `NAV_ITEMS` guanya `group` i `icon`; l'ordre continua sent el del fitxer.

### DC-7 · Menú mòbil (D-7)

- Calaix lateral **sobreposat** (no empeny el contingut) amb fons fosc al darrere.
- Es tanca amb Esc, tocant fora o en navegar. Focus al primer enllaç en obrir i tornada al botó en tancar.
- Barra superior `sticky` amb `top: env(safe-area-inset-top)`.

### DC-8 · Household i usuari (D-8)

- Bloc de household a dalt: nom (`Casa`) i «Household · 2 membres». Quan hi hagi més d'una household, serà un selector.
- Usuari ancorat a baix: avatar amb la inicial, nom i «Tanca la sessió».

### DC-9 · Capçalera de pàgina

Títol a l'esquerra; a la dreta, l'estat de les dades: «Cap font connectada» ara, «Actualitzat el 31 d'oct. de 2026, 06:00» quan hi hagi sync.

## 4. Resum (DC-10 a DC-13) → [`design/overview.html`](design/overview.html)

### DC-10 · Estat buit guiat (D-9) · **ara**

En lloc de «No data yet», una llista del que falta perquè hi hagi xifres:

| Pas                                   | Estat  |
| ------------------------------------- | ------ |
| Accés segur                           | Fet    |
| Entrada manual de comptes i posicions | Fase 2 |
| Connexions automàtiques               | Fase 3 |

Les altres seccions fan servir el mateix component amb un text propi (p. ex. Deutes: «La hipoteca apareixerà aquí quan n'introdueixis les condicions»). Cap xifra inventada.

### DC-11 · Xip d'origen de la dada (D-10)

Component `ledge-source-chip` amb tres valors, diferenciats per **forma i text**, mai pel verd/vermell:

| Valor     | Marca             | Quan                                                   |
| --------- | ----------------- | ------------------------------------------------------ |
| Automàtic | punt ple          | BBVA, Binance, wallets (Fase 3)                        |
| Manual    | cercle buit       | MyInvestor, Trade Republic, immobles, NAV              |
| Estimat   | cercle discontinu | Hipoteca (calendari francès), punts `ESTIMATED` de G-1 |

Es fa servir a les taules, als KPI i al panell «Fonts de dades». Compleix el requisit d'`INTEGRATION_FEASIBILITY.md` d'etiquetar el que no és automàtic.

### DC-12 · KPI + G-1 · **Fase 2**

- Tres indicadors: **Patrimoni net** (xifra de 36px + variació de 30 dies amb signe i color), **Actius** i **Deute viu** (amb xip «Estimat»). Coherent amb G-3 de `docs/CHARTS.md`.
- G-1 a sota, amb el selector Household / Per membre i el de rang `1M · 6M · 1A · Tot`, tram estimat discontinu, etiqueta al darrer punt i «Veure com a taula». Tot segons `docs/CHARTS.md`.

### DC-13 · Distribució i fonts de dades · **Fase 2–3**

- G-2 (barra apilada + taula amb el xip d'origen) i un panell «Fonts de dades» amb l'antiguitat de cada valor («fa 12 dies»), perquè es vegi quan cal actualitzar una entrada manual.
- El segell **«Dades de prova»** (vora discontínua) només a `/dev`.

Les xifres de la referència són fixtures coherents amb el cas de test de la Fase 2 (patrimoni 130.000 €, A 70.000 €, B 60.000 €, deute 180.000 €).

## 5. Pla d'implementació

| PR  | Abast                                                                   | Depèn de |
| --- | ----------------------------------------------------------------------- | -------- |
| 1   | DC-1, DC-2, DC-4 (tokens, focus, lletra, escala). Sense canvis de text. | —        |
| 2   | DC-3 + DC-5 (idioma i pantalles d'accés)                                | D6       |
| 3   | DC-6 a DC-9 (shell) + DC-10 (estat buit guiat)                          | PR 2     |
| 4   | DC-11 (xip d'origen) a `libs/web/charts` o a una lib `libs/web/ui`      | —        |
| 5   | DC-12, DC-13 connectats a l'API                                         | Fase 2   |

Cada PR: tests de components afectats, captura abans/després a la descripció i `npx nx run-many -t lint test build` + `npx prettier --check .`.
