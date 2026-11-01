# Canvis de disseny proposats

> 01/11/2026, revisat amb les skills de disseny: **design-taste-frontend** (taste-skill, regles de pantalles d'app), **web-design-guidelines** (Vercel), **playwright-cli** i **web-review**. Solucions als problemes D-1…D-14 de [`ANALYSIS.md`](ANALYSIS.md) §4.
>
> **Referències HTML** (obre-les al navegador; només necessiten internet per a la lletra):
>
> - [`design/overview.html`](design/overview.html): Resum de la Fase 2 amb dades de prova.
> - [`design/overview-empty.html`](design/overview-empty.html): Resum ara, sense dades (primer ús).
> - [`design/login.html`](design/login.html): inici de sessió, codi de verificació i codis de recuperació.
> - [`design/reference.css`](design/reference.css): tokens proposats. És la font de veritat dels valors d'aquest document.
>
> Totes passen `inspect.mjs --app` de la taste-skill a 1440, 768 i 390 px: **0 FAIL**. Queden dos avisos `ragged-row` defensats a §6.

## 0. Decisions

### D6, idioma de la UI

| Opció                  | Pros                                                                                                  | Contres                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Català** (recomanat) | És la llengua dels dos usuaris. Les gràfiques ja formaten en `ca-ES` i diuen «Encara no hi ha dades». | Cal traduir les 4 pantalles actuals i els tests.  |
| Anglès                 | Ja ho és.                                                                                             | Barreja amb els formats `ca-ES` de les gràfiques. |

Sense i18n (`@angular/localize`): una sola llengua, textos directes a les plantilles. Les referències són en català, amb majúscula només a l'inici (convenció catalana; la regla de _Title Case_ de les WIG és per a l'anglès).

### Estil: `true-black-flat` (taste-skill, `draw.mjs --app`, llavor 520370458)

Tria entre els dos estils foscos que dona la skill per a `--kind finance`. El ledge és una pantalla de **consulta curta i diària** de diners d'una parella, no una sessió llarga de mercats (`data-terminal`). Es manté la paleta i la lletra del projecte (`--keep palette,type`).

El moviment de l'estil, que no s'ha de trencar:

- **Elevació només per lluminositat**: `canvas` → `surface` → `surface-raised`. Les targetes no tenen ni vora ni ombra.
- **Un sol to de dada** (`--ledge-data`, el blau de la sèrie 1) i **cap color al chrome**: ni menú, ni botons, ni pestanyes.
- **Element actiu del menú**: només el text passa de `#bbb` a `#fff`. Ni píndola de color ni barra a l'esquerra.
- **Primari per inversió**: botó blanc de 36 px amb text fosc, un per pantalla.

**Shell redibuixat** (`--redraw shell`): la skill va donar «sense barra lateral», pensat per a 3–5 destinacions. El ledge en té 8, així que s'ha triat el **marc en T**: barra lateral de 232 px i barra superior de 64 px sobre el mateix fons, separades només per regles d'1 px.

Per tornar a imprimir el full d'estil en una sessió nova (genera `.taste-skill/direction.json`, que no es puja al repo):

```bash
K=~/.claude/skills/design-taste-frontend/scripts/draw.mjs
node $K --app --kind finance --theme dark --keep palette,type --style true-black-flat --seed 520370458 \
  --screens overview,list,settings \
  --brief "ledge: patrimoni net privat d'una parella (membre A, membre B i el que és conjunt); comptes, inversions, cripto, immobles i hipoteca; molts valors manuals o estimats"
node $K --redraw shell   # → «Ruled T-frame» (provat l'01/11/2026)
```

## 1. Tokens i base (DC-1 a DC-4)

Tots a `apps/web/src/styles.css` i `tailwind.config.js`. Contrastos WCAG 2.x calculats.

### DC-1 · Tokens (D-1, D-2)

| Token                       | Ara       | Proposta              | Per què                                                                         |
| --------------------------- | --------- | --------------------- | ------------------------------------------------------------------------------- |
| `--ledge-content-muted`     | `#a1a5ad` | `#b4b4b4`             | Dos grisos que es llegeixen com a dos (regla de la skill per a foscos)          |
| `--ledge-content-subtle`    | `#71757e` | `#949494`             | 5,31:1 sobre `surface` (abans 3,49:1, sota AA)                                  |
| `--ledge-negative`          | `#e5484d` | `#f06a6e`             | 4,78:1 sobre `surface-raised` (abans 3,67:1)                                    |
| `--ledge-line-strong` (nou) | —         | `#6b6f78`             | Vores de camps: 3,2:1 sobre `surface` (WCAG 1.4.11)                             |
| `--ledge-rule` (nou)        | —         | `#26282d`             | Regles estructurals del marc                                                    |
| `--ledge-data` (nou)        | —         | `#3987e5`             | L'únic to de dada (= `--ledge-series-1`)                                        |
| `--ledge-person-a` / `-b`   | —         | `#9ec3ee` / `#eec09e` | Tints d'identitat dels dos membres (inicials). Pàl·lids i fora de les llegendes |
| `--ledge-focus` (nou)       | —         | `#8ab4f8`             | Anell de focus, 7,65:1 sobre `surface`                                          |

### DC-2 · Focus visible (D-3)

Regla global a `styles.css`: `:focus-visible { outline: 2px solid rgb(var(--ledge-focus)); outline-offset: 2px; }`. Cal treure `focus:t-outline-none` de `INPUT_CLASS` (és un antipatró de les WIG).

### DC-3 · Idioma (D-4)

Si D6 = català: `lang="ca"`, textos, `title` de les rutes i `authErrorMessage` en català. Les rutes (`/overview`…) no canvien.

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
| Sign in / Continue        | Inicia la sessió          |
| Sign out                  | Tanca la sessió           |
| Two-factor authentication | Verificació en dos passos |
| Recovery code             | Codi de recuperació       |

### DC-4 · Lletra, escala i xifres (D-5, D-12)

- **Inter carregada de debò**: autoallotjada amb `@fontsource-variable/inter` (versió fixada, `font-src 'self'`). Ara cau a la lletra del sistema, i la skill ho compta com a FAIL.
- **Escala**: 12 · 13 · 14 · 16 · 20 · 24 · 32 px. Títol de pantalla 24/600; xifra que respon la pantalla (patrimoni net) 32/600; cap xifra de 48 px o més.
- **Xifres tabulars** a tots els imports (`t-tabular-nums`), alineats a la dreta; menys amb signe tipogràfic `−`.
- **Res de majúscules espaiades** (etiquetes, capçaleres de taula, grups del menú): majúscula inicial i gris.
- `<meta name="theme-color" content="#17181b">`, `translate="no"` a la marca i als codis, `spellcheck="false"` al correu i `touch-action: manipulation` (WIG).

## 2. Pantalles d'accés (DC-5) → [`design/login.html`](design/login.html)

| Canvi                                                                                                                                                         | Font                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Marca: «L» fosca sobre un quadrat clar (SVG inline) + favicon a joc                                                                                           | taste: el producte té nom i marca               |
| Botó amb el verb de l'acció: «Inicia la sessió», no «Continue»                                                                                                | WIG: etiquetes específiques                     |
| Primari blanc en forma de píndola de 36 px; en estat ocupat, «Verificant…» + `aria-busy`                                                                      | taste (estil) + WIG («…»)                       |
| Error dins d'una caixa amb el to negatiu sobre un fons fosc del mateix to, lligat al camp amb `aria-describedby`, i amb el pas següent («d'aquí a 15 minuts») | WIG: l'error diu com arreglar-ho                |
| Codi TOTP: **un sol camp** gran i espaiat (`one-time-code`), que s'envia sol a la 6a xifra                                                                    | No es fan 6 caselles: trencarien l'autoemplenat |
| Codis de recuperació en monoespaiada (són codis literals) + «Copia els 10 codis» + casella obligatòria per continuar                                          | D-11                                            |
| Etiquetes de 14/500 a sobre del camp, camps de 40 px                                                                                                          | taste §8.1                                      |

## 3. Shell (DC-6 a DC-9) → [`design/overview.html`](design/overview.html)

### DC-6 · Barra lateral (D-6)

- 232 px, sobre el mateix fons que la pàgina (no `surface`), separada per una regla d'1 px.
- Marca i nom a dalt. Grups «Patrimoni» (Resum, Comptes, Inversions, Cripto, Immobles, Deutes) i «Activitat» (Moviments i Anàlisi, amb l'etiqueta de la fase en què tindran dades). Configuració i usuari ancorats a baix.
- Files de 34 px, icones de traç de 16 px (SVG inline). L'element actiu es marca només amb el text en blanc.
- `NAV_ITEMS` guanya `group` i `icon`.

### DC-7 · Tauleta i mòbil (D-7, D-13)

- **Per sota de 1100 px la barra lateral es plega.** Ara, a 768 px, ocupa el 31% de l'amplada, i la skill posa el límit al 30% (D-13).
- Al seu lloc, una barra superior de 56 px `sticky` (`top: env(safe-area-inset-top)`) amb un botó «Menú» que obre la navegació a pantalla completa (`overscroll-behavior: contain`). Es tanca amb Esc o amb «Tanca», i el focus torna al botó.

### DC-8 · Barra superior: frescor i household (D-8)

- A l'esquerra, l'estat de les dades: «Actualitzat avui, 06:00» + «Sincronitza», o «Cap font connectada» (amb `aria-live`).
- A la dreta, rere un divisor de tota l'alçada, el **selector de household**: les inicials de A i B amb el seu tint i el nom «Casa».

### DC-9 · Fila del títol

`h1` «Resum» a 24/600. A sota, **la troballa del dia** a 16 px gris, calculada a partir de les dades («El valor de l'habitatge (87 % dels actius) fa 92 dies que no s'actualitza»). A la dreta, l'acció més freqüent com a primari: «Actualitza un valor».

## 4. Resum (DC-10 a DC-13)

### DC-10 · Primer ús (D-9) → [`design/overview-empty.html`](design/overview-empty.html) · **ara**

Es manté el marc de la pantalla de dades, amb el valor de cada cosa:

- La columna del patrimoni net amb un **guió gris** a cada grup (un valor que falta és un guió, no «0 €») i un requadre discontinu amb «+ Afegeix un compte».
- «Posada en marxa»: barra al percentatge real (**1 de 3 · 33 %**), amb Accés segur (fet), Valors manuals (Fase 2) i Connexions automàtiques (Fase 3).
- G-1 dibuixada buida: l'eix a 0 € i una frase al seu lloc. Ni il·lustració ni «No data yet».

### DC-11 · Xip d'origen de la dada (D-10)

`ledge-source-chip`, diferenciat per **forma i text**, mai per color: Automàtic (punt ple), Manual (cercle buit), Estimat (cercle discontinu). Va a la targeta de la hipoteca, a «Per revisar» i a les taules de detall.

### DC-12 · Resum de la Fase 2 → [`design/overview.html`](design/overview.html)

Patró `finance home with a pinned accounts column` de la skill, adaptat al ledge:

- **Columna fixa de 306 px**: «Patrimoni net» (32 px, la xifra més gran de la pantalla) amb la variació («+2.340,00 € des del 30 de set.») i l'**arbre de comptes**: grups amb el total i comptes en gris, sense separadors. Al mòbil, només els grups.
- **G-1**: una sola sèrie (household), en el to de dada, amb farcit pla al 12%, sense marcadors, 5 línies de graella i el màxim per sobre de la dada. Anotació a l'esdeveniment («Habitatge revalorat»), cursor amb ratolí i teclat (← → Esc) i rang `1M · 6M · 1A · Tot`.
- **«Qui té què»: l'element propi del ledge.** Tres franges, **Membre A · Conjunt · Membre B**, amb els actius de cadascú, el repartiment del conjunt (50 % / 50 % → 49.100,00 € per cap) i el total de cada persona. Substitueix la vista «Per membre» de la G-1 (dues línies) i treu un to del gràfic.
- **«Per revisar»**: els valors manuals més antics (3 files + «Veure'ls tots»), cadascun amb el seu botó «Actualitza». És la feina més freqüent d'aquesta pantalla.
- **Hipoteca**: barra de capital pagat amb els dos extrems etiquetats, pendent, propera quota i capital · interès, amb el xip «Estimat».

Les dades de prova quadren (les comprova `console.assert`): actius 309.670,19 € − hipoteca 179.670,19 € = **130.000,00 €** = A 70.000,00 € + B 60.000,00 €. La quota (948,42 €) surt del sistema francès per a 200.000 € a 25 anys al 3%.

### DC-13 · Canvis a `docs/CHARTS.md`

Ho proposa la taste-skill; s'ha d'aplicar al PR de cada gràfica:

- **G-1**: per defecte, una sola sèrie. La vista per membre la fa «Qui té què».
- **G-2**: una barra apilada de 4 tons és un «arc de Sant Martí». A l'Overview, la distribució ja surt a l'arbre de comptes. Si es fa la gràfica, que sigui una llista ordenada amb barres primes grises, amb la primera en tinta.
- **G-3**: no hi ha fila de KPI. Cada xifra va a la targeta que l'explica.
- **Paleta**: el violeta (`--ledge-series-3`, `#9085e9`) xoca amb la regla de la skill (res de violeta). Cal canviar-lo i tornar a validar la paleta abans de dibuixar 3 sèries o més.

## 5. Pla d'implementació

| PR  | Abast                                                                       | Depèn de |
| --- | --------------------------------------------------------------------------- | -------- |
| 1   | DC-1, DC-2, DC-4 (tokens, focus, lletra, escala). Sense canvis de text      | —        |
| 2   | DC-3 + DC-5 (idioma i pantalles d'accés)                                    | D6       |
| 3   | DC-6 a DC-9 (shell, inclosa la barra plegada a tauleta) + DC-10 (primer ús) | PR 2     |
| 4   | DC-11 (xip d'origen) i DC-13 (ajustos a `docs/CHARTS.md`)                   | —        |
| 5   | DC-12 connectat a l'API                                                     | Fase 2   |

Cada PR: tests dels components afectats; `inspect.mjs --app` i `lint.mjs --app` de la taste-skill a 1440/768/390 sense FAIL; revisió amb `web-design-guidelines`; captures abans/després a la descripció; `npx nx run-many -t lint test build` i `npx prettier --check .`.

## 6. Avisos defensats

| Avís             | On                    | Per què es manté                                                                                   |
| ---------------- | --------------------- | -------------------------------------------------------------------------------------------------- |
| `ragged-row`     | `login.html`          | Les tres targetes són tres estats diferents posats l'un al costat de l'altre, no una fila de l'app |
| `ragged-row`     | `overview-empty.html` | La columna fixa és més curta perquè encara no hi ha comptes; quan n'hi hagi, s'allarga             |
| `em-dash` (lint) | `overview-empty.html` | Són valors que falten. La regla d'app demana justament un guió gris                                |
